import { DashboardState } from './types';

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
      getAuth: () => { access_token: string; domain: string; member_id?: string } | false;
    };
  }
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

// Сохранение идёт не напрямую в Битрикс24 из браузера (app.option.set доступен
// только администраторам портала), а через наш серверный эндпоинт: он
// проверяет, что у вызывающего есть действующая сессия портала, и пишет в
// app.option от имени отдельного сервисного (администраторского) токена —
// так редактировать может любой сотрудник. См. worker.js.
export async function saveDashboardOption(state: DashboardState): Promise<{ ok: boolean; error: string | null }> {
  if (!hasBX24()) {
    return { ok: false, error: 'нет соединения с Битрикс24' };
  }

  const auth = window.BX24!.getAuth();
  if (!auth) {
    return { ok: false, error: 'не удалось получить авторизацию Битрикс24' };
  }

  try {
    const res = await fetch('/api/save-dashboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        state,
        auth: { access_token: auth.access_token, domain: auth.domain },
      }),
    });
    const data = (await res.json()) as { ok: boolean; error?: string };
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error || `HTTP ${res.status}` };
    }
    return { ok: true, error: null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'сетевая ошибка' };
  }
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
      const rows = (result.data() as RawBxUser[]) || [];
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
