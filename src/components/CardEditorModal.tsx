import { useState, ChangeEvent } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { X, Plus, Trash2, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Upload, ImagePlus, Palette } from 'lucide-react';
import * as XLSX from 'xlsx';
import { dataUrlSizeLabel, fileToDataUrl } from '../imageFile';
import {
  AnyCard,
  CardType,
  CARD_TYPE_LABELS,
  ChartType,
  CHART_TYPE_LABELS,
  IndicatorColor,
  INDICATOR_COLOR_LABELS,
  KpiCard,
  ChartCard,
  MoneyCard,
  ListCard,
  PersonCard,
  EventCard,
  EventsCard,
  TableCard,
  TableCellColor,
  TABLE_CELL_COLOR_LABELS,
  ImageCard,
} from '../types';
import { newCardId } from '../store';
import { usePortalUsers } from '../usePortalUsers';
import { isInIframe } from '../bitrix';
import { colorFor } from './cards/palette';
import { cellColorAt, cellColorClass, headerColorAt, swatchClass, TABLE_CELL_COLORS } from './cards/tableColors';

interface CardEditorModalProps {
  open: boolean;
  editingCard: AnyCard | null;
  onClose: () => void;
  onSave: (card: AnyCard) => void;
}

const CARD_TYPES: CardType[] = ['kpi', 'chart', 'money', 'list', 'person', 'event', 'events', 'table', 'image'];
const CHART_TYPES: ChartType[] = ['bar', 'line', 'area', 'pie'];

function blankCard(type: CardType): AnyCard {
  const base = { id: newCardId(), title: '', subtitle: '' };
  switch (type) {
    case 'kpi':
      return { ...base, type: 'kpi', planValue: '', planDate: '', factValue: '', factDate: '', percent: null } as KpiCard;
    case 'chart':
      return {
        ...base,
        type: 'chart',
        chartType: 'bar',
        seriesNames: ['Значение'],
        rows: [{ category: 'Категория 1', values: [0] }],
        seriesAsLine: [false],
      } as ChartCard;
    case 'money':
      return { ...base, type: 'money', plan: 0, fact: 0 } as MoneyCard;
    case 'list':
      return { ...base, type: 'list', items: [] } as ListCard;
    case 'person':
      return { ...base, type: 'person', role: '', tags: [], note: '' } as PersonCard;
    case 'event':
      return { ...base, type: 'event', date: '' } as EventCard;
    case 'events':
      return { ...base, type: 'events', items: [] } as EventsCard;
    case 'table':
      return { ...base, type: 'table', headers: ['Колонка 1', 'Колонка 2'], rows: [['', '']] } as TableCard;
    case 'image':
      return { ...base, type: 'image', imageUrl: '' } as ImageCard;
  }
}

function inputCls() {
  return 'w-full bg-[#161619] border border-[#27272a] rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/40';
}

function labelCls() {
  return 'text-[11px] font-semibold text-[#71717a] uppercase tracking-wide mb-1 block';
}

