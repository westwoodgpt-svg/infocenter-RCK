import { useEffect, useState } from 'react';
import { Plus, Trash2, Save, AlertTriangle, RefreshCw } from 'lucide-react';
import { BUILTIN_LISTS } from '../config/builtinLists';
import { getListElements, addListElement, updateListElement, deleteListElement, isB24Available } from '../b24/client';
import { extractPropValue } from '../b24/normalize';

const EVENTS_LIST = BUILTIN_LISTS.events;

interface EventRow {
  id: number;
  name: string;
  date: string; // "YYYY-MM-DD" для <input type="date">
}

function toInputDate(raw: string): string {
  const v = extractPropValue(raw);
  const ru = v.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (ru) return `${ru[3]}-${ru[2].padStart(2, '0')}-${ru[1].padStart(2, '0')}`;
  const iso = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return iso[0];
  return '';
}

interface EventsEditorProps {
  onChanged?: () => void;
}

export default function EventsEditor({ onChanged }: EventsEditorProps) {
  const [rows, setRows] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<number | 'new' | null>(null);
  const [draftName, setDraftName] = useState('');
  const [draftDate, setDraftDate] = useState('');

  const load = async () => {
    if (!isB24Available()) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const elements = await getListElements(EVENTS_LIST.id, [EVENTS_LIST.props.date]);
      const mapped = elements
        .map((el) => ({ id: el.id, name: el.name, date: toInputDate(el.values[EVENTS_LIST.props.date]) }))
        .sort((a, b) => a.date.localeCompare(b.date));
      setRows(mapped);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить события');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const updateRow = (id: number, patch: Partial<EventRow>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const saveRow = async (row: EventRow) => {
    setSavingId(row.id);
    try {
      await updateListElement(EVENTS_LIST.id, row.id, {
        NAME: row.name,
        [EVENTS_LIST.props.date]: row.date,
      });
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить событие');
    } finally {
      setSavingId(null);
    }
  };

  const removeRow = async (id: number) => {
    setSavingId(id);
    try {
      await deleteListElement(EVENTS_LIST.id, id);
      setRows((prev) => prev.filter((r) => r.id !== id));
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось удалить событие');
    } finally {
      setSavingId(null);
    }
  };

  const addRow = async () => {
    if (!draftName.trim() || !draftDate) return;
    setSavingId('new');
    try {
      const id = await addListElement(EVENTS_LIST.id, {
        NAME: draftName.trim(),
        [EVENTS_LIST.props.date]: draftDate,
      });
      setRows((prev) => [...prev, { id, name: draftName.trim(), date: draftDate }].sort((a, b) => a.date.localeCompare(b.date)));
      setDraftName('');
      setDraftDate('');
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось добавить событие');
    } finally {
      setSavingId(null);
    }
  };

  if (!isB24Available()) {
    return <p className="text-xs text-[#71717a]">События редактируются только внутри портала Bitrix24.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-[#a1a1aa]">
          Список «Ключевые события» (ID {EVENTS_LIST.id}) — правки уходят напрямую в Bitrix24.
        </p>
        <button type="button" onClick={load} className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800" title="Обновить">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 text-xs text-amber-300/90 bg-amber-500/5 border border-amber-500/20 rounded-xl p-3">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-400" />
          <span>{error}</span>
        </div>
      )}

      <div className="space-y-2">
        {rows.map((row) => (
          <div key={row.id} className="flex items-center gap-2 bg-[#161619] border border-[#27272a] rounded-xl px-3 py-2">
            <input
              value={row.name}
              onChange={(e) => updateRow(row.id, { name: e.target.value })}
              className="flex-1 bg-transparent border border-transparent focus:border-indigo-500/40 rounded-lg px-2 py-1.5 text-sm text-white outline-none"
            />
            <input
              type="date"
              value={row.date}
              onChange={(e) => updateRow(row.id, { date: e.target.value })}
              className="bg-[#0d0d0f] border border-[#27272a] rounded-lg px-2 py-1.5 text-sm text-white outline-none font-mono"
            />
            <button
              type="button"
              onClick={() => saveRow(row)}
              disabled={savingId === row.id}
              className="p-1.5 rounded-lg text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-40"
              title="Сохранить"
            >
              <Save className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => removeRow(row.id)}
              disabled={savingId === row.id}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 disabled:opacity-40"
              title="Удалить"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 bg-indigo-500/5 border border-indigo-500/20 rounded-xl px-3 py-2">
        <input
          placeholder="Название события"
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          className="flex-1 bg-transparent border border-transparent focus:border-indigo-500/40 rounded-lg px-2 py-1.5 text-sm text-white outline-none placeholder:text-zinc-600"
        />
        <input
          type="date"
          value={draftDate}
          onChange={(e) => setDraftDate(e.target.value)}
          className="bg-[#0d0d0f] border border-[#27272a] rounded-lg px-2 py-1.5 text-sm text-white outline-none font-mono"
        />
        <button
          type="button"
          onClick={addRow}
          disabled={savingId === 'new' || !draftName.trim() || !draftDate}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-200 text-sm font-medium rounded-lg border border-indigo-500/30 disabled:opacity-40 transition-colors"
        >
          <Plus className="w-4 h-4" /> Добавить
        </button>
      </div>
    </div>
  );
}
