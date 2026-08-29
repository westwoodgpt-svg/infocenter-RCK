import { useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Eye,
  EyeOff,
  Loader2,
  RotateCcw,
  Save,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import {
  CARD_TYPE_LABELS,
  EMPTY_SUMMARY_CONFIG,
  SummaryConfig,
  SummarySection,
  TabId,
} from '../types';
import { isBoardVisible, moveBoard, prefFor, selectedCardIds, withBoardPref } from '../summaryConfig';

interface Props {
  /** Все доступные отделы с их карточками на текущей вкладке — до применения настройки. */
  sections: SummarySection[];
  tab: TabId;
  tabLabel: string;
  config: SummaryConfig;
  saving: boolean;
  error: string | null;
  onApply: (config: SummaryConfig) => void;
  onClose: () => void;
}

// Редактор сводного экрана: руководитель сам выбирает, из каких отделов и какие
// именно карточки собирать сводку. Настройка личная — у коллег своя.
export default function SummaryEditor({ sections, tab, tabLabel, config, saving, error, onApply, onClose }: Props) {
  const [draft, setDraft] = useState<SummaryConfig>(config);
  const [expanded, setExpanded] = useState<string | null>(null);

  // Порядок отделов в редакторе — тот же, что и на самом сводном экране.
  const orderIndex = (boardId: string) => {
    const idx = draft.order.indexOf(boardId);
    return idx === -1 ? Number.MAX_SAFE_INTEGER : idx;
  };
  const ordered = sections
    .map((section, i) => ({ section, i }))
    .sort((a, b) => orderIndex(a.section.boardId) - orderIndex(b.section.boardId) || a.i - b.i)
    .map(({ section }) => section);
  const boardIds = ordered.map((s) => s.boardId);

  const toggleBoard = (boardId: string) => {
    const pref = prefFor(draft, boardId);
    setDraft(withBoardPref(draft, boardId, { ...pref, hidden: !pref.hidden }));
  };

  const setCards = (boardId: string, ids: string[] | null) => {
    const pref = prefFor(draft, boardId);
    const cards = { ...(pref.cards || {}) };
    if (ids === null) delete cards[tab];
    else cards[tab] = ids;
    setDraft(withBoardPref(draft, boardId, { ...pref, cards: Object.keys(cards).length ? cards : undefined }));
  };

  const toggleCard = (section: SummarySection, cardId: string) => {
    const current = selectedCardIds(draft, section.boardId, tab) ?? section.cards.map((c) => c.id);
    const next = current.includes(cardId) ? current.filter((id) => id !== cardId) : [...current, cardId];
    // Выбраны все карточки отдела — возвращаемся к режиму «все» (тогда новые
    // карточки отдела появятся в сводке сами, без правки настройки).
    if (next.length === section.cards.length) setCards(section.boardId, null);
    else setCards(section.boardId, next);
  };

  const move = (boardId: string, direction: -1 | 1) => setDraft(moveBoard(draft, boardIds, boardId, direction));

  const visibleCount = ordered.filter((s) => isBoardVisible(draft, s.boardId)).length;

  return (
    <div className="elegant-card rounded-2xl border border-indigo-500/25 bg-indigo-500/[0.03] p-5 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex items-center gap-2 text-sm font-bold text-white font-display">
          <SlidersHorizontal className="w-4 h-4 text-indigo-400" /> Что показывать на сводном экране
        </span>
        <span className="text-[11px] text-[#71717a]">
          Отделов выбрано: <span className="text-white font-mono">{visibleCount}</span> из{' '}
          <span className="font-mono">{ordered.length}</span> · карточки настраиваются отдельно для каждой вкладки
          (сейчас — «{tabLabel}»)
        </span>
        <button
          onClick={onClose}
          title="Закрыть настройку"
          className="ml-auto p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <p className="text-[11px] text-[#71717a] leading-relaxed">
        Настройка личная: она меняет только ваш сводный экран и хранится на портале, поэтому переезжает вместе с вами на
        другой компьютер. Инфоцентры отделов при этом не меняются.
      </p>

      <div className="space-y-2">
        {ordered.map((section, idx) => {
          const visible = isBoardVisible(draft, section.boardId);
          const selected = selectedCardIds(draft, section.boardId, tab);
          const isOpen = expanded === section.boardId;
          return (
            <div
              key={section.boardId}
              className={`rounded-xl border transition-colors ${
                visible ? 'border-[#27272a] bg-[#131316]' : 'border-[#1f1f23] bg-[#0d0d0f] opacity-60'
              }`}
            >
              <div className="flex flex-wrap items-center gap-2 px-3 py-2.5">
                <button
                  onClick={() => toggleBoard(section.boardId)}
                  title={visible ? 'Убрать отдел со сводного экрана' : 'Показывать отдел на сводном экране'}
                  className={`flex items-center gap-2 text-sm font-semibold transition-colors ${
                    visible ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                      visible ? 'bg-indigo-500 border-indigo-400' : 'border-[#3f3f46]'
                    }`}
                  >
                    {visible && <Check className="w-3 h-3 text-white" />}
                  </span>
                  {section.title}
                </button>

                <span className="text-[11px] text-[#71717a]">
                  {section.cards.length === 0
                    ? 'нет карточек на этой вкладке'
                    : selected
                    ? `выбрано ${selected.filter((id) => section.cards.some((c) => c.id === id)).length} из ${section.cards.length}`
                    : `все карточки (${section.cards.length})`}
                </span>

                <div className="ml-auto flex items-center gap-1">
                  <button
                    onClick={() => move(section.boardId, -1)}
                    disabled={idx === 0}
                    title="Выше на сводном экране"
                    className="p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-30 transition-colors"
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => move(section.boardId, 1)}
                    disabled={idx === ordered.length - 1}
                    title="Ниже на сводном экране"
                    className="p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-30 transition-colors"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setExpanded(isOpen ? null : section.boardId)}
                    disabled={section.cards.length === 0}
                    className="flex items-center gap-1 px-2 py-1.5 rounded-md text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 disabled:opacity-30 transition-colors"
                  >
                    {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    Карточки
                  </button>
                </div>
              </div>

              {isOpen && section.cards.length > 0 && (
                <div className="px-3 pb-3 space-y-1.5 border-t border-[#1f1f23] pt-2.5">
                  <div className="flex items-center gap-3 text-[11px]">
                    <button onClick={() => setCards(section.boardId, null)} className="text-indigo-400 hover:text-indigo-300 font-semibold">
                      Все карточки
                    </button>
                    <button onClick={() => setCards(section.boardId, [])} className="text-zinc-400 hover:text-white font-semibold">
                      Ни одной
                    </button>
                  </div>
                  {section.cards.map((card) => {
                    const checked = selected ? selected.includes(card.id) : true;
                    return (
                      <button
                        key={card.id}
                        onClick={() => toggleCard(section, card.id)}
                        className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-zinc-800/50 transition-colors text-left"
                      >
                        <span
                          className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                            checked ? 'bg-indigo-500 border-indigo-400' : 'border-[#3f3f46]'
                          }`}
                        >
                          {checked && <Check className="w-3 h-3 text-white" />}
                        </span>
                        <span className={`text-xs truncate ${checked ? 'text-zinc-200' : 'text-zinc-500'}`}>
                          {card.title || 'Без названия'}
                        </span>
                        <span className="ml-auto text-[10px] text-[#52525b] flex-shrink-0">{CARD_TYPE_LABELS[card.type]}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {error && <p className="text-[11px] text-rose-400">Не удалось сохранить настройку: {error}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => onApply(draft)}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-indigo-500 hover:bg-indigo-400 disabled:bg-zinc-700 text-white rounded-lg transition-colors"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Сохранить настройку
        </button>
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors"
        >
          Отмена
        </button>
        <button
          onClick={() => setDraft(EMPTY_SUMMARY_CONFIG)}
          className="flex items-center gap-1.5 ml-auto px-3 py-2 text-[11px] font-semibold text-zinc-400 hover:text-white transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Показывать всё (сброс)
        </button>
        <span className="flex items-center gap-1.5 text-[11px] text-[#52525b]">
          {visibleCount === ordered.length ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          {visibleCount === ordered.length ? 'показаны все отделы' : `скрыто отделов: ${ordered.length - visibleCount}`}
        </span>
      </div>
    </div>
  );
}
