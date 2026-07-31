import { ArrowUp, ArrowDown, Trash2, Plus, Eye, EyeOff } from 'lucide-react';
import { TabConfig } from '../types';

interface TabsEditorProps {
  tabs: TabConfig[];
  onChange: (tabs: TabConfig[]) => void;
}

function renumber(tabs: TabConfig[]): TabConfig[] {
  return [...tabs]
    .sort((a, b) => a.order - b.order)
    .map((t, i) => ({ ...t, order: i }));
}

export default function TabsEditor({ tabs, onChange }: TabsEditorProps) {
  const sorted = [...tabs].sort((a, b) => a.order - b.order);

  const move = (id: string, dir: -1 | 1) => {
    const idx = sorted.findIndex((t) => t.id === id);
    const swapWith = idx + dir;
    if (swapWith < 0 || swapWith >= sorted.length) return;
    const next = [...sorted];
    [next[idx], next[swapWith]] = [next[swapWith], next[idx]];
    onChange(renumber(next));
  };

  const toggleVisible = (id: string) => {
    onChange(sorted.map((t) => (t.id === id ? { ...t, visible: !t.visible } : t)));
  };

  const rename = (id: string, label: string) => {
    onChange(sorted.map((t) => (t.id === id ? { ...t, label } : t)));
  };

  const remove = (id: string) => {
    onChange(renumber(sorted.filter((t) => t.id !== id)));
  };

  const addTab = () => {
    const id = `custom-${Date.now()}`;
    onChange(renumber([...sorted, { id, label: 'Новая вкладка', order: sorted.length, visible: true, builtin: false }]));
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-[#a1a1aa]">
        Порядок и видимость вкладок в навигации дашборда. Встроенные вкладки нельзя удалить —
        только скрыть или переименовать.
      </p>
      <div className="space-y-2">
        {sorted.map((tab, idx) => (
          <div key={tab.id} className="flex items-center gap-2 bg-[#161619] border border-[#27272a] rounded-xl px-3 py-2.5">
            <div className="flex flex-col gap-0.5">
              <button
                type="button"
                onClick={() => move(tab.id, -1)}
                disabled={idx === 0}
                className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-20 disabled:hover:bg-transparent"
                title="Выше"
              >
                <ArrowUp className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => move(tab.id, 1)}
                disabled={idx === sorted.length - 1}
                className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-20 disabled:hover:bg-transparent"
                title="Ниже"
              >
                <ArrowDown className="w-3.5 h-3.5" />
              </button>
            </div>

            <input
              value={tab.label}
              onChange={(e) => rename(tab.id, e.target.value)}
              className="flex-1 bg-transparent border border-transparent focus:border-indigo-500/40 rounded-lg px-2 py-1.5 text-sm text-white outline-none"
            />

            {tab.builtin && (
              <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 px-2">встроенная</span>
            )}

            <button
              type="button"
              onClick={() => toggleVisible(tab.id)}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800"
              title={tab.visible ? 'Скрыть вкладку' : 'Показать вкладку'}
            >
              {tab.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4 text-amber-400" />}
            </button>

            {!tab.builtin && (
              <button
                type="button"
                onClick={() => remove(tab.id)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10"
                title="Удалить вкладку"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addTab}
        className="inline-flex items-center gap-1.5 px-3 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 text-sm font-medium rounded-xl border border-indigo-500/25 transition-colors"
      >
        <Plus className="w-4 h-4" /> Добавить вкладку
      </button>
    </div>
  );
}
