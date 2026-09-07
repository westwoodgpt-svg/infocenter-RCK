// Разовая копия инфоцентра РЦК в инфоцентр отдела.
//
// ЗАЧЕМ: содержимое исторического инфоцентра РЦК нужно завести отделу
// «Региональный центр компетенций в сфере производительности труда» — как
// страховку перед правками, не убирая инфоцентр оттуда, где он есть сейчас.
// Это именно копия: исходный инфоцентр РЦК не меняется вообще.
//
// КОГДА СРАБАТЫВАЕТ: один раз, при первом же открытии приложения кем угодно
// (действие bootstrap). Дальше в Redis лежит отметка о выполнении, и копия
// больше никогда не повторяется — правки отдела ничем не перетираются.
import { redisClient } from './_bitrixAuth.js';
import { boardIdForDepartment, getDepartmentTree, LEGACY_BOARD_ID, storagePrefixFor } from './_access.js';
import { loadDashboard, saveDashboard, TABS } from './_store.js';

/** Отметка «копия сделана» — по одной на инфоцентр-получатель. */
const doneKey = (prefix) => `rck:legacy-copy:${prefix}`;

const DEFAULT_TARGET_NAME = 'Региональный центр компетенций в сфере производительности труда';

const envValue = (name) => String(process.env[name] || '').trim();

// Названия отделов на портале пишут по-разному: другой регистр, «ё», лишние
// пробелы, кавычки. Сравниваем по приведённому виду, иначе копия просто не
// найдёт свой отдел и молча ничего не сделает.
const normalizeName = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[«»"'`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const countCards = (state) => TABS.reduce((acc, tab) => acc + ((state && state[tab]) || []).length, 0);

function findTargetDepartment(departments) {
  const byId = envValue('INFOCENTER_RCK_COPY_DEPARTMENT_ID');
  if (byId) return departments.find((d) => d.id === byId) || null;
  const wanted = normalizeName(envValue('INFOCENTER_RCK_COPY_DEPARTMENT_NAME') || DEFAULT_TARGET_NAME);
  return departments.find((d) => normalizeName(d.name) === wanted) || null;
}

/** Что известно о копии — для /api/bitrix-status. Ничего не меняет. */
export async function peekLegacyCopy() {
  try {
    const departments = await getDepartmentTree();
    if (!departments) return { status: 'нет структуры отделов' };
    const dept = findTargetDepartment(departments);
    if (!dept) return { status: 'отдел-получатель не найден на портале' };
    const targetPrefix = storagePrefixFor(boardIdForDepartment(dept.id));
    const done = await redisClient().get(doneKey(targetPrefix));
    if (!done) return { status: 'ещё не выполнялось', department: dept.name, boardId: boardIdForDepartment(dept.id) };
    try {
      return { ...JSON.parse(done), department: dept.name, boardId: boardIdForDepartment(dept.id) };
    } catch {
      return { status: 'копия уже сделана', department: dept.name };
    }
  } catch (err) {
    return { status: `ошибка: ${err instanceof Error ? err.message : String(err)}` };
  }
}

/**
 * Копирует инфоцентр РЦК в инфоцентр отдела — один раз за всё время.
 * Ничего не бросает: это фоновая задача, она не должна ронять открытие
 * приложения. Возвращает краткий отчёт (виден в /api/bitrix-status).
 */
export async function ensureLegacyCopy() {
  try {
    const departments = await getDepartmentTree();
    if (!departments) return { status: 'нет структуры отделов' };

    const dept = findTargetDepartment(departments);
    if (!dept) return { status: 'отдел-получатель не найден на портале' };

    const targetBoardId = boardIdForDepartment(dept.id);
    const targetPrefix = storagePrefixFor(targetBoardId);
    if (targetPrefix === LEGACY_BOARD_ID) {
      // Этот отдел и так назначен наследником РЦК (INFOCENTER_LEGACY_DEPARTMENT_ID):
      // он читает те же ключи, копировать нечего и некуда.
      return { status: 'отдел уже читает данные РЦК', department: dept.name };
    }

    const redis = redisClient();
    const done = await redis.get(doneKey(targetPrefix));
    if (done) {
      try {
        return { ...JSON.parse(done), department: dept.name };
      } catch {
        return { status: 'копия уже сделана', department: dept.name };
      }
    }

    // Заявка на выполнение: два одновременно открывших приложение сотрудника
    // не должны запустить копирование дважды.
    const claimed = await redis.set(doneKey(targetPrefix), JSON.stringify({ status: 'копирование выполняется' }), 'NX');
    if (!claimed) return { status: 'копирование уже выполняется', department: dept.name };

    try {
      const source = await loadDashboard(LEGACY_BOARD_ID);
      if (!source || !source.state || countCards(source.state) === 0) {
        // Инфоцентр РЦК пуст (или Redis ещё не прогрет) — снимаем заявку,
        // чтобы попытка повторилась при следующем открытии.
        await redis.del(doneKey(targetPrefix));
        return { status: 'инфоцентр РЦК пуст — копировать нечего', department: dept.name };
      }

      // Инфоцентр отдела с данными не трогаем никогда: копия — страховка, а не
      // способ затереть чужую работу. Отметку всё равно ставим, чтобы решение
      // было принято один раз и не пересматривалось при каждом открытии.
      const existing = await loadDashboard(targetPrefix);
      const existingCards = existing && existing.state ? countCards(existing.state) : 0;
      if (existingCards > 0 && envValue('INFOCENTER_RCK_COPY_OVERWRITE') !== '1') {
        const report = {
          status: 'пропущено: в инфоцентре отдела уже есть карточки',
          cards: existingCards,
          at: new Date().toISOString(),
        };
        await redis.set(doneKey(targetPrefix), JSON.stringify(report));
        return { ...report, department: dept.name };
      }

      const saved = await saveDashboard({
        prefix: targetPrefix,
        state: source.state,
        baseRev: null,
        author: 'копия инфоцентра РЦК',
      });
      const report = {
        status: 'скопировано',
        cards: countCards(source.state),
        rev: saved.rev,
        at: saved.updatedAt,
      };
      await redis.set(doneKey(targetPrefix), JSON.stringify(report));
      return { ...report, department: dept.name };
    } catch (err) {
      // Копия не удалась — снимаем заявку, чтобы попробовать ещё раз позже.
      await redis.del(doneKey(targetPrefix)).catch(() => {});
      throw err;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[infocenter] копия РЦК в отдел не выполнена:', message);
    return { status: `ошибка: ${message}` };
  }
}
