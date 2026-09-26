import { useCallback, useEffect, useRef, useState } from "react";
import { getRemoteSettings, patchRemoteSettings } from "@/lib/api";
import type { LearningStorage } from "@/lib/storage";
import type { AppSettings } from "@/types";
export function useSettingsSync(
  storage: LearningStorage,
  enabled: boolean,
  onApplied: (s: AppSettings) => void,
) {
  const generation = useRef(0);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const current = useRef(onApplied);
  current.current = onApplied;
  const alive = useRef(true);
  const flight = useRef<Promise<void> | null>(null);
  const flush = useCallback(async () => {
    if (!enabled) return;
    if (flight.current) return flight.current;
    const run = async () => {
      setPending(true);
      try {
        while (alive.current) {
          const changes = storage.getJSON<Partial<AppSettings>>(
            "settings_pending",
            {},
          );
          if (!Object.keys(changes).length) break;
          await patchRemoteSettings(changes);
          if (!alive.current) return;
          const remaining = storage.getJSON<Partial<AppSettings>>(
            "settings_pending",
            {},
          );
          for (const key of Object.keys(changes) as (keyof AppSettings)[])
            if (remaining[key] === changes[key]) delete remaining[key];
          storage.setJSON("settings_pending", remaining);
        }
        setError("");
      } catch (e) {
        if (alive.current)
          setError(e instanceof Error ? e.message : "Chưa lưu được cài đặt");
      } finally {
        if (alive.current) setPending(false);
      }
    };
    flight.current = run().finally(() => {
      flight.current = null;
    });
    return flight.current;
  }, [enabled, storage]);
  const change = useCallback(
    (updates: Partial<AppSettings>) => {
      generation.current++;
      const next = { ...storage.getSettings(), ...updates };
      storage.saveSettings(next);
      current.current(next);
      if (enabled) {
        storage.setJSON("settings_pending", {
          ...storage.getJSON("settings_pending", {}),
          ...updates,
        });
        void flush();
      }
    },
    [storage, enabled, flush],
  );
  const retry = useCallback(async () => {
    try {
      setPending(true);
      const started = generation.current;
      const remote = await getRemoteSettings();
      if (!alive.current) return;
      const next = {
        ...(started === generation.current ? remote : storage.getSettings()),
        ...storage.getJSON("settings_pending", {}),
      };
      storage.saveSettings(next);
      current.current(next);
      await flush();
    } catch (e) {
      if (alive.current)
        setError(e instanceof Error ? e.message : "Không tải được cài đặt");
    } finally {
      if (alive.current) setPending(false);
    }
  }, [storage, flush]);
  useEffect(() => {
    alive.current = true;
    if (enabled) void retry();
    return () => {
      alive.current = false;
    };
  }, [enabled, retry]);
  return { error, pending, retry, change };
}
