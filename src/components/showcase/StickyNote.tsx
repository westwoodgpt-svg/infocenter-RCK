import { DragEvent, Fragment, ReactNode, useRef, useState } from 'react';
import { CalendarClock, Download, FileText, GripVertical, Maximize2, Paperclip, Pencil, Pin, PinOff, Trash2 } from 'lucide-react';
import { NoteAttachment, ShowcaseNote } from '../../types';
import { downloadHref, formatBytes, isImageAttachment } from '../../showcaseUpload';
import {
  clamp,
  DEFAULT_NOTE_WIDTH,
  formatIsoDate,
  MAX_NOTE_HEIGHT,
  MAX_NOTE_WIDTH,
  MIN_NOTE_HEIGHT,
  MIN_NOTE_WIDTH,
  NOTE_STYLES,
  NOTE_TEXT_COLOR,
  startPointerDrag,
} from './noteStyles';

interface Props {
  note: ShowcaseNote;
  editMode: boolean;
  expired: boolean;
  /** Сюда сейчас вставится перетаскиваемый стикер — рисуем метку слева. */
  dropBefore: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onTogglePin: () => void;
  onResize: (width: number | undefined, height: number | undefined) => void;
  onOpenImage: (attachment: NoteAttachment) => void;
  onDragStart: (e: DragEvent) => void;
  onDragEnd: () => void;
  onDragOver: (e: DragEvent) => void;
  onDrop: (e: DragEvent) => void;
}

const URL_RE = /(https?:\/\/[^\s<>"«»]+[^\s<>"«».,;:!?)\]])/g;

/** Текст стикера с кликабельными ссылками; переносы строк сохраняются. */
function linkify(text: string): ReactNode[] {
  return text.split(URL_RE).map((part, i) =>
    i % 2 === 1 ? (
      <a
        key={i}
        href={part}
        target="_blank"
        rel="noopener noreferrer"
        className="underline decoration-zinc-400 underline-offset-2 hover:decoration-zinc-700 break-all"
        onClick={(e) => e.stopPropagation()}
      >
        {part}
      </a>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    )
  );
}

