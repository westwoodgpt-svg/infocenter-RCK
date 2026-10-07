// Единая точка чтения/записи инфоцентров и истории изменений карточек.
//
// Каждый отдел — свой инфоцентр. Какие из них доступны открывшему сотруднику и
// что он может в них делать, решает сервер по данным Битрикс24 (api/_access.js);
// идентификатор инфоцентра из запроса всегда проверяется по этому списку.
import { boardAccess, LEGACY_BOARD_ID, resolveAccess, resolveIdentity, storagePrefixFor } from './_access.js';
import {
  loadDashboard,
  saveDashboard,
  cardHistory,
  loadSummaryConfig,
  saveSummaryConfig,
  loadLastView,
  saveLastView,
  normalizeView,
  TABS,
  SHOWCASE_PREFIX,
} from './_store.js';
import { blobConfigured } from './showcase-upload.js';
import { diskUploadsEnabled } from './showcase-file.js';
import { destroySession, issueTicket, readCookie, readSession, sameOrigin, SESSION_COOKIE, sessionCookie } from './_standalone.js';
import { loadPortalUsers } from './_portalUsers.js';

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

// Сохранённый вид — только если он сотруднику всё ещё доступен. Прежний
// инфоцентр отдела РЦК открывает «Инфоцентр РЦК». Иначе null — тогда клиент
// откроет витрину.
function resolveLastView(view, access) {
  const v = normalizeView(view);
  if (!v) return null;
  if (v.kind === 'showcase') return v;
  if (v.kind === 'summary') return access.canSeeSummary ? v : null;
  const boardId = access.rckAliasBoardId && v.boardId === access.rckAliasBoardId ? LEGACY_BOARD_ID : v.boardId;
  return access.boards.some((b) => b.id === boardId) ? { kind: 'board', boardId } : null;
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

  try {
    // Кто это: внутри портала — токен Битрикс24 в теле запроса, в отдельном
    // окне — cookie сессии (api/_standalone.js). Права дальше одинаковые.
    let identity = null;
    let via = 'bitrix';
    if (auth && auth.access_token && auth.domain) {
      identity = await resolveIdentity({ accessToken: auth.access_token, domain: auth.domain });
      if (!identity) {
        res.status(403).json({ ok: false, error: 'сессия Битрикс24 недействительна — обновите страницу' });
        return;
      }
    } else if (readCookie(req, SESSION_COOKIE)) {
      if (!sameOrigin(req)) {
        res.status(403).json({ ok: false, error: 'запрос пришёл не со страницы инфоцентра' });
        return;
      }
      const session = await readSession(req);
      if (!session) {
        res.setHeader('Set-Cookie', sessionCookie('', 0));
        res.status(401).json({ ok: false, code: 'standalone-session-expired', error: 'сессия отдельного окна истекла' });
        return;
      }
      if (session.renewed) res.setHeader('Set-Cookie', sessionCookie(session.sid, session.maxAgeSec));
      identity = session.identity;
      via = 'session';
    } else {
      res.status(401).json({ ok: false, code: 'no-auth', error: 'отсутствует авторизация Битрикс24' });
      return;
    }
    const access = await resolveAccess(identity);

    // Билет на отдельное окно — только изнутри портала, по токену Битрикс24:
    // из отдельного окна новое окно не открывают, а сессия не должна
    // размножаться сама.
    if (action === 'standalone-ticket') {
      if (via !== 'bitrix') {
        res.status(403).json({ ok: false, error: 'отдельное окно открывается из портала' });
        return;
      }
      const ticket = await issueTicket(identity, resolveLastView(payload.view, access));
      res.setHeader('Cache-Control', 'no-store');
      res.status(200).json({ ok: true, ticket });
      return;
    }

    if (action === 'standalone-logout') {
      if (via === 'session') {
        await destroySession(req);
      }
      res.setHeader('Set-Cookie', sessionCookie('', 0));
      res.status(200).json({ ok: true });
      return;
    }

    // Сотрудники портала для карточки «Ответственный» в отдельном окне (там нет
    // BX24.callMethod). Только ФИО, должность и фото — см. api/_portalUsers.js.
    if (action === 'portal-users') {
      const users = await loadPortalUsers();
      res.status(200).json({ ok: true, users });
      return;
    }

    if (action === 'bootstrap') {
      // Последний вид отдаём сразу здесь, чтобы при входе не было лишнего запроса.
      const lastView = resolveLastView(await loadLastView(identity.id).catch(() => null), access);
      res.status(200).json({
        lastView,
        standalone: via === 'session',
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

    if (action === 'last-view-save') {
      const view = resolveLastView(payload.view, access);
      if (!view) {
        res.status(400).json({ ok: false, error: 'этот вид недоступен' });
        return;
      }
      await saveLastView(identity.id, view);
      res.status(200).json({ ok: true, view });
      return;
    }

    // Настройка сводного экрана (что и откуда на него тянуть) — личная,
    // поэтому лежит под идентификатором сотрудника, а не инфоцентра.
    if (action === 'summary-config') {
      if (!access.canSeeSummary) {
        res.status(403).json({ ok: false, error: 'сводный экран доступен при нескольких инфоцентрах' });
        return;
      }
      const config = await loadSummaryConfig(identity.id);
      res.status(200).json({ ok: true, config });
      return;
    }

    if (action === 'summary-config-save') {
      if (!access.canSeeSummary) {
        res.status(403).json({ ok: false, error: 'сводный экран доступен при нескольких инфоцентрах' });
        return;
      }
      const config = await saveSummaryConfig(identity.id, payload.config);
      res.status(200).json({ ok: true, config });
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

    // Витрина — один общий экран для всей компании. Смотрят все, правят тоже
    // все сотрудники портала (через режим редактирования), поэтому здесь
    // достаточно действующей сессии — права на отделы не проверяются.
    if (action === 'showcase-load') {
      const data = await loadDashboard(SHOWCASE_PREFIX);
      res.status(200).json({
        ok: true,
        state: data ? data.state : null,
        rev: data ? data.rev : 0,
        updatedAt: data ? data.updatedAt : null,
        updatedBy: data ? data.updatedBy : null,
        // Куда класть вложения: на диск своего сервера, в хранилище файлов
        // Vercel Blob или (если нет ни того, ни другого) прямо в данные
        // витрины — тогда только небольшие файлы.
        uploads: diskUploadsEnabled() ? 'disk' : blobConfigured() ? 'blob' : 'inline',
      });
      return;
    }

    if (action === 'showcase-save') {
      const { state, baseRev } = payload;
      if (!state || typeof state !== 'object') {
        res.status(400).json({ ok: false, error: 'отсутствует state' });
        return;
      }
      const saved = await saveDashboard({
        prefix: SHOWCASE_PREFIX,
        state,
        baseRev: baseRev == null ? null : Number(baseRev),
        author: identity.name,
      });
      res.status(200).json({ ok: true, ...saved });
      return;
    }

    if (action === 'showcase-history') {
      const { noteId } = payload;
      if (!noteId) {
        res.status(400).json({ ok: false, error: 'нужен noteId' });
        return;
      }
      const entries = await cardHistory(SHOWCASE_PREFIX, 'notes', String(noteId));
      res.status(200).json({ ok: true, entries });
      return;
    }

    res.status(400).json({ ok: false, error: `неизвестное действие: ${action}` });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(err && err.tooLarge ? 413 : 502).json({ ok: false, error: message });
  }
}
