import { useEffect } from "react";
import { DetailedSchedule } from "../types";
import { formatTime } from "../helpers";

export function SlotDrawer({
  date, timeRange, items, colorFn, onClose, onDragStart, onExamClick, onMoveClick, draggingId,
}: {
  date: string;
  timeRange: string;
  items: DetailedSchedule[];
  colorFn: (id: number) => number;
  onClose: () => void;
  onDragStart?: (s: DetailedSchedule) => void;
  onExamClick?: (s: DetailedSchedule) => void;
  onMoveClick?: (s: DetailedSchedule) => void;
  draggingId?: number | null;
}) {
  const [start, end] = timeRange.split("-");
  const d = new Date(date + "T00:00:00");
  const dateLabel = d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
  const timeLabel = `${formatTime(start)} – ${formatTime(end)}`;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="slot-drawer">
      <div className="drawer-header">
        <div className="drawer-title-group">
          <div className="drawer-date">{dateLabel}</div>
          <div className="drawer-time">{timeLabel}</div>
        </div>
        <div className="drawer-meta">
          <span className="drawer-count">{items.length} exam{items.length !== 1 ? "s" : ""}</span>
          <button className="drawer-close" onClick={onClose} aria-label="Close">×</button>
        </div>
      </div>

      <div className="drawer-body">
        {items.length === 0 ? (
          <div className="drawer-empty">No exams scheduled in this slot.</div>
        ) : (
          items.map((s) => (
            <div
              key={s.id}
              className={`drawer-exam-card color-${colorFn(s.exam?.id ?? 0)}${draggingId === s.id ? " dragging" : ""}`}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", String(s.id));
                onDragStart?.(s);
              }}
            >
              <div className="drawer-card-left">
                <div className="drawer-card-course">{s.exam?.course_name ?? "—"}</div>
                <div className="drawer-card-meta">
                  {s.room?.building} {s.room?.name}
                  <span className="drawer-card-dot">·</span>
                  {s.exam?.student_count ?? 0} students
                  {s.room?.capacity ? (
                    <span className={s.exam && s.room && s.exam.student_count > s.room.capacity ? " cap-warn" : " cap-ok"}>
                      {" "}/ {s.room.capacity} capacity
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="drawer-card-actions">
                <button className="drawer-action-btn" onClick={() => onExamClick?.(s)}>Students</button>
                <button className="drawer-action-btn drawer-action-move" onClick={() => onMoveClick?.(s)}>Move ⟳</button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
