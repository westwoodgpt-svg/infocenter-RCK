import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, LayoutList, CalendarClock, BarChart3, Check, AlertTriangle, Loader2 } from 'lucide-react';
import { DashboardConfig } from '../types';
import { SaveResult } from '../config/useDashboardConfig';
import TabsEditor from './TabsEditor';
import EventsEditor from './EventsEditor';
import ChartsEditor from './ChartsEditor';

type Section = 'tabs' | 'events' | 'charts';

interface EditorPanelProps {
  config: DashboardConfig;
  onSave: (next: DashboardConfig) => Promise<SaveResult>;
  onClose: () => void;
  onEventsChanged?: () => void;
}

const SECTIONS: { id: Section; label: string; icon: typeof LayoutList }[] = [
  { id: 'tabs', label: 'Вкладки', icon: LayoutList },
  { id: 'charts', label: 'Графики', icon: BarChart3 },
  { id: 'events', label: 'События', icon: CalendarClock },
];

export default function EditorPanel({ config, onSave, onClose, onEventsChanged }: EditorPanelProps) {
  const [draft, setDraft] = useState<DashboardConfig>(() => JSON.parse(JSON.stringify(config)));
  const [section, setSection] = useState<Section>('tabs');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ kind: 'ok' | 'conflict' | 'error'; message?: string } | null>(null);

  const dirty = JSON.stringify(draft.tabs) !== JSON.stringify(config.tabs)
    || JSON.stringify(draft.customCharts) !== JSON.stringify(config.customCharts);

  const handleSave = async () => {
    setSaving(true);
    setStatus(null);
    const result = await onSave(draft);
    setSaving(false);
    if (result.ok === true) {
      setStatus({ kind: 'ok' });
    } else if (result.reason === 'conflict') {
      setStatus({ kind: 'conflict', message: 'Кто-то уже изменил конфигурацию — обновите страницу и повторите правки.' });
    } else {
      setStatus({ kind: 'error', message: result.message || 'Не удалось сохранить конфигурацию.' });
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.98 }}
          className="bg-[#0b0b0d] border border-[#27272a] rounded-3xl w-full max-w-5xl max-h-[88vh] flex flex-col overflow-hidden shadow-2xl"
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#1f1f23]">
            <div>
              <h2 className="text-lg font-bold text-white font-display">Редактор Инфоцентра</h2>
              <p className="text-xs text-[#a1a1aa] mt-0.5">
                Вкладки и графики сохраняются в настройках приложения Bitrix24 · события — напрямую в Списке
              </p>
            </div>
            <button type="button" onClick={onClose} className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex flex-1 min-h-0">
            <nav className="w-44 flex-shrink-0 border-r border-[#1f1f23] p-3 space-y-1">
              {SECTIONS.map((s) => {
                const Icon = s.icon;
                const active = section === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSection(s.id)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                      active ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/25' : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60 border border-transparent'
                    }`}
                  >
                    <Icon className="w-4 h-4" /> {s.label}
                  </button>
                );
              })}
            </nav>

            <div className="flex-1 overflow-y-auto p-6">
              {section === 'tabs' && (
                <TabsEditor tabs={draft.tabs} onChange={(tabs) => setDraft((d) => ({ ...d, tabs }))} />
              )}
              {section === 'charts' && (
                <ChartsEditor
                  charts={draft.customCharts}
                  tabs={draft.tabs}
                  onChange={(customCharts) => setDraft((d) => ({ ...d, customCharts }))}
                />
              )}
              {section === 'events' && (
                <EventsEditor onChanged={onEventsChanged} />
              )}
            </div>
          </div>

          {section !== 'events' && (
            <div className="px-6 py-4 border-t border-[#1f1f23] flex items-center justify-between">
              <div className="text-xs">
                {status?.kind === 'ok' && (
                  <span className="inline-flex items-center gap-1.5 text-emerald-400"><Check className="w-3.5 h-3.5" /> Сохранено</span>
                )}
                {status?.kind === 'conflict' && (
                  <span className="inline-flex items-center gap-1.5 text-amber-400"><AlertTriangle className="w-3.5 h-3.5" /> {status.message}</span>
                )}
                {status?.kind === 'error' && (
                  <span className="inline-flex items-center gap-1.5 text-rose-400"><AlertTriangle className="w-3.5 h-3.5" /> {status.message}</span>
                )}
              </div>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !dirty}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-semibold rounded-xl disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                Сохранить изменения
              </button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
