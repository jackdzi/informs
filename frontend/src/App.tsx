import { useEffect, useState } from "react";
import "./styles.css";

const API = "http://localhost:8000";

interface Room {
  id: number;
  name: string;
  capacity: number;
  building: string;
}

interface Exam {
  id: number;
  course_name: string;
  student_count: number;
  duration_minutes: number;
}

interface TimeSlot {
  id: number;
  start_time: string;
  end_time: string;
  date: string;
}

interface DetailedSchedule {
  id: number;
  exam: Exam | null;
  room: Room | null;
  timeslot: TimeSlot | null;
}

interface Conflict {
  student: { id: number; name: string; email: string } | null;
  timeslot: TimeSlot | null;
  exams: Exam[];
}

interface Analytics {
  total_exams: number;
  scheduled_exams: number;
  total_rooms: number;
  total_students: number;
  total_timeslots: number;
  conflict_count: number;
  affected_students: number;
  capacity_warnings: { exam: string; students: number; room: string; capacity: number }[];
  room_usage: { room: string; count: number }[];
}

function formatTime(t: string) {
  const [h, m] = t.split(":");
  const hour = parseInt(h);
  const ampm = hour >= 12 ? "PM" : "AM";
  return `${hour % 12 || 12}:${m} ${ampm}`;
}

function shortCourse(name: string) {
  const dash = name.indexOf(" - ");
  return dash > -1 ? name.substring(0, dash) : name;
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];

