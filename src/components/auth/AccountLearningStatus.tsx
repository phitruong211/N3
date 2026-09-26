import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useApp } from "@/hooks/useApp";
import { createLearningStorage } from "@/lib/storage";
import { readLearning } from "@/hooks/useLearningSync";
import type { LearningData } from "@/lib/learningSync";
import LearningSyncPanel, {
  type LearningMigrationSource,
} from "./LearningSyncPanel";
const empty: LearningData = { bookmarks: [], srsCards: [], studyDays: [] };
function convertLegacyCard(old: any) {
  return {
    cardId: old.itemId,
    deckType: old.itemType,
    state:
      old.state === "mastered" || old.state === "review"
        ? "review"
        : old.state === "learning" || old.state === "forgotten"
          ? "learning"
          : "new",
    easeFactor: old.easeFactor ?? 2.5,
    intervalDays: old.interval,
    dueDate: old.dueDate || "1970-01-01T00:00:00.000Z",
    reps: old.repetitions ?? 0,
    lapses: old.state === "forgotten" ? 1 : 0,
    lastReviewedAt: old.lastReview || null,
  };
}
function legacyRows(key: string): any[] {
  try {
    const data = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}
function readLegacy(): LearningData {
  const modern = ["vocab", "kanji", "grammar"].flatMap((t) =>
    legacyRows(`srs_cards_${t}_v1`),
  );
  const cards = [
    ...modern,
    ...legacyRows("n3_srs_cards")
      .map(convertLegacyCard)
      .filter(
        (c) =>
          !modern.some(
            (m) => m.cardId === c.cardId && m.deckType === c.deckType,
          ),
      ),
  ];
  return {
    bookmarks: legacyRows("n3_bookmarks"),
    srsCards: cards,
    studyDays: legacyRows("n3_study_days"),
  };
}
function remaining(current: LearningData, sent: LearningData): LearningData {
  return {
    bookmarks: current.bookmarks.filter(
      (c) =>
        !sent.bookmarks.some((s) => JSON.stringify(c) === JSON.stringify(s)),
    ),
    srsCards: current.srsCards.filter(
      (c) =>
        !sent.srsCards.some((s) => JSON.stringify(c) === JSON.stringify(s)),
    ),
    studyDays: current.studyDays.flatMap((c) => {
      const s = sent.studyDays.find((s) => s.date === c.date);
      if (!s) return [c];
      const reviews = Math.max(0, c.cardsReviewed - s.cardsReviewed);
      const time = Math.max(0, c.timeSpent - s.timeSpent);
      if (!reviews && !time) return [];
      return [
        {
          ...c,
          cardsReviewed: reviews,
          flashcardReviewed: Math.max(
            0,
            (c.flashcardReviewed || 0) - (s.flashcardReviewed || 0),
          ),
          srsReviewed: Math.max(0, (c.srsReviewed || 0) - (s.srsReviewed || 0)),
          newCardsLearned: Math.max(0, c.newCardsLearned - s.newCardsLearned),
          timeSpent: time,
          accuracy: reviews
            ? Math.min(
                1,
                Math.max(
                  0,
                  (c.accuracy * c.cardsReviewed -
                    s.accuracy * s.cardsReviewed) /
                    reviews,
                ),
              )
            : 0,
        },
      ];
    }),
  };
}
export function AccountLearningStatus() {
  const { user } = useAuth();
  const { storage, learningSync: sync } = useApp();
  const [version, setVersion] = useState(0);
  const [sources] = useState<LearningMigrationSource[]>(() => {
    const guest = createLearningStorage("guest");
    const backup = storage.getJSON<LearningData>(
      "learning_local_backup",
      empty,
    );
    return [
      {
        id: "guest",
        label: "dữ liệu học thử",
        snapshot: readLearning(guest),
        onTransferred: (data) => {
          const next = remaining(readLearning(guest), data);
          guest.saveBookmarks(next.bookmarks);
          for (const t of ["vocabulary", "kanji", "grammar"] as const)
            guest.saveSRSCards(
              t,
              next.srsCards.filter((c) => c.deckType === t),
            );
          guest.setJSON("n3_study_days", next.studyDays);
          setVersion((v) => v + 1);
        },
      },
      {
        id: "legacy",
        label: "dữ liệu phiên bản cũ",
        snapshot: readLegacy(),
        onTransferred: (data) => {
          const next = remaining(readLegacy(), data);
          localStorage.setItem("n3_bookmarks", JSON.stringify(next.bookmarks));
          for (const [key, type] of [
            ["vocab", "vocabulary"],
            ["kanji", "kanji"],
            ["grammar", "grammar"],
          ])
            localStorage.setItem(
              `srs_cards_${key}_v1`,
              JSON.stringify(next.srsCards.filter((c) => c.deckType === type)),
            );
          localStorage.setItem("n3_study_days", JSON.stringify(next.studyDays));
          localStorage.setItem(
            "n3_srs_cards",
            JSON.stringify(
              legacyRows("n3_srs_cards").filter(
                (c) =>
                  !data.srsCards.some(
                    (sent) =>
                      JSON.stringify(convertLegacyCard(c)) ===
                      JSON.stringify(sent),
                  ),
              ),
            ),
          );
          setVersion((v) => v + 1);
        },
      },
      {
        id: "account-local",
        label: "bản học cục bộ chưa từng đồng bộ",
        snapshot: backup,
        onTransferred: () => storage.setJSON("learning_local_backup", empty),
      },
    ];
  });
  if (!user) return null;
  function exportBackup() {
    const blob = new Blob(
      [
        JSON.stringify(
          storage.getJSON("learning_conflict_backup", {
            data: readLearning(storage),
          }),
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "learning-backup.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <div className="space-y-3" data-source-version={version}>
      <p className="study-copy" role="status">
        {sync.status === "saved"
          ? "Tiến độ đã đồng bộ"
          : sync.status === "pending"
            ? "Đang lưu tiến độ…"
            : sync.status === "loading"
              ? "Đang tải tiến độ tài khoản…"
              : "Tiến độ chưa đồng bộ"}
      </p>
      {sync.error && (
        <div className="study-panel space-y-3" role="alert">
          <p>{sync.error}</p>
          <div className="flex flex-wrap gap-2">
            <button className="study-button" onClick={() => void sync.retry()}>
              Thử đồng bộ lại
            </button>
            <button className="study-button" onClick={exportBackup}>
              Tải bản sao dữ liệu
            </button>
            <button
              className="study-button"
              onClick={() => {
                if (
                  confirm(
                    "Lưu bản chưa đồng bộ vào bản sao trên thiết bị rồi tải tiến độ tài khoản?",
                  )
                )
                  void sync.reloadServer();
              }}
            >
              Dùng bản tài khoản, giữ bản sao cục bộ
            </button>
          </div>
        </div>
      )}
      {storage.getJSON("learning_conflict_backup", null) && (
        <p className="study-copy">
          Bản tiến độ trước khi xử lý xung đột vẫn được giữ.{" "}
          <button className="study-button" onClick={exportBackup}>
            Tải bản sao đã giữ
          </button>
        </p>
      )}
      <LearningSyncPanel
        accountId={user.id}
        sources={sources}
        onState={sync.apply}
        beforeTransfer={sync.beforeTransfer}
        afterTransfer={sync.afterTransfer}
      />
    </div>
  );
}
