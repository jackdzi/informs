import { useRef, useState } from "react";
import { DetailedSchedule } from "../types";
import { shortCourse } from "../helpers";

const PREVIEW = 2; // how many course labels to show before "…"

export function CalendarCell({
  items, colorFn, date, timeRange, onDragStart, onDrop, draggingId, onCellClick, onChipClick,
}: {
  items: DetailedSchedule[];
  colorFn: (id: number) => number;
  date: string;
  timeRange: string;
  onDragStart?: (s: DetailedSchedule) => void;
  onDrop?: (date: string, timeRange: string) => void;
  draggingId?: number | null;
  onCellClick?: (date: string, timeRange: string) => void;
  onChipClick?: (s: DetailedSchedule) => void;
}) {
  const dragCountRef = useRef(0);
  const [dragOver, setDragOver] = useState(false);

  const preview = items.slice(0, PREVIEW);
  const extra = items.length - PREVIEW;
  const isEmpty = items.length === 0;

  return (
    <div
      className={`calendar-cell${dragOver ? " drag-over" : ""}${isEmpty ? " cell-empty" : " cell-has-items"}`}
      onClick={() => !isEmpty && onCellClick?.(date, timeRange)}
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
      onDragEnter={(e) => { e.preventDefault(); dragCountRef.current++; setDragOver(true); }}
      onDragLeave={() => { dragCountRef.current--; if (dragCountRef.current <= 0) { dragCountRef.current = 0; setDragOver(false); } }}
      onDrop={(e) => { e.preventDefault(); dragCountRef.current = 0; setDragOver(false); onDrop?.(date, timeRange); }}
    >
      {!isEmpty && (
        <>
          <div className="cell-count">{items.length}</div>
          <div className="cell-previews">
            {preview.map((s) => (
              <div
                key={s.id}
                className={`cell-chip color-${colorFn(s.exam?.id ?? 0)}${draggingId === s.id ? " dragging" : ""}`}
                draggable
                onDragStart={(e) => {
                  e.stopPropagation();
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("text/plain", String(s.id));
                  onDragStart?.(s);
                }}
                onClick={(e) => { e.stopPropagation(); onChipClick?.(s); }}
              >
                {shortCourse(s.exam?.course_name ?? "")}
              </div>
            ))}
            {extra > 0 && <div className="cell-extra">+{extra} more</div>}
          </div>
        </>
      )}
    </div>
  );
}
