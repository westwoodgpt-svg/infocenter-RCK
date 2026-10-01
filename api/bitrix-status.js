// Диагностический эндпоинт: показывает, поймал ли сервер сервисный токен
// администратора, без раскрытия самого токена. Открыть в браузере:
// https://infocenter-rck.vercel.app/api/bitrix-status
import { peekServiceToken, peekLastOpenAttempt } from './_bitrixAuth.js';
import { peekDashboard, listStoredBoards } from './_store.js';
import {
  getDepartmentTree,
  departmentTreeError,
  LEGACY_BOARD_ID,
  LEGACY_BOARD_TITLE,
  storagePrefixFor,
  boardIdForDepartment,
  findRckDepartment,
} from './_access.js';
import { peekClientLog } from './client-log.js';
import { peekLegacyCopy } from './_seedCopy.js';

export default async function handler(req, res) {
  const hasRedisUrl = Boolean(process.env.REDIS_URL);
  const hasBitrixCreds = Boolean(process.env.BITRIX_CLIENT_ID && process.env.BITRIX_CLIENT_SECRET);

  // Позволяет сразу видеть, какой коммит реально обслуживает этот URL —
  // Vercel прокидывает это в рантайм автоматически, на своём сервере его
  // выставляет server/index.js из git.
  const deployedCommit = process.env.VERCEL_GIT_COMMIT_SHA || process.env.DEPLOYED_COMMIT || null;

  if (!hasRedisUrl || !hasBitrixCreds) {
    res.status(200).json({
      ok: false,
      deployedCommit,
      hasRedisUrl,
      hasBitrixCreds,
      serviceToken: null,
      hint: 'Не заданы переменные окружения — проверьте REDIS_URL / BITRIX_CLIENT_ID / BITRIX_CLIENT_SECRET (на своём сервере — /etc/infocenter-rck.env, затем systemctl restart infocenter-rck).',
    });
    return;
  }

  try {
    const [token, lastOpenAttempt, dashboard] = await Promise.all([
      peekServiceToken(),
      peekLastOpenAttempt(),
      peekDashboard(LEGACY_BOARD_ID).catch(() => null),
    ]);

    // Видно ли приложению структуру отделов — от этого зависит, работают ли
    // отдельные инфоцентры по отделам или все видят общий инфоцентр РЦК.
    const departments = await getDepartmentTree().catch(() => null);
    const departmentsError = departments ? null : await departmentTreeError().catch(() => null);
    // Разовая копия инфоцентра РЦК отделу-получателю: сделана или нет.
    const legacyCopy = await peekLegacyCopy();
    // Инфоцентры с данными на сервере — с названиями отделов. Отдел, которого
    // здесь нет, на сервер ни разу ничего не сохранял.
    const stored = await listStoredBoards().catch(() => []);
    const deptByPrefix = new Map((departments || []).map((d) => [storagePrefixFor(boardIdForDepartment(d.id)), d.name]));
    // Отдел РЦК работает в «Инфоцентре РЦК» (ключи rck) — его данные там.
    const rckDept = process.env.INFOCENTER_LEGACY_DEPARTMENT_ID ? null : findRckDepartment(departments);
    const prefixOfDept = (d) => (rckDept && d.id === rckDept.id ? LEGACY_BOARD_ID : storagePrefixFor(boardIdForDepartment(d.id)));
    const storedBoards = stored.map((b) => ({
      ...b,
      department: b.prefix === 'showcase' ? 'Витрина' : b.prefix === LEGACY_BOARD_ID ? LEGACY_BOARD_TITLE : deptByPrefix.get(b.prefix) || null,
    }));
    const departmentsWithoutData = departments
      ? departments.filter((d) => !stored.some((b) => b.prefix === prefixOfDept(d))).map((d) => d.name)
      : null;
    const clientLog = await peekClientLog().catch(() => null);
    res.status(200).json({
      ok: true,
      deployedCommit,
      hasRedisUrl,
      hasBitrixCreds,
      // Данные инфоцентра теперь живут в Redis; сервисный токен нужен только
      // для резервной копии в app.option и переноса старых данных.
      dashboard,
      departments: departments
        ? { count: departments.length, withHead: departments.filter((d) => d.headId).length }
        : null,
      departmentsError,
      legacyCopy,
      storedBoards,
      departmentsWithoutData,
      rckDepartment: rckDept ? { id: rckDept.id, name: rckDept.name, board: LEGACY_BOARD_ID } : null,
      clientLog,
      legacyDepartmentId: process.env.INFOCENTER_LEGACY_DEPARTMENT_ID || null,
      hiddenDepartments: process.env.INFOCENTER_HIDDEN_DEPARTMENTS || null,
      serviceToken: token
        ? { restBase: token.restBase, valid: token.valid, expiresAt: new Date(token.expiresAt).toISOString() }
        : null,
      lastOpenAttempt,
      hint: token
        ? null
        : 'Сервисный токен ещё не сохранён. На сохранение карточек это больше не влияет (данные пишутся в Redis), но резервная копия в app.option и перенос старых данных из него требуют, чтобы администратор один раз открыл приложение в Битрикс24.',
    });
  } catch (err) {
    res.status(200).json({
      ok: false,
      deployedCommit,
      hasRedisUrl,
      hasBitrixCreds,
      serviceToken: null,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
