import { useState, useRef } from "react";
import { DetailedSchedule } from "../types";
import { shortCourse } from "../helpers";
import { CellPopover } from "./CellPopover";

const MAX_CHIPS = 3;

export function CalendarCell({
  items, colorFn, date, timeRange, onDragStart, onDrop, draggingId,
}: {
  items: DetailedSchedule[];
  colorFn: (id: number) => number;
  date: string;
  timeRange: string;
  onDragStart?: (s: DetailedSchedule) => void;
  onDrop?: (date: string, timeRange: string) => void;
  draggingId?: number | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const dragCountRef = useRef(0);
  const [dragOver, setDragOver] = useState(false);
  const visible = items.slice(0, MAX_CHIPS);
  const overflow = items.length - MAX_CHIPS;

  return (
    <div
      className={`calendar-cell${dragOver ? " drag-over" : ""}`}
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
      onDragEnter={(e) => { e.preventDefault(); dragCountRef.current++; setDragOver(true); }}
      onDragLeave={() => { dragCountRef.current--; if (dragCountRef.current <= 0) { dragCountRef.current = 0; setDragOver(false); } }}
      onDrop={(e) => { e.preventDefault(); dragCountRef.current = 0; setDragOver(false); onDrop?.(date, timeRange); }}
    >
      {visible.map((s) => (
        <div
          key={s.id}
          className={`exam-chip color-${colorFn(s.exam?.id ?? 0)}${draggingId === s.id ? " dragging" : ""}`}
          title={`${s.exam?.course_name}\n${s.room?.name} (${s.room?.building})\n${s.exam?.student_count} students`}
          draggable
          onDragStart={(e) => {
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("text/plain", String(s.id));
            onDragStart?.(s);
          }}
        >
          <span className="chip-course">{shortCourse(s.exam?.course_name ?? "")}</span>
          <span className="chip-room">{s.room?.name}</span>
        </div>
      ))}
      {overflow > 0 && (
        <button className="overflow-btn" onClick={() => setExpanded(true)}>+{overflow} more</button>
      )}
      {expanded && <CellPopover items={items} onClose={() => setExpanded(false)} />}
    </div>
  );
}
