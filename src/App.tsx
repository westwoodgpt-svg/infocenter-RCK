import { ChangeEvent, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  ShieldCheck,
  Award,
  Clock,
  CheckCircle2,
  TrendingUp,
  PiggyBank,
  Users2,
  Info,
  Pencil,
  Eye,
  Settings,
  Download,
  Upload,
  RotateCcw,
  Eraser,
  RefreshCw,
  Wifi,
  WifiOff,
  AlertTriangle,
} from 'lucide-react';

import { TabId, DashboardState, AnyCard } from './types';
import { useDashboardStore } from './store';
import TabBoard from './components/TabBoard';
import logoHeader from './assets/logo-header.svg';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>('security');
  const [editMode, setEditMode] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    state,
    syncMode,
    syncStatus,
    syncError,
    lastSyncedAt,
    refresh,
    addCard,
    updateCard,
    deleteCard,
    moveCard,
    resetToSeed,
    clearAll,
    replaceAll,
  } = useDashboardStore();
  const isShared = syncMode === 'bitrix';

  const formattedToday = useMemo(() => {
    return new Date().toLocaleDateString('ru-RU', { year: 'numeric', month: 'long', day: 'numeric' });
  }, []);

  const tabs = [
    { id: 'security', label: 'Безопасность', color: 'bg-red-500', shadowColor: 'rgba(239, 68, 68, 0.15)', hoverBg: 'hover:bg-red-500/5', activeText: 'text-red-400 bg-red-500/10 border-red-500/20', icon: ShieldCheck },
    { id: 'quality', label: 'Качество', color: 'bg-blue-500', shadowColor: 'rgba(59, 130, 246, 0.15)', hoverBg: 'hover:bg-blue-500/5', activeText: 'text-blue-400 bg-blue-500/10 border-blue-500/20', icon: Award },
    { id: 'production', label: 'Производство', color: 'bg-amber-500', shadowColor: 'rgba(245, 158, 11, 0.15)', hoverBg: 'hover:bg-amber-500/5', activeText: 'text-amber-400 bg-amber-500/10 border-amber-500/20', icon: TrendingUp },
    { id: 'costs', label: 'Затраты', color: 'bg-emerald-500', shadowColor: 'rgba(16, 185, 129, 0.15)', hoverBg: 'hover:bg-emerald-500/5', activeText: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', icon: PiggyBank },
    { id: 'personnel', label: 'Персонал', color: 'bg-indigo-500', shadowColor: 'rgba(99, 102, 241, 0.15)', hoverBg: 'hover:bg-indigo-500/5', activeText: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20', icon: Users2 },
  ] as const;

  const totalCards = (Object.values(state) as AnyCard[][]).reduce((acc, list) => acc + list.length, 0);

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `infocenter-rck-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMenuOpen(false);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as DashboardState;
        const validKeys: TabId[] = ['security', 'quality', 'production', 'costs', 'personnel'];
        const isValid = validKeys.every((k) => Array.isArray(parsed[k]));
        if (!isValid) throw new Error('bad shape');
        replaceAll(parsed);
        setMenuOpen(false);
      } catch {
        alert('Не удалось прочитать файл — это должен быть JSON, экспортированный из этого дашборда.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const sharedWarning = isShared ? ' Это отразится у всех пользователей портала.' : '';

  const handleReset = () => {
    if (confirm(`Восстановить данные РЦК на 09.07.2026? Текущие карточки на всех вкладках будут заменены.${sharedWarning}`)) {
      resetToSeed();
      setMenuOpen(false);
    }
  };

  const handleClear = () => {
    if (confirm(`Очистить все вкладки? Это удалит все карточки без возможности отмены (кроме экспортированного JSON).${sharedWarning}`)) {
      clearAll();
      setMenuOpen(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-[#fafafa] py-8 px-4 md:px-8 font-sans antialiased">
      <div className="max-w-7xl mx-auto space-y-8">

        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="elegant-card rounded-3xl p-6 md:p-8 flex flex-col md:flex-row md:items-center md:justify-between gap-6"
        >
          <div className="space-y-1.5">
            <div className="flex items-center gap-3">
              <div className="h-4 w-1 bg-indigo-500 rounded-full shadow-[0_0_8px_#6366f1]" />
              <p className="text-xs font-bold uppercase tracking-widest text-indigo-400 font-display">ЦПП Калининградской области</p>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white font-display flex flex-wrap items-center gap-x-3 gap-y-1.5">
              Инфоцентр
              <img src={logoHeader} alt="РЦК" className="h-6 md:h-7 w-auto" />
            </h1>
            <div className="flex flex-wrap items-center gap-4 text-xs text-[#a1a1aa] pt-1.5">
              <span className="flex items-center gap-1.5 bg-[#161619] px-3 py-1 rounded-full border border-[#27272a]">
                <Clock className="w-3.5 h-3.5 text-indigo-400" />
                <span>Сегодня: <span className="text-white">{formattedToday}</span></span>
              </span>
              <span className="flex items-center gap-1.5 bg-[#161619] px-3 py-1 rounded-full border border-[#27272a]">
                <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" />
                <span>Карточек всего: <span className="text-white">{totalCards}</span></span>
              </span>
              {syncMode !== 'checking' && (
                <span
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full border ${
                    isShared
                      ? syncStatus === 'error'
                        ? 'bg-rose-500/10 border-rose-500/25 text-rose-300'
                        : 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300'
                      : 'bg-[#161619] border-[#27272a] text-[#a1a1aa]'
                  }`}
                >
                  {isShared ? (
                    syncStatus === 'error' ? <AlertTriangle className="w-3.5 h-3.5" /> : <Wifi className="w-3.5 h-3.5" />
                  ) : (
                    <WifiOff className="w-3.5 h-3.5" />
                  )}
                  <span>
                    {isShared
                      ? syncStatus === 'saving'
                        ? 'Синхронизация с Битрикс24…'
                        : syncStatus === 'error'
                        ? `Не сохранилось в Битрикс24${syncError ? `: ${syncError}` : ''}`
                        : `Общие данные Битрикс24${lastSyncedAt ? ` · ${lastSyncedAt.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}` : ''}`
                      : 'Автономный режим (только этот браузер)'}
                  </span>
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isShared && (
              <button
                onClick={refresh}
                disabled={syncStatus === 'saving'}
                title="Подтянуть последние изменения от коллег"
                className="p-2.5 rounded-xl bg-zinc-800/60 border border-zinc-700/60 text-zinc-300 hover:text-white transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${syncStatus === 'saving' ? 'animate-spin' : ''}`} />
              </button>
            )}
            <button
              onClick={() => setEditMode((v) => !v)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                editMode
                  ? 'bg-indigo-500/15 border-indigo-500/40 text-indigo-300'
                  : 'bg-zinc-800/60 border-zinc-700/60 text-zinc-300 hover:text-white'
              }`}
            >
              {editMode ? <Pencil className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              {editMode ? 'Режим редактирования' : 'Режим просмотра'}
            </button>

            <div className="relative">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="p-2.5 rounded-xl bg-zinc-800/60 border border-zinc-700/60 text-zinc-300 hover:text-white transition-colors"
                title="Настройки данных"
              >
                <Settings className="w-4 h-4" />
              </button>
              {menuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="absolute right-0 mt-2 w-64 bg-[#161619] border border-[#27272a] rounded-xl shadow-2xl overflow-hidden z-20"
                >
                  <button onClick={handleExport} className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-zinc-200 hover:bg-zinc-800/60 transition-colors">
                    <Download className="w-4 h-4 text-emerald-400" /> Экспортировать JSON
                  </button>
                  <button onClick={handleImportClick} className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-zinc-200 hover:bg-zinc-800/60 transition-colors">
                    <Upload className="w-4 h-4 text-blue-400" /> Импортировать JSON
                  </button>
                  <button onClick={handleReset} className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-zinc-200 hover:bg-zinc-800/60 transition-colors border-t border-[#1f1f23]">
                    <RotateCcw className="w-4 h-4 text-amber-400" /> Сбросить к данным РЦК
                  </button>
                  <button onClick={handleClear} className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-rose-300 hover:bg-rose-500/10 transition-colors border-t border-[#1f1f23]">
                    <Eraser className="w-4 h-4" /> Очистить всё (пустой инфоцентр)
                  </button>
                </motion.div>
              )}
              <input ref={fileInputRef} type="file" accept="application/json" className="hidden" onChange={handleImportFile} />
            </div>
          </div>
        </motion.header>

        <motion.nav
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="elegant-card rounded-3xl p-2"
        >
          <div className="flex md:flex-wrap gap-1.5 overflow-x-auto md:overflow-visible -mx-2 px-2 md:mx-0 md:px-0 snap-x snap-mandatory scrollbar-none">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as TabId)}
                  className={`relative flex-none md:flex-1 min-w-[132px] md:min-w-0 snap-start flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-sm font-semibold transition-all duration-200 border border-transparent font-display ${
                    isActive ? `${tab.activeText}` : `text-[#a1a1aa] hover:text-white ${tab.hoverBg}`
                  }`}
                  style={isActive ? { boxShadow: `0 0 15px ${tab.shadowColor}` } : {}}
                >
                  <Icon className={`w-4 h-4 transition-all duration-300 ${isActive ? 'scale-110 opacity-100' : 'opacity-60'}`} />
                  <span>{tab.label}</span>
                  <span className="text-[10px] font-mono text-[#71717a]">{state[tab.id as TabId].length}</span>
                  {isActive && (
                    <motion.div
                      layoutId="activeTabIndicator"
                      className={`absolute bottom-0 left-4 right-4 h-0.5 ${tab.color} rounded-full`}
                      transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </motion.nav>

        {isShared && syncStatus === 'error' && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="elegant-card rounded-2xl p-4 border border-rose-500/30 bg-rose-500/5 flex items-start gap-3"
          >
            <AlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-rose-200/90 leading-relaxed">
              <p className="font-semibold text-rose-300">
                Не удалось сохранить изменения в Битрикс24{syncError ? `: ${syncError}` : ''}.
              </p>
              <p className="mt-1 text-rose-200/70">
                Показаны последние известные данные. Попробуйте нажать «Обновить» — если ошибка повторится,
                проверьте права приложения на портале (нужен доступ к app.option) и повторите позже.
              </p>
            </div>
          </motion.div>
        )}

        <main className="min-h-[400px]">
          <motion.div key={activeTab} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
            <TabBoard
              tab={activeTab}
              cards={state[activeTab]}
              editMode={editMode}
              onAdd={addCard}
              onUpdate={updateCard}
              onDelete={deleteCard}
              onMove={moveCard}
            />
          </motion.div>
        </main>

        <motion.footer
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="elegant-card rounded-3xl p-6 flex items-start gap-4"
        >
          <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-2xl flex-shrink-0 border border-indigo-500/20">
            <Info className="w-5 h-5" />
          </div>
          <div className="space-y-1.5 text-xs text-[#a1a1aa] leading-relaxed">
            <h4 className="font-bold text-white">Как это работает</h4>
            <p>
              Включите «Режим редактирования», чтобы добавлять, изменять и удалять карточки на любой вкладке —
              KPI, графики (столбчатые, линейные, с областями, круговые), сметы, списки и карточки ответственных.
            </p>
            {isShared ? (
              <p>
                Приложение открыто внутри Битрикс24 — все изменения сохраняются в общих данных портала
                (<code className="bg-[#1c1c1f] px-1.5 py-0.5 rounded text-indigo-400 border border-[#2d2d34] font-mono">app.option</code>)
                и видны любому сотруднику, открывшему инфоцентр. Правки других пользователей подтягиваются при
                возврате на вкладку или по кнопке обновления рядом с режимом редактирования; если два человека
                правят одновременно, сохраняется последняя версия.
              </p>
            ) : (
              <p>
                Открыто вне Битрикс24 — изменения сохраняются только в этом браузере. Чтобы не потерять данные
                или перенести их на другое устройство, экспортируйте JSON через значок настроек.
              </p>
            )}
          </div>
        </motion.footer>

      </div>
    </div>
  );
}
