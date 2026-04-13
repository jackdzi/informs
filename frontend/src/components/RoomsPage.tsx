import { useState, useMemo } from "react";
import { RoomDetailed } from "../types";
import { formatTime } from "../helpers";

const DUMMY_ROOMS: Record<string, { label: string; parts: string[] }> = {
  "1": { label: "HRZ AMP + KCK 100", parts: ["HRZ Ampitheatre", "KCK 100"] },
  "2": { label: "DCH 1055 + HRG 100", parts: ["DCH 1055", "HRG 100"] },
  "3": { label: "HRZ 210 + HRZ 212", parts: ["HRZ 210", "HRZ 212"] },
};


export function RoomsPage({ rooms }: { rooms: RoomDetailed[] }) {
  const [showDummyHelp, setShowDummyHelp] = useState(false);
  const [search, setSearch] = useState("");
  const [expandedRoom, setExpandedRoom] = useState<number | null>(null);
  const [hideEmpty, setHideEmpty] = useState(false);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return rooms.filter((rd) => {
      if (hideEmpty && rd.schedules.length === 0) return false;
      if (!q) return true;
      return (
        rd.room.building.toLowerCase().includes(q) ||
        rd.room.name.toLowerCase().includes(q)
      );
    });
  }, [rooms, search, hideEmpty]);

  // Group by building
  const byBuilding = useMemo(() => {
    const map = new Map<string, RoomDetailed[]>();
    for (const rd of filtered) {
      const b = rd.room.building;
      if (!map.has(b)) map.set(b, []);
      map.get(b)!.push(rd);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const totalRooms = rooms.length;
  const usedRooms = rooms.filter((r) => r.schedules.length > 0).length;

  return (
    <div className="rooms-page">
      <div className="rooms-toolbar">
        <div className="section-title" style={{ marginBottom: 0 }}>
          <h2>Rooms</h2>
          <span className="stat-secondary">{usedRooms} of {totalRooms} in use</span>
        </div>
        <div className="rooms-toolbar-right">
          <label className="no-exam-toggle">
            <input type="checkbox" checked={hideEmpty} onChange={(e) => setHideEmpty(e.target.checked)} />
            <span>Hide empty rooms</span>
          </label>
          <input
            className="search-input"
            style={{ width: 220 }}
            placeholder="Search building or room…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {byBuilding.length === 0 && (
        <div className="suggest-loading">No rooms match your search.</div>
      )}

      {byBuilding.map(([building, rdList]) => (
        <div key={building} className="building-group">
          <div className="building-header">
            <span className="building-name">
              {building === "dummy" ? "Combined Rooms" : building}
              {building === "dummy" && (
                <span className="dummy-help-wrap">
                  <button
                    className="dummy-help-btn"
                    onClick={() => setShowDummyHelp((v) => !v)}
                    title="What are combined rooms?"
                  >?</button>
                  {showDummyHelp && (
                    <div className="dummy-help-popup">
                      <button className="dummy-help-close" onClick={() => setShowDummyHelp(false)}>×</button>
                      <strong>Combined (Dummy) Rooms</strong>
                      <p>These virtual rooms represent two physical rooms used together for large exams that exceed any single room&apos;s capacity. The optimizer assigns oversized exams here and blocks both physical rooms from simultaneous use.</p>
                      <ul>
                        <li><strong>Combined 1</strong> = HRZ Amphitheatre + KCK 100</li>
                        <li><strong>Combined 2</strong> = DCH 1055 + HRG 100</li>
                        <li><strong>Combined 3</strong> = HRZ 210 + HRZ 212</li>
                      </ul>
                    </div>
                  )}
                </span>
              )}
            </span>
            <span className="building-meta">
              {rdList.filter((r) => r.schedules.length > 0).length} / {rdList.length} rooms used
            </span>
          </div>
          <div className="room-cards">
            {rdList.map((rd) => {
              const used = rd.schedules.length;
              const isExpanded = expandedRoom === rd.room.id;
              const isEmpty = used === 0;
              return (
                <div
                  key={rd.room.id}
                  className={`room-card${isEmpty ? " room-card-empty" : ""}${isExpanded ? " room-card-expanded" : ""}`}
                >
                  <button
                    className="room-card-header"
                    onClick={() => setExpandedRoom(isExpanded ? null : rd.room.id)}
                    disabled={isEmpty}
                  >
                    <div className="room-card-title">
                      <span className="room-name">
                        {rd.room.building === "dummy" && DUMMY_ROOMS[rd.room.name]
                          ? `Combined ${rd.room.name} (${DUMMY_ROOMS[rd.room.name].label})`
                          : rd.room.name}
                      </span>
                      <span className="room-capacity">{rd.room.capacity} seats</span>
                    </div>
                    <div className="room-card-right">
                      {!isEmpty && (
                        <div className="room-util-bar" title={`${used} exam${used !== 1 ? "s" : ""} scheduled`}>
                          <div className="room-util-fill" style={{ width: `${Math.min(100, (used / 5) * 100)}%` }} />
                        </div>
                      )}
                      <span className={`room-used-count${isEmpty ? " room-used-zero" : ""}`}>
                        {isEmpty ? "empty" : `${used} exam${used !== 1 ? "s" : ""}`}
                      </span>
                      {!isEmpty && <span className="room-chevron">{isExpanded ? "▴" : "▾"}</span>}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="room-schedule-list">
                      {rd.schedules.map((entry) => {
                        const ts = entry.timeslot;
                        const d = ts ? new Date(ts.date + "T00:00:00") : null;
                        const dateStr = d
                          ? d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
                          : "—";
                        const timeStr = ts ? `${formatTime(ts.start_time)} – ${formatTime(ts.end_time)}` : "—";
                        const overCap = entry.exam && entry.exam.student_count > rd.room.capacity;
                        return (
                          <div key={entry.schedule_id} className="room-schedule-row">
                            <div className="room-schedule-datetime">
                              <span className="room-sched-date">{dateStr}</span>
                              <span className="room-sched-time">{timeStr}</span>
                            </div>
                            <div className="room-schedule-exam">
                              <span className="room-sched-course">{entry.exam?.course_name ?? "—"}</span>
                              <span className={`room-sched-count${overCap ? " cap-warn" : ""}`}>
                                {entry.exam?.student_count ?? 0} students
                                {overCap && " ⚠"}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
