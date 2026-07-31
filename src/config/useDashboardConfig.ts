import { useCallback, useEffect, useState } from 'react';
import { DashboardConfig } from '../types';
import { DEFAULT_CONFIG, DASHBOARD_CONFIG_OPTION_KEY } from './defaultConfig';
import { getOption, setOption, isB24Available } from '../b24/client';

export type SaveResult = { ok: true } | { ok: false; reason: 'conflict' | 'error'; message?: string };

/** Загружает и сохраняет DashboardConfig через app.option Bitrix24 —
 *  никакой отдельной БД: настройки живут внутри самого портала. */
export function useDashboardConfig() {
  const [config, setConfig] = useState<DashboardConfig>(DEFAULT_CONFIG);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!isB24Available()) {
        setLoaded(true);
        return;
      }
      try {
        const raw = await getOption(DASHBOARD_CONFIG_OPTION_KEY);
        if (!cancelled && raw) {
          setConfig(JSON.parse(raw) as DashboardConfig);
        }
      } catch {
        // конфига ещё нет или не распарсился — остаёмся на конфиге по умолчанию
      } finally {
        if (!cancelled) setLoaded(true);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const save = useCallback(async (next: DashboardConfig): Promise<SaveResult> => {
    if (!isB24Available()) {
      setConfig(next);
      return { ok: true };
    }
    try {
      const raw = await getOption(DASHBOARD_CONFIG_OPTION_KEY);
      const current = raw ? (JSON.parse(raw) as DashboardConfig) : DEFAULT_CONFIG;
      if (current.version !== config.version) {
        return { ok: false, reason: 'conflict' };
      }
      const toSave: DashboardConfig = {
        ...next,
        version: current.version + 1,
        updatedAt: new Date().toISOString(),
      };
      await setOption(DASHBOARD_CONFIG_OPTION_KEY, JSON.stringify(toSave));
      setConfig(toSave);
      return { ok: true };
    } catch (err) {
      return { ok: false, reason: 'error', message: err instanceof Error ? err.message : undefined };
    }
  }, [config.version]);

  return { config, loaded, save };
}
