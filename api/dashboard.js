// Единая точка чтения/записи инфоцентров и истории изменений карточек.
//
// Каждый отдел — свой инфоцентр. Какие из них доступны открывшему сотруднику и
// что он может в них делать, решает сервер по данным Битрикс24 (api/_access.js);
// идентификатор инфоцентра из запроса всегда проверяется по этому списку.
import { boardAccess, resolveAccess, resolveIdentity, storagePrefixFor } from './_access.js';
import { loadDashboard, saveDashboard, cardHistory, TABS } from './_store.js';

// Сводный экран грузит несколько инфоцентров сразу, поэтому тяжёлые картинки в
// нём не передаются — вместо них карточка помечается флагом.
const SUMMARY_IMAGE_MAX_BYTES = 60_000;
const SUMMARY_MAX_BOARDS = 30;

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

function lightenCard(card) {
  if (card && card.type === 'image' && typeof card.imageUrl === 'string' && card.imageUrl.length > SUMMARY_IMAGE_MAX_BYTES) {
    return { ...card, imageUrl: '', summaryTrimmed: true };
  }
  return card;
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

  const credentials = { accessToken: auth.access_token, domain: auth.domain };

  try {
    const identity = await resolveIdentity(credentials);
    if (!identity) {
      res.status(403).json({ ok: false, error: 'сессия Битрикс24 недействительна — обновите страницу' });
      return;
    }
    const access = await resolveAccess(identity);

    if (action === 'bootstrap') {
      res.status(200).json({
        ok: true,
        me: { id: identity.id, name: identity.name, isAdmin: identity.isAdmin },
        role: access.role,
        boards: access.boards,
        defaultBoardId: access.defaultBoardId,
        canSeeSummary: access.canSeeSummary,
        legacyBoardId: access.legacyBoardId,
        warning: access.warning,
      });
      return;
    }

    if (action === 'load') {
      const board = boardAccess(access, payload.boardId);
      if (!board) {
        res.status(403).json({ ok: false, error: 'нет доступа к этому инфоцентру' });
        return;
      }
      const data = await loadDashboard(storagePrefixFor(board.id));
      res.status(200).json({
        ok: true,
        boardId: board.id,
        canEdit: board.canEdit,
        state: data ? data.state : null,
        rev: data ? data.rev : 0,
        updatedAt: data ? data.updatedAt : null,
        updatedBy: data ? data.updatedBy : null,
      });
      return;
    }

    if (action === 'save') {
      const board = boardAccess(access, payload.boardId, 'edit');
      if (!board) {
        res.status(403).json({ ok: false, error: 'нет прав на редактирование этого инфоцентра' });
        return;
      }
      const { state, baseRev } = payload;
      if (!state || typeof state !== 'object') {
        res.status(400).json({ ok: false, error: 'отсутствует state' });
        return;
      }
      const saved = await saveDashboard({
        prefix: storagePrefixFor(board.id),
        state,
        baseRev: baseRev == null ? null : Number(baseRev),
        author: identity.name,
      });
      res.status(200).json({ ok: true, boardId: board.id, ...saved });
      return;
    }

    if (action === 'history') {
      const board = boardAccess(access, payload.boardId);
      if (!board) {
        res.status(403).json({ ok: false, error: 'нет доступа к этому инфоцентру' });
        return;
      }
      const { tab, cardId } = payload;
      if (!TABS.includes(tab) || !cardId) {
        res.status(400).json({ ok: false, error: 'нужны корректные tab и cardId' });
        return;
      }
      const entries = await cardHistory(storagePrefixFor(board.id), tab, String(cardId));
      res.status(200).json({ ok: true, entries });
      return;
    }

    // Сводный экран: выбранная вкладка по всем доступным инфоцентрам сразу.
    if (action === 'summary') {
      if (!access.canSeeSummary) {
        res.status(403).json({ ok: false, error: 'сводный экран доступен при нескольких инфоцентрах' });
        return;
      }
      const tab = payload.tab;
      if (!TABS.includes(tab)) {
        res.status(400).json({ ok: false, error: 'нужна корректная вкладка' });
        return;
      }
      const boards = access.boards.slice(0, SUMMARY_MAX_BOARDS);
      const sections = await Promise.all(
        boards.map(async (board) => {
          let data = null;
          try {
            data = await loadDashboard(storagePrefixFor(board.id));
          } catch {
            data = null; // один недоступный инфоцентр не должен ломать всю сводку
          }
          const cards = data && data.state ? (data.state[tab] || []).map(lightenCard) : [];
          return {
            boardId: board.id,
            title: board.title,
            canEdit: board.canEdit,
            updatedAt: data ? data.updatedAt : null,
            updatedBy: data ? data.updatedBy : null,
            cards,
          };
        })
      );
      res.status(200).json({ ok: true, tab, sections });
      return;
    }

    res.status(400).json({ ok: false, error: `неизвестное действие: ${action}` });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(err && err.tooLarge ? 413 : 502).json({ ok: false, error: message });
  }
}
