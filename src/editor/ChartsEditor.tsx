import { useEffect, useState } from 'react';
import {
  ArrowUp, ArrowDown, Trash2, Plus, Eye, EyeOff, Pencil, X, Loader2, AlertTriangle,
} from 'lucide-react';
import { ChartConfig, ChartFilter, ChartSeries, ChartType, TabConfig } from '../types';
import {
  getLists, getListFields, createListWithFields, B24ListInfo, B24Field, NewListFieldSpec,
} from '../b24/client';

const CHART_TYPE_LABELS: Record<ChartType, string> = {
  bar: 'Столбцы',
  line: 'Линия',
  area: 'Область',
  pie: 'Круговая диаграмма',
  kpi: 'KPI-карточка (число)',
  table: 'Таблица',
};

const FIELD_TYPE_LABELS: Record<NewListFieldSpec['type'], string> = {
  S: 'Текст',
  N: 'Число',
  'S:DateTime': 'Дата',
};

interface ChartsEditorProps {
  charts: ChartConfig[];
  tabs: TabConfig[];
  onChange: (charts: ChartConfig[]) => void;
}

function renumberByTab(charts: ChartConfig[]): ChartConfig[] {
  const byTab = new Map<string, ChartConfig[]>();
  charts.forEach((c) => {
    const list = byTab.get(c.tabId) || [];
    list.push(c);
    byTab.set(c.tabId, list);
  });
  const result: ChartConfig[] = [];
  byTab.forEach((list) => {
    list.sort((a, b) => a.order - b.order).forEach((c, i) => result.push({ ...c, order: i }));
  });
  return result;
}

