import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { History, ChevronLeft, ChevronRight, RotateCcw, X, Loader2, AlertTriangle } from 'lucide-react';
import { AnyCard, TabId } from '../../types';
import { CardHistoryEntry } from '../../bitrix';

export interface CardVersion {
  card: AnyCard;
  at: string | null;
  by: string | null;
  /** Версия сохранена без тяжёлого изображения. */
  trimmed?: boolean;
  /** Это то, что показывается на дашборде сейчас. */
  current: boolean;
}

interface Props {
  tab: TabId;
  card: AnyCard;
  editMode: boolean;
  loadHistory: (tab: TabId, cardId: string) => Promise<{ entries: CardHistoryEntry[]; error: string | null }>;
  /** Индекс выбранной версии; null — показывается текущая. */
  selected: number | null;
  onSelect: (version: CardVersion | null, index: number | null) => void;
  onRestore: (card: AnyCard) => void;
}

function formatStamp(at: string | null): string {
  if (!at) return 'сейчас';
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return at;
  return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default function CardHistoryBar({ tab, card, editMode, loadHistory, selected, onSelect, onRestore }: Props) {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<CardHistoryEntry[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const versions = useMemo<CardVersion[]>(() => {
    const past: CardVersion[] = (entries ?? [])
      .filter((e) => e.action !== 'delete' && e.card)
      .map((e) => ({ card: e.card, at: e.at, by: e.by, trimmed: e.trimmed, current: false }));

    const last = past[past.length - 1];
    if (last && JSON.stringify(last.card) === JSON.stringify(card)) {
      // последняя запись истории и есть текущее содержимое карточки
      past[past.length - 1] = { ...last, current: true };
      return past;
    }
    past.push({ card, at: null, by: null, current: true });
    return past;
  }, [entries, card]);

  const currentIndex = versions.length - 1;
  const activeIndex = selected == null ? currentIndex : Math.min(selected, currentIndex);
  const active = versions[activeIndex];

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { entries: fetched, error: err } = await loadHistory(tab, card.id);
    setEntries(fetched);
    setError(err);
    setLoading(false);
  }, [loadHistory, tab, card.id]);

  const toggle = () => {
    if (open) {
      setOpen(false);
      onSelect(null, null);
      return;
    }
    setOpen(true);
    if (entries === null) void fetchHistory();
  };

  // Карточку изменили, пока таймлайн открыт — история устарела, перечитываем.
  useEffect(() => {
    if (!open) return;
    void fetchHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card]);

  const select = (index: number) => {
    const clamped = Math.max(0, Math.min(index, currentIndex));
    if (clamped === currentIndex) onSelect(null, null);
    else onSelect(versions[clamped], clamped);
  };

  return (
    <div className="border-t border-[#1f1f23]">
      <button
        type="button"
        onClick={toggle}
        title="История изменений карточки"
        className={`w-full flex items-center gap-1.5 px-4 py-2 text-[11px] font-medium transition-colors ${
          open ? 'text-indigo-300' : 'text-[#52525b] hover:text-indigo-300'
        }`}
      >
        <History className="w-3.5 h-3.5" />
        История изменений
        {selected != null && (
          <span className="ml-auto flex items-center gap-1 text-amber-300">
            <AlertTriangle className="w-3 h-3" /> показана прошлая версия
          </span>
        )}
      </button>

      {open && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="px-4 pb-4 overflow-hidden">
          {loading && (
            <p className="flex items-center gap-2 text-[11px] text-[#71717a]">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Загружаем историю…
            </p>
          )}

          {!loading && error && (
            <p className="text-[11px] text-rose-400">Не удалось загрузить историю: {error}</p>
          )}

          {!loading && !error && versions.length < 2 && (
            <p className="text-[11px] text-[#71717a]">
              Пока сохранена только текущая версия — следующие правки появятся здесь как точки на шкале.
            </p>
          )}

          {!loading && !error && versions.length > 1 && (
            <div className="space-y-2.5">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => select(activeIndex - 1)}
                  disabled={activeIndex === 0}
                  title="Предыдущая версия"
                  className="p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-30 transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>

                <input
                  type="range"
                  min={0}
                  max={currentIndex}
                  step={1}
                  value={activeIndex}
                  onChange={(e) => select(Number(e.target.value))}
                  aria-label="Версия карточки"
                  className="history-slider flex-1"
                />

                <button
                  type="button"
                  onClick={() => select(activeIndex + 1)}
                  disabled={activeIndex === currentIndex}
                  title="Следующая версия"
                  className="p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-30 transition-colors"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px]">
                <span className="text-[#71717a]">
                  Версия <span className="text-white font-mono">{activeIndex + 1}</span>
                  <span className="text-[#3f3f46]"> / {versions.length}</span>
                </span>
                <span className={active.current ? 'text-emerald-300' : 'text-amber-300'}>
                  {active.current ? 'текущая' : formatStamp(active.at)}
                  {!active.current && active.by ? ` · ${active.by}` : ''}
                </span>
                {active.trimmed && <span className="text-[#71717a]">изображение в этой версии не сохранено</span>}

                {!active.current && (
                  <span className="flex items-center gap-2 ml-auto">
                    {editMode && (
                      <button
                        type="button"
                        onClick={() => {
                          onRestore(active.card);
                          onSelect(null, null);
                        }}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-500/15 border border-indigo-500/40 text-indigo-300 hover:bg-indigo-500/25 transition-colors"
                      >
                        <RotateCcw className="w-3 h-3" /> Восстановить
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => select(currentIndex)}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-800/70 border border-zinc-700/60 text-zinc-300 hover:text-white transition-colors"
                    >
                      <X className="w-3 h-3" /> К текущей
                    </button>
                  </span>
                )}
              </div>

              <div className="flex justify-between text-[10px] text-[#3f3f46] font-mono">
                <span>{formatStamp(versions[0].at)}</span>
                <span>сейчас</span>
              </div>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
