import { useState } from "react";
import { Conflict, StudentInfo } from "../types";

export function StudentsPage({
  students,
  conflicts,
  onStudentClick,
}: {
  students: StudentInfo[];
  conflicts: Conflict[];
  onStudentClick: (s: StudentInfo) => void;
}) {
  const [search, setSearch] = useState("");

  const filtered = students.filter((s) => {
    const q = search.toLowerCase();
    return (
      s.id.toString().includes(q) ||
      (s.person_id?.toString() ?? "").includes(q) ||
      (s.name ?? "").toLowerCase().includes(q) ||
      (s.email ?? "").toLowerCase().includes(q)
    );
  });

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
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="search-input"
        />
      </div>

      <div className="student-grid">
        {filtered.map((s) => {
          const hasConflict = conflicts.some((c) => c.student?.id === s.id);
          return (
            <button key={s.id} className="student-card" onClick={() => onStudentClick(s)}>
              <div className="student-card-avatar">
                {s.name ? s.name.split(" ").map((n) => n[0]).join("").slice(0, 2) : "#"}
              </div>
              <div className="student-card-info">
                <div className="student-card-name">{s.name ?? `Student #${s.person_id ?? s.id}`}</div>
                <div className="student-card-email">{s.email ?? ""}</div>
              </div>
              {hasConflict && <span className="student-card-conflict">Conflict</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
