// Принимает изменения дашборда от ЛЮБОГО авторизованного сотрудника портала и
// сохраняет их в app.option от имени сервисного (администраторского) токена —
// см. api/_bitrixAuth.js о том, почему это нужно.
import { verifyUserToken, bxAppOptionSet } from './_bitrixAuth.js';

const OPTION_KEY = 'rck_dashboard_v1';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'method not allowed' });
    return;
  }

  // req.body уже разобран платформой Vercel (Content-Type: application/json из
  // fetch() в src/bitrix.ts) — читать req как сырой поток здесь не нужно и не
  // работает: Vercel уже потребляет исходный stream до вызова этого обработчика.
  let payload = req.body;
  if (typeof payload === 'string') {
    try {
      payload = JSON.parse(payload);
    } catch {
      res.status(400).json({ ok: false, error: 'некорректный JSON в теле запроса' });
      return;
    }
  }

  const { state, auth } = payload || {};
  if (!state || !auth || !auth.access_token || !auth.domain) {
    res.status(400).json({ ok: false, error: 'отсутствует state или auth' });
    return;
  }

  const isValidUser = await verifyUserToken({ accessToken: auth.access_token, domain: auth.domain });
  if (!isValidUser) {
    res.status(403).json({ ok: false, error: 'сессия Битрикс24 недействительна — обновите страницу' });
    return;
  }

  try {
    await bxAppOptionSet(OPTION_KEY, JSON.stringify(state));
    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(502).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
}
