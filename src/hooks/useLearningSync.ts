import { useCallback, useEffect, useRef, useState } from "react";
import type { LearningStorage } from "@/lib/storage";
import {
  getLearningState,
  putLearningState,
  type LearningData,
  type LearningSnapshot,
} from "@/lib/learningSync";

export function readLearning(storage: LearningStorage): LearningData {
  return {
    bookmarks: storage.getBookmarks(),
    srsCards: ["vocabulary", "kanji", "grammar"].flatMap((type) =>
      storage.getSRSCards(type as "vocabulary" | "kanji" | "grammar"),
    ),
    studyDays: storage.getStudyDays(),
  };
}
const same = (a: LearningData, b: LearningData) =>
  JSON.stringify(a) === JSON.stringify(b);
export function useLearningSync(
  storage: LearningStorage,
  enabled: boolean,
  onApplied: (state: LearningData) => void,
) {
  const [status, setStatus] = useState<
    "local" | "loading" | "saved" | "pending" | "error"
  >(enabled ? "loading" : "local");
  const [initialized, setInitialized] = useState(!enabled);
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  const loadVersion = useRef(0);
  const revision = useRef<number | null>(
    storage.getJSON<number | null>("learning_revision", null),
  );
  const flight = useRef<Promise<void> | null>(null);
  const paused = useRef(false);
  const alive = useRef(true);
  const applyRef = useRef(onApplied);
  applyRef.current = onApplied;
  const apply = useCallback(
    (state: LearningSnapshot) => {
      storage.withoutLearningEvents(() => {
        storage.saveBookmarks(state.bookmarks);
        for (const type of ["vocabulary", "kanji", "grammar"] as const)
          storage.saveSRSCards(
            type,
            state.srsCards.filter((c) => c.deckType === type),
          );
        storage.setJSON("n3_study_days", state.studyDays);
      });
      revision.current = state.revision;
      storage.setJSON("learning_revision", state.revision);
      storage.setJSON("learning_base", {
        bookmarks: state.bookmarks,
        srsCards: state.srsCards,
        studyDays: state.studyDays,
      });
      storage.setJSON("learning_dirty", false);
      applyRef.current(state);
      setError("");
      setConflict(false);
      setStatus("saved");
    },
    [storage],
  );
  const flush = useCallback(async () => {
    if (!enabled) return;
    if (flight.current) return flight.current;
    if (revision.current === null)
      throw new Error("Chưa tải được tiến độ tài khoản.");
    const run = async () => {
      while (alive.current && storage.getJSON("learning_dirty", false)) {
        const data = readLearning(storage);
        setStatus("pending");
        const sent = await putLearningState({
          ...data,
          revision: revision.current!,
        });
        if (!alive.current) return;
        revision.current = sent.revision;
        storage.setJSON("learning_revision", sent.revision);
        storage.setJSON("learning_base", data);
        if (same(data, readLearning(storage)))
          storage.setJSON("learning_dirty", false);
      }
      if (alive.current) {
        setStatus("saved");
        setError("");
        setConflict(false);
      }
    };
    flight.current = run()
      .catch((e) => {
        if (alive.current) {
          setStatus("error");
          setError(e.message);
          setConflict(true);
        }
        throw e;
      })
      .finally(() => {
        flight.current = null;
      });
    return flight.current;
  }, [enabled, storage]);
  const load = useCallback(async () => {
    if (paused.current) return;
    const version = ++loadVersion.current;
    setStatus("loading");
    try {
      if (flight.current) await flight.current.catch(() => {});
      const state = await getLearningState();
      if (!alive.current || version !== loadVersion.current) return;
      const data = readLearning(storage);
      const nonempty =
        data.bookmarks.length + data.srsCards.length + data.studyDays.length >
        0;
      if (
        revision.current === null &&
        nonempty &&
        !same(data, {
          bookmarks: state.bookmarks,
          srsCards: state.srsCards,
          studyDays: state.studyDays,
        })
      ) {
        storage.setJSON("learning_local_backup", data);
        apply(state);
      } else if (storage.getJSON("learning_dirty", false)) {
        if (revision.current !== state.revision)
          throw new Error(
            "Tiến độ đã thay đổi trên thiết bị khác. Bản chưa gửi vẫn được giữ trên thiết bị này.",
          );
        await flush();
      } else apply(state);
    } catch (e) {
      if (alive.current && version === loadVersion.current) {
        setError(e instanceof Error ? e.message : "Không thể đồng bộ");
        setConflict(true);
        setStatus("error");
      }
    } finally {
      if (alive.current && version === loadVersion.current)
        setInitialized(true);
    }
  }, [storage, apply, flush]);
  useEffect(() => {
    alive.current = true;
    if (!enabled) return;
    void load();
    let timer: ReturnType<typeof setTimeout>;
    const unsubscribe = storage.subscribeLearning(() => {
      storage.setJSON("learning_dirty", true);
      setStatus((s) => (s === "error" ? s : "pending"));
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (!paused.current) void flush().catch(() => {});
      }, 500);
    });
    return () => {
      alive.current = false;
      loadVersion.current++;
      clearTimeout(timer);
      unsubscribe();
    };
  }, [enabled, storage, load, flush]);
  const beforeTransfer = useCallback(async () => {
    if (paused.current) throw new Error("Đang đồng bộ, vui lòng đợi.");
    loadVersion.current++;
    paused.current = true;
    try {
      await flush();
    } catch (e) {
      paused.current = false;
      throw e;
    }
  }, [flush]);
  const afterTransfer = useCallback(() => {
    paused.current = false;
  }, []);
  const reloadServer = useCallback(async () => {
    if (paused.current) return;
    paused.current = true;
    try {
      if (flight.current) await flight.current.catch(() => {});
      const state = await getLearningState();
      if (!alive.current) return;
      storage.setJSON("learning_conflict_backup", {
        data: readLearning(storage),
        base: storage.getJSON("learning_base", {}),
        savedAt: new Date().toISOString(),
      });
      apply(state);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể tải");
    } finally {
      paused.current = false;
    }
  }, [storage, apply]);
  return {
    status,
    initialized,
    error,
    conflict,
    retry: load,
    reloadServer,
    apply,
    beforeTransfer,
    afterTransfer,
  };
}
