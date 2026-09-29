import { ChangeEvent, ClipboardEvent, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import { AlertTriangle, FileText, History, Loader2, Paperclip, Pin, RotateCcw, Trash2, X } from 'lucide-react';
import { NOTE_COLOR_LABELS, NoteAttachment, ShowcaseNote } from '../../types';
import { NoteHistoryEntry, ShowcaseUploads } from '../../bitrix';
import { formatBytes, isImageAttachment, MAX_BLOB_BYTES, MAX_INLINE_BYTES, uploadAttachment } from '../../showcaseUpload';
import { NOTE_COLORS, NOTE_STYLES, NOTE_TEXT_COLOR } from './noteStyles';

interface Props {
  note: ShowcaseNote;
  isNew: boolean;
  uploads: ShowcaseUploads;
  loadHistory: (noteId: string) => Promise<{ entries: NoteHistoryEntry[]; error: string | null }>;
  onSave: (note: ShowcaseNote) => void;
  onDelete?: () => void;
  onClose: () => void;
}

interface PendingUpload {
  key: string;
  name: string;
  percent: number;
}

const inputCls =
  'w-full bg-[#161619] border border-[#27272a] rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/40';
const labelCls = 'text-[11px] font-semibold text-[#71717a] uppercase tracking-wide mb-1 block';

function formatStamp(at: string): string {
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return at;
  return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default function NoteEditorModal({ note, isNew, uploads, loadHistory, onSave, onDelete, onClose }: Props) {
  const [draft, setDraft] = useState<ShowcaseNote>(note);
  const [pending, setPending] = useState<PendingUpload[]>([]);
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<NoteHistoryEntry[] | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [restoredFrom, setRestoredFrom] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const addFiles = async (list: File[]) => {
    if (!list.length) return;
    setUploadErrors([]);
    await Promise.all(
      list.map(async (file, i) => {
        const key = `${Date.now()}-${i}-${file.name}`;
        setPending((p) => [...p, { key, name: file.name, percent: 0 }]);
        try {
          const attachment = await uploadAttachment(file, uploads, (percent) =>
            setPending((p) => p.map((x) => (x.key === key ? { ...x, percent } : x)))
          );
          setDraft((d) => ({ ...d, attachments: [...(d.attachments || []), attachment] }));
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          setUploadErrors((errs) => [...errs, `${file.name}: ${message}`]);
        } finally {
          setPending((p) => p.filter((x) => x.key !== key));
        }
      })
    );
  };

  const onPickFiles = (e: ChangeEvent<HTMLInputElement>) => {
    const list = Array.from(e.target.files || []);
    e.target.value = '';
    void addFiles(list);
  };

  // Скриншот из буфера обмена (Ctrl+V в поле текста) — сразу во вложения.
  const onPaste = (e: ClipboardEvent) => {
    const list = Array.from(e.clipboardData.files || []);
    if (!list.length) return;
    e.preventDefault();
    void addFiles(list);
  };

  const removeAttachment = (id: string) =>
    setDraft((d) => ({ ...d, attachments: (d.attachments || []).filter((a) => a.id !== id) }));

  const moveAttachment = (id: string, dir: -1 | 1) =>
    setDraft((d) => {
      const list = [...(d.attachments || [])];
      const i = list.findIndex((a) => a.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= list.length) return d;
      [list[i], list[j]] = [list[j], list[i]];
      return { ...d, attachments: list };
    });

  const toggleHistory = async () => {
    if (historyOpen) {
      setHistoryOpen(false);
      return;
    }
    setHistoryOpen(true);
    setHistoryLoading(true);
    const { entries, error } = await loadHistory(note.id);
    setHistory(entries.filter((e) => e.action !== 'delete' && e.card).reverse());
    setHistoryError(error);
    setHistoryLoading(false);
  };

  // Восстановление подставляет прошлую версию в редактор — на витрину она
  // попадёт только после «Сохранить». Колонку оставляем текущую: стикер могли
  // с тех пор перенести, и прыгать обратно ему незачем.
  const restore = (entry: NoteHistoryEntry) => {
    setDraft({ ...entry.card, id: note.id, columnId: draft.columnId });
    setRestoredFrom(formatStamp(entry.at));
  };

  const canSave = pending.length === 0 && (draft.text.trim() || (draft.title || '').trim() || (draft.attachments || []).length > 0);

  const save = () => {
    if (!canSave) return;
    const cleaned: ShowcaseNote = { ...draft, title: (draft.title || '').trim() || undefined };
    if (!cleaned.expiresAt) delete cleaned.expiresAt;
    if (!cleaned.pinned) delete cleaned.pinned;
    if (!cleaned.attachments || !cleaned.attachments.length) delete cleaned.attachments;
    onSave(cleaned);
  };

  const style = NOTE_STYLES[draft.color] || NOTE_STYLES.yellow;
  const attachments = draft.attachments || [];

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-[#111113] border border-[#27272a] rounded-2xl w-full max-w-2xl max-h-[88vh] overflow-y-auto shadow-2xl"
      >
        <div className="flex items-center justify-between p-5 border-b border-[#1f1f23] sticky top-0 bg-[#111113] z-10">
          <h2 className="text-base font-bold text-white font-display">{isNew ? 'Новый стикер' : 'Редактировать стикер'}</h2>
          <button onClick={onClose} className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <div>
            <p className={labelCls}>Цвет</p>
            <div className="flex flex-wrap gap-2">
              {NOTE_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  title={NOTE_COLOR_LABELS[c]}
                  onClick={() => setDraft({ ...draft, color: c })}
                  className={`w-8 h-8 rounded-md transition-transform ${draft.color === c ? 'ring-2 ring-indigo-400 ring-offset-2 ring-offset-[#111113] scale-105' : 'hover:scale-105'}`}
                  style={{ background: NOTE_STYLES[c].bg, border: `1px solid ${NOTE_STYLES[c].border}` }}
                />
              ))}
            </div>
          </div>

          <div>
            <label className={labelCls}>Заголовок в полосе сверху (необязательно)</label>
            <input
              className={inputCls}
              value={draft.title || ''}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder="Например: День рождения фонда"
            />
          </div>

          <div>
            <label className={labelCls}>Текст</label>
            <textarea
              autoFocus
              className={`${inputCls} min-h-[180px] leading-relaxed resize-y`}
              style={{ background: style.bg, color: NOTE_TEXT_COLOR, borderColor: style.border }}
              value={draft.text}
              onChange={(e) => setDraft({ ...draft, text: e.target.value })}
              onPaste={onPaste}
              placeholder="Текст стикера. Переносы строк сохраняются, ссылки станут кликабельными. Картинку можно вставить из буфера — Ctrl+V."
            />
          </div>

          <div>
            <p className={labelCls}>Вложения</p>
            {attachments.length > 0 && (
              <div className="space-y-1.5 mb-2">
                {attachments.map((a, i) => (
                  <AttachmentRow
                    key={a.id}
                    attachment={a}
                    first={i === 0}
                    last={i === attachments.length - 1}
                    onUp={() => moveAttachment(a.id, -1)}
                    onDown={() => moveAttachment(a.id, 1)}
                    onRemove={() => removeAttachment(a.id)}
                  />
                ))}
              </div>
            )}
            {pending.map((p) => (
              <p key={p.key} className="flex items-center gap-2 text-xs text-zinc-400 mb-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                <span className="truncate">{p.name}</span>
                <span className="font-mono">{Math.round(p.percent)}%</span>
              </p>
            ))}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold bg-zinc-800/60 border border-zinc-700/60 text-zinc-200 hover:text-white transition-colors"
            >
              <Paperclip className="w-3.5 h-3.5" /> Приложить файлы или картинки
            </button>
            <input ref={fileRef} type="file" multiple className="hidden" onChange={onPickFiles} />
            <p className="text-[11px] text-[#71717a] mt-1.5">
              {uploads === 'blob'
                ? `Любые файлы до ${formatBytes(MAX_BLOB_BYTES)}. Картинки показываются на стикере и открываются во весь экран, остальные файлы — ссылкой.`
                : `Хранилище файлов не подключено — можно прикладывать файлы до ${formatBytes(MAX_INLINE_BYTES)} (картинки ужимаются автоматически).`}
            </p>
            {uploadErrors.map((err) => (
              <p key={err} className="flex items-start gap-1.5 text-[11px] text-rose-400 mt-1.5">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-px" /> {err}
              </p>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Актуально до (необязательно)</label>
              <input
                type="date"
                className={inputCls}
                value={draft.expiresAt || ''}
                onChange={(e) => setDraft({ ...draft, expiresAt: e.target.value || undefined })}
              />
              <p className="text-[11px] text-[#71717a] mt-1">После этой даты стикер уходит с витрины, но остаётся в режиме редактирования.</p>
            </div>
            <div>
              <p className={labelCls}>Порядок</p>
              <label className="flex items-center gap-2 text-sm text-zinc-200 mt-2">
                <input type="checkbox" checked={Boolean(draft.pinned)} onChange={(e) => setDraft({ ...draft, pinned: e.target.checked })} />
                <Pin className="w-3.5 h-3.5 text-indigo-400" /> Закрепить первым в колонке
              </label>
              {(draft.width || draft.height) && (
                <button
                  type="button"
                  onClick={() => setDraft({ ...draft, width: undefined, height: undefined })}
                  className="mt-3 text-xs text-indigo-300 hover:text-indigo-200"
                >
                  Вернуть размер по умолчанию ({draft.width ?? 'авто'} × {draft.height ?? 'авто'})
                </button>
              )}
            </div>
          </div>

          {!isNew && (
            <div className="border-t border-[#1f1f23] pt-4">
              <button
                type="button"
                onClick={() => void toggleHistory()}
                className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${historyOpen ? 'text-indigo-300' : 'text-[#71717a] hover:text-indigo-300'}`}
              >
                <History className="w-3.5 h-3.5" /> История изменений
              </button>
              {restoredFrom && (
                <p className="text-[11px] text-amber-300 mt-2">
                  В редактор подставлена версия от {restoredFrom} — нажмите «Сохранить», чтобы вернуть её на витрину.
                </p>
              )}
              {historyOpen && (
                <div className="mt-3 space-y-1.5 max-h-64 overflow-y-auto">
                  {historyLoading && (
                    <p className="flex items-center gap-2 text-[11px] text-[#71717a]">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Загружаем историю…
                    </p>
                  )}
                  {!historyLoading && historyError && <p className="text-[11px] text-rose-400">Не удалось загрузить историю: {historyError}</p>}
                  {!historyLoading && !historyError && history && history.length === 0 && (
                    <p className="text-[11px] text-[#71717a]">Сохранённых версий пока нет — они появятся после следующих правок.</p>
                  )}
                  {!historyLoading &&
                    history?.map((entry, i) => {
                      const isCurrent = JSON.stringify(entry.card) === JSON.stringify(note);
                      return (
                      <div key={`${entry.at}-${i}`} className="flex items-start gap-3 p-2.5 rounded-lg bg-[#161619] border border-[#27272a]">
                        <span
                          className="w-3 h-3 rounded-sm mt-0.5 flex-shrink-0"
                          style={{ background: (NOTE_STYLES[entry.card.color] || NOTE_STYLES.yellow).bg }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] text-zinc-400">
                            {formatStamp(entry.at)}
                            {entry.by ? ` · ${entry.by}` : ''}
                            {isCurrent ? ' · текущая' : ''}
                            {entry.trimmed ? ' · без встроенных файлов' : ''}
                          </p>
                          <p className="text-xs text-zinc-200 truncate">
                            {entry.card.title ? `${entry.card.title}: ` : ''}
                            {entry.card.text || '—'}
                          </p>
                        </div>
                        {!isCurrent && (
                          <button
                            type="button"
                            onClick={() => restore(entry)}
                            className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] bg-indigo-500/15 border border-indigo-500/40 text-indigo-300 hover:bg-indigo-500/25 flex-shrink-0"
                          >
                            <RotateCcw className="w-3 h-3" /> Восстановить
                          </button>
                        )}
                      </div>
                      );
                    })}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 p-5 border-t border-[#1f1f23] sticky bottom-0 bg-[#111113]">
          {onDelete && (
            <button onClick={onDelete} className="flex items-center gap-1.5 px-3 py-2 text-sm text-rose-400 hover:text-rose-300 transition-colors">
              <Trash2 className="w-4 h-4" /> Удалить
            </button>
          )}
          <span className="flex-1" />
          <button onClick={onClose} className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors">
            Отмена
          </button>
          <button
            onClick={save}
            disabled={!canSave}
            className="px-4 py-2 text-sm font-semibold bg-indigo-500 hover:bg-indigo-400 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
          >
            {pending.length ? 'Загружаем файлы…' : 'Сохранить'}
          </button>
        </div>
      </motion.div>
    </motion.div>,
    document.body
  );
}

function AttachmentRow({
  attachment,
  first,
  last,
  onUp,
  onDown,
  onRemove,
}: {
  attachment: NoteAttachment;
  first: boolean;
  last: boolean;
  onUp: () => void;
  onDown: () => void;
  onRemove: () => void;
}) {
  const image = isImageAttachment(attachment) && attachment.url;
  return (
    <div className="flex items-center gap-2.5 p-2 rounded-lg bg-[#161619] border border-[#27272a]">
      {image ? (
        <img src={attachment.url} alt="" className="w-10 h-10 object-cover rounded flex-shrink-0" />
      ) : (
        <span className="w-10 h-10 rounded bg-zinc-800 flex items-center justify-center flex-shrink-0">
          <FileText className="w-4 h-4 text-zinc-400" />
        </span>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-zinc-200 truncate">{attachment.name}</p>
        <p className="text-[11px] text-[#71717a]">
          {formatBytes(attachment.size)}
          {!attachment.url ? ' · файл в этой версии не сохранён' : attachment.url.startsWith('data:') ? ' · в данных витрины' : ' · в хранилище'}
        </p>
      </div>
      <button type="button" disabled={first} onClick={onUp} title="Выше" className="px-1.5 text-zinc-400 hover:text-white disabled:opacity-25">
        ↑
      </button>
      <button type="button" disabled={last} onClick={onDown} title="Ниже" className="px-1.5 text-zinc-400 hover:text-white disabled:opacity-25">
        ↓
      </button>
      <button type="button" onClick={onRemove} title="Убрать вложение" className="p-1.5 text-zinc-400 hover:text-rose-400">
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
