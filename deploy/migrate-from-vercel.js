// Перенос данных инфоцентра с Vercel на свой сервер.
//
// 1. Копирует все ключи `rck:*` из Redis, которым пользовался Vercel
//    (OLD_REDIS_URL), в Redis этого сервера (REDIS_URL) — с типами и сроками
//    жизни. Ключи другого приложения (например, `iic:*` инфоцентра ИИЦ, если
//    база общая) не трогаются.
// 2. Вложения витрины, лежащие в Vercel Blob, скачивает в UPLOAD_DIR и
//    переписывает ссылки на /uploads/… — в самой витрине и в её истории.
//
// Запуск — через deploy/migrate.sh (он подставляет /etc/infocenter-rck.env).
// По умолчанию отказывается перезаписывать непустой Redis этого сервера,
// чтобы не затереть правки, сделанные уже здесь; --force снимает запрет.
import Redis from 'ioredis';
import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const PATTERN = 'rck:*';
// Кэш сессий сотрудников — временный, переносить незачем.
const SKIP = [/^rck:identity:/];
const BLOB_URL_RE = /https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\/[^"\s]+/gi;
const SHOWCASE_CURRENT = 'rck:board:showcase:current';

const force = process.argv.includes('--force');
const { OLD_REDIS_URL, REDIS_URL, UPLOAD_DIR } = process.env;
if (!OLD_REDIS_URL || !REDIS_URL) {
  console.error('Нужны OLD_REDIS_URL (Redis Vercel) и REDIS_URL (Redis этого сервера).');
  process.exit(1);
}
if (OLD_REDIS_URL === REDIS_URL) {
  console.error('OLD_REDIS_URL и REDIS_URL совпадают — переносить некуда.');
  process.exit(1);
}

const source = new Redis(OLD_REDIS_URL, { maxRetriesPerRequest: 3 });
const target = new Redis(REDIS_URL, { maxRetriesPerRequest: 3 });

async function scanAll(client, pattern) {
  const keys = [];
  let cursor = '0';
  do {
    const [next, batch] = await client.scan(cursor, 'MATCH', pattern, 'COUNT', 500);
    cursor = next;
    keys.push(...batch);
  } while (cursor !== '0');
  return keys;
}

async function copyKey(key) {
  const type = await source.type(key);
  const ttl = await source.pttl(key);
  const multi = target.multi().del(key);
  if (type === 'string') {
    multi.set(key, await source.getBuffer(key));
  } else if (type === 'list') {
    const items = await source.lrangeBuffer(key, 0, -1);
    if (items.length) multi.rpush(key, ...items);
  } else if (type === 'hash') {
    const hash = await source.hgetallBuffer(key);
    if (Object.keys(hash).length) multi.hset(key, hash);
  } else if (type === 'set') {
    const members = await source.smembersBuffer(key);
    if (members.length) multi.sadd(key, ...members);
  } else if (type === 'zset') {
    const flat = await source.zrangeBuffer(key, 0, -1, 'WITHSCORES');
    const args = [];
    for (let i = 0; i < flat.length; i += 2) args.push(flat[i + 1].toString(), flat[i]);
    if (args.length) multi.zadd(key, ...args);
  } else {
    return false; // ключ исчез или неизвестный тип
  }
  if (ttl > 0) multi.pexpire(key, ttl);
  await multi.exec();
  return true;
}

async function copyRedis() {
  const existing = (await scanAll(target, 'rck:board:*')).length;
  if (existing && !force) {
    console.error(
      `В Redis этого сервера уже есть данные инфоцентров (${existing} ключей). ` +
        'Чтобы перезаписать их данными с Vercel, запустите с FORCE=1.'
    );
    process.exit(2);
  }
  const keys = (await scanAll(source, PATTERN)).filter((k) => !SKIP.some((re) => re.test(k)));
  let copied = 0;
  for (const key of keys) {
    if (await copyKey(key)) copied += 1;
    if (copied && copied % 200 === 0) console.log(`  …${copied} из ${keys.length}`);
  }
  console.log(`Redis: перенесено ключей — ${copied}.`);
}

function safeName(url) {
  let name = 'file';
  try {
    name = decodeURIComponent(new URL(url).pathname.split('/').pop() || 'file');
  } catch {
    // остаётся 'file'
  }
  return name.replace(/[\\/?#%*:|"<>\x00-\x1f]+/g, '-').replace(/\s+/g, '_').slice(-120) || 'file';
}

async function moveBlobFiles() {
  const raw = await target.get(SHOWCASE_CURRENT);
  const urls = new Set(raw ? raw.match(BLOB_URL_RE) || [] : []);
  if (!urls.size) {
    console.log('Вложений витрины в Vercel Blob нет — скачивать нечего.');
    return;
  }
  if (!UPLOAD_DIR) {
    console.warn('UPLOAD_DIR не задан — вложения остаются в Vercel Blob (ссылки продолжат работать, пока жив Blob).');
    return;
  }
  await mkdir(UPLOAD_DIR, { recursive: true });
  const replacements = new Map();
  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const fileName = `${randomBytes(12).toString('hex')}-${safeName(url)}`;
      await writeFile(join(UPLOAD_DIR, fileName), Buffer.from(await res.arrayBuffer()));
      replacements.set(url, `/uploads/${encodeURIComponent(fileName)}`);
    } catch (err) {
      console.warn(`  не удалось скачать ${url}: ${err instanceof Error ? err.message : err} — ссылка остаётся как была`);
    }
  }
  if (!replacements.size) return;

  const rewrite = (text) => {
    let out = text;
    for (const [from, to] of replacements) out = out.split(from).join(to);
    return out;
  };
  // Текущая витрина, снимки для слияния правок и история стикеров.
  const keys = [SHOWCASE_CURRENT, ...(await scanAll(target, 'rck:board:showcase:snap:*'))];
  for (const key of keys) {
    const value = await target.get(key);
    if (!value) continue;
    const ttl = await target.pttl(key);
    const next = rewrite(value);
    if (next === value) continue;
    if (ttl > 0) await target.set(key, next, 'PX', ttl);
    else await target.set(key, next);
  }
  for (const key of await scanAll(target, 'rck:card-history:showcase:*')) {
    const items = await target.lrange(key, 0, -1);
    const next = items.map(rewrite);
    if (next.every((v, i) => v === items[i])) continue;
    await target.multi().del(key).rpush(key, ...next).exec();
  }
  console.log(`Vercel Blob: скачано файлов — ${replacements.size} из ${urls.size}, ссылки переписаны.`);
}

try {
  await copyRedis();
  await moveBlobFiles();
  console.log('Перенос завершён.');
} catch (err) {
  console.error('Перенос прервался:', err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  source.disconnect();
  target.disconnect();
}
