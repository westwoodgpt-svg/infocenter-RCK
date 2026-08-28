import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, Building2, Loader2, RefreshCw } from 'lucide-react';
import { SummarySection, TabId } from '../types';
import CardShell from './cards/CardShell';
import CardView from './cards/CardView';
import { effectiveIndicator } from './cards/chartStatus';

interface Props {
  tab: TabId;
  tabLabel: string;
  loadSummary: (tab: TabId) => Promise<{ sections: SummarySection[]; error: string | null }>;
  onOpenBoard: (boardId: string) => void;
}

function formatStamp(at: string | null): string {
  if (!at) return 'ещё не заполнялся';
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return at;
  return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

// Сводный экран: выбранная вкладка по всем доступным инфоцентрам сразу.
// Только просмотр — правки вносятся в инфоцентре своего отдела.
export default function SummaryBoard({ tab, tabLabel, loadSummary, onOpenBoard }: Props) {
  const [sections, setSections] = useState<SummarySection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadSummary(tab).then(({ sections: loaded, error: err }) => {
      if (cancelled) return;
      setSections(loaded);
      setError(err);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [tab, loadSummary]);

  if (loading) {
    return (
      <div className="elegant-card rounded-2xl p-12 flex items-center justify-center gap-2.5 text-sm text-[#a1a1aa]">
        <Loader2 className="w-4 h-4 animate-spin text-indigo-400" /> Собираем данные по отделам…
      </div>
    );
  }

  if (error) {
    return (
      <div className="elegant-card rounded-2xl p-6 border border-rose-500/30 bg-rose-500/5 text-sm text-rose-200">
        Не удалось собрать сводку: {error}
      </div>
    );
  }

  const filled = sections.filter((s) => s.cards.length > 0);
  const empty = sections.filter((s) => s.cards.length === 0);

  return (
    <div className="space-y-8">
      <div className="elegant-card rounded-2xl px-5 py-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="flex items-center gap-2 text-sm font-bold text-white font-display">
          <Building2 className="w-4 h-4 text-indigo-400" /> Сводный экран · {tabLabel}
        </span>
        <span className="text-xs text-[#71717a]">
          Отделов: <span className="text-white font-mono">{sections.length}</span> · с данными на этой вкладке:{' '}
          <span className="text-white font-mono">{filled.length}</span>
        </span>
        <span className="text-xs text-[#52525b] ml-auto">Только просмотр — правки вносятся в инфоцентре отдела</span>
      </div>

      {filled.map((section) => (
        <motion.section
          key={section.boardId}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <div className="flex flex-wrap items-center gap-3 px-1">
            <h2 className="text-base font-extrabold text-white font-display">{section.title}</h2>
            <span className="text-[11px] text-[#71717a]">
              обновлён {formatStamp(section.updatedAt)}
              {section.updatedBy ? ` · ${section.updatedBy}` : ''}
            </span>
            <button
              onClick={() => onOpenBoard(section.boardId)}
              className="ml-auto flex items-center gap-1.5 text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              Открыть инфоцентр <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {section.cards.map((card) => (
              <CardShell
                key={`${section.boardId}-${card.id}`}
                editMode={false}
                onEdit={() => {}}
                onDelete={() => {}}
                className={card.type === 'chart' || card.type === 'events' || card.type === 'table' ? 'xl:col-span-2' : ''}
                indicator={effectiveIndicator(card)}
              >
                <CardView card={card} />
              </CardShell>
            ))}
          </div>
        </motion.section>
      ))}

      {filled.length === 0 && (
        <div className="elegant-card rounded-2xl p-12 text-center text-sm text-[#a1a1aa]">
          На вкладке «{tabLabel}» пока нет карточек ни в одном отделе.
        </div>
      )}

      {empty.length > 0 && (
        <div className="elegant-card rounded-2xl px-5 py-4 flex flex-wrap items-center gap-2 text-xs text-[#71717a]">
          <RefreshCw className="w-3.5 h-3.5 text-[#52525b]" />
          <span>Без карточек на этой вкладке:</span>
          {empty.map((section) => (
            <button
              key={section.boardId}
              onClick={() => onOpenBoard(section.boardId)}
              className="px-2.5 py-1 rounded-lg bg-[#161619] border border-[#27272a] text-zinc-300 hover:text-white transition-colors"
            >
              {section.title}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
