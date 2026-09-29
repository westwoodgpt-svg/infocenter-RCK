import { useCallback, useEffect, useRef, useState } from 'react';
import { ShowcaseNote, ShowcaseState } from './types';
import { SHOWCASE_SEED } from './showcaseSeed';
import {
  fetchNoteHistoryRemote,
  loadShowcaseRemote,
  NoteHistoryEntry,
  saveShowcaseRemote,
  ShowcaseUploads,
} from './bitrix';
import type { SyncMode, SyncStatus } from './store';

// Витрина — один общий экран для всей компании. Синхронизация устроена так же,
// как у инфоцентров отделов (см. store.ts): правка сразу попадает в кэш
// браузера, отправляется на портал с номером версии, от которой отталкивалась,
// а сервер сливает её с правками коллег. Несохранённое никогда не затирается
// чтением с сервера.

const CACHE_KEY = 'rck-showcase-v1';
const LOCAL_CACHE_KEY = 'rck-showcase-local-v1';
const LOCAL_HISTORY_KEY = 'rck-showcase-history-v1';
const LOCAL_HISTORY_MAX = 25;
const LOCAL_HISTORY_ENTRY_MAX_BYTES = 60_000;

const SAVE_DEBOUNCE_MS = 500;
const RETRY_DELAYS_MS = [4000, 10000, 20000, 30000];
const POLL_INTERVAL_MS = 45000;

interface CachedShowcase {
  state: ShowcaseState;
  rev: number;
  dirty: boolean;
}

function normalize(raw: unknown): ShowcaseState {
  const src = raw && typeof raw === 'object' ? (raw as Partial<ShowcaseState>) : {};
  return {
    columns: Array.isArray(src.columns) ? src.columns.filter((c) => c && c.id) : [],
    notes: Array.isArray(src.notes) ? src.notes.filter((n) => n && n.id) : [],
  };
}

function readCache(key: string): CachedShowcase | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedShowcase;
    if (!parsed || !parsed.state) return null;
    return { state: normalize(parsed.state), rev: Number(parsed.rev) || 0, dirty: Boolean(parsed.dirty) };
  } catch {
    return null;
  }
}

function writeCache(key: string, cache: CachedShowcase) {
  try {
    localStorage.setItem(key, JSON.stringify(cache));
  } catch {
    // квота или приватный режим — правки останутся в памяти и уйдут на портал
  }
}

const same = (a: ShowcaseState, b: ShowcaseState) => JSON.stringify(a) === JSON.stringify(b);

// --- История стикеров в автономном режиме (внутри портала её ведёт сервер) ---

type LocalHistory = Record<string, NoteHistoryEntry[]>;

function readLocalHistory(): LocalHistory {
  try {
    const raw = localStorage.getItem(LOCAL_HISTORY_KEY);
    return raw ? (JSON.parse(raw) as LocalHistory) : {};
  } catch {
    return {};
  }
}

function recordLocalHistory(prev: ShowcaseState, next: ShowcaseState) {
  const prevById = new Map(prev.notes.map((n) => [n.id, n]));
  const nextIds = new Set(next.notes.map((n) => n.id));
  const at = new Date().toISOString();
  const changes: NoteHistoryEntry[] = [];
  for (const note of next.notes) {
    const before = prevById.get(note.id);
    if (!before) changes.push({ at, by: 'этот браузер', action: 'create', card: note });
    else if (JSON.stringify(before) !== JSON.stringify(note)) changes.push({ at, by: 'этот браузер', action: 'update', card: note });
  }
  for (const note of prev.notes) {
    if (!nextIds.has(note.id)) changes.push({ at, by: 'этот браузер', action: 'delete', card: note });
  }
  if (!changes.length) return;

  const history = readLocalHistory();
  for (let entry of changes) {
    if (JSON.stringify(entry).length > LOCAL_HISTORY_ENTRY_MAX_BYTES) {
      const card: ShowcaseNote = {
        ...entry.card,
        attachments: (entry.card.attachments || []).map((a) => (a.url.startsWith('data:') ? { ...a, url: '' } : a)),
      };
      entry = { ...entry, card, trimmed: true };
    }
    const list = [...(history[entry.card.id] || []), entry];
    history[entry.card.id] = list.slice(-LOCAL_HISTORY_MAX);
  }
  try {
    localStorage.setItem(LOCAL_HISTORY_KEY, JSON.stringify(history));
  } catch {
    // история необязательна
  }
}

export type ShowcaseMutator = (fn: (prev: ShowcaseState) => ShowcaseState) => void;

/**
 * @param syncMode режим работы приложения (определяет основное хранилище, store.ts)
 * @param active   витрина сейчас открыта — только тогда ходим на сервер и опрашиваем его
 */
