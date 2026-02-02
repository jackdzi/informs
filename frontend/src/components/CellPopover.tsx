import { useEffect, useRef } from "react";
import { DetailedSchedule } from "../types";

export function CellPopover({ items, onClose }: { items: DetailedSchedule[]; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div className="cell-popover" ref={ref}>
      <div className="popover-header">
        {items.length} exams in this slot
        <button className="popover-close" onClick={onClose}>&times;</button>
      </div>
      <div className="popover-body">
        {items.map((s) => (
          <div key={s.id} className="popover-item">
            <div className="popover-course">{s.exam?.course_name}</div>
            <div className="popover-meta">
              {s.room?.name} &middot; {s.room?.building} &middot; {s.exam?.student_count} students
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
