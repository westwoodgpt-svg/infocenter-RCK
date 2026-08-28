// Диагностический эндпоинт: показывает, поймал ли сервер сервисный токен
// администратора, без раскрытия самого токена. Открыть в браузере:
// https://infocenter-rck.vercel.app/api/bitrix-status
import { peekServiceToken, peekLastOpenAttempt } from './_bitrixAuth.js';
import { peekDashboard } from './_store.js';
import { getDepartmentTree, departmentTreeError, LEGACY_BOARD_ID } from './_access.js';

export default async function handler(req, res) {
  const hasRedisUrl = Boolean(process.env.REDIS_URL);
  const hasBitrixCreds = Boolean(process.env.BITRIX_CLIENT_ID && process.env.BITRIX_CLIENT_SECRET);

  // Позволяет сразу видеть, какой коммит реально обслуживает этот URL —
  // Vercel прокидывает это в рантайм автоматически, без ручной настройки.
  const deployedCommit = process.env.VERCEL_GIT_COMMIT_SHA || null;

  if (!hasRedisUrl || !hasBitrixCreds) {
    res.status(200).json({
      ok: false,
      deployedCommit,
      hasRedisUrl,
      hasBitrixCreds,
      serviceToken: null,
      hint: 'Не заданы переменные окружения на Vercel — проверьте REDIS_URL / BITRIX_CLIENT_ID / BITRIX_CLIENT_SECRET и сделайте Redeploy.',
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
