// Сотрудники портала для подстановки в карточку «Ответственный» — в отдельном
// окне, где нет BX24.callMethod('user.get').
//
// Почему через сервер, а не «отключить»: в отдельном окне правят те же
// карточки, что в портале, и без подстановки ФИО пришлось бы вводить вручную
// и с ошибками. Запрос идёт сервисным токеном (как и структура отделов), но
// наружу отдаются только ФИО, должность и ссылка на фото — то же, что
// сотрудник и так видит в карточке «Ответственный» и в портале. Только
// активные сотрудники (без экстранета). Кэш — 10 минут.
import { bxServiceCall, redisClient } from './_bitrixAuth.js';

const CACHE_KEY = 'rck:portal-users';
const CACHE_TTL_SEC = 600;
const MAX_PAGES = 40;

const fullName = (u) => [u.LAST_NAME, u.NAME, u.SECOND_NAME].filter(Boolean).join(' ').trim() || `ID ${u.ID}`;

export async function loadPortalUsers() {
  const cached = await redisClient().get(CACHE_KEY).catch(() => null);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch {
      // перечитаем
    }
  }
  const users = [];
  let start = 0;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const params = { 'FILTER[ACTIVE]': 'true', 'FILTER[USER_TYPE]': 'employee' };
    if (start) params.start = start;
    const data = await bxServiceCall('user.get', params);
    for (const u of Array.isArray(data.result) ? data.result : []) {
      users.push({ id: String(u.ID), name: fullName(u), position: u.WORK_POSITION || '', photo: u.PERSONAL_PHOTO || '' });
    }
    if (data.next === undefined || data.next === null) break;
    start = data.next;
  }
  await redisClient().set(CACHE_KEY, JSON.stringify(users), 'EX', CACHE_TTL_SEC).catch(() => {});
  return users;
}
