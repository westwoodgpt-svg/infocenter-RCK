import { DragEvent, useCallback, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, GripVertical, LayoutDashboard, Plus, Trash2 } from 'lucide-react';
import { NoteAttachment, ShowcaseColumn, ShowcaseNote, ShowcaseState } from '../../types';
import { NoteHistoryEntry, ShowcaseUploads } from '../../bitrix';
import { ShowcaseMutator } from '../../showcaseStore';
import ImageLightbox from '../cards/ImageLightbox';
import StickyNote from './StickyNote';
import NoteEditorModal from './NoteEditorModal';
import {
  clamp,
  DEFAULT_COLUMN_WIDTH,
  MAX_COLUMN_WIDTH,
  MIN_COLUMN_WIDTH,
  startPointerDrag,
  todayIso,
} from './noteStyles';

interface Props {
  state: ShowcaseState;
  editMode: boolean;
  mutate: ShowcaseMutator;
  uploads: ShowcaseUploads;
  loadNoteHistory: (noteId: string) => Promise<{ entries: NoteHistoryEntry[]; error: string | null }>;
}

type DragItem = { kind: 'note' | 'column'; id: string };
type DropTarget =
  | { kind: 'note'; id: string }
  | { kind: 'column-end'; id: string }
  | { kind: 'column'; id: string }
  | { kind: 'columns-end' };

let counter = 0;
const newId = (prefix: string) => {
  counter += 1;
  return `${prefix}-${Date.now()}-${counter}`;
};

const sameTarget = (a: DropTarget | null, b: DropTarget | null) => JSON.stringify(a) === JSON.stringify(b);

