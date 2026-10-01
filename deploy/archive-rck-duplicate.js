// Убрать дубль «Инфоцентра РЦК» — инфоцентр отдела РЦК (dept-<id>), который
// 07.09.2026 создала разовая копия (api/_seedCopy.js, теперь отключена).
//
// Ничего не удаляет и не сливает. Сначала сверяет карточки дубля с рабочим
// инфоцентром rck и печатает отчёт:
//   • совпадает     — такая же карточка есть в rck;
//   • отличается    — карточка с тем же id есть в rck, но её с тех пор правили
//                     (в rck более поздняя версия);
//   • только в дубле — карточки в rck нет (удалили после копии). Эти карточки
//                     нужно просмотреть глазами: в rck они не попадут сами.
// С --apply переименовывает все ключи дубля в архив
// rck:archive:dept-<id>:<дата>:… (данные, снимки, история карточек).
//
//   set -a; . /etc/infocenter-rck.env; set +a
//   node deploy/archive-rck-duplicate.js            # только отчёт
//   node deploy/archive-rck-duplicate.js --apply    # отчёт + архивация
// Отдел — INFOCENTER_RCK_DEPARTMENT_ID или --dept=<id> (по умолчанию 115).
import Redis from 'ioredis';
import { writeFile } from 'node:fs/promises';

const TABS = ['security', 'quality', 'production', 'costs', 'personnel'];
const apply = process.argv.includes('--apply');
const deptArg = process.argv.find((a) => a.startsWith('--dept='));
const dept = (deptArg ? deptArg.slice(7) : process.env.INFOCENTER_RCK_DEPARTMENT_ID || '115').trim();
const date = new Date().toISOString().slice(0, 10);

if (!process.env.REDIS_URL) {
  console.error('Нужен REDIS_URL (set -a; . /etc/infocenter-rck.env; set +a).');
  process.exit(1);
}
const redis = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 3 });

const DUP = `rck:board:dept-${dept}:current`;
const MAIN = 'rck:board:rck:current';
const archiveKey = (key) => `rck:archive:dept-${dept}:${date}:${key.replace(`rck:board:dept-${dept}:`, '').replace(`rck:card-history:dept-${dept}:`, 'card-history:')}`;

async function scanAll(pattern) {
  const keys = [];
  let cursor = '0';
  do {
    const [next, batch] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 500);
    cursor = next;
    keys.push(...batch);
  } while (cursor !== '0');
  return keys;
}

const label = (c) => `${c.title || '(без заголовка)'} [${c.type}, id ${c.id}]`;

try {
  const dupRaw = await redis.get(DUP);
  if (!dupRaw) {
    console.log(`Ключа ${DUP} нет — дубля нет или он уже в архиве.`);
    process.exit(0);
  }
  const mainRaw = await redis.get(MAIN);
  if (!mainRaw) {
    console.error(`Нет рабочего инфоцентра ${MAIN} — архивировать дубль нельзя, разберитесь сначала.`);
    process.exit(2);
  }
  const dup = JSON.parse(dupRaw);
  const main = JSON.parse(mainRaw);
  const count = (st) => TABS.reduce((a, t) => a + ((st && st[t]) || []).length, 0);
  console.log(`Рабочий «Инфоцентр РЦК» (${MAIN}): версия ${main.rev}, карточек ${count(main.state)}, правка ${main.updatedAt || '—'}`);
  console.log(`Дубль (${DUP}): версия ${dup.rev}, карточек ${count(dup.state)}, правка ${dup.updatedAt || '—'}\n`);

  const report = { at: new Date().toISOString(), dept, same: [], changed: [], onlyInDuplicate: [] };
  for (const tab of TABS) {
    const mainById = new Map(((main.state || {})[tab] || []).map((c) => [c.id, c]));
    // Карточку могли перенести на другую вкладку — ищем и по всем вкладкам.
    const anyTab = new Map(TABS.flatMap((t) => ((main.state || {})[t] || []).map((c) => [c.id, c])));
    for (const card of (dup.state || {})[tab] || []) {
      const twin = mainById.get(card.id) || anyTab.get(card.id);
      const entry = { tab, id: card.id, type: card.type, title: card.title || '' };
      if (!twin) report.onlyInDuplicate.push(entry);
      else if (JSON.stringify(twin) === JSON.stringify(card)) report.same.push(entry);
      else report.changed.push(entry);
    }
  }

  console.log(`Совпадает с РЦК: ${report.same.length}`);
  console.log(`Есть в РЦК, но там правили позже: ${report.changed.length}`);
  for (const e of report.changed) console.log(`  · ${e.tab}: ${label(e)}`);
  console.log(`ТОЛЬКО В ДУБЛЕ (в РЦК нет): ${report.onlyInDuplicate.length}`);
  for (const e of report.onlyInDuplicate) console.log(`  ! ${e.tab}: ${label(e)}`);
  if (report.onlyInDuplicate.length) {
    console.log('\n  Эти карточки в «Инфоцентр РЦК» сами не попадут. Они останутся в архиве;');
    console.log('  если какие-то нужны — восстановите их вручную (или через историю карточек РЦК).');
  }

  const reportFile = `/var/lib/infocenter-rck/rck-duplicate-report-${date}.json`;
  await writeFile(reportFile, JSON.stringify(report, null, 1)).catch(() => {});
  console.log(`\nОтчёт: ${reportFile}`);

  if (!apply) {
    console.log('\nЭто был только отчёт. Чтобы перенести дубль в архив: добавьте --apply.');
    process.exit(0);
  }

  const keys = [DUP, ...(await scanAll(`rck:board:dept-${dept}:*`)), ...(await scanAll(`rck:card-history:dept-${dept}:*`))];
  let moved = 0;
  for (const key of [...new Set(keys)]) {
    const target = archiveKey(key);
    // RENAMENX: если такой архивный ключ уже есть, ничего не затираем.
    const ok = await redis.renamenx(key, target).catch(() => 0);
    if (ok) {
      await redis.persist(target).catch(() => {});
      moved += 1;
    } else if (await redis.exists(key)) {
      console.warn(`  не перенесён (архивный ключ уже есть): ${key}`);
    }
  }
  console.log(`\nВ архив перенесено ключей: ${moved} → rck:archive:dept-${dept}:${date}:*`);
  console.log('Вернуть обратно: RENAME rck:archive:dept-' + dept + ':' + date + ':current ' + DUP);
} catch (err) {
  console.error('Ошибка:', err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  redis.disconnect();
}