export function useShowcaseStore(syncMode: SyncMode, active: boolean) {
  const [state, setStateRaw] = useState<ShowcaseState>(SHOWCASE_SEED);
  const [status, setStatus] = useState<SyncStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [uploads, setUploads] = useState<ShowcaseUploads>('inline');
  const [loaded, setLoaded] = useState(false);

  const stateRef = useRef<ShowcaseState>(SHOWCASE_SEED);
  const revRef = useRef(0);
  const dirtyRef = useRef(false);
  const savingRef = useRef(false);
  const editSeqRef = useRef(0);
  const retryStepRef = useRef(0);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const modeRef = useRef<SyncMode>(syncMode);
  const initializedRef = useRef(false);

  const cacheKey = () => (modeRef.current === 'bitrix' ? CACHE_KEY : LOCAL_CACHE_KEY);
  const persist = useCallback(() => {
    writeCache(cacheKey(), { state: stateRef.current, rev: revRef.current, dirty: dirtyRef.current });
  }, []);

  const apply = useCallback(
    (next: ShowcaseState, rev: number) => {
      stateRef.current = next;
      revRef.current = rev;
      dirtyRef.current = false;
      setStateRaw(next);
      persist();
    },
    [persist]
  );

  // Кэш поднимаем, как только стало понятно, где работаем (портал или браузер).
  useEffect(() => {
    modeRef.current = syncMode;
    if (syncMode === 'checking' || initializedRef.current) return;
    initializedRef.current = true;
    const cache = readCache(cacheKey());
    if (cache) {
      stateRef.current = cache.state;
      revRef.current = cache.rev;
      dirtyRef.current = cache.dirty;
      setStateRaw(cache.state);
    }
    if (syncMode === 'local') setLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncMode]);

  const flushSave = useCallback(async () => {
    if (modeRef.current !== 'bitrix' || savingRef.current || !dirtyRef.current) return;
    savingRef.current = true;
    const snapshot = stateRef.current;
    const seqAtStart = editSeqRef.current;
    const baseRev = revRef.current;
    setStatus('saving');

    const { ok, rev, state: merged, error: err } = await saveShowcaseRemote(snapshot, baseRev);
    savingRef.current = false;

    if (!ok) {
      setStatus('error');
      setError(err);
      const delay = RETRY_DELAYS_MS[Math.min(retryStepRef.current, RETRY_DELAYS_MS.length - 1)];
      retryStepRef.current += 1;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => void flushSave(), delay);
      return;
    }

    retryStepRef.current = 0;
    revRef.current = rev ?? baseRev;
    const newerEdits = editSeqRef.current !== seqAtStart;
    dirtyRef.current = newerEdits;
    if (!newerEdits && merged && !same(normalize(merged), snapshot)) {
      stateRef.current = normalize(merged);
      setStateRaw(stateRef.current);
    }
    persist();
    setError(null);
    setLastSyncedAt(new Date());
    setStatus(newerEdits ? 'saving' : 'saved');
    if (newerEdits) {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => void flushSave(), SAVE_DEBOUNCE_MS);
    }
  }, [persist]);

  const scheduleSave = useCallback(() => {
    if (modeRef.current !== 'bitrix') return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => void flushSave(), SAVE_DEBOUNCE_MS);
  }, [flushSave]);

  const pull = useCallback(
    async ({ announce = false }: { announce?: boolean } = {}) => {
      if (modeRef.current !== 'bitrix') return;
      if (dirtyRef.current || savingRef.current) return;
      if (announce) setStatus('saving');
      const { data, error: err } = await loadShowcaseRemote();
      if (err || !data) {
        setStatus('error');
        setError(err);
        return;
      }
      setError(null);
      setUploads(data.uploads);
      setLoaded(true);
      if (dirtyRef.current || savingRef.current) {
        // сотрудник успел что-то поменять, пока шёл запрос — его правка важнее
      } else if (data.state) {
        const remote = normalize(data.state);
        if (data.rev !== revRef.current || !same(remote, stateRef.current)) apply(remote, data.rev);
      } else if (revRef.current !== 0) {
        // на портале витрина пуста, а у нас кэш прошлой версии — показываем стартовую
        apply(SHOWCASE_SEED, 0);
      }
      setLastSyncedAt(new Date());
      setStatus(dirtyRef.current ? 'saving' : 'saved');
    },
    [apply]
  );

  // Первое открытие витрины внутри портала: дожимаем то, что осталось
  // несохранённым в браузере, или подтягиваем актуальную версию.
  useEffect(() => {
    if (!active || syncMode !== 'bitrix') return;
    if (dirtyRef.current) {
      void flushSave().then(() => pull());
    } else {
      void pull({ announce: !loaded });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, syncMode]);

  // Пока витрина открыта — подхватываем правки коллег.
  useEffect(() => {
    if (!active || syncMode !== 'bitrix') return;
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
  }, [active, syncMode, pull, flushSave]);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (modeRef.current === 'bitrix' && dirtyRef.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  const mutate = useCallback<ShowcaseMutator>(
    (fn) => {
      const prev = stateRef.current;
      const next = fn(prev);
      if (next === prev) return;
      if (modeRef.current !== 'bitrix') recordLocalHistory(prev, next);
      stateRef.current = next;
      editSeqRef.current += 1;
      dirtyRef.current = true;
      retryStepRef.current = 0;
      setStateRaw(next);
      persist();
      scheduleSave();
    },
    [persist, scheduleSave]
  );

  const refresh = useCallback(() => {
    if (dirtyRef.current) return flushSave();
    return pull({ announce: true });
  }, [flushSave, pull]);

  const loadNoteHistory = useCallback(async (noteId: string): Promise<{ entries: NoteHistoryEntry[]; error: string | null }> => {
    if (modeRef.current === 'bitrix') return fetchNoteHistoryRemote(noteId);
    return { entries: readLocalHistory()[noteId] || [], error: null };
  }, []);

  return { state, status, error, lastSyncedAt, uploads, loaded, mutate, refresh, loadNoteHistory };
}
