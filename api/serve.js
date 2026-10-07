// Vercel Serverless Function — раздаёт собранный dist/ для ЛЮБОГО HTTP-метода.
// Битрикс24 открывает локальное приложение POST-запросом (передаёт токен
// авторизации во внутренний iframe); обычная статическая раздача Vercel/CDN
// отвечает на POST ошибкой 405, поэтому здесь принудительно отдаём файл
// напрямую из функции.
import { readFileSync, existsSync, statSync } from 'fs';
import { createHash } from 'crypto';
import { join, extname, normalize } from 'path';
import { maybeCaptureServiceToken } from './_bitrixAuth.js';

const DIST = join(process.cwd(), 'dist');

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.ico': 'image/x-icon',
};

export default async function handler(req, res) {
  if (req.method === 'POST') {
    // Битрикс24 открывает локальные приложения POST-запросом с AUTH_ID/REFRESH_ID
    // открывшего пользователя. Если это администратор портала — обновляем
    // сервисный токен для api/save-dashboard.js (см. _bitrixAuth.js).
    //
    // ВАЖНО: 1) обязательно дожидаемся (await) этой обработки перед отправкой
    // ответа — serverless-функция Vercel замораживается сразу после отправки
    // HTTP-ответа, необождённый промис просто не успевает выполниться.
    // 2) НЕ читаем req как сырой поток (req.on('data')) — Vercel уже разобрал
    // тело в req.body до вызова этого обработчика и «слил» исходный поток,
    // поэтому попытка читать его вручную всегда возвращала бы пустую строку.
    try {
      const body = req.body || {};
      const params = typeof body === 'string' ? Object.fromEntries(new URLSearchParams(body)) : body;
      await maybeCaptureServiceToken(
        {
          authId: params.AUTH_ID,
          refreshId: params.REFRESH_ID,
        },
        Object.keys(params)
      );
    } catch (err) {
      console.error('[bitrix] serve.js POST handling failed:', err instanceof Error ? err.message : err);
    }
  }

    const host = req.headers.host || 'localhost';
    const url = new URL(req.url, `http://${host}`);
    let pathname = normalize(decodeURIComponent(url.pathname));

  if (pathname === '/' || pathname === '.') pathname = '/index.html';

  let filePath = join(DIST, pathname);

  if (!filePath.startsWith(DIST) || !existsSync(filePath)) {
        filePath = join(DIST, 'index.html');
  }

  const ext = extname(filePath);
  const { body, etag } = fileWithEtag(filePath);
  res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
  // Имена файлов сборки постоянные (assets/index.js), поэтому браузер должен
  // каждый раз спрашивать, не изменился ли файл. Не изменился — короткий 304,
  // изменился после выкладки — получит новый без Ctrl+F5.
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('ETag', etag);
  if ((req.method === 'GET' || req.method === 'HEAD') && req.headers['if-none-match'] === etag) {
    res.status(304).end();
    return;
  }
  res.status(200).send(body);
}

// ETag по содержимому; пересчитываем, только если файл поменялся на диске.
const etagCache = new Map();
function fileWithEtag(filePath) {
  const { mtimeMs, size } = statSync(filePath);
  const cached = etagCache.get(filePath);
  if (cached && cached.mtimeMs === mtimeMs && cached.size === size) return cached;
  const body = readFileSync(filePath);
  const entry = { mtimeMs, size, body, etag: `"${createHash('sha1').update(body).digest('hex').slice(0, 20)}"` };
  etagCache.set(filePath, entry);
  return entry;
}
