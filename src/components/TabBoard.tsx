import { useState } from 'react';
import { motion } from 'motion/react';
import { LayoutGrid, Plus } from 'lucide-react';
import { AnyCard, TabId } from '../types';
import CardShell from './cards/CardShell';
import CardView from './cards/CardView';
import CardEditorModal from './CardEditorModal';

interface TabBoardProps {
  tab: TabId;
  cards: AnyCard[];
  editMode: boolean;
  onAdd: (tab: TabId, card: AnyCard) => void;
  onUpdate: (tab: TabId, card: AnyCard) => void;
  onDelete: (tab: TabId, cardId: string) => void;
  onMove: (tab: TabId, cardId: string, direction: -1 | 1) => void;
}

export default function TabBoard({ tab, cards, editMode, onAdd, onUpdate, onDelete, onMove }: TabBoardProps) {
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
            Добавьте первую карточку — KPI, график, смету, список или ответственного — и начните собирать инфоцентр.
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
            <CardShell
              key={card.id}
              editMode={editMode}
              onEdit={() => openEdit(card)}
              onDelete={() => onDelete(tab, card.id)}
              onMoveUp={() => onMove(tab, card.id, -1)}
              onMoveDown={() => onMove(tab, card.id, 1)}
              canMoveUp={idx > 0}
              canMoveDown={idx < cards.length - 1}
              className={card.type === 'chart' ? 'xl:col-span-2' : ''}
            >
              <CardView card={card} />
            </CardShell>
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
