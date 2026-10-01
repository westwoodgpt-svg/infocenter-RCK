// Сервер инфоцентра для собственного хостинга — замена Vercel.
//
// Те же обработчики, что работали serverless-функциями Vercel (api/*.js),
// здесь подключены к обычному Express-приложению: у них одинаковый интерфейс
// (req.body уже разобран, res.status().json()). Фронтенд раздаётся из dist/
// тем же api/serve.js — он же ловит POST-открытие приложения из Битрикс24.
//
// Запуск: npm run build && npm start (порт — PORT, по умолчанию 3000).
// Переменные окружения — см. deploy/infocenter-rck.env.example.
import express from 'express';
import { execSync } from 'node:child_process';
import { join } from 'node:path';

import dashboard from '../api/dashboard.js';
import saveDashboard from '../api/save-dashboard.js';
import bitrixStatus from '../api/bitrix-status.js';
import showcaseUpload from '../api/showcase-upload.js';
import showcaseFile, { MAX_FILE_BYTES } from '../api/showcase-file.js';
import serve from '../api/serve.js';
import bx24Sdk from '../api/bx24-sdk.js';

if (!process.env.DEPLOYED_COMMIT) {
  try {
    process.env.DEPLOYED_COMMIT = execSync('git rev-parse HEAD', { cwd: join(import.meta.dirname, '..') })
      .toString()
      .trim();
  } catch {
    // не git-копия — просто не покажем коммит в /api/bitrix-status
  }
}

const app = express();
app.disable('x-powered-by');
// За nginx: настоящий адрес и протокол клиента берём из его заголовков.
app.set('trust proxy', 'loopback');

// Обёртка: ошибка внутри обработчика не должна ронять весь сервер.
const route = (handler) => async (req, res) => {
  try {
    await handler(req, res);
  } catch (err) {
    console.error(`[${req.method} ${req.path}]`, err);
    if (!res.headersSent) res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
};

const json = express.json({ limit: '8mb' });
// Битрикс24 открывает приложение POST-формой (AUTH_ID, REFRESH_ID, …).
const form = express.urlencoded({ extended: true, limit: '1mb' });

app.all('/api/dashboard', json, route(dashboard));
app.all('/api/save-dashboard', json, route(saveDashboard));
app.all('/api/bitrix-status', route(bitrixStatus));
app.get('/api/bx24-sdk', route(bx24Sdk));
app.all('/api/showcase-upload', json, route(showcaseUpload));
app.all(
  '/api/showcase-file',
  express.raw({ type: () => true, limit: MAX_FILE_BYTES }),
  route(showcaseFile)
);

// Вложения витрины, загруженные на диск сервера (api/showcase-file.js).
if (process.env.UPLOAD_DIR) {
  app.use(
    '/uploads',
    express.static(process.env.UPLOAD_DIR, {
      index: false,
      dotfiles: 'deny',
      maxAge: '30d',
      immutable: true, // имя файла со случайным префиксом никогда не меняется
      setHeaders(res) {
        res.setHeader('X-Content-Type-Options', 'nosniff');
      },
    })
  );
  // Такого файла нет — 404, а не страница приложения.
  app.use('/uploads', (req, res) => res.status(404).send('not found'));
}

// Всё остальное — фронтенд из dist/ на любой метод (как маршрут "/(.*)" в vercel.json).
app.all('*', form, json, route(serve));

const port = Number(process.env.PORT) || 3000;
const host = process.env.HOST || '127.0.0.1';
app.listen(port, host, () => {
  console.log(`infocenter-rck: http://${host}:${port} (commit ${process.env.DEPLOYED_COMMIT || 'неизвестен'})`);
});