// Витрина: колонки-разделы со стикерами. Колонки и стикеры в режиме
// редактирования перетаскиваются мышью, у обоих меняется размер: у колонки —
// за правый край, у стикера — за правый нижний уголок.
export default function ShowcaseBoard({ state, editMode, mutate, uploads, loadNoteHistory }: Props) {
  const [editing, setEditing] = useState<{ note: ShowcaseNote; isNew: boolean } | null>(null);
  const [lightbox, setLightbox] = useState<NoteAttachment | null>(null);
  const [drag, setDrag] = useState<DragItem | null>(null);
  const [dropTarget, setDropTargetRaw] = useState<DropTarget | null>(null);
  const setDropTarget = useCallback((t: DropTarget | null) => setDropTargetRaw((prev) => (sameTarget(prev, t) ? prev : t)), []);

  const today = todayIso();
  const firstColumnId = state.columns[0]?.id;
  const columnIds = useMemo(() => new Set(state.columns.map((c) => c.id)), [state.columns]);

  // Стикеры по колонкам: закреплённые первыми, остальные — в сохранённом
  // порядке. Стикер без колонки (её удалили, пока он правился) — в первую.
  const notesByColumn = useMemo(() => {
    const map = new Map<string, ShowcaseNote[]>();
    for (const note of state.notes) {
      const colId = columnIds.has(note.columnId) ? note.columnId : firstColumnId;
      if (!colId) continue;
      const expired = Boolean(note.expiresAt && note.expiresAt < today);
      if (expired && !editMode) continue;
      if (!map.has(colId)) map.set(colId, []);
      map.get(colId)!.push(note);
    }
    for (const list of map.values()) list.sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)));
    return map;
  }, [state.notes, columnIds, firstColumnId, today, editMode]);

  // --- Колонки ---

  const addColumn = () =>
    mutate((prev) => ({ ...prev, columns: [...prev.columns, { id: newId('col'), title: 'Новый раздел' }] }));

  const patchColumn = (id: string, fields: Partial<ShowcaseColumn>) =>
    mutate((prev) => ({ ...prev, columns: prev.columns.map((c) => (c.id === id ? { ...c, ...fields } : c)) }));

  const deleteColumn = (column: ShowcaseColumn) => {
    const count = state.notes.filter((n) => n.columnId === column.id).length;
    const warning = count ? ` Вместе с ней удалятся стикеры (${count}).` : '';
    if (!confirm(`Удалить колонку «${column.title}»?${warning} Это увидят все сотрудники.`)) return;
    mutate((prev) => ({
      columns: prev.columns.filter((c) => c.id !== column.id),
      notes: prev.notes.filter((n) => n.columnId !== column.id),
    }));
  };

  const shiftColumn = (id: string, dir: -1 | 1) =>
    mutate((prev) => {
      const list = [...prev.columns];
      const i = list.findIndex((c) => c.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= list.length) return prev;
      [list[i], list[j]] = [list[j], list[i]];
      return { ...prev, columns: list };
    });

  const placeColumn = (id: string, beforeId: string | null) =>
    mutate((prev) => {
      const moving = prev.columns.find((c) => c.id === id);
      if (!moving || id === beforeId) return prev;
      const rest = prev.columns.filter((c) => c.id !== id);
      const at = beforeId ? rest.findIndex((c) => c.id === beforeId) : -1;
      rest.splice(at < 0 ? rest.length : at, 0, moving);
      return { ...prev, columns: rest };
    });

  // --- Стикеры ---

  const newNote = (columnId: string): ShowcaseNote => ({ id: newId('note'), columnId, color: 'yellow', text: '' });

  const saveNote = (note: ShowcaseNote) => {
    mutate((prev) => {
      const exists = prev.notes.some((n) => n.id === note.id);
      return { ...prev, notes: exists ? prev.notes.map((n) => (n.id === note.id ? note : n)) : [...prev.notes, note] };
    });
    setEditing(null);
  };

  const deleteNote = (note: ShowcaseNote) => {
    if (!confirm('Удалить стикер? Это увидят все сотрудники.')) return;
    mutate((prev) => ({ ...prev, notes: prev.notes.filter((n) => n.id !== note.id) }));
    setEditing(null);
  };

  const patchNote = (id: string, fields: Partial<ShowcaseNote>) =>
    mutate((prev) => ({
      ...prev,
      notes: prev.notes.map((n) => {
        if (n.id !== id) return n;
        const next = { ...n, ...fields };
        // «Размер по умолчанию» — убираем поля, а не храним undefined.
        if (next.width === undefined) delete next.width;
        if (next.height === undefined) delete next.height;
        if (!next.pinned) delete next.pinned;
        return next;
      }),
    }));

  const placeNote = (id: string, columnId: string, beforeId: string | null) =>
    mutate((prev) => {
      const moving = prev.notes.find((n) => n.id === id);
      if (!moving || id === beforeId) return prev;
      const rest = prev.notes.filter((n) => n.id !== id);
      let at = beforeId ? rest.findIndex((n) => n.id === beforeId) : -1;
      if (at < 0) {
        // в конец колонки: сразу после её последнего стикера
        let last = -1;
        rest.forEach((n, i) => {
          if (n.columnId === columnId) last = i;
        });
        at = last < 0 ? rest.length : last + 1;
      }
      rest.splice(at, 0, { ...moving, columnId });
      return { ...prev, notes: rest };
    });

  // --- Перетаскивание ---

  const endDrag = () => {
    setDrag(null);
    setDropTargetRaw(null);
  };

  const beginDrag = (item: DragItem) => (e: DragEvent) => {
    e.stopPropagation();
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', item.id); // без данных Firefox не начинает перетаскивание
    setDrag(item);
  };

  const accept = (e: DragEvent, target: DropTarget) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    setDropTarget(target);
  };

  const finishDrop = (e: DragEvent, apply: () => void) => {
    e.preventDefault();
    e.stopPropagation();
    apply();
    endDrag();
  };

  const noteDropTarget = dropTarget?.kind === 'note' ? dropTarget.id : null;

  if (!state.columns.length && !editMode) {
    return (
      <div className="elegant-card rounded-2xl p-12 flex flex-col items-center justify-center gap-3 text-center">
        <LayoutDashboard className="w-8 h-8 text-indigo-400/70" />
        <p className="text-sm text-zinc-300">Витрина пока пуста.</p>
        <p className="text-xs text-[#71717a]">Включите «Режим редактирования», чтобы добавить раздел и первые стикеры.</p>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-start gap-5" onDragEnd={endDrag}>
        {state.columns.map((column, index) => {
          const notes = notesByColumn.get(column.id) || [];
          const isColumnDrop = dropTarget?.kind === 'column' && dropTarget.id === column.id;
          const isEndDrop = dropTarget?.kind === 'column-end' && dropTarget.id === column.id;
          return (
            <ColumnView
              key={column.id}
              column={column}
              editMode={editMode}
              first={index === 0}
              last={index === state.columns.length - 1}
              highlightBefore={isColumnDrop}
              highlightBody={isEndDrop}
              dragging={drag?.kind === 'column' && drag.id === column.id}
              onRename={(title) => patchColumn(column.id, { title })}
              onResize={(width) => patchColumn(column.id, { width })}
              onShift={(dir) => shiftColumn(column.id, dir)}
              onDelete={() => deleteColumn(column)}
              onAddNote={() => setEditing({ note: newNote(column.id), isNew: true })}
              onHeaderDragStart={beginDrag({ kind: 'column', id: column.id })}
              onDragOverColumn={(e) => {
                if (drag?.kind === 'column' && drag.id !== column.id) accept(e, { kind: 'column', id: column.id });
                else if (drag?.kind === 'note') accept(e, { kind: 'column-end', id: column.id });
              }}
              onDropColumn={(e) => {
                if (drag?.kind === 'column') finishDrop(e, () => placeColumn(drag.id, column.id));
                else if (drag?.kind === 'note') finishDrop(e, () => placeNote(drag.id, column.id, null));
              }}
            >
              {notes.map((note) => (
                <StickyNote
                  key={note.id}
                  note={note}
                  editMode={editMode}
                  expired={Boolean(note.expiresAt && note.expiresAt < today)}
                  dropBefore={noteDropTarget === note.id}
                  onEdit={() => setEditing({ note, isNew: false })}
                  onDelete={() => deleteNote(note)}
                  onTogglePin={() => patchNote(note.id, { pinned: !note.pinned })}
                  onResize={(width, height) => patchNote(note.id, { width, height })}
                  onOpenImage={setLightbox}
                  onDragStart={beginDrag({ kind: 'note', id: note.id })}
                  onDragEnd={endDrag}
                  onDragOver={(e) => {
                    if (drag?.kind === 'note' && drag.id !== note.id) accept(e, { kind: 'note', id: note.id });
                  }}
                  onDrop={(e) => {
                    if (drag?.kind === 'note') finishDrop(e, () => placeNote(drag.id, column.id, note.id));
                  }}
                />
              ))}
              {!notes.length && !editMode && <p className="text-xs text-[#52525b] py-6">Здесь пока ничего нет.</p>}
            </ColumnView>
          );
        })}

        {editMode && (
          <button
            type="button"
            onClick={addColumn}
            onDragOver={(e) => {
              if (drag?.kind === 'column') accept(e, { kind: 'columns-end' });
            }}
            onDrop={(e) => {
              if (drag?.kind === 'column') finishDrop(e, () => placeColumn(drag.id, null));
            }}
            className={`flex flex-col items-center justify-center gap-2 w-[220px] min-h-[180px] rounded-2xl border-2 border-dashed text-sm transition-colors ${
              dropTarget?.kind === 'columns-end'
                ? 'border-indigo-400 text-indigo-300 bg-indigo-500/5'
                : 'border-[#27272a] text-[#71717a] hover:text-indigo-300 hover:border-indigo-500/40'
            }`}
          >
            <Plus className="w-5 h-5" />
            {drag?.kind === 'column' ? 'Поставить в конец' : 'Добавить колонку'}
          </button>
        )}
      </div>

      {editing && (
        <NoteEditorModal
          note={editing.note}
          isNew={editing.isNew}
          uploads={uploads}
          loadHistory={loadNoteHistory}
          onSave={saveNote}
          onDelete={editing.isNew ? undefined : () => deleteNote(editing.note)}
          onClose={() => setEditing(null)}
        />
      )}

      {lightbox && <ImageLightbox src={lightbox.url} alt={lightbox.name} caption={lightbox.name} onClose={() => setLightbox(null)} />}
    </>
  );
}

