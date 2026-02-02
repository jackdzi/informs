import { Analytics, Conflict } from "../types";
import { formatTime, shortCourse, formatDate, groupConflicts } from "../helpers";

// Donut chart using SVG
function DonutChart({ value, total, label, color }: { value: number; total: number; label: string; color: string }) {
  const pct = total > 0 ? value / total : 0;
  const r = 40;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct);
  return (
    <div className="donut-chart">
      <svg viewBox="0 0 100 100" className="donut-svg">
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--slate-100)" strokeWidth="10" />
        <circle
          cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="10"
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transform: "rotate(-90deg)", transformOrigin: "50% 50%", transition: "stroke-dashoffset 0.6s ease" }}
        />
        <text x="50" y="46" textAnchor="middle" className="donut-value">{value}</text>
        <text x="50" y="60" textAnchor="middle" className="donut-total">/ {total}</text>
      </svg>
      <div className="donut-label">{label}</div>
    </div>
  );
}

export function AnalyticsPanel({
  analytics, conflicts, onConflictClick,
}: {
  analytics: Analytics;
  conflicts: Conflict[];
  onConflictClick: (key: string, items: Conflict[]) => void;
}) {
  const conflictGroups = groupConflicts(conflicts);

  return (
    <div className="analytics-panel">
      {/* Visual summary row */}
      <div className="analytics-donuts">
        <DonutChart
          value={analytics.scheduled_exams}
          total={analytics.total_exams}
          label="Scheduled"
          color="var(--indigo-500)"
        />
        <DonutChart
          value={analytics.total_exams - analytics.scheduled_exams}
          total={analytics.total_exams}
          label="Unscheduled"
          color="var(--amber-600)"
        />
        <DonutChart
          value={analytics.conflict_count}
          total={analytics.conflict_count + (analytics.total_exams - analytics.conflict_count)}
          label="Conflicts"
          color="var(--red-500)"
        />
      </div>

      {/* Conflicts by timeslot */}
      {conflictGroups.length > 0 && (
        <div className="analytics-section">
          <div className="analytics-section-title">
            Conflicts by Timeslot
            <span className="panel-badge danger" style={{ marginLeft: 8 }}>{conflicts.length}</span>
          </div>
          {conflictGroups.map(([key, items]) => {
            const [date, start, end] = key.split("|");
            const label = `${formatDate(date)} ${formatTime(start)} – ${formatTime(end)}`;
            const examNames = [...new Set(items.flatMap((c) => c.exams.map((e) => e.course_name)))];
            return (
              <div
                key={key}
                className="conflict-group clickable"
                onClick={() => onConflictClick(key, items)}
              >
                <div className="conflict-group-header">
                  <span className="conflict-group-time">{label}</span>
                  <span className="panel-badge danger">{items.length} student{items.length !== 1 ? "s" : ""}</span>
                </div>
                <div className="conflict-group-exams">
                  {examNames.map((name) => (
                    <span key={name} className="conflict-group-exam">{shortCourse(name)}</span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
