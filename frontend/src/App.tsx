import { useEffect, useState, useRef } from "react";
import "./styles.css";

const API = "http://localhost:8000";

// ── Types ──

interface Room { id: number; name: string; capacity: number; building: string }
interface Exam { id: number; course_name: string; student_count: number; duration_minutes: number }
interface TimeSlot { id: number; start_time: string; end_time: string; date: string }
interface DetailedSchedule { id: number; exam: Exam | null; room: Room | null; timeslot: TimeSlot | null }
interface StudentInfo { id: number; name: string; email: string }
interface Conflict { student: StudentInfo | null; timeslot: TimeSlot | null; exams: Exam[] }
interface Analytics {
  total_exams: number; scheduled_exams: number; total_rooms: number;
  total_students: number; total_timeslots: number; conflict_count: number;
  affected_students: number;
  capacity_warnings: { exam: string; students: number; room: string; capacity: number }[];
  room_usage: { room: string; count: number }[];
}

// ── Helpers ──

function formatTime(t: string) {
  const [h, m] = t.split(":");
  const hour = parseInt(h);
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? "PM" : "AM"}`;
}

function shortCourse(name: string) {
  const dash = name.indexOf(" - ");
  return dash > -1 ? name.substring(0, dash) : name;
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const MAX_CHIPS = 3;

type Page = "exams" | "students";

// ── Popover for overflow ──

function CellPopover({ items, onClose }: { items: DetailedSchedule[]; onClose: () => void }) {
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

// ── Calendar Cell ──

function CalendarCell({ items, colorFn }: { items: DetailedSchedule[]; colorFn: (id: number) => number }) {
  const [expanded, setExpanded] = useState(false);
  const visible = items.slice(0, MAX_CHIPS);
  const overflow = items.length - MAX_CHIPS;

  return (
    <div className="calendar-cell">
      {visible.map((s) => (
        <div
          key={s.id}
          className={`exam-chip color-${colorFn(s.exam?.id ?? 0)}`}
          title={`${s.exam?.course_name}\n${s.room?.name} (${s.room?.building})\n${s.exam?.student_count} students`}
        >
          <span className="chip-course">{shortCourse(s.exam?.course_name ?? "")}</span>
          <span className="chip-room">{s.room?.name}</span>
        </div>
      ))}
      {overflow > 0 && (
        <button className="overflow-btn" onClick={() => setExpanded(true)}>
          +{overflow} more
        </button>
      )}
      {expanded && <CellPopover items={items} onClose={() => setExpanded(false)} />}
    </div>
  );
}

// ── Calendar Grid (reused by both pages) ──

function CalendarGrid({
  schedules, timeslots, week, setWeek, colorFn,
}: {
  schedules: DetailedSchedule[];
  timeslots: TimeSlot[];
  week: number;
  setWeek: (w: number) => void;
  colorFn: (id: number) => number;
}) {
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
          <button key={i} className={`week-btn ${week === i ? "active" : ""}`} onClick={() => setWeek(i)}>
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
                  <CalendarCell key={`${date}-${tr}`} items={getCell(date, tr)} colorFn={colorFn} />
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ── Main App ──

export default function App() {
  const [page, setPage] = useState<Page>("exams");
  const [schedules, setSchedules] = useState<DetailedSchedule[]>([]);
  const [timeslots, setTimeslots] = useState<TimeSlot[]>([]);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [week, setWeek] = useState(0);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");

  // Student page state
  const [students, setStudents] = useState<StudentInfo[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<number | null>(null);
  const [studentSchedules, setStudentSchedules] = useState<DetailedSchedule[]>([]);
  const [studentSearch, setStudentSearch] = useState("");
  const [studentWeek, setStudentWeek] = useState(0);
  const [studentConflicts, setStudentConflicts] = useState<Conflict[]>([]);

  const fetchAll = () => {
    setLoading(true);
    Promise.all([
      fetch(`${API}/schedules/detailed`).then((r) => r.json()),
      fetch(`${API}/schedules/timeslots`).then((r) => r.json()),
      fetch(`${API}/schedules/conflicts`).then((r) => r.json()),
      fetch(`${API}/schedules/analytics`).then((r) => r.json()),
      fetch(`${API}/schedules/students`).then((r) => r.json()),
    ])
      .then(([s, t, c, a, st]) => {
        setSchedules(s);
        setTimeslots(t);
        setConflicts(c.conflicts || []);
        setAnalytics(a);
        setStudents(st);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchAll(); }, []);

  useEffect(() => {
    if (selectedStudent === null) { setStudentSchedules([]); setStudentConflicts([]); return; }
    fetch(`${API}/schedules/students/${selectedStudent}/schedule`)
      .then((r) => r.json())
      .then((data) => {
        setStudentSchedules(data.schedules || []);
        // Find conflicts for this student
        const sc = conflicts.filter((c) => c.student?.id === selectedStudent);
        setStudentConflicts(sc);
      })
      .catch(console.error);
  }, [selectedStudent, conflicts]);

  const handleSave = async () => {
    setSaveStatus("saving");
    const payload = schedules
      .filter((s) => s.exam && s.room && s.timeslot)
      .map((s) => ({ exam_id: s.exam!.id, room_id: s.room!.id, timeslot_id: s.timeslot!.id }));
    await fetch(`${API}/schedules/bulk`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaveStatus("saved");
    fetchAll();
    setTimeout(() => setSaveStatus("idle"), 2000);
  };

  const filteredStudents = students.filter((s) =>
    s.id.toString().includes(studentSearch) ||
    s.email.toLowerCase().includes(studentSearch.toLowerCase())
  );

  const currentStudent = students.find((s) => s.id === selectedStudent);

  if (loading) {
    return <div className="app"><div className="loading">Loading schedule...</div></div>;
  }

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-inner">
          <div className="header-left">
            <h1 className="logo">InForms</h1>
            <div className="divider" />
            <span className="subtitle">Final Exam Scheduling</span>
          </div>
          <div className="header-right">
            <nav className="header-nav">
              <button className={`header-nav-btn ${page === "exams" ? "active" : ""}`} onClick={() => setPage("exams")}>
                All Exams
              </button>
              <button className={`header-nav-btn ${page === "students" ? "active" : ""}`} onClick={() => setPage("students")}>
                Students
              </button>
            </nav>
            <button
              className={`save-btn ${saveStatus === "saved" ? "saved" : ""}`}
              onClick={handleSave}
              disabled={saveStatus === "saving"}
            >
              {saveStatus === "saving" ? "Saving..." : saveStatus === "saved" ? "Saved" : "Save Schedule"}
            </button>
          </div>
        </div>
      </header>

      {/* ═══ ALL EXAMS PAGE ═══ */}
      {page === "exams" && (
        <div className="layout">
          <div className="calendar-col">
            <div className="stats-row">
              <div className="stat-card">
                <div className="stat-label">Scheduled</div>
                <div className="stat-value">
                  {analytics?.scheduled_exams ?? 0}
                  <span className="stat-secondary"> / {analytics?.total_exams ?? 0}</span>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Conflicts</div>
                <div className={`stat-value ${(analytics?.conflict_count ?? 0) > 0 ? "conflict" : "good"}`}>
                  {analytics?.conflict_count ?? 0}
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Students Affected</div>
                <div className={`stat-value ${(analytics?.affected_students ?? 0) > 0 ? "conflict" : "good"}`}>
                  {analytics?.affected_students ?? 0}
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Rooms Used</div>
                <div className="stat-value">
                  {analytics?.room_usage?.length ?? 0}
                  <span className="stat-secondary"> / {analytics?.total_rooms ?? 0}</span>
                </div>
              </div>
            </div>

            <div className="section-title">
              <h2>Exam Calendar</h2>
            </div>

            <CalendarGrid
              schedules={schedules}
              timeslots={timeslots}
              week={week}
              setWeek={setWeek}
              colorFn={(id) => id % 10}
            />
          </div>

        </div>
      )}

      {/* ═══ STUDENTS PAGE ═══ */}
      {page === "students" && (
        <div className="layout">
          <div className="calendar-col">
            {selectedStudent && currentStudent ? (
              <>
                <div className="student-header">
                  <button className="back-btn" onClick={() => setSelectedStudent(null)}>&larr; All Students</button>
                  <div className="student-info">
                    <h2>Student ID: {currentStudent.id}</h2>
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
              </>
            ) : (
              <>
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
                          {s.id}
                        </div>
                        <div className="student-card-info">
                          <div className="student-card-name">ID: {s.id}</div>
                          <div className="student-card-email">{s.email}</div>
                        </div>
                        {hasConflict && <span className="student-card-conflict">Conflict</span>}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
