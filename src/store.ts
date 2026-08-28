import { useCallback, useEffect, useRef, useState } from 'react';
import { AnyCard, DashboardState, TabId } from './types';
import { SEED_DATA, EMPTY_DASHBOARD } from './seedData';
import {
  bx24Init,
  CardHistoryEntry,
  fetchCardHistoryRemote,
  isInIframe,
  loadDashboardRemote,
  saveDashboardRemote,
} from './bitrix';
import { readLocalCardHistory, recordLocalHistory } from './history';

const STORAGE_KEY = 'rck-dashboard-v1';

// Сохранение на портал: собираем правки за короткую паузу и отправляем одним
// запросом, но не дольше — сотрудник не должен гадать, «дошло или нет».
const SAVE_DEBOUNCE_MS = 500;
const RETRY_DELAYS_MS = [4000, 10000, 20000, 30000];
const POLL_INTERVAL_MS = 45000;

export type SyncMode = 'checking' | 'bitrix' | 'local';
export type SyncStatus = 'idle' | 'saving' | 'saved' | 'error';

interface CachedDashboard {
  state: DashboardState;
  /** Версия, полученная от сервера. 0 — состояние ни разу не подтверждено порталом. */
  rev: number;
  /** true — в этом браузере есть правки, которые сервер ещё не подтвердил. */
  dirty: boolean;
  savedAt: string | null;
}

function loadCache(): CachedDashboard {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as CachedDashboard | DashboardState;
      if (parsed && typeof parsed === 'object' && 'state' in parsed && parsed.state) {
        const cached = parsed as CachedDashboard;
        return {
          state: cached.state,
          rev: Number(cached.rev) || 0,
          dirty: Boolean(cached.dirty),
          savedAt: cached.savedAt || null,
        };
      }
      // Формат до 28.08.2026 — просто состояние дашборда. Такой кэш мог остаться
      // от правок, которые не доехали до портала из-за старой ошибки сохранения,
      // поэтому помечаем его как несохранённый и предлагаем восстановить.
      if (parsed && typeof parsed === 'object' && Array.isArray((parsed as DashboardState).security)) {
        return { state: parsed as DashboardState, rev: 0, dirty: true, savedAt: null };
      }
    }
  } catch {
    // повреждённый кэш — стартуем с примера
  }
  return { state: SEED_DATA, rev: 0, dirty: false, savedAt: null };
}

function persist(cache: CachedDashboard) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // хранилище недоступно (приватный режим, квота) — правки останутся в памяти
  }
}

let counter = 0;
export function newCardId() {
  counter += 1;
  return `card-${Date.now()}-${counter}`;
}

const sameState = (a: DashboardState, b: DashboardState) => JSON.stringify(a) === JSON.stringify(b);

export interface UnsyncedLocalCopy {
  /** Версия с портала — её показываем, если сотрудник отказывается от локальной. */
  remoteState: DashboardState;
  remoteRev: number;
  remoteUpdatedAt: string | null;
  remoteUpdatedBy: string | null;
}

