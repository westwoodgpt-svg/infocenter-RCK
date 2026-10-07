// Обмен одноразового билета на сессию отдельного окна (см. api/_standalone.js).
import { createSession, redeemTicket, sameOrigin, sessionCookie } from './_standalone.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'method not allowed' });
    return;
  }
  if (!sameOrigin(req)) {
    res.status(403).json({ ok: false, error: 'запрос пришёл не со страницы инфоцентра' });
    return;
  }
  const ticket = req.body && typeof req.body === 'object' ? req.body.ticket : null;
  const redeemed = await redeemTicket(ticket);
  if (!redeemed || !redeemed.identity) {
    res.status(401).json({
      ok: false,
      code: 'ticket-invalid',
      error: 'ссылка на отдельное окно уже использована или устарела',
    });
    return;
  }
  const sid = await createSession(redeemed.identity);
  res.setHeader('Set-Cookie', sessionCookie(sid));
  res.status(200).json({ ok: true, view: redeemed.view || null });
}
