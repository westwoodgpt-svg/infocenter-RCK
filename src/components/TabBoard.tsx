import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { LayoutGrid, Plus } from 'lucide-react';
import { AnyCard, TabId } from '../types';
import { CardHistoryEntry } from '../bitrix';
import CardShell from './cards/CardShell';
import CardView from './cards/CardView';
import CardHistoryBar, { CardVersion } from './cards/CardHistoryBar';
import CardEditorModal from './CardEditorModal';
import { effectiveIndicator } from './cards/chartStatus';

type LoadHistory = (tab: TabId, cardId: string) => Promise<{ entries: CardHistoryEntry[]; error: string | null }>;

interface TabBoardProps {
  tab: TabId;
  cards: AnyCard[];
  editMode: boolean;
  onAdd: (tab: TabId, card: AnyCard) => void;
  onUpdate: (tab: TabId, card: AnyCard) => void;
  onDelete: (tab: TabId, cardId: string) => void;
  onMove: (tab: TabId, cardId: string, direction: -1 | 1) => void;
  onDuplicate: (tab: TabId, cardId: string) => void;
  loadHistory: LoadHistory;
}

// Карточка с собственным таймлайном: ползунок листает сохранённые версии, и
// пока выбрана прошлая — тело карточки показывает именно её.
interface BoardCardProps {
  tab: TabId;
  card: AnyCard;
  editMode: boolean;
  index: number;
  total: number;
  loadHistory: LoadHistory;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRestore: (card: AnyCard) => void;
}

function BoardCard({
  tab,
  card,
  editMode,
  index,
  total,
  loadHistory,
  onEdit,
  onDelete,
  onDuplicate,
  onMoveUp,
  onMoveDown,
  onRestore,
}: BoardCardProps) {
  const [version, setVersion] = useState<CardVersion | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const shown = version ? version.card : card;

  // История доступна только в режиме редактирования. Вышли из него — карточка
  // возвращается к текущей версии, иначе на дашборде осталась бы висеть
  // прошлая, а вернуть её было бы нечем: таймлайн уже скрыт.
  useEffect(() => {
    if (editMode) return;
    setVersion(null);
    setSelected(null);
  }, [editMode]);

  return (
    <CardShell
      editMode={editMode}
      onEdit={onEdit}
      onDelete={onDelete}
      onDuplicate={onDuplicate}
      onMoveUp={onMoveUp}
      onMoveDown={onMoveDown}
      canMoveUp={index > 0}
      canMoveDown={index < total - 1}
      className={card.type === 'chart' || card.type === 'events' || card.type === 'table' ? 'xl:col-span-2' : ''}
      indicator={effectiveIndicator(shown)}
      dimmed={version !== null}
    >
      <CardView card={shown} />
      {editMode && (
        <CardHistoryBar
          tab={tab}
          card={card}
          editMode={editMode}
          loadHistory={loadHistory}
          selected={selected}
          onSelect={(v, idx) => {
            setVersion(v);
            setSelected(idx);
          }}
          onRestore={onRestore}
        />
      )}
    </CardShell>
  );
}

export default function TabBoard({ tab, cards, editMode, onAdd, onUpdate, onDelete, onMove, onDuplicate, loadHistory }: TabBoardProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<AnyCard | null>(null);

  const openNew = () => {
    setEditingCard(null);
    setModalOpen(true);
  };

  const openEdit = (card: AnyCard) => {
    setEditingCard(card);
    setModalOpen(true);
  };

  const handleSave = (card: AnyCard) => {
    if (editingCard) {
      onUpdate(tab, card);
    } else {
      onAdd(tab, card);
    }
    setModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {cards.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="elegant-card rounded-2xl p-12 flex flex-col items-center justify-center text-center gap-3"
        >
          <span className="p-4 bg-zinc-800/40 text-zinc-500 rounded-2xl border border-zinc-700/30">
            <LayoutGrid className="w-6 h-6" />
          </span>
          <p className="text-sm text-zinc-300 font-medium">На этой вкладке пока нет карточек</p>
          <p className="text-xs text-[#71717a] max-w-sm">
            Добавьте первую карточку — KPI, график, смету, список, ответственного или событие — и начните собирать инфоцентр.
          </p>
          {editMode && (
            <button
              onClick={openNew}
              className="mt-2 flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              <Plus className="w-4 h-4" /> Добавить карточку
            </button>
          )}
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {cards.map((card, idx) => (
            <BoardCard
              key={card.id}
              tab={tab}
              card={card}
              editMode={editMode}
              index={idx}
              total={cards.length}
              loadHistory={loadHistory}
              onEdit={() => openEdit(card)}
              onDelete={() => onDelete(tab, card.id)}
              onDuplicate={() => onDuplicate(tab, card.id)}
              onMoveUp={() => onMove(tab, card.id, -1)}
              onMoveDown={() => onMove(tab, card.id, 1)}
              onRestore={(restored) => onUpdate(tab, restored)}
            />
          ))}
        </div>
      )}

      {editMode && cards.length > 0 && (
        <button
          onClick={openNew}
          className="w-full flex items-center justify-center gap-2 px-4 py-4 border border-dashed border-[#27272a] hover:border-indigo-500/40 hover:bg-indigo-500/5 text-sm font-semibold text-zinc-400 hover:text-indigo-300 rounded-2xl transition-colors"
        >
          <Plus className="w-4 h-4" /> Добавить карточку
        </button>
      )}

      <CardEditorModal open={modalOpen} editingCard={editingCard} onClose={() => setModalOpen(false)} onSave={handleSave} />
    </div>
  );
}
