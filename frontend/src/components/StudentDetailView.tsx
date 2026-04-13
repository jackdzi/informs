import { useState, useEffect } from "react";
import { DetailedSchedule, Conflict, StudentInfo, TimeSlot } from "../types";
import { API, formatTime, shortCourse } from "../helpers";
import { CalendarGrid, OpenSlot } from "./CalendarGrid";

export function StudentDetailView({
  student,
  conflicts,
  timeslots,
  versionId,
  backLabel,
  onBack,
  onDragStart,
  onDrop,
  draggingId,
}: {
  student: StudentInfo;
  conflicts: Conflict[];
  timeslots: TimeSlot[];
  versionId: number;
  backLabel: string;
  onBack: () => void;
  onDragStart: (s: DetailedSchedule) => void;
  onDrop: (date: string, timeRange: string) => void;
  draggingId: number | null;
}) {
  const [schedules, setSchedules] = useState<DetailedSchedule[]>([]);
  const [week, setWeek] = useState(0);
  const [openSlot, setOpenSlot] = useState<OpenSlot | null>(null);

  const studentConflicts = conflicts.filter((c) => c.student?.id === student.id);

  useEffect(() => {
    fetch(`${API}/schedules/students/${student.id}/schedule?version_id=${versionId}`)
      .then((r) => r.json())
      .then((data) => setSchedules(data.schedules || []))
      .catch(console.error);
  }, [student.id, versionId]);

  return (
    <div className="student-detail-view">
      <div className="student-header">
        <button className="back-btn" onClick={onBack}>&larr; {backLabel}</button>
        <div className="student-info">
          <h2>{student.name ?? `Student #${student.person_id ?? student.id}`}</h2>
          {student.email && <span className="student-email">{student.email}</span>}
        </div>
        {studentConflicts.length > 0 && (
          <span className="panel-badge danger" style={{ marginLeft: "auto", fontSize: 12, padding: "4px 12px" }}>
            {studentConflicts.length} conflict{studentConflicts.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      <div className="section-title">
        <h2>Personal Exam Schedule</h2>
        <span className="stat-secondary">{schedules.length} exam{schedules.length !== 1 ? "s" : ""}</span>
      </div>

      <CalendarGrid
        schedules={schedules}
        timeslots={timeslots}
        week={week}
        setWeek={setWeek}
        colorFn={(id) => id % 10}
        onDragStart={onDragStart}
        onDrop={onDrop}
        draggingId={draggingId}
        openSlot={openSlot}
        setOpenSlot={setOpenSlot}
      />

      {studentConflicts.length > 0 && (
        <div className="student-conflicts">
          <h3>Conflicts</h3>
          {studentConflicts.map((c, i) => (
            <div key={i} className="student-conflict-item">
              <span className="conflict-time">{c.timeslot?.date} at {formatTime(c.timeslot?.start_time ?? "")}</span>
              <span className="conflict-exams">{c.exams.map((e) => shortCourse(e.course_name)).join(" & ")}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
