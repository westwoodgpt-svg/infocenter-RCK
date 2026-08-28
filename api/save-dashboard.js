// Совместимость со старыми вкладками, у которых ещё загружен предыдущий бандл:
// они шлют состояние сюда, ничего не зная о разделении по отделам. Пишем в
// исторический инфоцентр РЦК — тот самый, который такая вкладка и показывает.
import { getUserProfile } from './_bitrixAuth.js';
import { LEGACY_BOARD_ID } from './_access.js';
import { saveDashboard } from './_store.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'method not allowed' });
    return;
  }

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

  const profile = await getUserProfile({ accessToken: auth.access_token, domain: auth.domain });
  if (!profile) {
    res.status(403).json({ ok: false, error: 'сессия Битрикс24 недействительна — обновите страницу' });
    return;
  }

  try {
    // baseRev не приходит от старого клиента — сохраняем как есть, поверх
    // текущей версии (правки при этом всё равно попадают в историю карточек).
    const saved = await saveDashboard({ prefix: LEGACY_BOARD_ID, state, baseRev: null, author: profile.name });
    res.status(200).json({ ok: true, rev: saved.rev });
  } catch (err) {
    res.status(err && err.tooLarge ? 413 : 502).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
}