export default function CardEditorModal({ open, editingCard, onClose, onSave }: CardEditorModalProps) {
  const [pickedType, setPickedType] = useState<CardType | null>(editingCard?.type ?? null);
  const [draft, setDraft] = useState<AnyCard | null>(editingCard);
  const { users: portalUsers, loading: portalUsersLoading, error: portalUsersError } = usePortalUsers();
  const isPersonPicker = pickedType === 'person' && portalUsers.length > 0;

  // Сброс формы при открытии модалки на другой карточке. Раньше это делал
  // useMemo — React вправе пересчитать его когда угодно, и тогда набранное в
  // форме молча откатывалось к исходной карточке. Сравнение с сохранённым
  // ключом сбрасывает форму ровно один раз на открытие.
  const openKey = `${open ? 'open' : 'closed'}:${editingCard ? editingCard.id : 'new'}`;
  const [syncedKey, setSyncedKey] = useState<string>(openKey);
  if (syncedKey !== openKey) {
    setSyncedKey(openKey);
    setPickedType(editingCard?.type ?? null);
    setDraft(editingCard);
  }

  if (!open) return null;

  const startType = (t: CardType) => {
    setPickedType(t);
    setDraft(blankCard(t));
  };

  const canSave =
    !!draft &&
    draft.title.trim().length > 0 &&
    (draft.type !== 'event' || draft.date.trim().length > 0) &&
    (draft.type !== 'image' || draft.imageUrl.trim().length > 0);

  const handleSave = () => {
    if (!draft || !canSave) return;
    onSave(draft);
  };

  // Портал в document.body — иначе fixed-оверлей позиционируется относительно
  // ближайшего анимируемого предка (motion.div со своим transform), а не
  // окна целиком, и на практике оказывается прокручен далеко за пределы экрана.
  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-[#111113] border border-[#27272a] rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-2xl"
        >
          <div className="flex items-center justify-between p-5 border-b border-[#1f1f23] sticky top-0 bg-[#111113] z-10">
            <h2 className="text-base font-bold text-white font-display">
              {editingCard ? 'Редактировать карточку' : 'Новая карточка'}
            </h2>
            <button onClick={onClose} className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-5 space-y-5">
            {!pickedType ? (
              <div>
                <p className={labelCls()}>Тип карточки</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {CARD_TYPES.map((t) => (
                    <button
                      key={t}
                      onClick={() => startType(t)}
                      className="text-left p-3 rounded-xl border border-[#27272a] bg-[#161619] hover:border-indigo-500/40 hover:bg-indigo-500/5 transition-colors text-sm text-zinc-200"
                    >
                      {CARD_TYPE_LABELS[t]}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              draft && (
                <>
                  <div>
                    <p className={labelCls()}>Тип: {CARD_TYPE_LABELS[draft.type]}</p>
                  </div>

                  <div>
                    <label className={labelCls()}>
                      {draft.type === 'person' ? 'ФИО' : draft.type === 'event' ? 'Название события' : 'Заголовок'}
                    </label>
                    <input
                      className={inputCls()}
                      value={draft.title}
                      list={isPersonPicker ? 'employee-options' : undefined}
                      onChange={(e) => {
                        const title = e.target.value;
                        if (draft.type === 'person') {
                          const normalized = title.trim().toLowerCase();
                          const matched = portalUsers.find((u) => u.name.trim().toLowerCase() === normalized);
                          setDraft({
                            ...draft,
                            title,
                            role: matched ? matched.position || draft.role : draft.role,
                            photoUrl: matched ? matched.photo : draft.photoUrl,
                          });
                          return;
                        }
                        setDraft({ ...draft, title });
                      }}
                      placeholder={draft.type === 'person' ? 'Иванов Иван Иванович' : draft.type === 'event' ? 'Сертификация РЦК' : draft.type === 'events' ? 'Ключевые события 2026' : 'Название карточки'}
                    />
                    {isPersonPicker && (
                      <>
                        <p className="text-[11px] text-[#71717a] mt-1">
                          Выберите из списка — подставим сотрудников портала ({portalUsers.length})
                        </p>
                        <datalist id="employee-options">
                          {portalUsers.map((u) => (
                            <option key={u.id} value={u.name} />
                          ))}
                        </datalist>
                      </>
                    )}
                    {draft.type === 'person' && !isPersonPicker && (
                      <p className="text-[11px] text-amber-400/80 mt-1">
                        {portalUsersLoading
                          ? 'Загружаем сотрудников портала…'
                          : portalUsersError
                          ? `Не удалось получить сотрудников портала: ${portalUsersError}. Введите ФИО, должность и фото вручную.`
                          : isInIframe()
                          ? 'Сотрудники портала не найдены — проверьте, что у приложения есть право на чтение пользователей (user.get) в настройках локального приложения Битрикс24, и переоткройте инфоцентр.'
                          : 'Автоподстановка сотрудников доступна только внутри Битрикс24 — вне портала введите данные вручную.'}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className={labelCls()}>
                      {draft.type === 'event'
                        ? 'Описание (необязательно)'
                        : draft.type === 'image'
                        ? 'Подпись (необязательно)'
                        : 'Подзаголовок (необязательно)'}
                    </label>
                    <input
                      className={inputCls()}
                      value={draft.subtitle ?? ''}
                      onChange={(e) => setDraft({ ...draft, subtitle: e.target.value })}
                      placeholder={
                        draft.type === 'event'
                          ? 'Что за событие, где и для кого…'
                          : draft.type === 'image'
                          ? 'Краткое описание изображения…'
                          : 'Реквизиты, период, ответственный…'
                      }
                    />
                  </div>

                  {draft.type === 'kpi' && <KpiFields draft={draft} setDraft={setDraft} />}
                  {draft.type === 'chart' && <ChartFields draft={draft} setDraft={setDraft} />}
                  {draft.type === 'money' && <MoneyFields draft={draft} setDraft={setDraft} />}
                  {draft.type === 'list' && <ListFields draft={draft} setDraft={setDraft} />}
                  {draft.type === 'person' && <PersonFields draft={draft} setDraft={setDraft} />}
                  {draft.type === 'event' && <EventFields draft={draft} setDraft={setDraft} />}
                  {draft.type === 'events' && <EventsFields draft={draft} setDraft={setDraft} />}
                  {draft.type === 'table' && <TableFields draft={draft} setDraft={setDraft} />}
                  {draft.type === 'image' && <ImageFields draft={draft} setDraft={setDraft} />}

                  <IndicatorField draft={draft} setDraft={setDraft} />
                </>
              )
            )}
          </div>

          {pickedType && (
            <div className="flex items-center justify-end gap-3 p-5 border-t border-[#1f1f23] sticky bottom-0 bg-[#111113]">
              <button onClick={onClose} className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors">
                Отмена
              </button>
              <button
                onClick={handleSave}
                disabled={!canSave}
                className="px-4 py-2 text-sm font-semibold bg-indigo-500 hover:bg-indigo-400 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
              >
                Сохранить
              </button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}

function KpiFields({ draft, setDraft }: { draft: KpiCard; setDraft: (c: AnyCard) => void }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <label className={labelCls()}>План</label>
        <input className={inputCls()} value={draft.planValue} onChange={(e) => setDraft({ ...draft, planValue: e.target.value })} />
      </div>
      <div>
        <label className={labelCls()}>Плановая дата</label>
        <input className={inputCls()} value={draft.planDate ?? ''} onChange={(e) => setDraft({ ...draft, planDate: e.target.value })} placeholder="дд.мм.гггг" />
      </div>
      <div>
        <label className={labelCls()}>Факт</label>
        <input className={inputCls()} value={draft.factValue} onChange={(e) => setDraft({ ...draft, factValue: e.target.value })} />
      </div>
      <div>
        <label className={labelCls()}>Фактическая дата</label>
        <input className={inputCls()} value={draft.factDate ?? ''} onChange={(e) => setDraft({ ...draft, factDate: e.target.value })} placeholder="дд.мм.гггг" />
      </div>
      <div className="col-span-2">
        <label className={labelCls()}>% исполнения (пусто = без индикатора)</label>
        <input
          type="number"
          className={inputCls()}
          value={draft.percent ?? ''}
          onChange={(e) => setDraft({ ...draft, percent: e.target.value === '' ? null : Number(e.target.value) })}
        />
      </div>
    </div>
  );
}

function EventFields({ draft, setDraft }: { draft: EventCard; setDraft: (c: AnyCard) => void }) {
  const isElapsed = draft.counterMode === 'elapsed';
  return (
    <div>
      <label className={labelCls()}>Дата события</label>
      <input
        type="date"
        className={inputCls()}
        value={draft.date}
        onChange={(e) => setDraft({ ...draft, date: e.target.value })}
      />
      <p className="text-[11px] text-[#71717a] mt-1">
        {isElapsed
          ? 'Обратный счёт: карточка покажет, сколько дней прошло от этой даты (растёт каждый день).'
          : 'Счётчик дней до/после события считается автоматически от текущей даты.'}
      </p>
      <label className="flex items-center gap-2 mt-3 text-[11px] font-semibold text-[#71717a] uppercase tracking-wide">
        <input
          type="checkbox"
          checked={isElapsed}
          onChange={(e) => setDraft({ ...draft, counterMode: e.target.checked ? 'elapsed' : 'countdown' })}
        />
        Обратный счёт от даты (сколько дней прошло, напр. «дней без штрафа»)
      </label>
    </div>
  );
}

function EventsFields({ draft, setDraft }: { draft: EventsCard; setDraft: (c: AnyCard) => void }) {
  const update = (items: EventsCard['items']) => setDraft({ ...draft, items });
  const patch = (i: number, fields: Partial<EventsCard['items'][number]>) => {
    const next = [...draft.items];
    next[i] = { ...next[i], ...fields };
    update(next);
  };

  return (
    <div>
      <label className={labelCls()}>События (несколько в одной карточке)</label>
      <div className="space-y-2.5">
        {draft.items.map((item, i) => {
          const isElapsed = item.counterMode === 'elapsed';
          return (
            <div key={i} className="border border-[#27272a] rounded-xl p-2.5 space-y-2 bg-[#141417]">
              <div className="flex items-center gap-2">
                <input
                  className={inputCls()}
                  value={item.title}
                  placeholder="Название события"
                  onChange={(e) => patch(i, { title: e.target.value })}
                />
                <input
                  type="date"
                  className={inputCls()}
                  value={item.date}
                  onChange={(e) => patch(i, { date: e.target.value })}
                />
                <button
                  onClick={() => update(draft.items.filter((_, idx) => idx !== i))}
                  title="Удалить событие"
                  className="p-2 text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors flex-shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              {/* Такой же переключатель счётчика, как в одиночной карточке «Событие»:
                  обратный счёт нужен и здесь (например, «дней без штрафа» по каждому авто). */}
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => patch(i, { counterMode: 'countdown' })}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors ${
                    !isElapsed
                      ? 'bg-indigo-500/15 border-indigo-500/40 text-indigo-300'
                      : 'bg-[#161619] border-[#27272a] text-zinc-400 hover:text-white'
                  }`}
                >
                  Отсчёт до даты
                </button>
                <button
                  type="button"
                  onClick={() => patch(i, { counterMode: 'elapsed' })}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors ${
                    isElapsed
                      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                      : 'bg-[#161619] border-[#27272a] text-zinc-400 hover:text-white'
                  }`}
                >
                  Обратный счёт от даты
                </button>
                <span className="text-[11px] text-[#71717a]">
                  {isElapsed ? 'покажет, сколько дней прошло (растёт каждый день)' : 'покажет, сколько дней осталось'}
                </span>
              </div>
            </div>
          );
        })}
        <button
          onClick={() => update([...draft.items, { title: '', date: '', counterMode: 'countdown' }])}
          className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-semibold mt-1"
        >
          <Plus className="w-3.5 h-3.5" /> Добавить событие
        </button>
      </div>
      <p className="text-[11px] text-[#71717a] mt-2">
        Карточка сама отсортирует события по дате, посчитает дни по каждому и подпишет «Завершено» / «Ближайшее» /
        «Планируется», а события с обратным счётом — числом прошедших дней.
      </p>
    </div>
  );
}

function IndicatorField({ draft, setDraft }: { draft: AnyCard; setDraft: (c: AnyCard) => void }) {
  const indicator = draft.indicator ?? { enabled: false, color: 'emerald' as IndicatorColor };
  return (
    <div className="border-t border-[#1f1f23] pt-4">
      <label className="flex items-center gap-2 text-[11px] font-semibold text-[#71717a] uppercase tracking-wide">
        <input
          type="checkbox"
          checked={indicator.enabled}
          onChange={(e) => setDraft({ ...draft, indicator: { ...indicator, enabled: e.target.checked } })}
        />
        Индикатор статуса («светофор») в углу карточки
      </label>
      {indicator.enabled && (
        <div className="flex flex-wrap gap-2 mt-2">
          {(Object.keys(INDICATOR_COLOR_LABELS) as IndicatorColor[]).map((c) => (
            <button
              key={c}
              onClick={() => setDraft({ ...draft, indicator: { ...indicator, color: c } })}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                indicator.color === c
                  ? 'bg-indigo-500/15 border-indigo-500/40 text-indigo-300'
                  : 'bg-[#161619] border-[#27272a] text-zinc-400 hover:text-white'
              }`}
            >
              {INDICATOR_COLOR_LABELS[c]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function MoneyFields({ draft, setDraft }: { draft: MoneyCard; setDraft: (c: AnyCard) => void }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <label className={labelCls()}>План, ₽</label>
        <input type="number" className={inputCls()} value={draft.plan} onChange={(e) => setDraft({ ...draft, plan: Number(e.target.value) })} />
      </div>
      <div>
        <label className={labelCls()}>Факт, ₽</label>
        <input type="number" className={inputCls()} value={draft.fact} onChange={(e) => setDraft({ ...draft, fact: Number(e.target.value) })} />
      </div>
    </div>
  );
}

function ListFields({ draft, setDraft }: { draft: ListCard; setDraft: (c: AnyCard) => void }) {
  const update = (items: string[]) => setDraft({ ...draft, items });
  return (
    <div>
      <label className={labelCls()}>Пункты списка</label>
      <div className="space-y-2">
        {draft.items.map((item, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              className={inputCls()}
              value={item}
              onChange={(e) => {
                const next = [...draft.items];
                next[i] = e.target.value;
                update(next);
              }}
            />
            <button
              onClick={() => update(draft.items.filter((_, idx) => idx !== i))}
              className="p-2 text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors flex-shrink-0"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
        <button
          onClick={() => update([...draft.items, ''])}
          className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-semibold mt-1"
        >
          <Plus className="w-3.5 h-3.5" /> Добавить пункт
        </button>
      </div>
    </div>
  );
}

function PersonFields({ draft, setDraft }: { draft: PersonCard; setDraft: (c: AnyCard) => void }) {
  const [tagInput, setTagInput] = useState('');
  const addTag = () => {
    const v = tagInput.trim();
    if (!v) return;
    setDraft({ ...draft, tags: [...draft.tags, v] });
    setTagInput('');
  };
  return (
    <div className="space-y-4">
      {draft.photoUrl && (
        <div className="flex items-center gap-3">
          <img src={draft.photoUrl} alt={draft.title} className="w-10 h-10 rounded-lg object-cover border border-[#27272a]" />
          <span className="text-[11px] text-[#71717a]">Фото подставлено из профиля сотрудника в Битрикс24</span>
        </div>
      )}
      <div>
        <label className={labelCls()}>Роль / должность</label>
        <input className={inputCls()} value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value })} />
      </div>
      <div>
        <label className={labelCls()}>Направления (теги)</label>
        <div className="flex flex-wrap gap-2 mb-2">
          {draft.tags.map((t, i) => (
            <span key={i} className="flex items-center gap-1.5 text-xs text-zinc-300 bg-[#161619] px-2.5 py-1 rounded-lg border border-[#27272a]/60">
              {t}
              <button onClick={() => setDraft({ ...draft, tags: draft.tags.filter((_, idx) => idx !== i) })} className="text-zinc-500 hover:text-rose-400">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            className={inputCls()}
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addTag();
              }
            }}
            placeholder="Добавить направление и Enter"
          />
          <button onClick={addTag} className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm text-zinc-200 transition-colors flex-shrink-0">
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div>
        <label className={labelCls()}>Заметка (необязательно)</label>
        <input className={inputCls()} value={draft.note ?? ''} onChange={(e) => setDraft({ ...draft, note: e.target.value })} placeholder="День рождения, контакты…" />
      </div>
    </div>
  );
}

function arrayMove<T>(arr: T[], from: number, to: number): T[] {
  const copy = [...arr];
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}

function ChartFields({ draft, setDraft }: { draft: ChartCard; setDraft: (c: AnyCard) => void }) {
  const setSeriesName = (idx: number, name: string) => {
    const seriesNames = [...draft.seriesNames];
    seriesNames[idx] = name;
    setDraft({ ...draft, seriesNames });
  };

  const addSeries = () => {
    const seriesNames = [...draft.seriesNames, `Ряд ${draft.seriesNames.length + 1}`];
    const rows = draft.rows.map((r) => ({ ...r, values: [...r.values, 0] }));
    const seriesAsLine = [...(draft.seriesAsLine ?? draft.seriesNames.map(() => false)), false];
    const seriesColors = [...(draft.seriesColors ?? draft.seriesNames.map((_, i) => colorFor(i))), colorFor(draft.seriesNames.length)];
    setDraft({ ...draft, seriesNames, rows, seriesAsLine, seriesColors });
  };

  const removeSeries = (idx: number) => {
    if (draft.seriesNames.length <= 1) return;
    const seriesNames = draft.seriesNames.filter((_, i) => i !== idx);
    const rows = draft.rows.map((r) => ({ ...r, values: r.values.filter((_, i) => i !== idx) }));
    const seriesAsLine = (draft.seriesAsLine ?? draft.seriesNames.map(() => false)).filter((_, i) => i !== idx);
    const seriesColors = (draft.seriesColors ?? draft.seriesNames.map((_, i) => colorFor(i))).filter((_, i) => i !== idx);
    setDraft({ ...draft, seriesNames, rows, seriesAsLine, seriesColors });
  };

  const moveSeries = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= draft.seriesNames.length) return;
    const seriesNames = arrayMove(draft.seriesNames, idx, target);
    const seriesAsLine = arrayMove(draft.seriesAsLine ?? draft.seriesNames.map(() => false), idx, target);
    const seriesColors = arrayMove(draft.seriesColors ?? draft.seriesNames.map((_, i) => colorFor(i)), idx, target);
    const rows = draft.rows.map((r) => ({ ...r, values: arrayMove(r.values, idx, target) }));
    setDraft({ ...draft, seriesNames, seriesAsLine, seriesColors, rows });
  };

  const toggleSeriesLine = (idx: number, value: boolean) => {
    const seriesAsLine = draft.seriesNames.map((_, i) => (draft.seriesAsLine?.[i] ?? false));
    seriesAsLine[idx] = value;
    setDraft({ ...draft, seriesAsLine });
  };

  const setSeriesColor = (idx: number, color: string) => {
    const seriesColors = draft.seriesNames.map((_, i) => (draft.seriesColors?.[i] ?? colorFor(i)));
    seriesColors[idx] = color;
    setDraft({ ...draft, seriesColors });
  };

  const setCategory = (rowIdx: number, category: string) => {
    const rows = draft.rows.map((r, i) => (i === rowIdx ? { ...r, category } : r));
    setDraft({ ...draft, rows });
  };

  const setRowColor = (rowIdx: number, color: string) => {
    const rows = draft.rows.map((r, i) => (i === rowIdx ? { ...r, color } : r));
    setDraft({ ...draft, rows });
  };

  const setValue = (rowIdx: number, seriesIdx: number, value: number) => {
    const rows = draft.rows.map((r, i) => {
      if (i !== rowIdx) return r;
      const values = [...r.values];
      values[seriesIdx] = value;
      return { ...r, values };
    });
    setDraft({ ...draft, rows });
  };

  const addRow = () => {
    const rows = [...draft.rows, { category: `Категория ${draft.rows.length + 1}`, values: draft.seriesNames.map(() => 0) }];
    setDraft({ ...draft, rows });
  };

  const removeRow = (idx: number) => {
    setDraft({ ...draft, rows: draft.rows.filter((_, i) => i !== idx) });
  };

  const moveRow = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= draft.rows.length) return;
    setDraft({ ...draft, rows: arrayMove(draft.rows, idx, target) });
  };

  const hasPlanLine = (draft.seriesAsLine ?? []).some(Boolean);

  return (
    <div className="space-y-4">
      <div>
        <label className={labelCls()}>Тип графика</label>
        <div className="flex flex-wrap gap-2">
          {CHART_TYPES.map((ct) => (
            <button
              key={ct}
              onClick={() => setDraft({ ...draft, chartType: ct })}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                draft.chartType === ct
                  ? 'bg-indigo-500/15 border-indigo-500/40 text-indigo-300'
                  : 'bg-[#161619] border-[#27272a] text-zinc-400 hover:text-white'
              }`}
            >
              {CHART_TYPE_LABELS[ct]}
            </button>
          ))}
        </div>
        {draft.chartType === 'pie' && (
          <p className="text-[11px] text-[#71717a] mt-2">Для круговой диаграммы используется только первый ряд данных.</p>
        )}
      </div>

      <div>
        <label className={labelCls()}>Данные</label>
        <div className="overflow-x-auto border border-[#27272a] rounded-xl">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#27272a] bg-[#161619]">
                <th className="text-left p-2 font-semibold text-[#71717a]">Категория</th>
                {draft.seriesNames.map((name, si) => (
                  <th key={si} className="p-2 min-w-[140px]">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => moveSeries(si, -1)}
                        disabled={si === 0}
                        title="Сдвинуть ряд влево"
                        className="text-zinc-600 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed flex-shrink-0"
                      >
                        <ChevronLeft className="w-3 h-3" />
                      </button>
                      {draft.chartType !== 'pie' && (
                        <input
                          type="color"
                          title="Цвет ряда"
                          className="w-5 h-5 rounded border border-[#27272a] bg-transparent p-0 flex-shrink-0 cursor-pointer"
                          value={draft.seriesColors?.[si] ?? colorFor(si)}
                          onChange={(e) => setSeriesColor(si, e.target.value)}
                        />
                      )}
                      <input
                        className="w-full bg-transparent border-b border-[#27272a] text-zinc-200 font-semibold px-1 py-0.5 focus:outline-none focus:border-indigo-500"
                        value={name}
                        onChange={(e) => setSeriesName(si, e.target.value)}
                      />
                      {draft.seriesNames.length > 1 && (
                        <button onClick={() => removeSeries(si)} className="text-zinc-600 hover:text-rose-400 flex-shrink-0">
                          <X className="w-3 h-3" />
                        </button>
                      )}
                      <button
                        onClick={() => moveSeries(si, 1)}
                        disabled={si === draft.seriesNames.length - 1}
                        title="Сдвинуть ряд вправо"
                        className="text-zinc-600 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed flex-shrink-0"
                      >
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                    {draft.chartType === 'bar' && (
                      <label className="flex items-center gap-1 mt-1.5 text-[10px] font-normal text-zinc-500 normal-case">
                        <input
                          type="checkbox"
                          checked={draft.seriesAsLine?.[si] ?? false}
                          onChange={(e) => toggleSeriesLine(si, e.target.checked)}
                        />
                        линией (совмещённая диаграмма)
                      </label>
                    )}
                  </th>
                ))}
                <th className="p-2 w-8" />
              </tr>
            </thead>
            <tbody>
              {draft.rows.map((row, ri) => (
                <tr key={ri} className="border-b border-[#1f1f23] last:border-b-0">
                  <td className="p-2">
                    <div className="flex items-center gap-1">
                      <div className="flex flex-col flex-shrink-0">
                        <button
                          onClick={() => moveRow(ri, -1)}
                          disabled={ri === 0}
                          title="Сдвинуть категорию выше"
                          className="text-zinc-600 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed leading-none"
                        >
                          <ChevronUp className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => moveRow(ri, 1)}
                          disabled={ri === draft.rows.length - 1}
                          title="Сдвинуть категорию ниже"
                          className="text-zinc-600 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed leading-none"
                        >
                          <ChevronDown className="w-3 h-3" />
                        </button>
                      </div>
                      {draft.chartType === 'pie' && (
                        <input
                          type="color"
                          title="Цвет сектора"
                          className="w-5 h-5 rounded border border-[#27272a] bg-transparent p-0 flex-shrink-0 cursor-pointer"
                          value={row.color ?? colorFor(ri)}
                          onChange={(e) => setRowColor(ri, e.target.value)}
                        />
                      )}
                      <input
                        className="w-full bg-transparent text-zinc-200 px-1 py-0.5 focus:outline-none"
                        value={row.category}
                        onChange={(e) => setCategory(ri, e.target.value)}
                      />
                    </div>
                  </td>
                  {row.values.map((v, si) => (
                    <td key={si} className="p-2">
                      <input
                        type="number"
                        className="w-full bg-transparent text-zinc-200 px-1 py-0.5 focus:outline-none font-mono"
                        value={v}
                        onChange={(e) => setValue(ri, si, Number(e.target.value))}
                      />
                    </td>
                  ))}
                  <td className="p-2">
                    <button onClick={() => removeRow(ri)} className="text-zinc-600 hover:text-rose-400">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex gap-4 mt-2">
          <button onClick={addRow} className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-semibold">
            <Plus className="w-3.5 h-3.5" /> Добавить категорию
          </button>
          <button onClick={addSeries} className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-semibold">
            <Plus className="w-3.5 h-3.5" /> Добавить ряд
          </button>
        </div>
      </div>

      {draft.chartType === 'bar' && hasPlanLine && (
        <div className="border-t border-[#1f1f23] pt-4">
          <label className="flex items-center gap-2 text-[11px] font-semibold text-[#71717a] uppercase tracking-wide">
            <input
              type="checkbox"
              checked={draft.highlightBelowPlan ?? false}
              onChange={(e) => setDraft({ ...draft, highlightBelowPlan: e.target.checked })}
            />
            Подсвечивать столбцы факта, если они ниже плана (линии)
          </label>
          {draft.highlightBelowPlan && (
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs text-zinc-400">Цвет подсветки:</span>
              <input
                type="color"
                className="w-7 h-7 rounded border border-[#27272a] bg-transparent p-0 cursor-pointer"
                value={draft.belowPlanColor || '#f43f5e'}
                onChange={(e) => setDraft({ ...draft, belowPlanColor: e.target.value })}
              />
            </div>
          )}
          <p className="text-[11px] text-[#71717a] mt-2">
            Если включено и хотя бы в одной категории факт ниже плана — индикатор статуса карточки (если включён ниже) автоматически станет красным.
          </p>
        </div>
      )}
    </div>
  );
}

function TableFields({ draft, setDraft }: { draft: TableCard; setDraft: (c: AnyCard) => void }) {
  const [importError, setImportError] = useState<string | null>(null);
  // Открытая палитра: 'h' — ячейка заголовка, число — индекс строки тела.
  const [picker, setPicker] = useState<{ row: number | 'h'; col: number } | null>(null);

  // Цвета живут в отдельной сетке, выровненной по строкам/столбцам таблицы.
  // Приводим её к текущему размеру при каждой правке структуры, иначе после
  // удаления строки или столбца заливка «съезжает» на соседние ячейки.
  const fitColors = (rows: string[][], headers: string[], colors?: TableCellColor[][]): TableCellColor[][] =>
    rows.map((_, ri) => headers.map((__, ci) => colors?.[ri]?.[ci] || 'none'));

  const handleFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isCsv = /\.csv$/i.test(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        // .csv читаем как UTF-8 текст (type: 'string') — иначе SheetJS определяет
        // кодировку по сырым байтам и кириллица без BOM превращается в кракозябры.
        const wb = isCsv
          ? XLSX.read(reader.result as string, { type: 'string' })
          : XLSX.read(reader.result as ArrayBuffer, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });
        const nonEmpty = raw.filter((r) => r.length > 0);
        if (nonEmpty.length === 0) throw new Error('empty');
        const [headerRow, ...bodyRows] = nonEmpty;
        const headers = headerRow.map((h) => String(h ?? ''));
        const rows = bodyRows.map((r) => headers.map((_, i) => String(r[i] ?? '')));
        // Данные заменились целиком — старая раскраска к ним уже не относится.
        setDraft({ ...draft, headers, rows, cellColors: undefined, headerColors: undefined });
        setImportError(null);
      } catch {
        setImportError('Не удалось прочитать файл. Поддерживаются .xlsx, .xls, .csv с заголовками в первой строке.');
      }
    };
    if (isCsv) reader.readAsText(file, 'utf-8');
    else reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const setHeader = (idx: number, value: string) => {
    const headers = [...draft.headers];
    headers[idx] = value;
    setDraft({ ...draft, headers });
  };

  const addColumn = () => {
    const headers = [...draft.headers, `Колонка ${draft.headers.length + 1}`];
    const rows = draft.rows.map((r) => [...r, '']);
    setDraft({
      ...draft,
      headers,
      rows,
      cellColors: draft.cellColors ? fitColors(rows, headers, draft.cellColors) : undefined,
      headerColors: draft.headerColors ? [...draft.headerColors, 'none'] : undefined,
    });
  };

  const removeColumn = (idx: number) => {
    if (draft.headers.length <= 1) return;
    const headers = draft.headers.filter((_, i) => i !== idx);
    const rows = draft.rows.map((r) => r.filter((_, i) => i !== idx));
    setDraft({
      ...draft,
      headers,
      rows,
      // Сначала дотягиваем сетку цветов до текущего размера, потом убираем из
      // неё тот же столбец — так заливка остаётся на своих ячейках.
      cellColors: draft.cellColors
        ? fitColors(draft.rows, draft.headers, draft.cellColors).map((r) => r.filter((_, i) => i !== idx))
        : undefined,
      headerColors: draft.headerColors ? draft.headerColors.filter((_, i) => i !== idx) : undefined,
    });
    setPicker(null);
  };

  const setCell = (rowIdx: number, colIdx: number, value: string) => {
    const rows = draft.rows.map((r, i) => {
      if (i !== rowIdx) return r;
      const next = [...r];
      next[colIdx] = value;
      return next;
    });
    setDraft({ ...draft, rows });
  };

  // Сетка цветов создаётся только когда что-то действительно закрасили — пока
  // заливки нет, в данных карточки не появляется лишних массивов.
  const setCellColor = (rowIdx: number | 'h', colIdx: number, color: TableCellColor) => {
    if (rowIdx === 'h') {
      const headerColors = draft.headers.map((_, i) => (i === colIdx ? color : draft.headerColors?.[i] || 'none'));
      setDraft({ ...draft, headerColors });
      return;
    }
    const cellColors = fitColors(draft.rows, draft.headers, draft.cellColors);
    cellColors[rowIdx][colIdx] = color;
    setDraft({ ...draft, cellColors });
  };

  /** Залить всю строку или весь столбец одним цветом — быстрее, чем по ячейке. */
  const fillRow = (rowIdx: number, color: TableCellColor) => {
    const cellColors = fitColors(draft.rows, draft.headers, draft.cellColors);
    cellColors[rowIdx] = cellColors[rowIdx].map(() => color);
    setDraft({ ...draft, cellColors });
  };

  const fillColumn = (colIdx: number, color: TableCellColor) => {
    const cellColors = fitColors(draft.rows, draft.headers, draft.cellColors).map((r) =>
      r.map((c, ci) => (ci === colIdx ? color : c))
    );
    const headerColors = draft.headers.map((_, i) => (i === colIdx ? color : draft.headerColors?.[i] || 'none'));
    setDraft({ ...draft, cellColors, headerColors });
  };

  const addRow = () => {
    const rows = [...draft.rows, draft.headers.map(() => '')];
    setDraft({ ...draft, rows, cellColors: draft.cellColors ? fitColors(rows, draft.headers, draft.cellColors) : undefined });
    setPicker(null);
  };

  const removeRow = (idx: number) => {
    const rows = draft.rows.filter((_, i) => i !== idx);
    setDraft({
      ...draft,
      rows,
      cellColors: draft.cellColors ? draft.cellColors.filter((_, i) => i !== idx) : undefined,
    });
    setPicker(null);
  };

  const clearColors = () => setDraft({ ...draft, cellColors: undefined, headerColors: undefined });

  const hasColors =
    (draft.cellColors || []).some((r) => (r || []).some((c) => c && c !== 'none')) ||
    (draft.headerColors || []).some((c) => c && c !== 'none');

  const pickerColor = (): TableCellColor =>
    picker ? (picker.row === 'h' ? headerColorAt(draft, picker.col) : cellColorAt(draft, picker.row, picker.col)) : 'none';

  const pickerLabel = () =>
    picker ? (picker.row === 'h' ? `заголовок «${draft.headers[picker.col] || picker.col + 1}»` : `строка ${picker.row + 1}, столбец ${picker.col + 1}`) : '';

  // Палитра живёт под таблицей, а не всплывающим окном у ячейки: таблица
  // прокручивается по горизонтали, и всплывающее окно обрезалось её краем.
  const palette = () => {
    if (!picker) return null;
    const current = pickerColor();
    return (
      <div className="mt-2 p-3 rounded-xl bg-[#131316] border border-indigo-500/30 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold text-[#a1a1aa]">Заливка: {pickerLabel()}</span>
          <button
            type="button"
            onClick={() => setPicker(null)}
            className="ml-auto text-[11px] text-zinc-400 hover:text-white transition-colors"
          >
            Готово
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {TABLE_CELL_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              title={TABLE_CELL_COLOR_LABELS[c]}
              onClick={() => setCellColor(picker.row, picker.col, c)}
              className={`w-6 h-6 rounded-md border transition-transform ${swatchClass(c)} ${
                current === c ? 'ring-2 ring-indigo-400 ring-offset-2 ring-offset-[#131316]' : 'hover:scale-110'
              }`}
            />
          ))}
          <span className="text-[11px] text-[#71717a] ml-1">{TABLE_CELL_COLOR_LABELS[current]}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#71717a]">
          <span>залить этим цветом:</span>
          {picker.row !== 'h' && (
            <button
              type="button"
              onClick={() => fillRow(picker.row as number, current)}
              className="px-2 py-1 rounded-lg border border-[#27272a] hover:text-white transition-colors"
            >
              всю строку
            </button>
          )}
          <button
            type="button"
            onClick={() => fillColumn(picker.col, current)}
            className="px-2 py-1 rounded-lg border border-[#27272a] hover:text-white transition-colors"
          >
            весь столбец
          </button>
        </div>
      </div>
    );
  };

  const togglePicker = (row: number | 'h', col: number) =>
    setPicker((p) => (p && p.row === row && p.col === col ? null : { row, col }));

  return (
    <div className="space-y-3">
      <div>
        <label className={labelCls()}>Загрузить файл</label>
        <label className="flex items-center gap-1.5 text-xs font-semibold text-indigo-400 hover:text-indigo-300 cursor-pointer px-3 py-2 bg-[#161619] border border-[#27272a] rounded-lg w-fit">
          <Upload className="w-3.5 h-3.5" /> Выбрать .xlsx / .xls / .csv
          <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFile} />
        </label>
        {importError && <p className="text-[11px] text-rose-400 mt-1.5">{importError}</p>}
        <p className="text-[11px] text-[#71717a] mt-1.5">Первая строка файла считается заголовками столбцов. Данные также можно править вручную ниже.</p>
      </div>

      <div>
        <div className="flex items-center justify-between gap-3">
          <label className={labelCls()}>Данные</label>
          {hasColors && (
            <button
              type="button"
              onClick={clearColors}
              className="text-[11px] text-zinc-400 hover:text-white transition-colors mb-1"
            >
              Убрать всю заливку
            </button>
          )}
        </div>
        <div className="overflow-x-auto border border-[#27272a] rounded-xl">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#27272a] bg-[#161619]">
                {draft.headers.map((h, ci) => (
                  <th key={ci} className={`p-2 min-w-[130px] ${cellColorClass(headerColorAt(draft, ci))}`}>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        title="Цвет ячейки"
                        onClick={() => togglePicker('h', ci)}
                        className={`w-4 h-4 rounded border flex-shrink-0 ${swatchClass(headerColorAt(draft, ci))} ${
                          picker && picker.row === 'h' && picker.col === ci ? 'ring-2 ring-indigo-400' : ''
                        }`}
                      />
                      <input
                        className="w-full bg-transparent border-b border-[#27272a] text-zinc-200 font-semibold px-1 py-0.5 focus:outline-none focus:border-indigo-500"
                        value={h}
                        onChange={(e) => setHeader(ci, e.target.value)}
                      />
                      {draft.headers.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeColumn(ci)}
                          title="Удалить столбец"
                          className="text-zinc-600 hover:text-rose-400 flex-shrink-0"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </th>
                ))}
                <th className="p-2 w-8" />
              </tr>
            </thead>
            <tbody>
              {draft.rows.map((row, ri) => (
                <tr key={ri} className="border-b border-[#1f1f23] last:border-b-0">
                  {draft.headers.map((_, ci) => (
                    <td key={ci} className={`p-2 ${cellColorClass(cellColorAt(draft, ri, ci))}`}>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          title="Цвет ячейки"
                          onClick={() => togglePicker(ri, ci)}
                          className={`w-4 h-4 rounded border flex-shrink-0 ${swatchClass(cellColorAt(draft, ri, ci))} ${
                            picker && picker.row === ri && picker.col === ci ? 'ring-2 ring-indigo-400' : ''
                          }`}
                        />
                        <input
                          className="w-full bg-transparent text-zinc-200 px-1 py-0.5 focus:outline-none"
                          value={row[ci] ?? ''}
                          onChange={(e) => setCell(ri, ci, e.target.value)}
                        />
                      </div>
                    </td>
                  ))}
                  <td className="p-2">
                    <button type="button" onClick={() => removeRow(ri)} title="Удалить строку" className="text-zinc-600 hover:text-rose-400">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {palette()}
        <div className="flex flex-wrap gap-4 mt-2">
          <button onClick={addRow} className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-semibold">
            <Plus className="w-3.5 h-3.5" /> Добавить строку
          </button>
          <button onClick={addColumn} className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-semibold">
            <Plus className="w-3.5 h-3.5" /> Добавить столбец
          </button>
          <span className="flex items-center gap-1.5 text-[11px] text-[#71717a]">
            <Palette className="w-3.5 h-3.5" /> Квадрат слева от значения — выбор заливки ячейки
          </span>
        </div>
      </div>
    </div>
  );
}

function ImageFields({ draft, setDraft }: { draft: ImageCard; setDraft: (c: AnyCard) => void }) {
  const [error, setError] = useState<string | null>(null);
  const isDataUrl = draft.imageUrl.startsWith('data:');

  const [busy, setBusy] = useState(false);

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Выберите файл изображения (png, jpg, svg…)');
      return;
    }
    setBusy(true);
    try {
      // Большие снимки ужимаем — иначе одна карточка распухает на мегабайты
      // и тормозит сохранение всего инфоцентра.
      const dataUrl = await fileToDataUrl(file);
      setDraft({ ...draft, imageUrl: dataUrl });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'не удалось загрузить изображение');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <label className={labelCls()}>Изображение</label>
      {draft.imageUrl && (
        <img
          src={draft.imageUrl}
          alt=""
          className="w-full max-h-56 object-contain rounded-lg border border-[#27272a] bg-[#161619]"
        />
      )}
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-1.5 text-xs font-semibold text-indigo-400 hover:text-indigo-300 cursor-pointer px-3 py-2 bg-[#161619] border border-[#27272a] rounded-lg">
          <ImagePlus className="w-3.5 h-3.5" /> {busy ? 'Обрабатываем…' : 'Загрузить файл'}
          <input type="file" accept="image/*" className="hidden" onChange={handleFile} disabled={busy} />
        </label>
        {isDataUrl && <span className="text-[11px] text-[#71717a]">{dataUrlSizeLabel(draft.imageUrl)}</span>}
        {draft.imageUrl && (
          <button onClick={() => setDraft({ ...draft, imageUrl: '' })} className="text-xs text-rose-400 hover:text-rose-300">
            Удалить
          </button>
        )}
      </div>
      {error && <p className="text-[11px] text-rose-400">{error}</p>}
      <div>
        <label className={labelCls()}>…или ссылка на изображение</label>
        <input
          className={inputCls()}
          value={isDataUrl ? '' : draft.imageUrl}
          placeholder="https://…"
          onChange={(e) => setDraft({ ...draft, imageUrl: e.target.value })}
        />
      </div>
    </div>
  );
}
