import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Building2, Check, ChevronDown, Eye, LayoutGrid, Pencil } from 'lucide-react';
import { BoardInfo, ROLE_LABELS, UserRole } from '../types';

interface Props {
  boards: BoardInfo[];
  activeBoardId: string;
  role: UserRole;
  summaryOpen: boolean;
  canSeeSummary: boolean;
  onSelect: (boardId: string) => void;
  onOpenSummary: () => void;
}

export default function BoardSwitcher({
  boards,
  activeBoardId,
  role,
  summaryOpen,
  canSeeSummary,
  onSelect,
  onOpenSummary,
}: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  const active = boards.find((b) => b.id === activeBoardId);
  const label = summaryOpen ? 'Сводный экран' : active ? active.title : 'Инфоцентр';
  // Одному отделу переключатель не нужен — показываем просто название.
  const single = boards.length <= 1 && !canSeeSummary;

  if (single) {
    return (
      <span className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#161619] border border-[#27272a] text-zinc-300">
        <Building2 className="w-3.5 h-3.5 text-indigo-400" />
        {label}
      </span>
    );
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        title="Выбрать инфоцентр отдела"
        className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-zinc-800/60 border border-zinc-700/60 text-zinc-200 hover:text-white transition-colors max-w-[240px]"
      >
        {summaryOpen ? (
          <LayoutGrid className="w-3.5 h-3.5 text-indigo-400" />
        ) : (
          <Building2 className="w-3.5 h-3.5 text-indigo-400" />
        )}
        <span className="truncate">{label}</span>
        <ChevronDown className={`w-3.5 h-3.5 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute right-0 mt-2 w-72 max-h-[70vh] overflow-y-auto bg-[#161619] border border-[#27272a] rounded-xl shadow-2xl z-30 py-1"
        >
          <p className="px-4 py-2 text-[10px] uppercase tracking-widest text-[#52525b] font-display">
            {ROLE_LABELS[role]} · инфоцентров: {boards.length}
          </p>

          {canSeeSummary && (
            <button
              onClick={() => {
                onOpenSummary();
                setOpen(false);
              }}
              className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors border-b border-[#1f1f23] ${
                summaryOpen ? 'text-indigo-300 bg-indigo-500/10' : 'text-zinc-200 hover:bg-zinc-800/60'
              }`}
            >
              <LayoutGrid className="w-4 h-4 text-indigo-400" />
              <span className="flex-1 text-left">Сводный экран по отделам</span>
              {summaryOpen && <Check className="w-3.5 h-3.5" />}
            </button>
          )}

          {boards.map((board) => {
            const isActive = !summaryOpen && board.id === activeBoardId;
            return (
              <button
                key={board.id}
                onClick={() => {
                  onSelect(board.id);
                  setOpen(false);
                }}
                className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors ${
                  isActive ? 'text-indigo-300 bg-indigo-500/10' : 'text-zinc-200 hover:bg-zinc-800/60'
                }`}
              >
                {board.canEdit ? (
                  <Pencil className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                ) : (
                  <Eye className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
                )}
                <span className="flex-1 text-left truncate">{board.title}</span>
                {!board.canEdit && <span className="text-[10px] text-[#52525b]">просмотр</span>}
                {isActive && <Check className="w-3.5 h-3.5" />}
              </button>
            );
          })}
        </motion.div>
      )}
    </div>
  );
}
