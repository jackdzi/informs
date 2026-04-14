import { useState, useEffect } from "react";
import { Exam, Suggestion } from "../types";
import { API, formatTime } from "../helpers";

const NO_EXAM = "No Final Exam";

export function UnscheduledModal({
  versionId,
  includeNoExam,
  onClose,
  onScheduled,
}: {
  versionId: number;
  includeNoExam: boolean;
  onClose: () => void;
  onScheduled: () => void;
}) {
  const [exams, setExams] = useState<Exam[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Exam | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loadingSuggest, setLoadingSuggest] = useState(false);
  const [scheduling, setScheduling] = useState<number | null>(null);
  const [noExamExpanded, setNoExamExpanded] = useState(false);

  useEffect(() => {
    fetch(`${API}/schedules/unscheduled?version_id=${versionId}&include_no_exam=${includeNoExam}`)
      .then((r) => r.json())
      .then((d) => setExams(Array.isArray(d) ? d : []))
      .catch(console.error);
  }, [versionId, includeNoExam]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") selected ? setSelected(null) : onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [selected, onClose]);

  function openSuggestions(exam: Exam) {
    setSelected(exam);
    setSuggestions([]);
    setLoadingSuggest(true);
    fetch(`${API}/schedules/suggest/${exam.id}?version_id=${versionId}`)
      .then((r) => r.json())
      .then((d) => setSuggestions(Array.isArray(d) ? d : []))
      .catch(console.error)
      .finally(() => setLoadingSuggest(false));
  }

  function scheduleExam(exam: Exam, suggestion: Suggestion) {
    if (!suggestion.room) return;
    setScheduling(suggestion.timeslot.id);
    fetch(`${API}/schedules/?version_id=${versionId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        exam_id: exam.id,
        room_id: suggestion.room.id,
        timeslot_id: suggestion.timeslot.id,
      }),
    })
      .then((r) => { if (!r.ok) throw new Error(); })
      .then(() => { onScheduled(); onClose(); })
      .catch(console.error)
      .finally(() => setScheduling(null));
  }

  const q = search.toLowerCase();
  const regularExams = exams.filter((e) => e.exam_type !== NO_EXAM && e.student_count > 0 && e.course_name.toLowerCase().includes(q));
  const noExamExams  = exams.filter((e) => e.exam_type === NO_EXAM  && e.student_count > 0 && e.course_name.toLowerCase().includes(q));

  return (
    <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal unscheduled-modal">
        <div className="modal-header">
          {selected ? (
            <div>
              <button className="back-btn" style={{ marginBottom: 6 }} onClick={() => setSelected(null)}>
                &larr; All unscheduled
              </button>
              <h3>{selected.course_name}</h3>
              <div className="modal-subtitle">
                {selected.student_count} students · top 3 slots by fewest conflicts
              </div>
            </div>
          ) : (
            <div>
              <h3>Unscheduled Exams</h3>
              <div className="modal-subtitle">
                {regularExams.length} exam{regularExams.length !== 1 ? "s" : ""} without a slot
                {includeNoExam && noExamExams.length > 0 && ` · ${noExamExams.length} no-exam courses`}
              </div>
            </div>
          )}
          <button className="drawer-close" onClick={onClose} style={{ fontSize: 26, alignSelf: "flex-start" }}>×</button>
        </div>

        <div className="modal-body">
          {selected ? (
            <SuggestionView
              exam={selected}
              suggestions={suggestions}
              loading={loadingSuggest}
              scheduling={scheduling}
              onSchedule={(s) => scheduleExam(selected, s)}
            />
          ) : (
            <>
              <div className="search-box" style={{ marginBottom: 12 }}>
                <input
                  className="search-input"
                  placeholder="Search exams…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="unscheduled-list">
                {regularExams.map((e) => (
                  <ExamRow key={e.id} exam={e} onClick={() => openSuggestions(e)} />
                ))}
                {regularExams.length === 0 && !includeNoExam && (
                  <div className="suggest-loading">All exams are scheduled.</div>
                )}
              </div>

              {includeNoExam && noExamExams.length > 0 && (
                <div className="no-exam-section">
                  <button
                    className="no-exam-toggle-header"
                    onClick={() => setNoExamExpanded((v) => !v)}
                  >
                    <span>{noExamExpanded ? "▾" : "▸"} No Final Exam courses ({noExamExams.length})</span>
                    <span className="no-exam-hint">Can be given a slot if desired</span>
                  </button>
                  {noExamExpanded && (
                    <div className="unscheduled-list" style={{ marginTop: 6 }}>
                      {noExamExams.map((e) => (
                        <ExamRow key={e.id} exam={e} onClick={() => openSuggestions(e)} dim />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ExamRow({ exam, onClick, dim }: { exam: Exam; onClick: () => void; dim?: boolean }) {
  return (
    <button className={`unscheduled-row${dim ? " unscheduled-row-dim" : ""}`} onClick={onClick}>
      <div className="unscheduled-name">{exam.course_name}</div>
      <div className="unscheduled-meta">{exam.student_count} students</div>
      <span className="suggest-open-hint">Suggest slots ›</span>
    </button>
  );
}

export function SuggestionView({
  exam,
  suggestions,
  loading,
  scheduling,
  onSchedule,
}: {
  exam: Exam;
  suggestions: Suggestion[];
  loading: boolean;
  scheduling: number | null;
  onSchedule: (s: Suggestion) => void;
}) {
  if (loading) return <div className="suggest-loading">Calculating best slots…</div>;
  if (suggestions.length === 0) return <div className="suggest-loading">No available timeslots found.</div>;

  return (
    <div className="suggest-list">
      {suggestions.map((s, i) => {
        const d = new Date(s.timeslot.date + "T00:00:00");
        const dateStr = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
        const timeStr = `${formatTime(s.timeslot.start_time)} – ${formatTime(s.timeslot.end_time)}`;
        const noRoom = !s.room;
        const overCapacity = s.room && exam.student_count > s.room.capacity;
        return (
          <div key={s.timeslot.id} className="suggest-card">
            <div className="suggest-rank">#{i + 1}</div>
            <div className="suggest-info">
              <div className="suggest-datetime">{dateStr} · {timeStr}</div>
              <div className="suggest-room">
                {noRoom ? (
                  <span className="suggest-no-room">No room available</span>
                ) : (
                  <>
                    {s.room!.building} {s.room!.name} · {s.room!.capacity} seats
                    {overCapacity && <span className="cap-warn"> (over capacity)</span>}
                  </>
                )}
              </div>
              <div className="suggest-conflicts">
                {s.conflict_count === 0
                  ? <span className="suggest-zero">0 conflicts</span>
                  : <span className="suggest-nonzero">{s.conflict_count} student conflict{s.conflict_count !== 1 ? "s" : ""}</span>
                }
              </div>
            </div>
            <button
              className="suggest-btn"
              disabled={noRoom || scheduling !== null}
              onClick={() => onSchedule(s)}
            >
              {scheduling === s.timeslot.id ? "Scheduling…" : "Schedule here"}
            </button>
          </div>
        );
      })}
    </div>
  );
}
