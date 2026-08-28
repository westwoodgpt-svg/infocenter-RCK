// Кто открыл инфоцентр, какие инфоцентры ему доступны и что он может в них
// делать. Всё определяется на сервере по данным Битрикс24 — клиент присылает
// только свой токен и не может «попросить» чужой отдел.
//
// Правила доступа (согласованы с заказчиком):
//   • сотрудник        — инфоцентры своих отделов (UF_DEPARTMENT): смотреть и править;
//                        инфоцентры вышестоящих отделов — только смотреть;
//   • руководитель     — свой отдел (UF_HEAD) и ВСЕ его подотделы: смотреть и править;
//   • директор         — руководитель корневого отдела, поэтому по тому же правилу
//                        получает всю структуру; плюс список ID в
//                        INFOCENTER_DIRECTOR_IDS, если кого-то нужно добавить руками;
//   • администратор    — все инфоцентры.
// Сводный экран доступен всем, у кого инфоцентров больше одного.
import { createHash } from 'node:crypto';
import { bxServiceCall, bxUserCall, getUserProfile, redisClient } from './_bitrixAuth.js';

const DEPT_TREE_KEY = 'rck:dept-tree';
const DEPT_TREE_FAIL_KEY = 'rck:dept-tree:failed';
const DEPT_TREE_TTL_SEC = 900; // 15 минут: структура отделов меняется редко
const DEPT_TREE_FAIL_TTL_SEC = 120; // не долбим портал на каждом запросе, если скоупа нет
const IDENTITY_TTL_SEC = 300;
const MAX_DEPT_PAGES = 20;

/** Инфоцентр РЦК, существовавший до разделения по отделам. */
export const LEGACY_BOARD_ID = 'rck';
const LEGACY_BOARD_TITLE = 'РЦК (общий)';

const identityKey = (accessToken) => `rck:identity:${createHash('sha256').update(accessToken).digest('hex').slice(0, 32)}`;

