// Загрузка вложений стикеров витрины в хранилище файлов Vercel Blob.
//
// Файл идёт из браузера прямо в Blob, минуя нашу функцию: у serverless-функций
// Vercel тело запроса ограничено ~4,5 МБ, а презентации и сканы бывают больше.
// Сюда браузер приходит только за одноразовым токеном на загрузку — и получает
// его, лишь предъявив действующую сессию Битрикс24.
//
// Хранилище подключается один раз в Vercel (Storage → Blob, см. DEPLOYMENT.md):
// Vercel сам пропишет переменную BLOB_READ_WRITE_TOKEN. Пока её нет, витрина
// работает без хранилища — небольшие файлы сохраняются прямо в её данных.
import { handleUpload } from '@vercel/blob/client';
import { resolveIdentity } from './_access.js';

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
const TOKEN_TTL_MS = 10 * 60 * 1000;

export const blobConfigured = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);

function parseBody(req) {
  let payload = req.body;
  if (typeof payload === 'string') {
    try {
      payload = JSON.parse(payload);
    } catch {
      return null;
    }
  }
  return payload && typeof payload === 'object' ? payload : null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method not allowed' });
    return;
  }
  if (!blobConfigured()) {
    res.status(503).json({ error: 'хранилище файлов (Vercel Blob) не подключено — см. DEPLOYMENT.md' });
    return;
  }
  const body = parseBody(req);
  if (!body) {
    res.status(400).json({ error: 'некорректный JSON в теле запроса' });
    return;
  }

  try {
    const result = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        let auth = null;
        try {
          auth = clientPayload ? JSON.parse(clientPayload).auth : null;
        } catch {
          auth = null;
        }
        if (!auth || !auth.access_token || !auth.domain) throw new Error('отсутствует авторизация Битрикс24');
        const identity = await resolveIdentity({ accessToken: auth.access_token, domain: auth.domain });
        if (!identity) throw new Error('сессия Битрикс24 недействительна — обновите страницу');
        if (!String(pathname).startsWith('showcase/')) throw new Error('недопустимый путь файла');
        return {
          maximumSizeInBytes: MAX_UPLOAD_BYTES,
          // Случайный суффикс: ссылку на файл нельзя угадать по его имени,
          // и два файла с одинаковым именем не затирают друг друга.
          addRandomSuffix: true,
          validUntil: Date.now() + TOKEN_TTL_MS,
          tokenPayload: JSON.stringify({ by: identity.id }),
        };
      },
    });
    res.status(200).json(result);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
}
