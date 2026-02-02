import { useEffect, useRef } from "react";
import { Conflict } from "../types";
import { formatDate, formatTime, shortCourse } from "../helpers";

export function ConflictModal({
  slotKey, items, onClose,
}: {
  slotKey: string;
  items: Conflict[];
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [date, start, end] = slotKey.split("|");
  const label = `${formatDate(date)} ${formatTime(start)} – ${formatTime(end)}`;
  const examNames = [...new Set(items.flatMap((c) => c.exams.map((e) => e.course_name)))];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const keyHandler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", keyHandler);
    return () => { document.removeEventListener("mousedown", handler); document.removeEventListener("keydown", keyHandler); };
  }, [onClose]);

  return (
    <div className="modal-overlay">
      <div className="modal" ref={ref}>
        <div className="modal-header">
          <div>
            <h3>Conflict Details</h3>
            <span className="modal-subtitle">{label}</span>
          </div>
          <button className="popover-close" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          <div className="modal-section">
            <div className="modal-section-title">Conflicting Exams</div>
            <div className="conflict-group-exams">
              {examNames.map((name) => (
                <span key={name} className="conflict-group-exam">{name}</span>
              ))}
            </div>
          </div>
          <div className="modal-section">
            <div className="modal-section-title">Affected Students ({items.length})</div>
            <div className="modal-student-list">
              {items.map((c, i) => (
                <div key={i} className="modal-student-row">
                  <span className="modal-student-id">ID: {c.student?.id}</span>
                  <span className="modal-student-email">{c.student?.email}</span>
                  <span className="modal-student-exams">
                    {c.exams.map((e) => shortCourse(e.course_name)).join(", ")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