export default function StickyNote({
  note,
  editMode,
  expired,
  dropBefore,
  onEdit,
  onDelete,
  onTogglePin,
  onResize,
  onOpenImage,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  // Размер, пока тянут за уголок: показываем сразу, сохраняем по отпусканию.
  const [live, setLive] = useState<{ w: number; h: number } | null>(null);
  const style = NOTE_STYLES[note.color] || NOTE_STYLES.yellow;
  const attachments = note.attachments || [];
  const images = attachments.filter(isImageAttachment);
  const files = attachments.filter((a) => !isImageAttachment(a));

  const width = live ? live.w : note.width ?? DEFAULT_NOTE_WIDTH;
  const height = live ? live.h : note.height;

  const beginResize = (e: React.PointerEvent) => {
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return;
    const limitW = rootRef.current?.parentElement?.clientWidth || MAX_NOTE_WIDTH;
    const size = (dx: number, dy: number) => ({
      w: clamp(rect.width + dx, MIN_NOTE_WIDTH, Math.min(MAX_NOTE_WIDTH, limitW)),
      h: clamp(rect.height + dy, MIN_NOTE_HEIGHT, MAX_NOTE_HEIGHT),
    });
    startPointerDrag(
      e,
      (dx, dy) => setLive(size(dx, dy)),
      (dx, dy) => {
        setLive(null);
        if (Math.abs(dx) < 2 && Math.abs(dy) < 2) return;
        const next = size(dx, dy);
        onResize(next.w, next.h);
      }
    );
  };

  return (
    <div
      ref={rootRef}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDoubleClick={editMode ? onEdit : undefined}
      className={`relative flex flex-col rounded-[3px] shadow-[2px_3px_6px_rgba(0,0,0,0.35)] transition-opacity ${
        expired ? 'opacity-45' : ''
      }`}
      style={{
        width,
        maxWidth: '100%',
        height,
        minHeight: height ? undefined : 150,
        background: style.bg,
        border: `1px solid ${style.border}`,
        color: NOTE_TEXT_COLOR,
      }}
    >
      {dropBefore && <div className="absolute -left-2.5 top-0 bottom-0 w-1 rounded-full bg-indigo-400 shadow-[0_0_8px_#818cf8]" />}

      <div
        draggable={editMode}
        onDragStart={(e) => {
          if (rootRef.current) e.dataTransfer.setDragImage(rootRef.current, 20, 16);
          onDragStart(e);
        }}
        onDragEnd={onDragEnd}
        className={`flex items-center gap-1.5 min-h-[34px] px-3 py-1.5 border-b flex-shrink-0 ${editMode ? 'cursor-grab active:cursor-grabbing' : ''}`}
        style={{ background: style.strip, borderColor: style.border }}
        title={editMode ? 'Перетащите, чтобы переместить стикер' : undefined}
      >
        {editMode && <GripVertical className="w-3.5 h-3.5 opacity-40 flex-shrink-0" />}
        {note.pinned && <Pin className="w-3.5 h-3.5 opacity-60 flex-shrink-0" />}
        <span className="flex-1 min-w-0 text-[13px] font-semibold leading-snug truncate">{note.title}</span>
        {editMode ? (
          <span className="flex items-center gap-0.5 flex-shrink-0">
            <IconButton title={note.pinned ? 'Открепить' : 'Закрепить первым в колонке'} onClick={onTogglePin}>
              {note.pinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
            </IconButton>
            <IconButton title="Редактировать" onClick={onEdit}>
              <Pencil className="w-3.5 h-3.5" />
            </IconButton>
            <IconButton title="Удалить стикер" onClick={onDelete} danger>
              <Trash2 className="w-3.5 h-3.5" />
            </IconButton>
          </span>
        ) : (
          attachments.length > 0 && (
            <span className="flex items-center gap-0.5 text-[11px] opacity-50 flex-shrink-0" title={`Вложений: ${attachments.length}`}>
              <Paperclip className="w-3.5 h-3.5" />
              {attachments.length > 1 && attachments.length}
            </span>
          )
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3.5 space-y-3">
        {note.text && <p className="text-[13px] leading-[1.45] whitespace-pre-wrap break-words">{linkify(note.text)}</p>}

        {images.length > 0 && (
          <div className={`grid gap-2 ${images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
            {images.map((img) =>
              img.url ? (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => onOpenImage(img)}
                  title="Открыть во весь экран"
                  className="group relative block rounded-sm overflow-hidden border border-black/10 bg-white/50 cursor-zoom-in"
                >
                  <img src={img.url} alt={img.name} className="w-full max-h-56 object-cover" loading="lazy" />
                  <span className="absolute top-1 right-1 p-1 rounded bg-black/45 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                    <Maximize2 className="w-3 h-3" />
                  </span>
                </button>
              ) : null
            )}
          </div>
        )}

        {files.length > 0 && (
          <div className="space-y-1.5">
            {files.map((file) => (
              <AttachmentChip key={file.id} file={file} />
            ))}
          </div>
        )}
      </div>

      {editMode && (note.expiresAt || expired) && (
        <div
          className="flex items-center gap-1.5 px-3 py-1 text-[11px] border-t flex-shrink-0"
          style={{ borderColor: style.border }}
        >
          <CalendarClock className="w-3 h-3 opacity-60" />
          {expired ? 'срок истёк — на витрине не показывается' : `актуально до ${formatIsoDate(note.expiresAt!)}`}
        </div>
      )}

      {editMode && (
        <div
          onPointerDown={beginResize}
          onDoubleClick={(e) => {
            e.stopPropagation();
            onResize(undefined, undefined);
          }}
          title="Потяните, чтобы изменить размер. Двойной щелчок — размер по умолчанию"
          className="absolute -right-px -bottom-px w-4 h-4 cursor-nwse-resize touch-none"
          style={{
            background: `linear-gradient(135deg, transparent 50%, ${style.border} 50%)`,
          }}
        />
      )}
    </div>
  );
}

function IconButton({ title, onClick, danger, children }: { title: string; onClick: () => void; danger?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onDoubleClick={(e) => e.stopPropagation()}
      className={`p-1 rounded opacity-55 hover:opacity-100 hover:bg-black/10 transition ${danger ? 'hover:text-rose-700' : ''}`}
    >
      {children}
    </button>
  );
}

function AttachmentChip({ file }: { file: NoteAttachment }) {
  if (!file.url) {
    return (
      <span className="flex items-center gap-2 px-2.5 py-1.5 rounded-sm bg-black/5 text-[12px] opacity-60">
        <FileText className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="truncate">{file.name}</span>
        <span className="text-[11px]">— файл в этой версии не сохранён</span>
      </span>
    );
  }
  const inline = file.url.startsWith('data:');
  return (
    <span className="flex items-center gap-1 rounded-sm bg-black/5 hover:bg-black/10 transition-colors text-[12px]">
      <a
        href={file.url}
        target={inline ? undefined : '_blank'}
        rel="noopener noreferrer"
        download={inline ? file.name : undefined}
        onClick={(e) => e.stopPropagation()}
        className="flex-1 min-w-0 flex items-center gap-2 px-2.5 py-1.5"
        title={inline ? 'Скачать' : 'Открыть в новой вкладке'}
      >
        <FileText className="w-3.5 h-3.5 flex-shrink-0 opacity-70" />
        <span className="truncate font-medium">{file.name}</span>
        <span className="text-[11px] opacity-60 flex-shrink-0">{formatBytes(file.size)}</span>
      </a>
      {!inline && (
        <a
          href={downloadHref(file)}
          download={file.name}
          onClick={(e) => e.stopPropagation()}
          title="Скачать"
          className="p-1.5 opacity-60 hover:opacity-100"
        >
          <Download className="w-3.5 h-3.5" />
        </a>
      )}
    </span>
  );
}
