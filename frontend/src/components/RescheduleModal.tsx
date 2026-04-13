import { useState, useEffect } from "react";
import { DetailedSchedule, Suggestion } from "../types";
import { API } from "../helpers";
import { SuggestionView } from "./UnscheduledModal";

export function RescheduleModal({
  schedule,
  versionId,
  onClose,
  onRescheduled,
}: {
  schedule: DetailedSchedule;
  versionId: number;
  onClose: () => void;
  onRescheduled: () => void;
}) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [scheduling, setScheduling] = useState<number | null>(null);

  useEffect(() => {
    if (!schedule.exam) return;
    fetch(`${API}/schedules/suggest/${schedule.exam.id}?version_id=${versionId}`)
      .then((r) => r.json())
      .then((d) => setSuggestions(Array.isArray(d) ? d : []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [schedule.exam, versionId]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  function moveExam(suggestion: Suggestion) {
    if (!suggestion.room) return;
    setScheduling(suggestion.timeslot.id);
    fetch(`${API}/schedules/${schedule.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        exam_id: schedule.exam!.id,
        room_id: suggestion.room.id,
        timeslot_id: suggestion.timeslot.id,
      }),
    })
      .then((r) => { if (!r.ok) throw new Error(); })
      .then(() => { onRescheduled(); onClose(); })
      .catch(console.error)
      .finally(() => setScheduling(null));
  }

  return (
    <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal unscheduled-modal">
        <div className="modal-header">
          <div>
            <h3>Find Better Slot</h3>
            <div className="modal-subtitle">
              {schedule.exam?.course_name} · top 3 alternatives by fewest conflicts
            </div>
          </div>
          <button className="drawer-close" onClick={onClose} style={{ fontSize: 26, alignSelf: "flex-start" }}>×</button>
        </div>
        <div className="modal-body">
          <SuggestionView
            exam={schedule.exam!}
            suggestions={suggestions}
            loading={loading}
            scheduling={scheduling}
            onSchedule={moveExam}
          />
        </div>
      </div>
    </div>
  );
}
