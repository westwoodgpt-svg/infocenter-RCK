import { ReactNode } from 'react';
import { motion } from 'motion/react';
import { Pencil, Trash2, ChevronUp, ChevronDown, Copy } from 'lucide-react';
import { CardIndicator, IndicatorColor } from '../../types';

interface CardShellProps {
  children: ReactNode;
  editMode: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  className?: string;
  indicator?: CardIndicator;
}

const INDICATOR_DOT: Record<IndicatorColor, string> = {
  emerald: 'bg-emerald-500 shadow-[0_0_8px_#10b981]',
  amber: 'bg-amber-500 shadow-[0_0_8px_#f59e0b]',
  rose: 'bg-rose-500 shadow-[0_0_8px_#f43f5e]',
  sky: 'bg-sky-500 shadow-[0_0_8px_#0ea5e9]',
};

export default function CardShell({
  children,
  editMode,
  onEdit,
  onDelete,
  onDuplicate,
  onMoveUp,
  onMoveDown,
  canMoveUp = false,
  canMoveDown = false,
  className = '',
  indicator,
}: CardShellProps) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`relative bg-[#111113] rounded-2xl border border-[#27272a] shadow-sm transition-all duration-300 hover:border-[#2d2d34] ${className}`}
    >
      {indicator?.enabled && (
        <span
          title="Индикатор статуса"
          className={`absolute top-3.5 left-3.5 z-20 w-2.5 h-2.5 rounded-full animate-pulse ${INDICATOR_DOT[indicator.color]}`}
        />
      )}
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
          {onDuplicate && (
            <button
              type="button"
              onClick={onDuplicate}
              title="Дублировать карточку"
              className="p-2 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
          )}
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
