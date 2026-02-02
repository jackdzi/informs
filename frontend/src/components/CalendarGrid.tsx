import { useState } from "react";
import { DetailedSchedule, TimeSlot } from "../types";
import { formatTime, WEEKDAYS } from "../helpers";
import { CalendarCell } from "./CalendarCell";

export function CalendarGrid({
  schedules, timeslots, week, setWeek, colorFn, onDragStart, onDrop, draggingId,
}: {
  schedules: DetailedSchedule[];
  timeslots: TimeSlot[];
  week: number;
  setWeek: (w: number) => void;
  colorFn: (id: number) => number;
  onDragStart?: (s: DetailedSchedule) => void;
  onDrop?: (date: string, timeRange: string) => void;
  draggingId?: number | null;
}) {
  const [dragHoverWeek, setDragHoverWeek] = useState<number | null>(null);
  const allDates = [...new Set(timeslots.map((t) => t.date))].sort();
  const weeks: string[][] = [];
  for (let i = 0; i < allDates.length; i += 5) weeks.push(allDates.slice(i, i + 5));
  const currentDates = weeks[week] || [];
  const allTimes = [...new Set(timeslots.map((t) => `${t.start_time}-${t.end_time}`))].sort();

  const getCell = (date: string, tr: string) => {
    const [start, end] = tr.split("-");
    return schedules.filter(
      (s) => s.timeslot?.date === date && s.timeslot?.start_time === start && s.timeslot?.end_time === end,
    );
  };

  return (
    <>
      <div className="week-toggle">
        {weeks.map((_, i) => (
          <button
            key={i}
            className={`week-btn ${week === i ? "active" : ""}${dragHoverWeek === i && week !== i ? " drag-hover" : ""}`}
            onClick={() => setWeek(i)}
            onDragEnter={(e) => { e.preventDefault(); setWeek(i); setDragHoverWeek(i); }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); setDragHoverWeek(null); }}
          >
            Week {i + 1}
          </button>
        ))}
      </div>

      <div className="calendar">
        <div className="calendar-header" style={{ gridTemplateColumns: `72px repeat(${Math.max(currentDates.length, 1)}, 1fr)` }}>
          <div className="calendar-corner" />
          {currentDates.map((date, i) => {
            const d = new Date(date + "T00:00:00");
            return (
              <div key={date} className="calendar-header-cell">
                {WEEKDAYS[i] || d.toLocaleDateString("en-US", { weekday: "short" })}
                <span className="day-num">{d.getDate()}</span>
              </div>
            );
          })}
        </div>

        <div className="calendar-body" style={{ gridTemplateColumns: `72px repeat(${Math.max(currentDates.length, 1)}, 1fr)` }}>
          {allTimes.map((tr) => {
            const start = tr.split("-")[0];
            return (
              <div key={tr} className="calendar-row">
                <div className="time-label">{formatTime(start)}</div>
                {currentDates.map((date) => (
                  <CalendarCell
                    key={`${date}-${tr}`}
                    items={getCell(date, tr)}
                    colorFn={colorFn}
                    date={date}
                    timeRange={tr}
                    onDragStart={onDragStart}
                    onDrop={onDrop}
                    draggingId={draggingId}
                  />
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
