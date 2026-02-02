import { useState, useEffect } from "react";
import { DetailedSchedule, Conflict, StudentInfo, TimeSlot } from "../types";
import { API, formatTime, shortCourse } from "../helpers";
import { CalendarGrid } from "./CalendarGrid";

export function StudentsPage({
  students, conflicts, timeslots, versionId,
  onDragStart, onDrop, draggingId,
}: {
  students: StudentInfo[];
  conflicts: Conflict[];
  timeslots: TimeSlot[];
  versionId: number;
  onDragStart: (s: DetailedSchedule) => void;
  onDrop: (date: string, timeRange: string) => void;
  draggingId: number | null;
}) {
  const [selectedStudent, setSelectedStudent] = useState<number | null>(null);
  const [studentSchedules, setStudentSchedules] = useState<DetailedSchedule[]>([]);
  const [studentSearch, setStudentSearch] = useState("");
  const [studentWeek, setStudentWeek] = useState(0);
  const [studentConflicts, setStudentConflicts] = useState<Conflict[]>([]);

  useEffect(() => {
    if (selectedStudent === null) { setStudentSchedules([]); setStudentConflicts([]); return; }
    fetch(`${API}/schedules/students/${selectedStudent}/schedule?version_id=${versionId}`)
      .then((r) => r.json())
      .then((data) => {
        setStudentSchedules(data.schedules || []);
        setStudentConflicts(conflicts.filter((c) => c.student?.id === selectedStudent));
      })
      .catch(console.error);
  }, [selectedStudent, conflicts, versionId]);

  const filteredStudents = students.filter((s) =>
    s.id.toString().includes(studentSearch) ||
    s.email.toLowerCase().includes(studentSearch.toLowerCase())
  );

  const currentStudent = students.find((s) => s.id === selectedStudent);

  if (selectedStudent && currentStudent) {
    return (
      <div className="student-detail-view">
        <div className="student-header">
          <button className="back-btn" onClick={() => setSelectedStudent(null)}>&larr; All Students</button>
          <div className="student-info">
            <h2>{currentStudent.name}</h2>
            <span className="student-email">{currentStudent.email}</span>
          </div>
          {studentConflicts.length > 0 && (
            <span className="panel-badge danger" style={{ marginLeft: "auto", fontSize: 12, padding: "4px 12px" }}>
              {studentConflicts.length} conflict{studentConflicts.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        <div className="section-title">
          <h2>Personal Exam Schedule</h2>
          <span className="stat-secondary">{studentSchedules.length} exam{studentSchedules.length !== 1 ? "s" : ""}</span>
        </div>

        <CalendarGrid
          schedules={studentSchedules}
          timeslots={timeslots}
          week={studentWeek}
          setWeek={setStudentWeek}
          colorFn={(id) => id % 10}
          onDragStart={onDragStart}
          onDrop={onDrop}
          draggingId={draggingId}
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

  return (
    <div className="students-list-view">
      <div className="section-title">
        <h2>Students</h2>
        <span className="stat-secondary">{students.length} total</span>
      </div>

      <div className="search-box">
        <input
          type="text"
          placeholder="Search by ID or email..."
          value={studentSearch}
          onChange={(e) => setStudentSearch(e.target.value)}
          className="search-input"
        />
      </div>

      <div className="student-grid">
        {filteredStudents.map((s) => {
          const hasConflict = conflicts.some((c) => c.student?.id === s.id);
          return (
            <button key={s.id} className="student-card" onClick={() => setSelectedStudent(s.id)}>
              <div className="student-card-avatar">
                {s.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
              </div>
              <div className="student-card-info">
                <div className="student-card-name">{s.name}</div>
                <div className="student-card-email">{s.email}</div>
              </div>
              {hasConflict && <span className="student-card-conflict">Conflict</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
