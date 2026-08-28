import { AnyCard, BootstrapInfo, DashboardState, SummarySection, TabId } from './types';

// Общее хранилище дашборда на уровне приложения Битрикс24 (app.option) —
// один и тот же ключ виден всем пользователям портала, установившим
// локальное приложение. В отличие от localStorage (per-browser), это даёт
// действительно общие данные для всех, кто открывает инфоцентр из Битрикс24.

const OPTION_KEY = 'rck_dashboard_v1';
const INIT_TIMEOUT_MS = 4000;

declare global {
  interface Window {
    BX24?: {
      init: (cb: () => void) => void;
      callMethod: (method: string, params: Record<string, unknown>, cb: (result: BXResult) => void) => void;
      getAuth: () => BXAuth | false;
      refreshAuth?: (cb: (auth: BXAuth | false) => void) => void;
    };
  }
}

export interface BXAuth {
  access_token: string;
  domain: string;
  member_id?: string;
}

interface BXResult {
  error: () => { ex?: { error_description?: string }; error_description?: string } | null;
  data: () => unknown;
  more: () => boolean;
  next: (cb: (result: BXResult) => void) => void;
}

export interface PortalUser {
  id: string;
  name: string;
  position: string;
  photo: string;
}

const MAX_USER_PAGES = 20; // защита от бесконечного цикла на очень больших порталах

export function isInIframe(): boolean {
  try {
    return typeof window !== 'undefined' && window.self !== window.top;
  } catch {
    return true;
  }
}

export function hasBX24(): boolean {
  return typeof window !== 'undefined' && !!window.BX24;
}

export function bx24Init(): Promise<boolean> {
  return new Promise((resolve) => {
    if (!hasBX24()) {
      resolve(false);
      return;
    }
    let done = false;
    const finish = (ok: boolean) => {
      if (done) return;
      done = true;
      resolve(ok);
    };
    try {
      window.BX24!.init(() => finish(true));
    } catch {
      finish(false);
    }
    setTimeout(() => finish(hasBX24()), INIT_TIMEOUT_MS);
  });
}

function bxErrorMessage(result: BXResult): string {
  const err = result.error();
  if (!err) return '';
  return err.ex?.error_description || err.error_description || 'неизвестная ошибка';
}

export function fetchDashboardOption(): Promise<{ state: DashboardState | null; error: string | null }> {
  return new Promise((resolve) => {
    if (!hasBX24()) {
      resolve({ state: null, error: null });
      return;
    }
    window.BX24!.callMethod('app.option.get', {}, (result) => {
      if (result.error()) {
        resolve({ state: null, error: bxErrorMessage(result) });
        return;
      }
      const options = (result.data() as Record<string, string>) || {};
      const raw = options[OPTION_KEY];
      if (!raw) {
        resolve({ state: null, error: null });
        return;
      }
      try {
        resolve({ state: JSON.parse(raw) as DashboardState, error: null });
      } catch {
        resolve({ state: null, error: 'повреждённые данные в app.option' });
      }
    });
  });
}

// Чтение/запись данных инфоцентра идут через наш эндпоинт /api/dashboard.
//
// Раньше состояние писалось в app.option Битрикс24 (значение опции портала
// ограничено по объёму) — из-за этого сохранение молча падало, а правка
// сотрудника исчезала при следующем чтении. Теперь состояние лежит в Redis на
// стороне сервера, app.option остаётся только резервной копией.

export interface RemoteDashboard {
  state: DashboardState | null;
  rev: number;
  updatedAt: string | null;
  updatedBy: string | null;
  canEdit: boolean;
}

/** Идентификатор исторического инфоцентра РЦК (совпадает с LEGACY_BOARD_ID на сервере). */
export const LEGACY_BOARD_ID = 'rck';

export interface CardHistoryEntry {
  rev?: number;
  at: string;
  by: string | null;
  action: 'create' | 'update' | 'delete';
  card: AnyCard;
  /** Версия сохранена без тяжёлого изображения (экономия места в истории). */
  trimmed?: boolean;
}

