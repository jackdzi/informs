import { useEffect, useState, useRef, useCallback } from "react";
import "./styles.css";
import { DetailedSchedule, TimeSlot, Conflict, Analytics, StudentInfo, ScheduleVersion } from "./types";
import { API } from "./helpers";
import { CalendarGrid } from "./components/CalendarGrid";
import { AnalyticsPanel } from "./components/AnalyticsPanel";
import { ConflictModal } from "./components/ConflictModal";
import { VersionSelector } from "./components/VersionSelector";
import { StudentsPage } from "./components/StudentsPage";

type Page = "exams" | "students";

export default function App() {
  const [page, setPage] = useState<Page>("exams");
  const [schedules, setSchedules] = useState<DetailedSchedule[]>([]);
  const [timeslots, setTimeslots] = useState<TimeSlot[]>([]);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [week, setWeek] = useState(0);
  const [students, setStudents] = useState<StudentInfo[]>([]);
  const [versions, setVersions] = useState<ScheduleVersion[]>([]);
  const [activeVersionId, setActiveVersionId] = useState<number>(1);

  // Drag state
  const draggedRef = useRef<DetailedSchedule | null>(null);
  const [draggingId, setDraggingId] = useState<number | null>(null);

  // Conflict modal
  const [conflictModal, setConflictModal] = useState<{ key: string; items: Conflict[] } | null>(null);

  // Auto-save indicator
  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const vParam = `version_id=${activeVersionId}`;

  const fetchVersions = useCallback(() => {
    fetch(`${API}/schedules/versions`)
      .then((r) => r.json())
      .then((v) => {
        setVersions(v);
        if (v.length > 0 && !v.find((ver: ScheduleVersion) => ver.id === activeVersionId)) {
          setActiveVersionId(v[0].id);
        }
      })
      .catch(console.error);
  }, [activeVersionId]);

  const fetchData = useCallback((showLoading = false) => {
    if (showLoading) setLoading(true);
    Promise.all([
      fetch(`${API}/schedules/detailed?${vParam}`).then((r) => r.json()),
      fetch(`${API}/schedules/timeslots`).then((r) => r.json()),
      fetch(`${API}/schedules/conflicts?${vParam}`).then((r) => r.json()),
      fetch(`${API}/schedules/analytics?${vParam}`).then((r) => r.json()),
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
  }, [vParam]);

  useEffect(() => { fetchVersions(); }, [fetchVersions]);
  useEffect(() => { fetchData(true); }, [fetchData]);

  useEffect(() => {
    const clearDrag = () => { draggedRef.current = null; setDraggingId(null); };
    document.addEventListener("dragend", clearDrag);
    return () => document.removeEventListener("dragend", clearDrag);
  }, []);

  // ── Optimistic drag ──

  const applyOptimisticMove = (dragged: DetailedSchedule, newSlot: TimeSlot) => {
    const updated = { ...dragged, timeslot: newSlot };
    setSchedules((prev) => prev.map((s) => (s.id === dragged.id ? updated : s)));
  };

  const handleExamDragStart = (s: DetailedSchedule) => {
    draggedRef.current = s;
    setDraggingId(s.id);
  };

  const handleExamDrop = (date: string, timeRange: string) => {
    const dragged = draggedRef.current;
    draggedRef.current = null;
    setDraggingId(null);
    if (!dragged || !dragged.exam || !dragged.room) return;

    const [start, end] = timeRange.split("-");
    const slot = timeslots.find((t) => t.date === date && t.start_time === start && t.end_time === end);
    if (!slot || dragged.timeslot?.id === slot.id) return;

    // Optimistic
    applyOptimisticMove(dragged, slot);
    setAutoSaveStatus("saving");

    fetch(`${API}/schedules/${dragged.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ exam_id: dragged.exam.id, room_id: dragged.room.id, timeslot_id: slot.id }),
    })
      .then((r) => {
        if (!r.ok) throw new Error(`PUT failed: ${r.status}`);
        setAutoSaveStatus("saved");
        setTimeout(() => setAutoSaveStatus("idle"), 1500);
        // Sync server state for conflicts/analytics
        fetchData(false);
      })
      .catch((err) => {
        console.error("Failed to update schedule:", err);
        setAutoSaveStatus("error");
        setTimeout(() => setAutoSaveStatus("idle"), 2000);
        // Rollback
        setSchedules((prev) => prev.map((s) => (s.id === dragged.id ? dragged : s)));
      });
  };

  const handleVersionSwitch = (id: number) => {
    setActiveVersionId(id);
  };

  if (loading) {
    return <div className="app"><div className="loading"><div className="loading-spinner" />Loading schedule...</div></div>;
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
          <div className="header-right">
            <VersionSelector
              versions={versions}
              activeVersionId={activeVersionId}
              onSwitch={handleVersionSwitch}
              onVersionsChanged={fetchVersions}
            />
            <nav className="header-nav">
              <button className={`header-nav-btn ${page === "exams" ? "active" : ""}`} onClick={() => setPage("exams")}>
                Exams
              </button>
              <button className={`header-nav-btn ${page === "students" ? "active" : ""}`} onClick={() => setPage("students")}>
                Students
              </button>
            </nav>
            <div className={`autosave-indicator ${autoSaveStatus}`}>
              {autoSaveStatus === "saving" && <><div className="autosave-dot pulse" />Saving...</>}
              {autoSaveStatus === "saved" && <><div className="autosave-dot saved" />Saved</>}
              {autoSaveStatus === "error" && <><div className="autosave-dot error" />Error</>}
            </div>
          </div>
        </div>
      </header>

      {page === "exams" && (
        <div className="layout two-col">
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
              onDragStart={handleExamDragStart}
              onDrop={handleExamDrop}
              draggingId={draggingId}
            />
          </div>

          <div className="sidebar">
            {analytics && (
              <AnalyticsPanel
                analytics={analytics}
                conflicts={conflicts}
                onConflictClick={(key, items) => setConflictModal({ key, items })}
              />
            )}
          </div>
        </div>
      )}

      {page === "students" && (
        <div className="layout">
          <div className="calendar-col">
            <StudentsPage
              students={students}
              conflicts={conflicts}
              timeslots={timeslots}
              versionId={activeVersionId}
              onDragStart={handleExamDragStart}
              onDrop={handleExamDrop}
              draggingId={draggingId}
            />
          </div>
        </div>
      )}

      {conflictModal && (
        <ConflictModal
          slotKey={conflictModal.key}
          items={conflictModal.items}
          onClose={() => setConflictModal(null)}
        />
      )}
    </div>
  );
}
