// Загрузка вложений стикеров витрины на диск своего сервера (без Vercel Blob).
//
// Работает, когда задана переменная UPLOAD_DIR (так запускается server/index.js
// на собственном сервере). Браузер отправляет файл одним запросом «как есть»,
// с токеном Битрикс24 в заголовках; сервер проверяет сессию и кладёт файл в
// UPLOAD_DIR под случайным именем. Раздаёт файлы server/index.js по /uploads/.
import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { resolveIdentity } from './_access.js';
import { readCookie, readSession, sameOrigin, SESSION_COOKIE } from './_standalone.js';

export const MAX_FILE_BYTES = 50 * 1024 * 1024;

export const diskUploadsEnabled = () => Boolean(process.env.UPLOAD_DIR);

// Кириллицу оставляем — файл узнаваем на диске; убираем только то, что
// ломает путь или URL.
function safeName(name) {
  const cleaned = String(name || '')
    .replace(/[\\/?#%*:|"<>\x00-\x1f]+/g, '-')
    .replace(/\s+/g, '_')
    .replace(/^\.+/, '')
    .slice(-120);
  return cleaned || 'file';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'method not allowed' });
    return;
  }
  if (!diskUploadsEnabled()) {
    res.status(503).json({ ok: false, error: 'загрузка файлов на сервер не настроена (UPLOAD_DIR)' });
    return;
  }

  // В портале — токен Битрикс24 в заголовках, в отдельном окне — cookie
  // сессии (с проверкой Origin, см. api/_standalone.js).
  const accessToken = req.headers['x-bx-access-token'];
  const domain = req.headers['x-bx-domain'];
  let identity = null;
  if (accessToken && domain) {
    identity = await resolveIdentity({ accessToken: String(accessToken), domain: String(domain) }).catch(() => null);
    if (!identity) {
      res.status(403).json({ ok: false, error: 'сессия Битрикс24 недействительна — обновите страницу' });
      return;
    }
  } else if (readCookie(req, SESSION_COOKIE)) {
    if (!sameOrigin(req)) {
      res.status(403).json({ ok: false, error: 'запрос пришёл не со страницы инфоцентра' });
      return;
    }
    const session = await readSession(req).catch(() => null);
    if (!session) {
      res.status(401).json({ ok: false, code: 'standalone-session-expired', error: 'сессия отдельного окна истекла' });
      return;
    }
    identity = session.identity;
  } else {
    res.status(400).json({ ok: false, error: 'отсутствует авторизация Битрикс24' });
    return;
  }

  const body = req.body;
  if (!Buffer.isBuffer(body) || !body.length) {
    res.status(400).json({ ok: false, error: 'пустой файл' });
    return;
  }
  if (body.length > MAX_FILE_BYTES) {
    res.status(413).json({ ok: false, error: 'файл больше 50 МБ' });
    return;
  }

  let original = '';
  try {
    original = decodeURIComponent(String(req.query && req.query.name ? req.query.name : ''));
  } catch {
    original = String((req.query && req.query.name) || '');
  }

  try {
    // Случайный префикс: ссылку нельзя угадать по имени файла, а одинаковые
    // имена не затирают друг друга.
    const fileName = `${randomBytes(12).toString('hex')}-${safeName(original)}`;
    const dir = process.env.UPLOAD_DIR;
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, fileName), body);
    res.status(200).json({ ok: true, url: `/uploads/${encodeURIComponent(fileName)}` });
  } catch (err) {
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
}