export default function App() {
  const [schedules, setSchedules] = useState<DetailedSchedule[]>([]);
  const [timeslots, setTimeslots] = useState<TimeSlot[]>([]);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [week, setWeek] = useState(0);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");

  const fetchAll = () => {
    setLoading(true);
    Promise.all([
      fetch(`${API}/schedules/detailed`).then((r) => r.json()),
      fetch(`${API}/schedules/timeslots`).then((r) => r.json()),
      fetch(`${API}/schedules/conflicts`).then((r) => r.json()),
      fetch(`${API}/schedules/analytics`).then((r) => r.json()),
    ])
      .then(([s, t, c, a]) => {
        setSchedules(s);
        setTimeslots(t);
        setConflicts(c.conflicts || []);
        setAnalytics(a);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const handleSave = async () => {
    setSaveStatus("saving");
    const payload = schedules.map((s) => ({
      exam_id: s.exam!.id,
      room_id: s.room!.id,
      timeslot_id: s.timeslot!.id,
    }));
    await fetch(`${API}/schedules/bulk`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaveStatus("saved");
    fetchAll();
    setTimeout(() => setSaveStatus("idle"), 2000);
  };

  // Build calendar grid from timeslots
  const allDates = [...new Set(timeslots.map((t) => t.date))].sort();
  const weeks: string[][] = [];
  for (let i = 0; i < allDates.length; i += 5) {
    weeks.push(allDates.slice(i, i + 5));
  }
  const currentWeekDates = weeks[week] || [];

  const allTimes = [...new Set(timeslots.map((t) => `${t.start_time}-${t.end_time}`))].sort();

  const getSchedulesForCell = (date: string, timeRange: string) => {
    const [start, end] = timeRange.split("-");
    return schedules.filter(
      (s) => s.timeslot?.date === date && s.timeslot?.start_time === start && s.timeslot?.end_time === end,
    );
  };

  const conflictSlotIds = new Set(conflicts.flatMap((c) => (c.timeslot ? [c.timeslot.id] : [])));

  if (loading) {
    return <div className="app"><div className="loading">Loading schedule...</div></div>;
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <div className="header-left">
            <h1 className="logo">InForms</h1>
            <div className="divider" />
            <span className="subtitle">Final Exam Scheduling</span>
          </div>
          <button
            className={`save-btn ${saveStatus === "saved" ? "saved" : ""}`}
            onClick={handleSave}
            disabled={saveStatus === "saving"}
          >
            {saveStatus === "saving" ? "Saving..." : saveStatus === "saved" ? "Saved" : "Save Schedule"}
          </button>
        </div>
      </header>

      <div className="layout">
        <div className="calendar-col">
          {/* Stats */}
          <div className="stats-row">
            <div className="stat-card">
              <div className="stat-label">Scheduled</div>
              <div className="stat-value">{analytics?.scheduled_exams ?? 0}<span style={{ fontSize: 14, fontWeight: 400, color: "var(--slate-400)" }}> / {analytics?.total_exams ?? 0}</span></div>
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
              <div className="stat-value">{analytics?.room_usage?.length ?? 0}<span style={{ fontSize: 14, fontWeight: 400, color: "var(--slate-400)" }}> / {analytics?.total_rooms ?? 0}</span></div>
            </div>
          </div>

          {/* Week toggle */}
          <div className="week-toggle">
            <h2>Schedule</h2>
            {weeks.map((w, i) => (
              <button key={i} className={`week-btn ${week === i ? "active" : ""}`} onClick={() => setWeek(i)}>
                Week {i + 1}
              </button>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="calendar">
            <div className="calendar-header">
              <div className="calendar-header-cell" />
              {currentWeekDates.map((date, i) => {
                const d = new Date(date + "T00:00:00");
                return (
                  <div key={date} className="calendar-header-cell">
                    {WEEKDAYS[i] || d.toLocaleDateString("en-US", { weekday: "short" })}
                    <span className="day-num">{d.getDate()}</span>
                  </div>
                );
              })}
              {/* Fill empty day columns */}
              {Array.from({ length: Math.max(0, 5 - currentWeekDates.length) }).map((_, i) => (
                <div key={`empty-h-${i}`} className="calendar-header-cell" />
              ))}
            </div>

            <div className="calendar-body">
              {allTimes.map((timeRange) => {
                const [start, end] = timeRange.split("-");
                return [
                  <div key={`t-${timeRange}`} className="time-label">
                    {formatTime(start)}
                  </div>,
                  ...currentWeekDates.map((date) => {
                    const cellSchedules = getSchedulesForCell(date, timeRange);
                    return (
                      <div key={`${date}-${timeRange}`} className="calendar-cell">
                        {cellSchedules.map((s) => (
                          <div
                            key={s.id}
                            className={`exam-chip color-${(s.exam?.id ?? 0) % 10}`}
                            title={`${s.exam?.course_name}\n${s.room?.name} (${s.room?.building})\n${s.exam?.student_count} students`}
                          >
                            <div className="chip-course">{shortCourse(s.exam?.course_name ?? "")}</div>
                            <div className="chip-room">{s.room?.name}</div>
                          </div>
                        ))}
                      </div>
                    );
                  }),
                  ...Array.from({ length: Math.max(0, 5 - currentWeekDates.length) }).map((_, i) => (
                    <div key={`empty-${timeRange}-${i}`} className="calendar-cell" />
                  )),
                ];
              })}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="sidebar">
          {/* Conflicts */}
          <div className="panel">
            <div className="panel-header">
              <span className="panel-title">Scheduling Conflicts</span>
              <span className={`panel-badge ${conflicts.length > 0 ? "danger" : "success"}`}>
                {conflicts.length}
              </span>
            </div>
            <div className="panel-body">
              {conflicts.length === 0 ? (
                <div className="empty-panel">No conflicts detected</div>
              ) : (
                conflicts.map((c, i) => (
                  <div key={i} className="conflict-item">
                    <div className="conflict-student">{c.student?.name}</div>
                    <div className="conflict-detail">
                      {c.timeslot?.date} at {formatTime(c.timeslot?.start_time ?? "")}
                    </div>
                    <div className="conflict-exams">
                      {c.exams.map((e) => shortCourse(e.course_name)).join(" & ")}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Capacity warnings */}
          <div className="panel">
            <div className="panel-header">
              <span className="panel-title">Capacity Warnings</span>
              <span className={`panel-badge ${(analytics?.capacity_warnings?.length ?? 0) > 0 ? "warn" : "success"}`}>
                {analytics?.capacity_warnings?.length ?? 0}
              </span>
            </div>
            <div className="panel-body">
              {(analytics?.capacity_warnings?.length ?? 0) === 0 ? (
                <div className="empty-panel">All rooms have sufficient capacity</div>
              ) : (
                analytics?.capacity_warnings.map((w, i) => (
                  <div key={i} className="warning-item">
                    <span className="warning-label">{shortCourse(w.exam)} in {w.room}</span>
                    <span className="warning-nums">{w.students} / {w.capacity}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Room usage */}
          <div className="panel">
            <div className="panel-header">
              <span className="panel-title">Room Usage</span>
            </div>
            <div className="panel-body">
              {analytics?.room_usage?.map((r, i) => (
                <div key={i} className="warning-item">
                  <span className="warning-label">{r.room}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--indigo-600)" }}>
                    {r.count} exam{r.count !== 1 ? "s" : ""}
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
