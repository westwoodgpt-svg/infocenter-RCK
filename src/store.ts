import { useCallback, useEffect, useRef, useState } from 'react';
import { AnyCard, DashboardState, TabId } from './types';
import { SEED_DATA, EMPTY_DASHBOARD } from './seedData';
import { bx24Init, fetchDashboardOption, isInIframe, saveDashboardOption } from './bitrix';

const STORAGE_KEY = 'rck-dashboard-v1';

export type SyncMode = 'checking' | 'bitrix' | 'local';
export type SyncStatus = 'idle' | 'saving' | 'saved' | 'error';

function loadInitial(): DashboardState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as DashboardState;
  } catch {
    // ignore corrupt storage, fall back to seed
  }
  return SEED_DATA;
}

function persist(state: DashboardState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // storage unavailable (private mode, quota) — edits stay in-memory only
  }
}

let counter = 0;
export function newCardId() {
  counter += 1;
  return `card-${Date.now()}-${counter}`;
}

export function useDashboardStore() {
  const [state, setState] = useState<DashboardState>(() => loadInitial());
  const [syncMode, setSyncMode] = useState<SyncMode>('checking');
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

  const skipNextPush = useRef(false);

  // Всегда кэшируем в localStorage — это и офлайн-хранилище вне Битрикс24,
  // и мгновенная копия на случай, если запрос к app.option не успеет/упадёт.
  useEffect(() => {
    persist(state);
  }, [state]);

  const pullFromBitrix = useCallback(async (applyEvenIfEmpty = false) => {
    setSyncStatus('saving');
    const { state: remote, error } = await fetchDashboardOption();
    if (error) {
      setSyncStatus('error');
      setSyncError(error);
      return;
    }
    if (remote) {
      skipNextPush.current = true;
      setState(remote);
      setLastSyncedAt(new Date());
    } else if (applyEvenIfEmpty) {
      // ничего не сохранено на портале ещё — оставляем текущее (localStorage/пример)
    }
    setSyncStatus('saved');
    setSyncError(null);
  }, []);

  // Первичная инициализация: определяем, встроены ли мы в Битрикс24, и если да —
  // подключаем SDK и подтягиваем общие данные портала.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isInIframe()) {
        setSyncMode('local');
        return;
      }
      const ready = await bx24Init();
      if (cancelled) return;
      if (!ready) {
        setSyncMode('local');
        return;
      }
      await pullFromBitrix(true);
      if (cancelled) return;
      setSyncMode('bitrix');
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Каждое изменение данных отправляем в app.option, если подключены к Битрикс24.
  useEffect(() => {
    if (syncMode !== 'bitrix') return;
    if (skipNextPush.current) {
      skipNextPush.current = false;
      return;
    }
    let cancelled = false;
    setSyncStatus('saving');
    saveDashboardOption(state).then(({ ok, error }) => {
      if (cancelled) return;
      if (ok) {
        setSyncStatus('saved');
        setSyncError(null);
        setLastSyncedAt(new Date());
      } else {
        setSyncStatus('error');
        setSyncError(error);
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, syncMode]);

  // Подхватываем правки других пользователей, когда вкладка снова становится активной.
  useEffect(() => {
    if (syncMode !== 'bitrix') return;
    const onVisible = () => {
      if (document.visibilityState === 'visible') pullFromBitrix();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [syncMode, pullFromBitrix]);

  const addCard = useCallback((tab: TabId, card: AnyCard) => {
    setState((prev) => ({ ...prev, [tab]: [...prev[tab], card] }));
  }, []);

  const updateCard = useCallback((tab: TabId, card: AnyCard) => {
    setState((prev) => ({
      ...prev,
      [tab]: prev[tab].map((c) => (c.id === card.id ? card : c)),
    }));
  }, []);

  const deleteCard = useCallback((tab: TabId, cardId: string) => {
    setState((prev) => ({
      ...prev,
      [tab]: prev[tab].filter((c) => c.id !== cardId),
    }));
  }, []);

  const moveCard = useCallback((tab: TabId, cardId: string, direction: -1 | 1) => {
    setState((prev) => {
      const list = [...prev[tab]];
      const idx = list.findIndex((c) => c.id === cardId);
      const target = idx + direction;
      if (idx < 0 || target < 0 || target >= list.length) return prev;
      [list[idx], list[target]] = [list[target], list[idx]];
      return { ...prev, [tab]: list };
    });
  }, []);

  const resetToSeed = useCallback(() => setState(SEED_DATA), []);
  const clearAll = useCallback(() => setState(EMPTY_DASHBOARD), []);
  const replaceAll = useCallback((next: DashboardState) => setState(next), []);
  const refresh = useCallback(() => pullFromBitrix(), [pullFromBitrix]);

  return {
    state,
    syncMode,
    syncStatus,
    syncError,
    lastSyncedAt,
    refresh,
    addCard,
    updateCard,
    deleteCard,
    moveCard,
    resetToSeed,
    clearAll,
    replaceAll,
  };
}
