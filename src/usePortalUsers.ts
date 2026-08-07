import { useEffect, useState } from 'react';
import { fetchPortalUsers, hasBX24, isInIframe, PortalUser } from './bitrix';

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
    if (!isInIframe() || !hasBX24()) {
      setLoading(false);
      return;
    }
    setLoading(true);
    if (!inFlight) inFlight = fetchPortalUsers();
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