export function useDashboardStore() {
  const initial = useRef<CachedDashboard>(loadCache());
  const [state, setStateRaw] = useState<DashboardState>(initial.current.state);
  const [syncMode, setSyncMode] = useState<SyncMode>('checking');
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [unsyncedLocal, setUnsyncedLocal] = useState<UnsyncedLocalCopy | null>(null);

  // Вся синхронизация опирается на ref-ы, а не на состояние React: обработчики
  // (таймеры, focus, повторные попытки) должны видеть актуальные значения, а не
  // те, что были на момент их создания.
  const stateRef = useRef<DashboardState>(initial.current.state);
  const revRef = useRef<number>(initial.current.rev);
  const dirtyRef = useRef<boolean>(initial.current.dirty);
  const savedAtRef = useRef<string | null>(initial.current.savedAt);
  const editSeqRef = useRef(0);
  const savingRef = useRef(false);
  // Пока сотрудник не решил, что делать с локальной копией, ничего не
  // отправляем и не подтягиваем — иначе выбор сделается за него.
  const awaitingChoiceRef = useRef(false);
  const modeRef = useRef<SyncMode>('checking');
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryStepRef = useRef(0);

  const writeCache = useCallback(() => {
    persist({
      state: stateRef.current,
      rev: revRef.current,
      dirty: dirtyRef.current,
      savedAt: savedAtRef.current,
    });
  }, []);

  // Применение состояния, пришедшего с сервера: свои правки при этом не теряем,
  // потому что вызывается только когда локальных несохранённых изменений нет.
  const applyRemote = useCallback(
    (next: DashboardState, rev: number) => {
      stateRef.current = next;
      revRef.current = rev;
      dirtyRef.current = false;
      savedAtRef.current = new Date().toISOString();
      setStateRaw(next);
      writeCache();
    },
    [writeCache]
  );

  const flushSave = useCallback(async () => {
    if (modeRef.current !== 'bitrix') return;
    if (awaitingChoiceRef.current) return;
    if (savingRef.current) return; // текущее сохранение по завершении заберёт свежие правки
    if (!dirtyRef.current) return;

    savingRef.current = true;
    const snapshot = stateRef.current;
    const seqAtStart = editSeqRef.current;
    const baseRev = revRef.current;
    setSyncStatus('saving');

    const { ok, rev, state: merged, error } = await saveDashboardRemote(snapshot, baseRev);

    savingRef.current = false;

    if (!ok) {
      setSyncStatus('error');
      setSyncError(error);
      // Правки остаются «грязными» и лежат в localStorage — повторим попытку.
      const delay = RETRY_DELAYS_MS[Math.min(retryStepRef.current, RETRY_DELAYS_MS.length - 1)];
      retryStepRef.current += 1;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => void flushSave(), delay);
      return;
    }

    retryStepRef.current = 0;
    revRef.current = rev ?? baseRev;
    savedAtRef.current = new Date().toISOString();
    const newerEdits = editSeqRef.current !== seqAtStart;
    dirtyRef.current = newerEdits;

    // Сервер мог слить наши правки с чужими (кто-то сохранился параллельно) —
    // тогда забираем результат слияния, но только если пользователь за это
    // время ничего нового не изменил.
    if (!newerEdits && merged && !sameState(merged, snapshot)) {
      stateRef.current = merged;
      setStateRaw(merged);
    }
    writeCache();
    setSyncError(null);
    setLastSyncedAt(new Date());
    setSyncStatus(newerEdits ? 'saving' : 'saved');

    if (newerEdits) {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => void flushSave(), SAVE_DEBOUNCE_MS);
    }
  }, [writeCache]);

  const scheduleSave = useCallback(() => {
    if (modeRef.current !== 'bitrix') return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => void flushSave(), SAVE_DEBOUNCE_MS);
  }, [flushSave]);

  // Единственная точка изменения данных: пишет историю, помечает правку
  // несохранённой и ставит сохранение в очередь.
  const mutate = useCallback(
    (fn: (prev: DashboardState) => DashboardState) => {
      const prev = stateRef.current;
      const next = fn(prev);
      if (next === prev) return;

      // Внутри портала историю ведёт сервер (api/_store.js) — локально пишем
      // её только в автономном режиме, чтобы не забивать localStorage дублями.
      if (modeRef.current !== 'bitrix') recordLocalHistory(prev, next);
      stateRef.current = next;
      editSeqRef.current += 1;
      dirtyRef.current = true;
      retryStepRef.current = 0;
      setStateRaw(next);
      // правка поверх локальной копии = сотрудник выбрал её
      awaitingChoiceRef.current = false;
      setUnsyncedLocal(null);
      writeCache();
      scheduleSave();
    },
    [scheduleSave, writeCache]
  );

  const pull = useCallback(
    async ({ force = false, announce = false }: { force?: boolean; announce?: boolean } = {}) => {
      if (modeRef.current !== 'bitrix' && !force) return;
      if (awaitingChoiceRef.current) return;
      // Никогда не затираем несохранённые правки чтением с сервера — именно
      // из-за этого раньше внесённые данные «мигали» и пропадали.
      if (!force && (dirtyRef.current || savingRef.current)) return;

      // Фоновый опрос не мигает статусом в шапке — только явное обновление.
      if (announce) setSyncStatus('saving');
      const { data, error } = await loadDashboardRemote();
      if (error) {
        setSyncStatus('error');
        setSyncError(error);
        return;
      }
      setSyncError(null);

      if (data && data.state) {
        const remoteIsNewer = data.rev !== revRef.current && (data.rev > revRef.current || revRef.current === 0);
        if (!dirtyRef.current && !savingRef.current && remoteIsNewer) {
          applyRemote(data.state, data.rev);
        } else if (!dirtyRef.current && data.rev === revRef.current && !sameState(data.state, stateRef.current)) {
          // одинаковая версия, но содержимое разошлось — доверяем серверу
          applyRemote(data.state, data.rev);
        }
      }
      setLastSyncedAt(new Date());
      setSyncStatus(dirtyRef.current ? 'saving' : 'saved');
    },
    [applyRemote]
  );

  // Первичная инициализация: определяем, открыт ли инфоцентр внутри Битрикс24,
  // и подтягиваем общие данные портала.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isInIframe()) {
        modeRef.current = 'local';
        setSyncMode('local');
        return;
      }
      const ready = await bx24Init();
      if (cancelled) return;
      if (!ready) {
        modeRef.current = 'local';
        setSyncMode('local');
        return;
      }

      setSyncStatus('saving');
      const { data, error } = await loadDashboardRemote();
      if (cancelled) return;

      modeRef.current = 'bitrix';
      setSyncMode('bitrix');

      if (error) {
        setSyncStatus('error');
        setSyncError(error);
        return;
      }

      if (!data || !data.state) {
        // На портале ещё ничего не сохранено. Если в браузере есть правки —
        // отправляем их: терять нечего, а данные должны стать общими.
        if (dirtyRef.current) scheduleSave();
        setLastSyncedAt(new Date());
        setSyncStatus(dirtyRef.current ? 'saving' : 'saved');
        return;
      }

      {
        if (!dirtyRef.current) {
          applyRemote(data.state, data.rev);
        } else if (sameState(data.state, stateRef.current)) {
          // локальная копия совпала с порталом — «несохранённого» на самом деле нет
          applyRemote(data.state, data.rev);
        } else {
          // В браузере остались правки, не доехавшие до портала (последствия
          // старой ошибки сохранения). Показываем их и даём выбор — отправить
          // на портал или отказаться. Молча терять их нельзя.
          awaitingChoiceRef.current = true;
          setUnsyncedLocal({
            remoteState: data.state,
            remoteRev: data.rev,
            remoteUpdatedAt: data.updatedAt,
            remoteUpdatedBy: data.updatedBy,
          });
        }
      }
      setLastSyncedAt(new Date());
      setSyncStatus(dirtyRef.current ? 'idle' : 'saved');
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Подхватываем правки коллег: при возврате на вкладку и раз в ~45 секунд.
  useEffect(() => {
    if (syncMode !== 'bitrix') return;
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      if (dirtyRef.current) {
        void flushSave();
        return;
      }
      void pull();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    const timer = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      if (dirtyRef.current) void flushSave();
      else void pull();
    }, POLL_INTERVAL_MS);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
      clearInterval(timer);
    };
  }, [syncMode, pull, flushSave]);

  // Предупреждение при закрытии вкладки с неотправленными правками.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (modeRef.current === 'bitrix' && dirtyRef.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  useEffect(
    () => () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    },
    []
  );

  const addCard = useCallback(
    (tab: TabId, card: AnyCard) => mutate((prev) => ({ ...prev, [tab]: [...prev[tab], card] })),
    [mutate]
  );

  const updateCard = useCallback(
    (tab: TabId, card: AnyCard) =>
      mutate((prev) => ({ ...prev, [tab]: prev[tab].map((c) => (c.id === card.id ? card : c)) })),
    [mutate]
  );

  const deleteCard = useCallback(
    (tab: TabId, cardId: string) => mutate((prev) => ({ ...prev, [tab]: prev[tab].filter((c) => c.id !== cardId) })),
    [mutate]
  );

  const duplicateCard = useCallback(
    (tab: TabId, cardId: string) =>
      mutate((prev) => {
        const list = prev[tab];
        const idx = list.findIndex((c) => c.id === cardId);
        if (idx === -1) return prev;
        const clone: AnyCard = { ...list[idx], id: newCardId(), title: `${list[idx].title} (копия)` };
        const next = [...list];
        next.splice(idx + 1, 0, clone);
        return { ...prev, [tab]: next };
      }),
    [mutate]
  );

  const moveCard = useCallback(
    (tab: TabId, cardId: string, direction: -1 | 1) =>
      mutate((prev) => {
        const list = [...prev[tab]];
        const idx = list.findIndex((c) => c.id === cardId);
        const target = idx + direction;
        if (idx < 0 || target < 0 || target >= list.length) return prev;
        [list[idx], list[target]] = [list[target], list[idx]];
        return { ...prev, [tab]: list };
      }),
    [mutate]
  );

  const resetToSeed = useCallback(() => mutate(() => SEED_DATA), [mutate]);
  const clearAll = useCallback(() => mutate(() => EMPTY_DASHBOARD), [mutate]);
  const replaceAll = useCallback((next: DashboardState) => mutate(() => next), [mutate]);
  const refresh = useCallback(() => {
    if (dirtyRef.current) return flushSave();
    return pull({ announce: true });
  }, [pull, flushSave]);

  // Локальная копия, не доехавшая до портала: отправить её или отказаться.
  const keepLocalCopy = useCallback(() => {
    setUnsyncedLocal(null);
    awaitingChoiceRef.current = false;
    dirtyRef.current = true;
    editSeqRef.current += 1;
    writeCache();
    void flushSave();
  }, [flushSave, writeCache]);

  const discardLocalCopy = useCallback(() => {
    const remote = unsyncedLocal;
    setUnsyncedLocal(null);
    awaitingChoiceRef.current = false;
    if (!remote) return;
    dirtyRef.current = false;
    applyRemote(remote.remoteState, remote.remoteRev);
  }, [unsyncedLocal, applyRemote, pull]);

  const loadCardHistory = useCallback(
    async (tab: TabId, cardId: string): Promise<{ entries: CardHistoryEntry[]; error: string | null }> => {
      if (modeRef.current === 'bitrix') return fetchCardHistoryRemote(tab, cardId);
      return { entries: readLocalCardHistory(tab, cardId), error: null };
    },
    []
  );

  return {
    state,
    syncMode,
    syncStatus,
    syncError,
    lastSyncedAt,
    unsyncedLocal,
    keepLocalCopy,
    discardLocalCopy,
    refresh,
    addCard,
    updateCard,
    deleteCard,
    duplicateCard,
    moveCard,
    resetToSeed,
    clearAll,
    replaceAll,
    loadCardHistory,
  };
}
