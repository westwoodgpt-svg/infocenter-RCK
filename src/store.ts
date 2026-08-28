import { useCallback, useEffect, useRef, useState } from 'react';
import { AnyCard, BoardInfo, BootstrapInfo, DashboardState, SummarySection, TabId, UserRole } from './types';
import { SEED_DATA, EMPTY_DASHBOARD } from './seedData';
import {
  bootstrapRemote,
  bx24Init,
  CardHistoryEntry,
  fetchCardHistoryRemote,
  fetchSummaryRemote,
  isInIframe,
  LEGACY_BOARD_ID,
  loadDashboardRemote,
  saveDashboardRemote,
} from './bitrix';
import { readLocalCardHistory, recordLocalHistory } from './history';

// Кэш инфоцентра в браузере: свой на каждый отдел.
const CACHE_PREFIX = 'rck-dashboard-v2:';
// Ключ до разделения по отделам — переносится в кэш того инфоцентра, где теперь
// живут исторические данные РЦК.
const LEGACY_CACHE_KEY = 'rck-dashboard-v1';
const ACTIVE_BOARD_KEY = 'rck-active-board';

/** Псевдо-инфоцентр для работы вне Битрикс24 (данные только в этом браузере). */
export const LOCAL_BOARD_ID = 'local';

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

const emptyCache = (state: DashboardState): CachedDashboard => ({ state, rev: 0, dirty: false, savedAt: null });

function parseCache(raw: string | null): CachedDashboard | null {
  if (!raw) return null;
  try {
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
    // от правок, не доехавших до портала из-за старой ошибки сохранения,
    // поэтому считаем его несохранённым и предлагаем восстановить.
    if (parsed && typeof parsed === 'object' && Array.isArray((parsed as DashboardState).security)) {
      return { state: parsed as DashboardState, rev: 0, dirty: true, savedAt: null };
    }
  } catch {
    // повреждённый кэш — игнорируем
  }
  return null;
}

function readCache(boardId: string): CachedDashboard | null {
  try {
    return parseCache(localStorage.getItem(CACHE_PREFIX + boardId));
  } catch {
    return null;
  }
}

function writeCacheFor(boardId: string, cache: CachedDashboard) {
  try {
    localStorage.setItem(CACHE_PREFIX + boardId, JSON.stringify(cache));
  } catch {
    // хранилище недоступно (приватный режим, квота) — правки останутся в памяти
  }
}

// Старый кэш (когда инфоцентр был один) переносим в тот инфоцентр, где теперь
// лежат эти данные. Важно не потерять правки, не доехавшие до портала.
function adoptLegacyCache(boardId: string) {
  try {
    const legacy = localStorage.getItem(LEGACY_CACHE_KEY);
    if (!legacy) return;
    if (!localStorage.getItem(CACHE_PREFIX + boardId)) localStorage.setItem(CACHE_PREFIX + boardId, legacy);
    localStorage.removeItem(LEGACY_CACHE_KEY);
  } catch {
    // не критично
  }
}

let counter = 0;
export function newCardId() {
  counter += 1;
  return `card-${Date.now()}-${counter}`;
}

const sameState = (a: DashboardState, b: DashboardState) => JSON.stringify(a) === JSON.stringify(b);

export interface UnsyncedLocalCopy {
  boardId: string;
  remoteState: DashboardState;
  remoteRev: number;
  remoteUpdatedAt: string | null;
  remoteUpdatedBy: string | null;
}

const LOCAL_BOARD: BoardInfo = { id: LOCAL_BOARD_ID, title: 'Инфоцентр (этот браузер)', canEdit: true };

