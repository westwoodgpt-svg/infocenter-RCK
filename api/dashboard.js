// Единая точка чтения/записи данных инфоцентра и истории изменений карточек.
//
// Любой сотрудник портала (не только администратор) читает и пишет через этот
// эндпоинт: он проверяет, что запрос пришёл с действующей сессией Битрикс24,
// и работает с Redis, где теперь живёт состояние дашборда (см. api/_store.js).
import { getUserProfile } from './_bitrixAuth.js';
import { loadDashboard, saveDashboard, cardHistory, TABS } from './_store.js';

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
    res.status(405).json({ ok: false, error: 'method not allowed' });
    return;
  }

  const payload = parseBody(req);
  if (!payload) {
    res.status(400).json({ ok: false, error: 'некорректный JSON в теле запроса' });
    return;
  }

  const { action, auth } = payload;
  if (!auth || !auth.access_token || !auth.domain) {
    res.status(400).json({ ok: false, error: 'отсутствует авторизация Битрикс24' });
    return;
  }

  const profile = await getUserProfile({ accessToken: auth.access_token, domain: auth.domain });
  if (!profile) {
    res.status(403).json({ ok: false, error: 'сессия Битрикс24 недействительна — обновите страницу' });
    return;
  }

  try {
    if (action === 'load') {
      const data = await loadDashboard();
      res.status(200).json({
        ok: true,
        state: data ? data.state : null,
        rev: data ? data.rev : 0,
        updatedAt: data ? data.updatedAt : null,
        updatedBy: data ? data.updatedBy : null,
      });
      return;
    }

    if (action === 'save') {
      const { state, baseRev } = payload;
      if (!state || typeof state !== 'object') {
        res.status(400).json({ ok: false, error: 'отсутствует state' });
        return;
      }
      const saved = await saveDashboard({
        state,
        baseRev: baseRev == null ? null : Number(baseRev),
        author: profile.name,
      });
      res.status(200).json({ ok: true, ...saved });
      return;
    }

    if (action === 'history') {
      const { tab, cardId } = payload;
      if (!TABS.includes(tab) || !cardId) {
        res.status(400).json({ ok: false, error: 'нужны корректные tab и cardId' });
        return;
      }
      const entries = await cardHistory(tab, String(cardId));
      res.status(200).json({ ok: true, entries });
      return;
    }

    res.status(400).json({ ok: false, error: `неизвестное действие: ${action}` });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(err && err.tooLarge ? 413 : 502).json({ ok: false, error: message });
  }
}
