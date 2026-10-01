import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
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
  UploadCloud,
  History,
  Eye as EyeIcon,
  Info as InfoIcon,
  LayoutDashboard,
  FilePlus2,
  MonitorSmartphone,
} from 'lucide-react';

import { TabId, DashboardState, AnyCard } from './types';
import { useDashboardStore } from './store';
import TabBoard from './components/TabBoard';
import BoardSwitcher from './components/BoardSwitcher';
import SummaryBoard from './components/SummaryBoard';
import ShowcaseBoard from './components/showcase/ShowcaseBoard';
import { useShowcaseStore } from './showcaseStore';
import { isInIframe } from './bitrix';
import logoHeader from './assets/logo-header.svg';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>('security');
  const [editMode, setEditMode] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  // Витрина — общий для всех отделов экран со стикерами. При входе не
  // открывается сама: сотрудник попадает в инфоцентр своего отдела.
  const [showcaseOpen, setShowcaseOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Импорт JSON: заменить всё или только добавить карточки из файла.
  const importModeRef = useRef<'replace' | 'append'>('replace');
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
    duplicateCard,
    moveCard,
    resetToSeed,
    clearAll,
    replaceAll,
    appendAll,
    loadCardHistory,
    portalError,
    localLeftovers,
    adoptLocalLeftovers,
    dismissLocalLeftovers,
    unsyncedLocal,
    keepLocalCopy,
    discardLocalCopy,
    boards,
    activeBoardId,
    activeBoard,
    canEdit,
    role,
    canSeeSummary,
    accessWarning,
    legacyBoardId,
    switchBoard,
    loadSummary,
    loadSummaryConfig,
    saveSummaryConfig,
  } = useDashboardStore();
  const isShared = syncMode === 'bitrix';
  const showcase = useShowcaseStore(syncMode, showcaseOpen);
  // Статус синхронизации в шапке — того экрана, что сейчас открыт.
  const shownStatus = showcaseOpen ? showcase.status : syncStatus;
  const shownError = showcaseOpen ? showcase.error : syncError;
  const shownSyncedAt = showcaseOpen ? showcase.lastSyncedAt : lastSyncedAt;

  // Право на правку зависит от инфоцентра: свой отдел — правим, вышестоящий —
  // только смотрим. Переключились на чужой — режим редактирования выключаем.
  // Витрину правят все сотрудники, поэтому на ней режим не сбрасываем.
  useEffect(() => {
    if (!showcaseOpen && !canEdit && editMode) setEditMode(false);
  }, [canEdit, editMode, showcaseOpen]);

  // Логотип РЦК — только на инфоцентре РЦК. У остальных отделов в шапке
  // название их отдела без чужого бренда.
  const isRckBoard = !summaryOpen && !showcaseOpen && activeBoardId === legacyBoardId;
  const onBoard = !summaryOpen && !showcaseOpen;

  const openBoardFromSummary = (boardId: string) => {
    setSummaryOpen(false);
    void switchBoard(boardId);
  };

  const selectBoard = (boardId: string) => {
    setSummaryOpen(false);
    setShowcaseOpen(false);
    void switchBoard(boardId);
  };

  const openSummary = () => {
    setShowcaseOpen(false);
    setSummaryOpen(true);
  };

  const openShowcase = () => {
    setSummaryOpen(false);
    setShowcaseOpen(true);
  };

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

  const handleImportClick = (mode: 'replace' | 'append' = 'replace') => {
    importModeRef.current = mode;
    fileInputRef.current?.click();
  };

  const downloadJson = (data: unknown, name: string) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleAdoptLeftovers = () => {
    const added = adoptLocalLeftovers();
    alert(
      added
        ? `Добавлено карточек: ${added}. Они сохранены в инфоцентре «${activeBoard?.title || ''}» и видны коллегам.`
        : 'Все эти карточки уже есть в инфоцентре — добавлять нечего.'
    );
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
        if (importModeRef.current === 'append') {
          const added = appendAll(parsed);
          alert(added ? `Добавлено карточек: ${added}. Существующие карточки не изменились.` : 'Все карточки из файла уже есть в инфоцентре.');
        } else {
          replaceAll(parsed);
        }
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
              {isRckBoard && <img src={logoHeader} alt="РЦК" className="h-6 md:h-7 w-auto" />}
              {!isRckBoard && (activeBoard || !onBoard) && (
                <span className="text-lg md:text-xl font-bold text-[#a1a1aa]">
                  · {showcaseOpen ? 'витрина' : summaryOpen ? 'сводный экран' : activeBoard!.title}
                </span>
              )}
            </h1>
            <div className="flex flex-wrap items-center gap-4 text-xs text-[#a1a1aa] pt-1.5">
              <span className="flex items-center gap-1.5 bg-[#161619] px-3 py-1 rounded-full border border-[#27272a]">
                <Clock className="w-3.5 h-3.5 text-indigo-400" />
                <span>Сегодня: <span className="text-white">{formattedToday}</span></span>
              </span>
              {onBoard && (
                <span className="flex items-center gap-1.5 bg-[#161619] px-3 py-1 rounded-full border border-[#27272a]">
                  <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Карточек всего: <span className="text-white">{totalCards}</span></span>
                </span>
              )}
              {showcaseOpen && (
                <span className="flex items-center gap-1.5 bg-[#161619] px-3 py-1 rounded-full border border-[#27272a]">
                  <LayoutDashboard className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Общая для всех отделов · стикеров: <span className="text-white">{showcase.state.notes.length}</span></span>
                </span>
              )}
              {isShared && onBoard && activeBoard && !activeBoard.canEdit && (
                <span className="flex items-center gap-1.5 bg-[#161619] px-3 py-1 rounded-full border border-[#27272a] text-[#a1a1aa]">
                  <EyeIcon className="w-3.5 h-3.5 text-zinc-500" />
                  <span>Только просмотр — это инфоцентр другого отдела</span>
                </span>
              )}
              {syncMode !== 'checking' && (
                <span
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full border ${
                    isShared
                      ? shownStatus === 'error'
                        ? 'bg-rose-500/10 border-rose-500/25 text-rose-300'
                        : 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300'
                      : 'bg-[#161619] border-[#27272a] text-[#a1a1aa]'
                  }`}
                >
                  {isShared ? (
                    shownStatus === 'error' ? <AlertTriangle className="w-3.5 h-3.5" /> : <Wifi className="w-3.5 h-3.5" />
                  ) : (
                    <WifiOff className="w-3.5 h-3.5" />
                  )}
                  <span>
                    {isShared
                      ? shownStatus === 'saving'
                        ? 'Синхронизация с Битрикс24…'
                        : shownStatus === 'error'
                        ? `Не сохранилось в Битрикс24${shownError ? `: ${shownError}` : ''}`
                        : `Общие данные Битрикс24${shownSyncedAt ? ` · ${shownSyncedAt.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}` : ''}`
                      : 'Автономный режим (только этот браузер)'}
                  </span>
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {syncMode !== 'checking' && (
              <BoardSwitcher
                boards={boards}
                activeBoardId={activeBoardId}
                role={role}
                summaryOpen={summaryOpen}
                showcaseOpen={showcaseOpen}
                canSeeSummary={canSeeSummary}
                onSelect={selectBoard}
                onOpenSummary={openSummary}
                onOpenShowcase={openShowcase}
              />
            )}
            {isShared && !summaryOpen && (
              <button
                onClick={showcaseOpen ? showcase.refresh : refresh}
                disabled={shownStatus === 'saving'}
                title="Подтянуть последние изменения от коллег"
                className="p-2.5 rounded-xl bg-zinc-800/60 border border-zinc-700/60 text-zinc-300 hover:text-white transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${shownStatus === 'saving' ? 'animate-spin' : ''}`} />
              </button>
            )}
            {!portalError && (showcaseOpen || (canEdit && !summaryOpen)) && (
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
            )}

            <div className={`relative ${canEdit && onBoard ? '' : 'hidden'}`}>
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
                  <button onClick={() => handleImportClick('append')} className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-zinc-200 hover:bg-zinc-800/60 transition-colors">
                    <FilePlus2 className="w-4 h-4 text-emerald-400" /> Добавить карточки из JSON
                  </button>
                  <button onClick={() => handleImportClick('replace')} className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-zinc-200 hover:bg-zinc-800/60 transition-colors">
                    <Upload className="w-4 h-4 text-blue-400" /> Импортировать JSON (заменить всё)
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

        {!showcaseOpen && (
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
                  {!summaryOpen && (
                    <span className="text-[10px] font-mono text-[#71717a]">{state[tab.id as TabId].length}</span>
                  )}
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
        )}

        {portalError && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="elegant-card rounded-2xl p-4 border border-rose-500/30 bg-rose-500/5 flex flex-col md:flex-row md:items-center gap-3"
          >
            <AlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0" />
            <div className="text-xs text-rose-100/90 leading-relaxed flex-1">
              <p className="font-semibold text-rose-300">Нет связи с Битрикс24 — правка временно отключена.</p>
              <p className="mt-1 text-rose-100/70">
                Причина: {portalError}. Без связи изменения сохранились бы только в этом браузере, и коллеги бы их не
                увидели. Обновите страницу; если не помогает — отключите блокировщик рекламы для портала или
                сообщите администратору.
              </p>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="px-3 py-2 rounded-xl text-xs font-semibold bg-rose-500/20 border border-rose-500/40 text-rose-200 hover:bg-rose-500/30 transition-colors flex-shrink-0"
            >
              Обновить страницу
            </button>
          </motion.div>
        )}

        {syncMode === 'local' && !portalError && !isInIframe() && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="elegant-card rounded-2xl p-4 border border-amber-500/30 bg-amber-500/5 flex items-start gap-3"
          >
            <MonitorSmartphone className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-100/90 leading-relaxed">
              <span className="font-semibold text-amber-200">Инфоцентр открыт напрямую, а не через Битрикс24.</span>{' '}
              Всё, что вы здесь меняете, остаётся только в этом браузере — коллеги этого не увидят. Откройте
              инфоцентр из меню портала. Если вы уже вносили здесь данные, сохраните их: ⚙ → «Экспортировать JSON»,
              а затем в инфоцентре отдела на портале ⚙ → «Добавить карточки из JSON».
            </p>
          </motion.div>
        )}

        {localLeftovers && isShared && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="elegant-card rounded-2xl p-4 border border-amber-500/30 bg-amber-500/5 flex flex-col md:flex-row md:items-center gap-3"
          >
            <UploadCloud className="w-5 h-5 text-amber-400 flex-shrink-0" />
            <div className="text-xs text-amber-100/90 leading-relaxed flex-1">
              <p className="font-semibold text-amber-200">
                В этом браузере остались карточки, внесённые без связи с порталом: {localLeftovers.count}
                {localLeftovers.savedAt
                  ? ` (последняя правка — ${new Date(localLeftovers.savedAt).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })})`
                  : ''}
                .
              </p>
              <p className="mt-1 text-amber-100/70">
                Коллеги их не видят. {onBoard && canEdit && activeBoard
                  ? `Добавьте их в инфоцентр «${activeBoard.title}» — существующие карточки не изменятся.`
                  : 'Откройте инфоцентр своего отдела, чтобы добавить их туда.'}{' '}
                Или скачайте их файлом и загрузите позже через ⚙ → «Добавить карточки из JSON».
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
              {onBoard && canEdit && (
                <button
                  onClick={handleAdoptLeftovers}
                  className="px-3 py-2 rounded-xl text-xs font-semibold bg-amber-500/20 border border-amber-500/40 text-amber-200 hover:bg-amber-500/30 transition-colors"
                >
                  Добавить в этот инфоцентр
                </button>
              )}
              <button
                onClick={() => downloadJson(localLeftovers.state, `infocenter-iz-brauzera-${new Date().toISOString().slice(0, 10)}.json`)}
                className="px-3 py-2 rounded-xl text-xs font-semibold bg-zinc-800/60 border border-zinc-700/60 text-zinc-300 hover:text-white transition-colors"
              >
                Скачать JSON
              </button>
              <button onClick={dismissLocalLeftovers} className="px-2 py-2 text-xs text-zinc-500 hover:text-zinc-300">
                Позже
              </button>
            </div>
          </motion.div>
        )}

        {accessWarning && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="elegant-card rounded-2xl p-4 border border-sky-500/25 bg-sky-500/5 flex items-start gap-3"
          >
            <InfoIcon className="w-5 h-5 text-sky-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-sky-100/80 leading-relaxed">{accessWarning}</p>
          </motion.div>
        )}

        {unsyncedLocal && !showcaseOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="elegant-card rounded-2xl p-4 border border-amber-500/30 bg-amber-500/5 flex flex-col md:flex-row md:items-center gap-3"
          >
            <UploadCloud className="w-5 h-5 text-amber-400 flex-shrink-0" />
            <div className="text-xs text-amber-100/90 leading-relaxed flex-1">
              <p className="font-semibold text-amber-200">
                В этом браузере остались изменения, которые не сохранились на портале.
              </p>
              <p className="mt-1 text-amber-100/70">
                Сейчас показана именно эта, локальная версия. Отправьте её на портал, чтобы её увидели коллеги,
                или откройте версию портала
                {unsyncedLocal.remoteUpdatedAt
                  ? ` (последнее сохранение — ${new Date(unsyncedLocal.remoteUpdatedAt).toLocaleString('ru-RU', {
                      day: '2-digit',
                      month: '2-digit',
                      year: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}${unsyncedLocal.remoteUpdatedBy ? `, ${unsyncedLocal.remoteUpdatedBy}` : ''})`
                  : ''}
                . Ничего не теряется: у каждой карточки есть история версий.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={keepLocalCopy}
                className="px-3 py-2 rounded-xl text-xs font-semibold bg-amber-500/20 border border-amber-500/40 text-amber-200 hover:bg-amber-500/30 transition-colors"
              >
                Отправить на портал
              </button>
              <button
                onClick={discardLocalCopy}
                className="px-3 py-2 rounded-xl text-xs font-semibold bg-zinc-800/60 border border-zinc-700/60 text-zinc-300 hover:text-white transition-colors"
              >
                Показать версию портала
              </button>
            </div>
          </motion.div>
        )}

        {isShared && shownStatus === 'error' && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="elegant-card rounded-2xl p-4 border border-rose-500/30 bg-rose-500/5 flex items-start gap-3"
          >
            <AlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-rose-200/90 leading-relaxed">
              <p className="font-semibold text-rose-300">
                Не удалось сохранить изменения в Битрикс24{shownError ? `: ${shownError}` : ''}.
              </p>
              <p className="mt-1 text-rose-200/70">
                Показаны последние известные данные. Попробуйте нажать «Обновить» — если ошибка повторится,
                проверьте права приложения на портале (нужен доступ к app.option) и повторите позже.
              </p>
            </div>
          </motion.div>
        )}

        <main className="min-h-[400px]">
          {showcaseOpen ? (
            <motion.div key="showcase" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
              <ShowcaseBoard
                state={showcase.state}
                editMode={editMode}
                mutate={showcase.mutate}
                uploads={isShared ? showcase.uploads : 'inline'}
                loadNoteHistory={showcase.loadNoteHistory}
              />
            </motion.div>
          ) : summaryOpen ? (
            <motion.div key={`summary-${activeTab}`} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
              <SummaryBoard
                tab={activeTab}
                tabLabel={tabs.find((t) => t.id === activeTab)?.label || ''}
                loadSummary={loadSummary}
                loadConfig={loadSummaryConfig}
                saveConfig={saveSummaryConfig}
                onOpenBoard={openBoardFromSummary}
              />
            </motion.div>
          ) : (
          <motion.div key={`${activeBoardId}-${activeTab}`} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
            <TabBoard
              tab={activeTab}
              cards={state[activeTab]}
              editMode={editMode}
              onAdd={addCard}
              onUpdate={updateCard}
              onDelete={deleteCard}
              onDuplicate={duplicateCard}
              onMove={moveCard}
              loadHistory={loadCardHistory}
            />
          </motion.div>
          )}
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
              KPI, графики (столбчатые, линейные, с областями, круговые), сметы, списки, карточки ответственных,
              таблицы и события. Счётчик дней работает и в одиночной карточке «Событие», и в списке событий: для
              каждого события выбирается отсчёт до даты или обратный счёт («сколько дней прошло»). В таблицах
              ячейки можно выделять цветом и задавать ширину столбцов — полем в пикселях или перетаскиванием
              правой границы заголовка; длинный текст в ячейке переносится по словам. Таблицу можно загрузить
              из Excel: после выбора файла указываются лист и строка заголовков, а даты, проценты и заливка
              ячеек переносятся такими, какими их показывает Excel. Числа 0–4 в столбце можно показывать
              значками освоения («пирогами») — как в матрице компетенций.
            </p>
            {isShared && (
              <p>
                У каждого отдела свой инфоцентр. Вам сразу открывается инфоцентр вашего отдела — его вы и правите;
                инфоцентры вышестоящих подразделений доступны только для просмотра. Руководитель отдела правит свой
                отдел и все подотделы, а директор и администратор портала — все инфоцентры и сводный экран по
                отделам (переключатель в шапке). На сводном экране кнопка «Настроить сводку» позволяет выбрать,
                какие отделы и какие именно их карточки на него тянуть; настройка личная и хранится на портале.
              </p>
            )}
            <p className="flex items-start gap-1.5">
              <LayoutDashboard className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0 mt-0.5" />
              <span>
                «Витрина» (первый пункт переключателя в шапке) — общий экран для всех отделов: колонки-разделы со
                стикерами. В режиме редактирования стикеры и колонки перетаскиваются мышью, размер стикера меняется
                за правый нижний уголок, ширина колонки — за её правый край (двойной щелчок возвращает размер по
                умолчанию). К стикеру можно приложить картинки и файлы, закрепить его первым в колонке и задать дату
                «актуально до» — после неё стикер уходит с витрины.
              </span>
            </p>
            <p className="flex items-start gap-1.5">
              <History className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0 mt-0.5" />
              <span>
                В режиме редактирования у каждой карточки внизу появляется «История изменений» — ползунок листает
                сохранённые версии этой карточки с датой и автором правки, а кнопка «Восстановить» возвращает
                выбранную версию. В режиме просмотра дашборд её не показывает, но ничего из внесённого не пропадает.
                Изображение в карточке открывается во весь экран — кнопкой в углу картинки или щелчком по ней.
              </span>
            </p>
            {isShared ? (
              <p>
                Приложение открыто внутри Битрикс24 — изменения сохраняются в общем хранилище инфоцентра и видны
                любому сотруднику, открывшему его. Правки коллег подтягиваются при возврате на вкладку, раз в
                минуту и по кнопке обновления. Если двое правят одновременно, изменения обеих вкладок сливаются
                по карточкам, а не затирают друг друга.
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
