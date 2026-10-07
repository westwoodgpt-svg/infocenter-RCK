import { useEffect, useState } from 'react';
import { fetchPortalUsers, fetchPortalUsersViaServer, hasBX24, isInIframe, isSessionTransport, PortalUser } from './bitrix';

// Кэш на модуль — чтобы каждое открытие модалки редактирования не дёргало
// user.get заново, достаточно одного запроса за сессию.
let cache: PortalUser[] | null = null;
let inFlight: Promise<{ users: PortalUser[]; error: string | null }> | null = null;

export function usePortalUsers() {
  const [users, setUsers] = useState<PortalUser[]>(cache ?? []);
  const [loading, setLoading] = useState(!cache);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cache) {
      setUsers(cache);
      setLoading(false);
      return;
    }
    // В отдельном окне BX24 нет — список отдаёт сервер (api/_portalUsers.js).
    const viaServer = isSessionTransport();
    if (!viaServer && (!isInIframe() || !hasBX24())) {
      setLoading(false);
      return;
    }
    setLoading(true);
    if (!inFlight) inFlight = viaServer ? fetchPortalUsersViaServer() : fetchPortalUsers();
    let cancelled = false;
    inFlight.then(({ users: fetched, error: err }) => {
      if (cancelled) return;
      cache = fetched;
      setUsers(fetched);
      setError(err);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { users, loading, error };
}