const envList = (name) =>
  String(process.env[name] || '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);

/** ID отдела, чей инфоцентр — это исторические данные РЦК (переезд без миграции). */
const legacyDepartmentId = () => (process.env.INFOCENTER_LEGACY_DEPARTMENT_ID || '').trim() || null;
const hiddenDepartmentIds = () => new Set(envList('INFOCENTER_HIDDEN_DEPARTMENTS'));
const directorIds = () => new Set(envList('INFOCENTER_DIRECTOR_IDS'));

export const boardIdForDepartment = (departmentId) => `dept-${departmentId}`;

// Данные борда лежат в Redis под своим префиксом. Единственное исключение —
// отдел, назначенный «наследником» РЦК: он читает и пишет старые ключи, чтобы
// уже внесённые карточки остались на месте без переноса.
export function storagePrefixFor(boardId) {
  const legacy = legacyDepartmentId();
  if (legacy && boardId === boardIdForDepartment(legacy)) return LEGACY_BOARD_ID;
  return boardId;
}

async function readJson(key) {
  const raw = await redisClient().get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function writeJson(key, value, ttlSec) {
  await redisClient().set(key, JSON.stringify(value), 'EX', ttlSec);
}

// ---------------------------------------------------------------------------
// Структура отделов портала
// ---------------------------------------------------------------------------

async function fetchDepartments() {
  const all = [];
  let start = 0;
  for (let page = 0; page < MAX_DEPT_PAGES; page += 1) {
    const data = await bxServiceCall('department.get', start ? { start } : {});
    const rows = data.result || [];
    for (const d of rows) {
      all.push({
        id: String(d.ID),
        name: d.NAME || `Отдел ${d.ID}`,
        parent: d.PARENT ? String(d.PARENT) : null,
        headId: d.UF_HEAD ? String(d.UF_HEAD) : null,
        sort: Number(d.SORT) || 500,
      });
    }
    if (data.next === undefined || data.next === null) break;
    start = data.next;
  }
  return all;
}

/** Отделы портала или null, если их не удалось получить (нет скоупа, нет токена). */
export async function getDepartmentTree() {
  const cached = await readJson(DEPT_TREE_KEY);
  if (cached) return cached;
  if (await redisClient().get(DEPT_TREE_FAIL_KEY)) return null;

  try {
    const departments = await fetchDepartments();
    if (!departments.length) throw new Error('department.get вернул пустой список');
    await writeJson(DEPT_TREE_KEY, departments, DEPT_TREE_TTL_SEC);
    return departments;
  } catch (err) {
    await redisClient().set(
      DEPT_TREE_FAIL_KEY,
      err instanceof Error ? err.message : String(err),
      'EX',
      DEPT_TREE_FAIL_TTL_SEC
    );
    return null;
  }
}

export async function departmentTreeError() {
  return redisClient().get(DEPT_TREE_FAIL_KEY);
}

function childrenMap(departments) {
  const map = new Map();
  for (const d of departments) {
    if (!d.parent) continue;
    const list = map.get(d.parent) || [];
    list.push(d.id);
    map.set(d.parent, list);
  }
  return map;
}

function collectDescendants(rootId, children, acc = new Set()) {
  for (const child of children.get(rootId) || []) {
    if (acc.has(child)) continue;
    acc.add(child);
    collectDescendants(child, children, acc);
  }
  return acc;
}

function collectAncestors(departmentId, byId, acc = new Set()) {
  const dept = byId.get(departmentId);
  if (!dept || !dept.parent) return acc;
  if (acc.has(dept.parent)) return acc;
  acc.add(dept.parent);
  return collectAncestors(dept.parent, byId, acc);
}

// ---------------------------------------------------------------------------
// Личность сотрудника
// ---------------------------------------------------------------------------

export async function resolveIdentity({ accessToken, domain }) {
  const cacheKey = identityKey(accessToken);
  const cached = await readJson(cacheKey).catch(() => null);
  if (cached) return cached;

  const profile = await getUserProfile({ accessToken, domain });
  if (!profile) return null;

  let departmentIds = [];
  try {
    const data = await bxUserCall('user.current', { accessToken, domain });
    const raw = (data.result && data.result.UF_DEPARTMENT) || [];
    departmentIds = (Array.isArray(raw) ? raw : [raw]).map(String).filter(Boolean);
  } catch {
    // нет скоупа user — сотрудник получит запасной сценарий (см. resolveAccess)
  }

  const identity = { ...profile, departmentIds };
  try {
    await writeJson(cacheKey, identity, IDENTITY_TTL_SEC);
  } catch {
    // кэш необязателен
  }
  return identity;
}

// ---------------------------------------------------------------------------
// Доступные инфоцентры
// ---------------------------------------------------------------------------

function legacyBoard(canEdit = true) {
  return { id: LEGACY_BOARD_ID, title: LEGACY_BOARD_TITLE, departmentId: null, canEdit };
}

// Запасной сценарий: структура отделов недоступна. Никого не запираем —
// показываем общий инфоцентр РЦК ровно так, как он работал до разделения.
function degradedAccess(identity, reason) {
  return {
    role: identity.isAdmin ? 'admin' : 'employee',
    boards: [legacyBoard(true)],
    defaultBoardId: LEGACY_BOARD_ID,
    canSeeSummary: false,
    legacyBoardId: LEGACY_BOARD_ID,
    warning:
      'Не удалось получить структуру отделов Битрикс24, инфоцентры по отделам недоступны. ' +
      'Проверьте, что локальному приложению выданы права «Пользователи» (user) и «Структура компании» ' +
      `(department), и что администратор открывал приложение. Причина: ${reason || 'неизвестна'}`,
  };
}

export async function resolveAccess(identity) {
  const departments = await getDepartmentTree();
  if (!departments) return degradedAccess(identity, await departmentTreeError());

  const byId = new Map(departments.map((d) => [d.id, d]));
  const children = childrenMap(departments);
  const hidden = hiddenDepartmentIds();
  const legacyDept = legacyDepartmentId();

  const own = new Set(identity.departmentIds.filter((id) => byId.has(id)));
  const headOf = departments.filter((d) => d.headId && d.headId === identity.id).map((d) => d.id);

  const editable = new Set(own);
  for (const deptId of headOf) {
    editable.add(deptId);
    for (const child of collectDescendants(deptId, children)) editable.add(child);
  }

  // Вышестоящие отделы — только для просмотра: сотрудник видит инфоцентр
  // родительского подразделения, но правит только свой.
  const viewable = new Set(editable);
  for (const deptId of own) {
    for (const ancestor of collectAncestors(deptId, byId)) viewable.add(ancestor);
  }

  const isDirector = directorIds().has(identity.id);
  const everything = identity.isAdmin || isDirector;
  if (everything) {
    for (const d of departments) {
      viewable.add(d.id);
      editable.add(d.id);
    }
  }

  const boards = departments
    .filter((d) => viewable.has(d.id) && !hidden.has(d.id))
    .sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name, 'ru'))
    .map((d) => ({
      id: boardIdForDepartment(d.id),
      title: d.name,
      departmentId: d.id,
      canEdit: editable.has(d.id),
    }));

  // Пока исторический инфоцентр РЦК не привязан к отделу, он остаётся общим и
  // доступным всем — иначе уже внесённые данные оказались бы никому не видны.
  if (!legacyDept) boards.unshift(legacyBoard(true));

  let role = 'employee';
  if (identity.isAdmin) role = 'admin';
  else if (isDirector) role = 'director';
  else if (headOf.length) role = 'head';

  const preferred =
    boards.find((b) => b.departmentId && own.has(b.departmentId) && b.canEdit) ||
    boards.find((b) => b.canEdit) ||
    boards[0] ||
    null;

  return {
    role,
    boards,
    defaultBoardId: preferred ? preferred.id : null,
    canSeeSummary: boards.length > 1,
    // Где теперь живут исторические данные РЦК — по этому идентификатору клиент
    // переносит свой старый локальный кэш в нужный инфоцентр.
    legacyBoardId: legacyDept ? boardIdForDepartment(legacyDept) : LEGACY_BOARD_ID,
    warning: null,
  };
}

/** Проверка права на конкретный инфоцентр. Возвращает борд или null. */
export function boardAccess(access, boardId, need = 'view') {
  const board = access.boards.find((b) => b.id === boardId);
  if (!board) return null;
  if (need === 'edit' && !board.canEdit) return null;
  return board;
}
