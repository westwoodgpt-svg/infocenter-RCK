// Тонкая Promise-обёртка над window.BX24.callMethod — единая точка входа
// для всех вызовов Bitrix24 REST, которые использует и дашборд, и редактор.
// Ничего не уходит на наш хостинг: BX24.callMethod обращается к родительскому
// окну портала напрямую из браузера (см. DEPLOYMENT.md).

export interface B24ListDescriptor {
  id: number;
  props: Record<string, string>;
}

export interface B24Field {
  fieldId: string; // "NAME" | "PROPERTY_123" | ...
  label: string;
  type: string; // "S", "N", "S:DateTime", "L" и т.д. — как в lists.field.get
  isRequired: boolean;
  multiple: boolean;
}

export interface B24ListInfo {
  id: number;
  name: string;
}

function getBX24(): any {
  const BX24 = (window as any).BX24;
  if (typeof BX24 === 'undefined') {
    throw new Error('BX24 SDK недоступен — приложение открыто вне портала Bitrix24');
  }
  return BX24;
}

export function isB24Available(): boolean {
  return typeof (window as any).BX24 !== 'undefined';
}

// Если портал не ответил за это время — считаем вызов зависшим и показываем
// ошибку вместо бесконечного спиннера (реальная причина обычно — недостающее
// право приложения на этот метод, например отсутствующий scope "lists").
const CALL_TIMEOUT_MS = 20000;

function callMethod<T = any>(method: string, params: Record<string, any> = {}): Promise<T> {
  const BX24 = getBX24();
  return new Promise((resolve, reject) => {
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error(
        `Bitrix24 не ответил на ${method} за ${CALL_TIMEOUT_MS / 1000} с. ` +
        'Проверьте, что приложению выдано право «lists» (Настройка прав в параметрах приложения), и попробуйте снова.'
      ));
    }, CALL_TIMEOUT_MS);

    BX24.callMethod(method, params, (result: any) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);

      if (result.error()) {
        const err = result.error();
        const message = (err && (err.ex?.error_description || err.error_description || err.error)) || 'неизвестная ошибка Bitrix24';
        reject(new Error(message));
        return;
      }
      resolve(result.answer.result as T);
    });
  });
}

/* ── Списки: чтение ───────────────────────────────────────── */

export async function getLists(): Promise<B24ListInfo[]> {
  const rows = await callMethod<any[]>('lists.get', { IBLOCK_TYPE_ID: 'lists' });
  return (rows || []).map((r) => ({ id: Number(r.ID), name: String(r.NAME) }));
}

export async function getListFields(listId: number): Promise<B24Field[]> {
  const raw = await callMethod<Record<string, any>>('lists.field.get', {
    IBLOCK_TYPE_ID: 'lists',
    IBLOCK_ID: listId,
  });
  return Object.entries(raw || {}).map(([fieldId, f]) => ({
    fieldId,
    label: String(f?.NAME ?? fieldId),
    type: String(f?.TYPE ?? 'S'),
    isRequired: f?.IS_REQUIRED === 'Y',
    multiple: f?.MULTIPLE === 'Y',
  }));
}

export interface B24ListElementRow {
  id: number;
  name: string;
  timestampX?: string;
  values: Record<string, any>;
}

export async function getListElements(listId: number, selectFields: string[] = []): Promise<B24ListElementRow[]> {
  const select = Array.from(new Set(['ID', 'NAME', 'TIMESTAMP_X', ...selectFields]));
  const rows = await callMethod<any[]>('lists.element.get', {
    IBLOCK_TYPE_ID: 'lists',
    IBLOCK_ID: listId,
    SELECT: select,
  });
  return (rows || []).map((row) => ({
    id: Number(row.ID),
    name: String(row.NAME ?? ''),
    timestampX: row.TIMESTAMP_X,
    values: row,
  }));
}

/* ── Списки: запись ───────────────────────────────────────── */

export async function addListElement(listId: number, fields: Record<string, any>): Promise<number> {
  const id = await callMethod<number | string>('lists.element.add', {
    IBLOCK_TYPE_ID: 'lists',
    IBLOCK_ID: listId,
    FIELDS: fields,
  });
  return Number(id);
}

export async function updateListElement(listId: number, elementId: number, fields: Record<string, any>): Promise<void> {
  await callMethod('lists.element.update', {
    IBLOCK_TYPE_ID: 'lists',
    IBLOCK_ID: listId,
    ELEMENT_ID: elementId,
    FIELDS: fields,
  });
}

export async function deleteListElement(listId: number, elementId: number): Promise<void> {
  await callMethod('lists.element.delete', {
    IBLOCK_TYPE_ID: 'lists',
    IBLOCK_ID: listId,
    ELEMENT_ID: elementId,
  });
}

/* ── Настройки приложения (замена отдельной БД для конфигурации) ── */

export async function getOption(name: string): Promise<string | undefined> {
  const all = await callMethod<Record<string, string>>('app.option.get');
  return all ? all[name] : undefined;
}

export async function setOption(name: string, value: string): Promise<void> {
  await callMethod('app.option.set', { options: { [name]: value } });
}

/* ── Права ────────────────────────────────────────────────── */

/** true — портал подтвердил, что пользователь администратор.
 *  false при ошибке вызова (не блокируем UI редактора из-за нестабильного API —
 *  реальное разграничение прав всё равно обеспечивают права на Список/app.option). */
export async function isCurrentUserAdmin(): Promise<boolean> {
  try {
    const result = await callMethod<boolean>('user.admin');
    return Boolean(result);
  } catch {
    return true;
  }
}