interface ColumnProps {
  column: ShowcaseColumn;
  editMode: boolean;
  first: boolean;
  last: boolean;
  highlightBefore: boolean;
  highlightBody: boolean;
  dragging: boolean;
  onRename: (title: string) => void;
  onResize: (width: number | undefined) => void;
  onShift: (dir: -1 | 1) => void;
  onDelete: () => void;
  onAddNote: () => void;
  onHeaderDragStart: (e: DragEvent) => void;
  onDragOverColumn: (e: DragEvent) => void;
  onDropColumn: (e: DragEvent) => void;
  children: React.ReactNode;
}

function ColumnView({
  column,
  editMode,
  first,
  last,
  highlightBefore,
  highlightBody,
  dragging,
  onRename,
  onResize,
  onShift,
  onDelete,
  onAddNote,
  onHeaderDragStart,
  onDragOverColumn,
  onDropColumn,
  children,
}: ColumnProps) {
  const rootRef = useRef<HTMLElement>(null);
  const [liveWidth, setLiveWidth] = useState<number | null>(null);
  const [titleDraft, setTitleDraft] = useState<string | null>(null);
  const width = liveWidth ?? column.width ?? DEFAULT_COLUMN_WIDTH;

  const beginResize = (e: React.PointerEvent) => {
    const start = rootRef.current?.getBoundingClientRect().width || width;
    const size = (dx: number) => clamp(start + dx, MIN_COLUMN_WIDTH, MAX_COLUMN_WIDTH);
    startPointerDrag(
      e,
      (dx) => setLiveWidth(size(dx)),
      (dx) => {
        setLiveWidth(null);
        if (Math.abs(dx) >= 2) onResize(size(dx));
      }
    );
  };

  const commitTitle = () => {
    if (titleDraft === null) return;
    const next = titleDraft.trim() || 'Без названия';
    setTitleDraft(null);
    if (next !== column.title) onRename(next);
  };

  return (
    <section
      ref={rootRef}
      onDragOver={onDragOverColumn}
      onDrop={onDropColumn}
      className={`relative elegant-card rounded-2xl flex flex-col transition-opacity ${dragging ? 'opacity-40' : ''} ${
        highlightBody ? 'ring-1 ring-indigo-400/60' : ''
      }`}
      style={{ width, maxWidth: '100%' }}
    >
      {highlightBefore && <div className="absolute -left-3 top-2 bottom-2 w-1 rounded-full bg-indigo-400 shadow-[0_0_8px_#818cf8]" />}

      <header className="flex items-center gap-1.5 px-5 pt-5 pb-3">
        {editMode && (
          <span
            draggable
            onDragStart={(e) => {
              if (rootRef.current) e.dataTransfer.setDragImage(rootRef.current, 24, 20);
              onHeaderDragStart(e);
            }}
            title="Перетащите, чтобы переместить колонку"
            className="-ml-2 p-1 rounded-md cursor-grab active:cursor-grabbing text-[#52525b] hover:text-zinc-300 hover:bg-zinc-800 flex-shrink-0"
          >
            <GripVertical className="w-4 h-4" />
          </span>
        )}
        {editMode ? (
          <input
            value={titleDraft ?? column.title}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
              if (e.key === 'Escape') setTitleDraft(null);
            }}
            title="Название колонки"
            className="flex-1 min-w-0 bg-transparent border border-transparent hover:border-[#27272a] focus:border-indigo-500/50 rounded-md px-1.5 py-0.5 text-[13px] font-bold uppercase tracking-wide text-zinc-100 font-display focus:outline-none"
          />
        ) : (
          <h3 className="flex-1 min-w-0 text-[13px] font-bold uppercase tracking-wide text-zinc-100 font-display">{column.title}</h3>
        )}
        {editMode && (
          <span className="flex items-center gap-0.5 flex-shrink-0">
            <HeaderButton title="Левее" disabled={first} onClick={() => onShift(-1)}>
              <ChevronLeft className="w-3.5 h-3.5" />
            </HeaderButton>
            <HeaderButton title="Правее" disabled={last} onClick={() => onShift(1)}>
              <ChevronRight className="w-3.5 h-3.5" />
            </HeaderButton>
            <HeaderButton title="Удалить колонку" onClick={onDelete} danger>
              <Trash2 className="w-3.5 h-3.5" />
            </HeaderButton>
          </span>
        )}
      </header>

      <div className="flex flex-wrap items-start gap-4 px-5 pb-5 min-h-[140px]">
        {children}
        {editMode && (
          <button
            type="button"
            onClick={onAddNote}
            className="flex items-center justify-center gap-1.5 w-full py-3 rounded-lg border border-dashed border-[#27272a] text-xs text-[#71717a] hover:text-indigo-300 hover:border-indigo-500/40 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Стикер
          </button>
        )}
      </div>

      {editMode && (
        <div
          onPointerDown={beginResize}
          onDoubleClick={() => onResize(undefined)}
          title="Потяните, чтобы изменить ширину колонки. Двойной щелчок — ширина по умолчанию"
          className="absolute top-4 bottom-4 -right-1.5 w-3 cursor-ew-resize touch-none group"
        >
          <div className="mx-auto h-full w-0.5 rounded-full bg-transparent group-hover:bg-indigo-400/60 transition-colors" />
        </div>
      )}
    </section>
  );
}

function HeaderButton({
  title,
  disabled,
  danger,
  onClick,
  children,
}: {
  title: string;
  disabled?: boolean;
  danger?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`p-1.5 rounded-md text-zinc-500 hover:bg-zinc-800 disabled:opacity-25 disabled:hover:bg-transparent transition-colors ${
        danger ? 'hover:text-rose-400' : 'hover:text-white'
      }`}
    >
      {children}
    </button>
  );
}