export default function ChartsEditor({ charts, tabs, onChange }: ChartsEditorProps) {
  const [editingId, setEditingId] = useState<string | 'new' | null>(null);

  const sorted = [...charts].sort((a, b) => (a.tabId === b.tabId ? a.order - b.order : a.tabId.localeCompare(b.tabId)));
  const tabLabel = (id: string) => tabs.find((t) => t.id === id)?.label || id;

  const move = (chart: ChartConfig, dir: -1 | 1) => {
    const siblings = charts.filter((c) => c.tabId === chart.tabId).sort((a, b) => a.order - b.order);
    const idx = siblings.findIndex((c) => c.id === chart.id);
    const swapWith = idx + dir;
    if (swapWith < 0 || swapWith >= siblings.length) return;
    [siblings[idx], siblings[swapWith]] = [siblings[swapWith], siblings[idx]];
    const others = charts.filter((c) => c.tabId !== chart.tabId);
    onChange(renumberByTab([...others, ...siblings]));
  };

  const toggleVisible = (id: string) => {
    onChange(charts.map((c) => (c.id === id ? { ...c, visible: !c.visible } : c)));
  };

  const remove = (id: string) => {
    onChange(renumberByTab(charts.filter((c) => c.id !== id)));
  };

  const upsert = (chart: ChartConfig) => {
    const exists = charts.some((c) => c.id === chart.id);
    const next = exists ? charts.map((c) => (c.id === chart.id ? chart : c)) : [...charts, chart];
    onChange(renumberByTab(next));
    setEditingId(null);
  };

  if (editingId !== null) {
    const editing = editingId === 'new' ? undefined : charts.find((c) => c.id === editingId);
    return (
      <ChartForm
        chart={editing}
        tabs={tabs}
        existingCount={charts.length}
        onCancel={() => setEditingId(null)}
        onSave={upsert}
      />
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-[#a1a1aa]">
        Пользовательские графики поверх Списков Б24. Встроенные графики пяти исходных вкладок
        пока редактируются только в коде — здесь управляются графики, добавленные через
        редактор.
      </p>

      {sorted.length === 0 && (
        <p className="text-xs text-[#71717a] bg-[#161619] border border-[#27272a] rounded-xl px-3 py-4 text-center">
          Пользовательских графиков пока нет.
        </p>
      )}

      <div className="space-y-2">
        {sorted.map((chart, idx) => {
          const siblingsBefore = sorted.filter((c) => c.tabId === chart.tabId).indexOf(chart);
          const siblingsCount = sorted.filter((c) => c.tabId === chart.tabId).length;
          return (
            <div key={chart.id} className="flex items-center gap-2 bg-[#161619] border border-[#27272a] rounded-xl px-3 py-2.5">
              <div className="flex flex-col gap-0.5">
                <button type="button" onClick={() => move(chart, -1)} disabled={siblingsBefore === 0}
                  className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-20">
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
                <button type="button" onClick={() => move(chart, 1)} disabled={siblingsBefore === siblingsCount - 1}
                  className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-20">
                  <ArrowDown className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm text-white font-medium truncate">{chart.title}</p>
                <p className="text-[11px] text-zinc-500 font-mono">
                  {tabLabel(chart.tabId)} · {CHART_TYPE_LABELS[chart.type]} · Список {chart.dataSource.listId}
                </p>
              </div>

              <button type="button" onClick={() => toggleVisible(chart.id)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800" title={chart.visible ? 'Скрыть' : 'Показать'}>
                {chart.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4 text-amber-400" />}
              </button>
              <button type="button" onClick={() => setEditingId(chart.id)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-indigo-300 hover:bg-indigo-500/10" title="Редактировать">
                <Pencil className="w-4 h-4" />
              </button>
              <button type="button" onClick={() => remove(chart.id)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10" title="Удалить">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>

      <button type="button" onClick={() => setEditingId('new')}
        className="inline-flex items-center gap-1.5 px-3 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 text-sm font-medium rounded-xl border border-indigo-500/25 transition-colors">
        <Plus className="w-4 h-4" /> Добавить график
      </button>
    </div>
  );
}

/* ── Форма создания/редактирования одного графика ─────────── */

interface ChartFormProps {
  chart?: ChartConfig;
  tabs: TabConfig[];
  existingCount: number;
  onCancel: () => void;
  onSave: (chart: ChartConfig) => void;
}

function ChartForm({ chart, tabs, existingCount, onCancel, onSave }: ChartFormProps) {
  const [title, setTitle] = useState(chart?.title ?? '');
  const [subtitle, setSubtitle] = useState(chart?.subtitle ?? '');
  const [tabId, setTabId] = useState(chart?.tabId ?? tabs[0]?.id ?? '');
  const [type, setType] = useState<ChartType>(chart?.type ?? 'bar');
  const [goal, setGoal] = useState(chart?.goal !== undefined ? String(chart.goal) : '');

  const [sourceMode, setSourceMode] = useState<'existing' | 'new'>('existing');
  const [lists, setLists] = useState<B24ListInfo[]>([]);
  const [listsLoading, setListsLoading] = useState(false);
  const [listId, setListId] = useState<number | null>(chart?.dataSource.listId ?? null);
  const [fields, setFields] = useState<B24Field[]>([]);
  const [fieldsLoading, setFieldsLoading] = useState(false);
  const [nameField, setNameField] = useState(chart?.dataSource.nameField ?? 'NAME');
  const [series, setSeries] = useState<ChartSeries[]>(chart?.dataSource.series ?? []);
  const [filters, setFilters] = useState<ChartFilter[]>(chart?.dataSource.filters ?? []);

  const [newListName, setNewListName] = useState('');
  const [newFields, setNewFields] = useState<NewListFieldSpec[]>([{ name: 'Значение', type: 'N' }]);
  const [creatingList, setCreatingList] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (sourceMode !== 'existing') return;
    let cancelled = false;
    setListsLoading(true);
    getLists().then((r) => { if (!cancelled) setLists(r); })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : 'Не удалось получить Списки'); })
      .finally(() => { if (!cancelled) setListsLoading(false); });
    return () => { cancelled = true; };
  }, [sourceMode]);

  useEffect(() => {
    if (!listId) { setFields([]); return; }
    let cancelled = false;
    setFieldsLoading(true);
    getListFields(listId).then((r) => { if (!cancelled) setFields(r); })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : 'Не удалось получить поля Списка'); })
      .finally(() => { if (!cancelled) setFieldsLoading(false); });
    return () => { cancelled = true; };
  }, [listId]);

  const addSeries = () => {
    const key = `s${series.length}_${Date.now()}`;
    const firstField = fields[0]?.fieldId || 'NAME';
    setSeries([...series, { key, label: fields.find((f) => f.fieldId === firstField)?.label || firstField, field: firstField }]);
  };
  const updateSeries = (key: string, patch: Partial<ChartSeries>) => {
    setSeries(series.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  };
  const removeSeries = (key: string) => setSeries(series.filter((s) => s.key !== key));

  const addFilter = () => setFilters([...filters, { field: nameField, op: 'eq', value: '' }]);
  const updateFilter = (idx: number, patch: Partial<ChartFilter>) => {
    setFilters(filters.map((f, i) => (i === idx ? { ...f, ...patch } : f)));
  };
  const removeFilter = (idx: number) => setFilters(filters.filter((_, i) => i !== idx));

  const addNewField = () => setNewFields([...newFields, { name: '', type: 'N' }]);
  const updateNewField = (idx: number, patch: Partial<NewListFieldSpec>) => {
    setNewFields(newFields.map((f, i) => (i === idx ? { ...f, ...patch } : f)));
  };
  const removeNewField = (idx: number) => setNewFields(newFields.filter((_, i) => i !== idx));

  const createNewList = async () => {
    if (!newListName.trim() || newFields.some((f) => !f.name.trim())) {
      setError('Укажите имя списка и названия всех полей');
      return;
    }
    setCreatingList(true);
    setError(null);
    try {
      const { listId: createdId, fieldIds } = await createListWithFields(newListName.trim(), newFields);
      setListId(createdId);
      setNameField('NAME');
      setSeries(newFields.map((f, i) => ({ key: `s${i}_${Date.now()}`, label: f.name, field: fieldIds[i] })));
      setSourceMode('existing');
      // подтягиваем поля только что созданного списка, чтобы форма ниже вела себя как с обычным списком
      const created = await getListFields(createdId);
      setFields(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось создать список');
    } finally {
      setCreatingList(false);
    }
  };

  const canSave = title.trim() && tabId && listId && series.length > 0;

  const handleSave = () => {
    if (!canSave || !listId) return;
    const config: ChartConfig = {
      id: chart?.id ?? `chart-${Date.now()}`,
      tabId,
      order: chart?.order ?? existingCount,
      visible: chart?.visible ?? true,
      title: title.trim(),
      subtitle: subtitle.trim() || undefined,
      type,
      goal: goal.trim() ? Number(goal) : undefined,
      dataSource: {
        listId,
        listName: lists.find((l) => l.id === listId)?.name,
        nameField,
        series,
        filters: filters.length ? filters : undefined,
      },
    };
    onSave(config);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold text-white">{chart ? 'Редактирование графика' : 'Новый график'}</h4>
        <button type="button" onClick={onCancel} className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800">
          <X className="w-4 h-4" />
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 text-xs text-amber-300/90 bg-amber-500/5 border border-amber-500/20 rounded-xl p-3">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-400" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <label className="text-xs text-zinc-400 space-y-1">
          Название
          <input value={title} onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-[#0d0d0f] border border-[#27272a] rounded-lg px-2 py-1.5 text-sm text-white outline-none focus:border-indigo-500/40" />
        </label>
        <label className="text-xs text-zinc-400 space-y-1">
          Подпись (необязательно)
          <input value={subtitle} onChange={(e) => setSubtitle(e.target.value)}
            className="w-full bg-[#0d0d0f] border border-[#27272a] rounded-lg px-2 py-1.5 text-sm text-white outline-none focus:border-indigo-500/40" />
        </label>
        <label className="text-xs text-zinc-400 space-y-1">
          Вкладка
          <select value={tabId} onChange={(e) => setTabId(e.target.value)}
            className="w-full bg-[#0d0d0f] border border-[#27272a] rounded-lg px-2 py-1.5 text-sm text-white outline-none focus:border-indigo-500/40">
            {tabs.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </label>
        <label className="text-xs text-zinc-400 space-y-1">
          Тип отображения
          <select value={type} onChange={(e) => setType(e.target.value as ChartType)}
            className="w-full bg-[#0d0d0f] border border-[#27272a] rounded-lg px-2 py-1.5 text-sm text-white outline-none focus:border-indigo-500/40">
            {(Object.keys(CHART_TYPE_LABELS) as ChartType[]).map((t) => <option key={t} value={t}>{CHART_TYPE_LABELS[t]}</option>)}
          </select>
        </label>
        {(type === 'bar' || type === 'line' || type === 'area') && (
          <label className="text-xs text-zinc-400 space-y-1">
            Целевая линия (необязательно)
            <input value={goal} onChange={(e) => setGoal(e.target.value)} inputMode="numeric"
              className="w-full bg-[#0d0d0f] border border-[#27272a] rounded-lg px-2 py-1.5 text-sm text-white outline-none focus:border-indigo-500/40" />
          </label>
        )}
      </div>

      <div className="border-t border-[#1f1f23] pt-3 space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-zinc-300">Источник данных</span>
          <div className="flex gap-1 bg-[#0d0d0f] border border-[#27272a] rounded-lg p-0.5">
            <button type="button" onClick={() => setSourceMode('existing')}
              className={`px-2.5 py-1 text-xs rounded-md ${sourceMode === 'existing' ? 'bg-indigo-500/20 text-indigo-200' : 'text-zinc-400'}`}>
              Существующий список
            </button>
            <button type="button" onClick={() => setSourceMode('new')}
              className={`px-2.5 py-1 text-xs rounded-md ${sourceMode === 'new' ? 'bg-indigo-500/20 text-indigo-200' : 'text-zinc-400'}`}>
              Создать новый список
            </button>
          </div>
        </div>

        {sourceMode === 'existing' && (
          <div className="space-y-2">
            <label className="text-xs text-zinc-400 space-y-1 block">
              Список Б24 {listsLoading && <Loader2 className="inline w-3 h-3 animate-spin ml-1" />}
              <select value={listId ?? ''} onChange={(e) => setListId(e.target.value ? Number(e.target.value) : null)}
                className="w-full bg-[#0d0d0f] border border-[#27272a] rounded-lg px-2 py-1.5 text-sm text-white outline-none focus:border-indigo-500/40">
                <option value="">— выбрать —</option>
                {lists.map((l) => <option key={l.id} value={l.id}>{l.name} (ID {l.id})</option>)}
              </select>
            </label>

            {listId && (
              <label className="text-xs text-zinc-400 space-y-1 block">
                Поле для подписи (ось X) {fieldsLoading && <Loader2 className="inline w-3 h-3 animate-spin ml-1" />}
                <select value={nameField} onChange={(e) => setNameField(e.target.value)}
                  className="w-full bg-[#0d0d0f] border border-[#27272a] rounded-lg px-2 py-1.5 text-sm text-white outline-none focus:border-indigo-500/40">
                  <option value="NAME">NAME (стандартное название элемента)</option>
                  {fields.map((f) => <option key={f.fieldId} value={f.fieldId}>{f.label} ({f.fieldId})</option>)}
                </select>
              </label>
            )}
          </div>
        )}

        {sourceMode === 'new' && (
          <div className="space-y-2 bg-[#0d0d0f] border border-[#27272a] rounded-xl p-3">
            <label className="text-xs text-zinc-400 space-y-1 block">
              Название нового списка
              <input value={newListName} onChange={(e) => setNewListName(e.target.value)}
                className="w-full bg-[#161619] border border-[#27272a] rounded-lg px-2 py-1.5 text-sm text-white outline-none focus:border-indigo-500/40" />
            </label>
            <div className="space-y-1.5">
              <span className="text-xs text-zinc-500">Поля со значениями (стандартное поле NAME для названия строки уже есть в любом Списке)</span>
              {newFields.map((f, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input value={f.name} onChange={(e) => updateNewField(i, { name: e.target.value })} placeholder="Название поля"
                    className="flex-1 bg-[#161619] border border-[#27272a] rounded-lg px-2 py-1.5 text-sm text-white outline-none focus:border-indigo-500/40" />
                  <select value={f.type} onChange={(e) => updateNewField(i, { type: e.target.value as NewListFieldSpec['type'] })}
                    className="bg-[#161619] border border-[#27272a] rounded-lg px-2 py-1.5 text-sm text-white outline-none">
                    {(Object.keys(FIELD_TYPE_LABELS) as NewListFieldSpec['type'][]).map((t) => <option key={t} value={t}>{FIELD_TYPE_LABELS[t]}</option>)}
                  </select>
                  <button type="button" onClick={() => removeNewField(i)} disabled={newFields.length === 1}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-400 disabled:opacity-20">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <button type="button" onClick={addNewField} className="text-xs text-indigo-300 hover:text-indigo-200">+ ещё поле</button>
            </div>
            <button type="button" onClick={createNewList} disabled={creatingList}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-200 text-sm font-medium rounded-lg border border-indigo-500/30 disabled:opacity-40">
              {creatingList && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Создать список и продолжить
            </button>
          </div>
        )}
      </div>

      {listId && (
        <div className="border-t border-[#1f1f23] pt-3 space-y-2">
          <span className="text-xs font-semibold text-zinc-300">Ряды данных</span>
          {series.map((s) => (
            <div key={s.key} className="flex items-center gap-2">
              <select value={s.field} onChange={(e) => updateSeries(s.key, { field: e.target.value })}
                className="flex-1 bg-[#0d0d0f] border border-[#27272a] rounded-lg px-2 py-1.5 text-sm text-white outline-none">
                {fields.map((f) => <option key={f.fieldId} value={f.fieldId}>{f.label} ({f.fieldId})</option>)}
              </select>
              <input value={s.label} onChange={(e) => updateSeries(s.key, { label: e.target.value })} placeholder="Подпись ряда"
                className="flex-1 bg-[#0d0d0f] border border-[#27272a] rounded-lg px-2 py-1.5 text-sm text-white outline-none" />
              <input type="color" value={s.color || '#6366f1'} onChange={(e) => updateSeries(s.key, { color: e.target.value })}
                className="w-9 h-8 bg-[#0d0d0f] border border-[#27272a] rounded-lg" />
              <button type="button" onClick={() => removeSeries(s.key)} className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-400">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          <button type="button" onClick={addSeries} disabled={fields.length === 0}
            className="text-xs text-indigo-300 hover:text-indigo-200 disabled:opacity-40">+ добавить ряд</button>
        </div>
      )}

      {listId && (
        <div className="border-t border-[#1f1f23] pt-3 space-y-2">
          <span className="text-xs font-semibold text-zinc-300">Фильтры (необязательно)</span>
          {filters.map((f, i) => (
            <div key={i} className="flex items-center gap-2">
              <select value={f.field} onChange={(e) => updateFilter(i, { field: e.target.value })}
                className="bg-[#0d0d0f] border border-[#27272a] rounded-lg px-2 py-1.5 text-sm text-white outline-none">
                <option value="name">name (подпись)</option>
                {series.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
              <select value={f.op} onChange={(e) => updateFilter(i, { op: e.target.value as ChartFilter['op'] })}
                className="bg-[#0d0d0f] border border-[#27272a] rounded-lg px-2 py-1.5 text-sm text-white outline-none">
                <option value="eq">равно</option>
                <option value="neq">не равно</option>
                <option value="contains">содержит</option>
                <option value="gte">≥</option>
                <option value="lte">≤</option>
              </select>
              <input value={f.value} onChange={(e) => updateFilter(i, { value: e.target.value })}
                className="flex-1 bg-[#0d0d0f] border border-[#27272a] rounded-lg px-2 py-1.5 text-sm text-white outline-none" />
              <button type="button" onClick={() => removeFilter(i)} className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-400">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          <button type="button" onClick={addFilter} className="text-xs text-indigo-300 hover:text-indigo-200">+ добавить фильтр</button>
        </div>
      )}

      <div className="flex items-center gap-2 pt-2">
        <button type="button" onClick={handleSave} disabled={!canSave}
          className="px-4 py-2 bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-semibold rounded-xl disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
          Сохранить график
        </button>
        <button type="button" onClick={onCancel} className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium rounded-xl">
          Отмена
        </button>
      </div>
    </div>
  );
}
