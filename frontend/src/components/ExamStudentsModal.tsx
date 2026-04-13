import { useEffect, useState } from "react";
import { StudentInfo } from "../types";
import { API } from "../helpers";

export function ExamStudentsModal({
  examId,
  examName,
  onClose,
  onStudentClick,
}: {
  examId: number;
  examName: string;
  onClose: () => void;
  onStudentClick: (student: StudentInfo) => void;
}) {
  const [students, setStudents] = useState<StudentInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/schedules/exams/${examId}/students`)
      .then((r) => r.json())
      .then((data) => { setStudents(Array.isArray(data) ? data : []); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [examId]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div className="modal-header">
          <div>
            <h3>{examName}</h3>
            <div className="modal-subtitle">{students.length} enrolled student{students.length !== 1 ? "s" : ""}</div>
          </div>
          <button className="drawer-close" onClick={onClose} style={{ fontSize: 26 }}>×</button>
        </div>
        <div className="modal-body">
          {loading ? (
            <div style={{ textAlign: "center", color: "var(--slate-400)", padding: "32px 0" }}>Loading…</div>
          ) : students.length === 0 ? (
            <div style={{ textAlign: "center", color: "var(--slate-400)", padding: "32px 0" }}>No students found.</div>
          ) : (
            <div className="modal-student-list">
              {students.map((s) => (
                <button
                  key={s.id}
                  className="modal-student-row modal-student-clickable"
                  onClick={() => onStudentClick(s)}
                >
                  <div className="student-card-avatar" style={{ width: 32, height: 32, fontSize: 11, flexShrink: 0 }}>
                    {s.name ? s.name.split(" ").map((n) => n[0]).join("").slice(0, 2) : "#"}
                  </div>
                  <span className="modal-student-id">
                    {s.name ?? `Student #${s.person_id ?? s.id}`}
                  </span>
                  {s.email && <span className="modal-student-email">{s.email}</span>}
                  <span className="modal-student-nav">View schedule ›</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
