// Копия JS-SDK Битрикс24 (https://api.bitrix24.com/api/v1/) с нашего домена.
//
// Браузер сотрудника сначала берёт SDK с api.bitrix24.com; если тот не
// загрузился (блокировщик, фильтр сети, медленное соединение), приложение
// пробует этот адрес. Сервер скачивает файл сам и держит последнюю удачную
// копию в памяти и, на своём сервере, на диске — тогда она переживает
// перезапуск и временную недоступность api.bitrix24.com.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const SOURCE = 'https://api.bitrix24.com/api/v1/';
const REFRESH_MS = 12 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 8000;

let cached = null; // { body, fetchedAt }

const diskPath = () => (process.env.UPLOAD_DIR ? join(dirname(process.env.UPLOAD_DIR), 'bx24-sdk.js') : null);

async function fromDisk() {
  const path = diskPath();
  if (!path) return null;
  try {
    return await readFile(path, 'utf8');
  } catch {
    return null;
  }
}

async function fetchFresh() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(SOURCE, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.text();
    // Защита от того, чтобы закэшировать страницу ошибки вместо скрипта.
    if (!body.includes('BX24')) throw new Error('ответ не похож на SDK Битрикс24');
    return body;
  } finally {
    clearTimeout(timer);
  }
}

export default async function handler(req, res) {
  if (!cached || Date.now() - cached.fetchedAt > REFRESH_MS) {
    try {
      const body = await fetchFresh();
      cached = { body, fetchedAt: Date.now() };
      const path = diskPath();
      if (path) {
        await mkdir(dirname(path), { recursive: true });
        await writeFile(path, body).catch(() => {});
      }
    } catch (err) {
      if (!cached) {
        const body = await fromDisk();
        if (body) cached = { body, fetchedAt: Date.now() - REFRESH_MS + 10 * 60 * 1000 }; // повторим через 10 минут
      }
      if (!cached) {
        res.status(502).send(`// SDK Битрикс24 недоступен: ${err instanceof Error ? err.message : err}`);
        return;
      }
    }
  }
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.status(200).send(cached.body);
}
