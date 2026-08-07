import { ReactNode } from 'react';
import { motion } from 'motion/react';
import { Pencil, Trash2, ChevronUp, ChevronDown } from 'lucide-react';

interface CardShellProps {
  children: ReactNode;
  editMode: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  className?: string;
}

export default function CardShell({
  children,
  editMode,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
  canMoveUp = false,
  canMoveDown = false,
  className = '',
}: CardShellProps) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`bg-[#111113] rounded-2xl border border-[#27272a] shadow-sm transition-all duration-300 hover:border-[#2d2d34] ${className}`}
    >
      {editMode && (
        // Полоса управления в потоке документа (не оверлей) — так карточкам
        // не нужно резервировать паддинг под кнопки, и на узких экранах
        // заголовки не переносятся раньше времени.
        <div className="flex items-center justify-end gap-1 px-3 py-2 border-b border-[#1f1f23]">
          {onMoveUp && (
            <button
              type="button"
              onClick={onMoveUp}
              disabled={!canMoveUp}
              title="Переместить выше"
              className="p-2 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
          )}
          {onMoveDown && (
            <button
              type="button"
              onClick={onMoveDown}
              disabled={!canMoveDown}
              title="Переместить ниже"
              className="p-2 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={onEdit}
            title="Редактировать"
            className="p-2 rounded-md text-indigo-400 hover:text-white hover:bg-indigo-500/20 transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            title="Удалить"
            className="p-2 rounded-md text-rose-400 hover:text-white hover:bg-rose-500/20 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
      {children}
    </motion.div>
  );
}
