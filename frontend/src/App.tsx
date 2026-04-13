import { useEffect, useState, useRef, useCallback } from "react";
import "./styles.css";
import { DetailedSchedule, TimeSlot, Conflict, Analytics, StudentInfo, ScheduleVersion, RoomDetailed } from "./types";
import { API } from "./helpers";
import { CalendarGrid, OpenSlot } from "./components/CalendarGrid";
import { AnalyticsPanel } from "./components/AnalyticsPanel";
import { ConflictModal } from "./components/ConflictModal";
import { VersionSelector } from "./components/VersionSelector";
import { StudentsPage } from "./components/StudentsPage";
import { StudentDetailView } from "./components/StudentDetailView";
import { ExamStudentsModal } from "./components/ExamStudentsModal";
import { UnscheduledModal } from "./components/UnscheduledModal";
import { RescheduleModal } from "./components/RescheduleModal";
import { RoomsPage } from "./components/RoomsPage";

type Page = "exams" | "students" | "rooms";

export default function App() {
  const [page, setPage] = useState<Page>("exams");
  const [schedules, setSchedules] = useState<DetailedSchedule[]>([]);
  const [timeslots, setTimeslots] = useState<TimeSlot[]>([]);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [week, setWeek] = useState(0);
  const [students, setStudents] = useState<StudentInfo[]>([]);
  const [roomsDetailed, setRoomsDetailed] = useState<RoomDetailed[]>([]);
  const [versions, setVersions] = useState<ScheduleVersion[]>([]);
  const [activeVersionId, setActiveVersionId] = useState<number>(1);

  // Student detail navigation
  const [selectedStudent, setSelectedStudent] = useState<StudentInfo | null>(null);
  const [studentReturnPage, setStudentReturnPage] = useState<Page>("students");
  const [studentReturnLabel, setStudentReturnLabel] = useState("All Students");

  // Drawer + exam students modal (lifted so they survive navigation)
  const [openSlot, setOpenSlot] = useState<OpenSlot | null>(null);
  const [examModal, setExamModal] = useState<{ examId: number; examName: string } | null>(null);
  const [showUnscheduled, setShowUnscheduled] = useState(false);
  const [includeNoExam, setIncludeNoExam] = useState(false);
  const [rescheduleTarget, setRescheduleTarget] = useState<DetailedSchedule | null>(null);

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

  const fetchAnalytics = useCallback(() => {
    fetch(`${API}/schedules/analytics?${vParam}&include_no_exam=${includeNoExam}`)
      .then((r) => r.json())
      .then(setAnalytics)
      .catch(console.error);
  }, [vParam, includeNoExam]);

  const fetchData = useCallback((showLoading = false) => {
    if (showLoading) setLoading(true);
    Promise.all([
      fetch(`${API}/schedules/detailed?${vParam}`).then((r) => r.json()),
      fetch(`${API}/schedules/timeslots`).then((r) => r.json()),
      fetch(`${API}/schedules/conflicts?${vParam}`).then((r) => r.json()),
      fetch(`${API}/schedules/analytics?${vParam}&include_no_exam=${includeNoExam}`).then((r) => r.json()),
      fetch(`${API}/schedules/students`).then((r) => r.json()),
      fetch(`${API}/rooms/detailed?${vParam}`).then((r) => r.json()),
    ])
      .then(([s, t, c, a, st, rd]) => {
        setSchedules(s);
        setTimeslots(t);
        setConflicts(c.conflicts || []);
        setAnalytics(a);
        setStudents(Array.isArray(st) ? st : []);
        setRoomsDetailed(Array.isArray(rd) ? rd : []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [vParam]);

  useEffect(() => { fetchVersions(); }, [fetchVersions]);
  useEffect(() => { fetchData(true); }, [fetchData]);
  useEffect(() => { fetchAnalytics(); }, [fetchAnalytics]);

  useEffect(() => {
    const clearDrag = () => { draggedRef.current = null; setDraggingId(null); };
    document.addEventListener("dragend", clearDrag);
    return () => document.removeEventListener("dragend", clearDrag);
  }, []);

  // ── Navigation helpers ──

  const goToStudent = (student: StudentInfo, returnPage: Page, returnLabel: string) => {
    setSelectedStudent(student);
    setStudentReturnPage(returnPage);
    setStudentReturnLabel(returnLabel);
    // intentionally NOT clearing openSlot or examModal so they reappear on back
  };

  const goBack = () => {
    setSelectedStudent(null);
    setPage(studentReturnPage);
  };

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
        fetchData(false);
      })
      .catch((err) => {
        console.error("Failed to update schedule:", err);
        setAutoSaveStatus("error");
        setTimeout(() => setAutoSaveStatus("idle"), 2000);
        setSchedules((prev) => prev.map((s) => (s.id === dragged.id ? dragged : s)));
      });
  };

  if (loading) {
    return <div className="app"><div className="loading"><div className="loading-spinner" />Loading schedule...</div></div>;
  }

  // ── Student detail view (accessible from any page) ──
  if (selectedStudent) {
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
                onSwitch={setActiveVersionId}
                onVersionsChanged={fetchVersions}
              />
            </div>
          </div>
        </header>
        <div className="layout">
          <div className="calendar-col">
            <StudentDetailView
              student={selectedStudent}
              conflicts={conflicts}
              timeslots={timeslots}
              versionId={activeVersionId}
              backLabel={studentReturnLabel}
              onBack={goBack}
              onDragStart={handleExamDragStart}
              onDrop={handleExamDrop}
              draggingId={draggingId}
              onReschedule={(s) => setRescheduleTarget(s)}
            />
          </div>
        </div>
      </div>
    );
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
              onSwitch={setActiveVersionId}
              onVersionsChanged={fetchVersions}
            />
            <nav className="header-nav">
              <button className={`header-nav-btn ${page === "exams" ? "active" : ""}`} onClick={() => setPage("exams")}>
                Exams
              </button>
              <button className={`header-nav-btn ${page === "students" ? "active" : ""}`} onClick={() => setPage("students")}>
                Students
              </button>
              <button className={`header-nav-btn ${page === "rooms" ? "active" : ""}`} onClick={() => setPage("rooms")}>
                Rooms
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
              <div className="stat-card stat-card-toggle">
                <label className="no-exam-toggle">
                  <input
                    type="checkbox"
                    checked={includeNoExam}
                    onChange={(e) => setIncludeNoExam(e.target.checked)}
                  />
                  <span>Include No-Exam</span>
                </label>
              </div>
            </div>

            <div className="section-title">
              <h2>Exam Calendar</h2>
              <button className="unscheduled-btn" onClick={() => setShowUnscheduled(true)}>
                {(analytics?.total_exams ?? 0) - (analytics?.scheduled_exams ?? 0)} unscheduled
              </button>
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
              openSlot={openSlot}
              setOpenSlot={setOpenSlot}
              onExamClick={(s) => setExamModal({
                examId: s.exam?.id ?? 0,
                examName: s.exam?.course_name ?? "Exam",
              })}
              onMoveClick={(s) => setRescheduleTarget(s)}
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
              onStudentClick={(s) => goToStudent(s, "students", "All Students")}
            />
          </div>
        </div>
      )}

      {page === "rooms" && (
        <div className="layout">
          <div className="calendar-col">
            <RoomsPage rooms={roomsDetailed} />
          </div>
        </div>
      )}

      {rescheduleTarget && (
        <RescheduleModal
          schedule={rescheduleTarget}
          versionId={activeVersionId}
          onClose={() => setRescheduleTarget(null)}
          onRescheduled={() => fetchData(false)}
        />
      )}

      {showUnscheduled && (
        <UnscheduledModal
          versionId={activeVersionId}
          includeNoExam={includeNoExam}
          onClose={() => setShowUnscheduled(false)}
          onScheduled={() => fetchData(false)}
        />
      )}

      {conflictModal && (
        <ConflictModal
          slotKey={conflictModal.key}
          items={conflictModal.items}
          onClose={() => setConflictModal(null)}
        />
      )}

      {examModal && (
        <ExamStudentsModal
          examId={examModal.examId}
          examName={examModal.examName}
          onClose={() => setExamModal(null)}
          onStudentClick={(s) => goToStudent(s, "exams", "Exam Calendar")}
        />
      )}
    </div>
  );
}