function currentAuth(): Promise<BXAuth | null> {
  return new Promise((resolve) => {
    if (!hasBX24()) {
      resolve(null);
      return;
    }
    const auth = window.BX24!.getAuth();
    resolve(auth || null);
  });
}

// Токен, выданный порталом вкладке, живёт около часа. Если инфоцентр держат
// открытым дольше, сервер отвечает 403 — тогда просим SDK обновить токен и
// повторяем запрос один раз, чтобы сохранение не «отваливалось» само по себе.
function refreshAuth(): Promise<BXAuth | null> {
  return new Promise((resolve) => {
    const bx = window.BX24;
    if (!bx || typeof bx.refreshAuth !== 'function') {
      resolve(null);
      return;
    }
    let done = false;
    const finish = (auth: BXAuth | null) => {
      if (done) return;
      done = true;
      resolve(auth);
    };
    try {
      bx.refreshAuth((auth) => finish(auth || null));
    } catch {
      finish(null);
    }
    setTimeout(() => finish(null), 5000);
  });
}

interface ApiResponse {
  ok: boolean;
  error?: string;
}

async function postDashboardApi<T extends ApiResponse>(
  body: Record<string, unknown>
): Promise<{ data: T | null; error: string | null }> {
  if (!hasBX24()) return { data: null, error: 'нет соединения с Битрикс24' };

  let auth = await currentAuth();
  if (!auth) return { data: null, error: 'не удалось получить авторизацию Битрикс24' };

  const send = async (a: BXAuth) => {
    const res = await fetch('/api/dashboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, auth: { access_token: a.access_token, domain: a.domain } }),
    });
    let data: T | null = null;
    try {
      data = (await res.json()) as T;
    } catch {
      data = null;
    }
    return { res, data };
  };

  try {
    let { res, data } = await send(auth);
    if (res.status === 403) {
      const refreshed = await refreshAuth();
      if (refreshed) {
        auth = refreshed;
        ({ res, data } = await send(refreshed));
      }
    }
    if (!res.ok || !data || !data.ok) {
      return { data: null, error: (data && data.error) || `HTTP ${res.status}` };
    }
    return { data, error: null };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'сетевая ошибка' };
  }
}

// Кто открыл инфоцентр и какие инфоцентры ему доступны — решает сервер по
// структуре отделов портала (см. api/_access.js).
export async function bootstrapRemote(): Promise<{ data: BootstrapInfo | null; error: string | null }> {
  const { data, error } = await postDashboardApi<ApiResponse & BootstrapInfo>({ action: 'bootstrap' });
  if (error || !data) return { data: null, error };
  return {
    data: {
      me: data.me,
      role: data.role,
      boards: data.boards || [],
      defaultBoardId: data.defaultBoardId,
      canSeeSummary: Boolean(data.canSeeSummary),
      legacyBoardId: data.legacyBoardId || LEGACY_BOARD_ID,
      warning: data.warning || null,
    },
    error: null,
  };
}

// Запасное чтение из app.option имеет смысл только для исторического
// инфоцентра РЦК — у остальных отделов там ничего не лежало.
async function legacyFallback(boardId: string, legacyBoardId: string): Promise<RemoteDashboard | null> {
  if (boardId !== legacyBoardId) return null;
  const legacy = await fetchDashboardOption();
  if (!legacy.state) return null;
  return { state: legacy.state, rev: 0, updatedAt: null, updatedBy: null, canEdit: true };
}

export async function loadDashboardRemote(
  boardId: string,
  legacyBoardId: string = LEGACY_BOARD_ID
): Promise<{ data: RemoteDashboard | null; error: string | null }> {
  const { data, error } = await postDashboardApi<ApiResponse & RemoteDashboard>({ action: 'load', boardId });
  if (error) {
    // Наш сервер или Redis недоступны — показываем хотя бы то, что лежит в
    // app.option, чтобы инфоцентр не оказался пустым.
    const fallback = await legacyFallback(boardId, legacyBoardId);
    if (fallback) return { data: fallback, error: null };
    return { data: null, error };
  }

  if (!data!.state) {
    const fallback = await legacyFallback(boardId, legacyBoardId);
    if (fallback) return { data: fallback, error: null };
  }

  return {
    data: {
      state: data!.state,
      rev: data!.rev,
      updatedAt: data!.updatedAt,
      updatedBy: data!.updatedBy,
      canEdit: data!.canEdit !== false,
    },
    error: null,
  };
}