export function useDashboardStore() {
  const [state, setStateRaw] = useState<DashboardState>(SEED_DATA);
  const [syncMode, setSyncMode] = useState<SyncMode>('checking');
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [unsyncedLocal, setUnsyncedLocal] = useState<UnsyncedLocalCopy | null>(null);

  // Инфоцентры, доступные открывшему приложение (определяет сервер по отделам).
  const [boards, setBoardsState] = useState<BoardInfo[]>([]);
  const [activeBoardId, setActiveBoardId] = useState<string>(LOCAL_BOARD_ID);
  const [role, setRole] = useState<UserRole>('employee');
  const [me, setMe] = useState<BootstrapInfo['me'] | null>(null);
  const [canSeeSummary, setCanSeeSummary] = useState(false);
  const [accessWarning, setAccessWarning] = useState<string | null>(null);

  // Синхронизация живёт на ref-ах: таймеры и обработчики должны видеть
  // актуальные значения, а не те, что были на момент их создания.
  const stateRef = useRef<DashboardState>(SEED_DATA);
  const boardRef = useRef<string>(LOCAL_BOARD_ID);
  const legacyBoardRef = useRef<string>(LEGACY_BOARD_ID);
  const revRef = useRef(0);
  const dirtyRef = useRef(false);
  const savedAtRef = useRef<string | null>(null);
  const editSeqRef = useRef(0);
  const savingRef = useRef(false);
  const modeRef = useRef<SyncMode>('checking');
  const canEditRef = useRef(true);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryStepRef = useRef(0);
  // Пока сотрудник не решил, что делать с локальной копией, ничего не
  // отправляем и не подтягиваем — иначе выбор сделается за него.
  const awaitingChoiceRef = useRef(false);

  const boardsRef = useRef<BoardInfo[]>([]);
  const setBoards = useCallback((list: BoardInfo[]) => {
    boardsRef.current = list;
    setBoardsState(list);
  }, []);

  const activeBoard = boards.find((b) => b.id === activeBoardId) || null;
  const canEdit = activeBoard ? activeBoard.canEdit : syncMode === 'local';

  const writeCache = useCallback(() => {
    writeCacheFor(boardRef.current, {
      state: stateRef.current,
      rev: revRef.current,
      dirty: dirtyRef.current,
      savedAt: savedAtRef.current,
    });
  }, []);

  // Применение состояния, пришедшего с сервера. Вызывается только когда
  // локальных несохранённых изменений нет — свои правки не теряем.
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
    if (!canEditRef.current) return; // права проверяет и сервер, но незачем ломиться зря

    savingRef.current = true;
    const boardId = boardRef.current;
    const snapshot = stateRef.current;
    const seqAtStart = editSeqRef.current;
    const baseRev = revRef.current;
    setSyncStatus('saving');

    const { ok, rev, state: merged, error } = await saveDashboardRemote(boardId, snapshot, baseRev);

    savingRef.current = false;
    if (boardRef.current !== boardId) return; // за время запроса переключились на другой инфоцентр

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
    // забираем результат слияния, если пользователь за это время ничего не менял.
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
      if (!canEditRef.current) return;
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
    async ({ announce = false }: { announce?: boolean } = {}) => {
      if (modeRef.current !== 'bitrix') return;
      if (awaitingChoiceRef.current) return;
      // Никогда не затираем несохранённые правки чтением с сервера — именно
      // из-за этого раньше внесённые данные «мигали» и пропадали.
      if (dirtyRef.current || savingRef.current) return;

      // Фоновый опрос не мигает статусом в шапке — только явное обновление.
      if (announce) setSyncStatus('saving');
      const boardId = boardRef.current;
      const { data, error } = await loadDashboardRemote(boardId, legacyBoardRef.current);
      if (boardRef.current !== boardId) return;

      if (error) {
        setSyncStatus('error');
        setSyncError(error);
        return;
      }
      setSyncError(null);

      if (data && data.state && !dirtyRef.current && !savingRef.current) {
        const remoteIsNewer = data.rev !== revRef.current && (data.rev > revRef.current || revRef.current === 0);
        if (remoteIsNewer || (data.rev === revRef.current && !sameState(data.state, stateRef.current))) {
          applyRemote(data.state, data.rev);
        }
      }
      setLastSyncedAt(new Date());
      setSyncStatus(dirtyRef.current ? 'saving' : 'saved');
    },
    [applyRemote]
  );

  // Открыть инфоцентр: поднять кэш этого отдела, показать его и подтянуть
  // актуальную версию с сервера.
  const openBoard = useCallback(
    async (boardId: string, { fromCacheOnly = false }: { fromCacheOnly?: boolean } = {}) => {
      boardRef.current = boardId;
      const board = boardsRef.current.find((b) => b.id === boardId);
      canEditRef.current = board ? board.canEdit : modeRef.current !== 'bitrix';
      setActiveBoardId(boardId);
      try {
        localStorage.setItem(ACTIVE_BOARD_KEY, boardId);
      } catch {
        // не критично
      }

      const cache = readCache(boardId) || emptyCache(EMPTY_DASHBOARD);
      stateRef.current = cache.state;
      revRef.current = cache.rev;
      dirtyRef.current = cache.dirty;
      savedAtRef.current = cache.savedAt;
      editSeqRef.current += 1;
      awaitingChoiceRef.current = false;
      setUnsyncedLocal(null);
      setStateRaw(cache.state);
      setSyncError(null);

      if (fromCacheOnly || modeRef.current !== 'bitrix') return;

      setSyncStatus('saving');
      const { data, error } = await loadDashboardRemote(boardId, legacyBoardRef.current);
      if (boardRef.current !== boardId) return;

      if (error) {
        setSyncStatus('error');
        setSyncError(error);
        return;
      }

      if (!data || !data.state) {
        // Инфоцентр этого отдела ещё пуст. Если в браузере есть правки — они
        // уйдут на портал: терять нечего.
        if (dirtyRef.current) scheduleSave();
        setLastSyncedAt(new Date());
        setSyncStatus(dirtyRef.current ? 'saving' : 'saved');
        return;
      }

      if (!dirtyRef.current || sameState(data.state, stateRef.current)) {
        applyRemote(data.state, data.rev);
      } else {
        // В браузере остались правки, не доехавшие до портала (последствия
        // старой ошибки сохранения). Показываем их и даём выбор.
        awaitingChoiceRef.current = true;
        setUnsyncedLocal({
          boardId,
          remoteState: data.state,
          remoteRev: data.rev,
          remoteUpdatedAt: data.updatedAt,
          remoteUpdatedBy: data.updatedBy,
        });
      }
      setLastSyncedAt(new Date());
      setSyncStatus(dirtyRef.current ? 'idle' : 'saved');
    },
    [applyRemote, scheduleSave]
  );

  // Первичная инициализация: кто открыл, какие инфоцентры доступны, какой открыть.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const startLocal = () => {
        modeRef.current = 'local';
        setSyncMode('local');
        setBoards([LOCAL_BOARD]);
        adoptLegacyCache(LOCAL_BOARD_ID);
        const cache = readCache(LOCAL_BOARD_ID) || emptyCache(SEED_DATA);
        boardRef.current = LOCAL_BOARD_ID;
        setActiveBoardId(LOCAL_BOARD_ID);
        stateRef.current = cache.state;
        revRef.current = cache.rev;
        dirtyRef.current = cache.dirty;
        savedAtRef.current = cache.savedAt;
        setStateRaw(cache.state);
      };

      if (!isInIframe()) {
        startLocal();
        return;
      }
      const ready = await bx24Init();
      if (cancelled) return;
      if (!ready) {
        startLocal();
        return;
      }

      setSyncStatus('saving');
      const { data: info, error } = await bootstrapRemote();
      if (cancelled) return;

      if (error || !info) {
        // Список инфоцентров получить не удалось (Redis, права, сеть). Не
        // запираем сотрудника: открываем исторический инфоцентр РЦК — его
        // чтение умеет запасной путь через app.option.
        modeRef.current = 'bitrix';
        setSyncMode('bitrix');
        setBoards([{ id: LEGACY_BOARD_ID, title: 'Инфоцентр РЦК', canEdit: true }]);
        setAccessWarning(`Не удалось получить список инфоцентров по отделам: ${error || 'неизвестная ошибка'}`);
        legacyBoardRef.current = LEGACY_BOARD_ID;
        adoptLegacyCache(LEGACY_BOARD_ID);
        await openBoard(LEGACY_BOARD_ID);
        return;
      }

      modeRef.current = 'bitrix';
      setSyncMode('bitrix');
      setBoards(info.boards);
      setRole(info.role);
      setMe(info.me);
      setCanSeeSummary(info.canSeeSummary);
      setAccessWarning(info.warning);
      legacyBoardRef.current = info.legacyBoardId;
      adoptLegacyCache(info.legacyBoardId);

      let preferred: string | null = null;
      try {
        preferred = localStorage.getItem(ACTIVE_BOARD_KEY);
      } catch {
        preferred = null;
      }
      const target =
        (preferred && info.boards.some((b) => b.id === preferred) ? preferred : null) ||
        info.defaultBoardId ||
        (info.boards[0] ? info.boards[0].id : null);

      if (!target) {
        setSyncStatus('idle');
        return;
      }
      await openBoard(target);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    canEditRef.current = activeBoard ? activeBoard.canEdit : syncMode === 'local';
  }, [activeBoard, syncMode]);

  // Подхватываем правки коллег: при возврате на вкладку и раз в ~45 секунд.
  useEffect(() => {
    if (syncMode !== 'bitrix') return;
    const tick = () => {
      if (document.visibilityState !== 'visible') return;
      if (dirtyRef.current) void flushSave();
      else void pull();
    };
    document.addEventListener('visibilitychange', tick);
    window.addEventListener('focus', tick);
    const timer = setInterval(tick, POLL_INTERVAL_MS);
    return () => {
      document.removeEventListener('visibilitychange', tick);
      window.removeEventListener('focus', tick);
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

  // Переключение инфоцентра: сначала дожимаем несохранённое, потом открываем новый.
  const switchBoard = useCallback(
    async (boardId: string) => {
      if (boardId === boardRef.current) return;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (dirtyRef.current && modeRef.current === 'bitrix' && !awaitingChoiceRef.current) await flushSave();
      await openBoard(boardId);
    },
    [flushSave, openBoard]
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
    const pending = unsyncedLocal;
    setUnsyncedLocal(null);
    awaitingChoiceRef.current = false;
    if (!pending || pending.boardId !== boardRef.current) return;
    dirtyRef.current = false;
    applyRemote(pending.remoteState, pending.remoteRev);
  }, [unsyncedLocal, applyRemote]);

  const loadCardHistory = useCallback(
    async (tab: TabId, cardId: string): Promise<{ entries: CardHistoryEntry[]; error: string | null }> => {
      if (modeRef.current === 'bitrix') return fetchCardHistoryRemote(boardRef.current, tab, cardId);
      return { entries: readLocalCardHistory(tab, cardId), error: null };
    },
    []
  );

  const loadSummary = useCallback(
    async (tab: TabId): Promise<{ sections: SummarySection[]; error: string | null }> => {
      if (modeRef.current !== 'bitrix') return { sections: [], error: 'сводный экран доступен только внутри Битрикс24' };
      return fetchSummaryRemote(tab);
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
    boards,
    activeBoardId,
    activeBoard,
    canEdit,
    role,
    me,
    canSeeSummary,
    accessWarning,
    switchBoard,
    loadSummary,
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