export async function saveDashboardRemote(
  boardId: string,
  state: DashboardState,
  baseRev: number
): Promise<{ ok: boolean; rev: number | null; state: DashboardState | null; error: string | null }> {
  const { data, error } = await postDashboardApi<ApiResponse & { rev: number; state: DashboardState }>({
    action: 'save',
    boardId,
    state,
    baseRev,
  });
  if (error) return { ok: false, rev: null, state: null, error };
  return { ok: true, rev: data!.rev, state: data!.state, error: null };
}

export async function fetchCardHistoryRemote(
  boardId: string,
  tab: TabId,
  cardId: string
): Promise<{ entries: CardHistoryEntry[]; error: string | null }> {
  const { data, error } = await postDashboardApi<ApiResponse & { entries: CardHistoryEntry[] }>({
    action: 'history',
    boardId,
    tab,
    cardId,
  });
  if (error) return { entries: [], error };
  return { entries: data!.entries || [], error: null };
}

/** Сводный экран: выбранная вкладка по всем доступным инфоцентрам. */
export async function fetchSummaryRemote(
  tab: TabId
): Promise<{ sections: SummarySection[]; error: string | null }> {
  const { data, error } = await postDashboardApi<ApiResponse & { sections: SummarySection[] }>({
    action: 'summary',
    tab,
  });
  if (error) return { sections: [], error };
  return { sections: data!.sections || [], error: null };
}


interface RawBxUser {
  ID: string;
  NAME?: string;
  LAST_NAME?: string;
  SECOND_NAME?: string;
  WORK_POSITION?: string;
  PERSONAL_PHOTO?: string;
}

function formatUserName(u: RawBxUser): string {
  return [u.LAST_NAME, u.NAME, u.SECOND_NAME].filter(Boolean).join(' ').trim() || `ID ${u.ID}`;
}

// Список активных сотрудников портала — для выбора ответственного в карточке
// «Ответственный» выпадающим списком вместо ручного ввода ФИО. Классический
// BX24 REST отдаёт user.get постранично (по 50), поэтому докручиваем через
// result.more()/result.next() с защитным лимитом страниц.
export function fetchPortalUsers(): Promise<{ users: PortalUser[]; error: string | null }> {
  return new Promise((resolve) => {
    if (!hasBX24()) {
      resolve({ users: [], error: null });
      return;
    }

    const collected: PortalUser[] = [];
    let pages = 0;

    const handlePage = (result: BXResult) => {
      if (result.error()) {
        resolve({ users: collected, error: bxErrorMessage(result) });
        return;
      }
      // Портал может ответить не массивом (например, объектом с ошибкой) —
      // необработанное исключение здесь ломало бы выпадающий список сотрудников.
      const raw = result.data();
      const rows: RawBxUser[] = Array.isArray(raw) ? (raw as RawBxUser[]) : [];
      rows.forEach((u) => {
        collected.push({
          id: u.ID,
          name: formatUserName(u),
          position: u.WORK_POSITION || '',
          photo: u.PERSONAL_PHOTO || '',
        });
      });
      pages += 1;
      if (result.more() && pages < MAX_USER_PAGES) {
        result.next(handlePage);
      } else {
        resolve({ users: collected, error: null });
      }
    };

    window.BX24!.callMethod(
      'user.get',
      {
        FILTER: { ACTIVE: true },
        SELECT: ['ID', 'NAME', 'LAST_NAME', 'SECOND_NAME', 'WORK_POSITION', 'PERSONAL_PHOTO'],
      },
      handlePage
    );
  });
}
