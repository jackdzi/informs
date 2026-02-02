import { useState, useRef, useEffect } from "react";
import { ScheduleVersion } from "../types";
import { API } from "../helpers";

export function VersionSelector({
  versions,
  activeVersionId,
  onSwitch,
  onVersionsChanged,
}: {
  versions: ScheduleVersion[];
  activeVersionId: number;
  onSwitch: (id: number) => void;
  onVersionsChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [duplicateFrom, setDuplicateFrom] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setCreating(false); }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const current = versions.find((v) => v.id === activeVersionId);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    if (duplicateFrom) {
      await fetch(`${API}/schedules/versions/${duplicateFrom}/duplicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
    } else {
      await fetch(`${API}/schedules/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
    }
    setNewName("");
    setCreating(false);
    setDuplicateFrom(null);
    onVersionsChanged();
  };

  const handleDelete = async (id: number) => {
    if (versions.length <= 1) return;
    await fetch(`${API}/schedules/versions/${id}`, { method: "DELETE" });
    if (id === activeVersionId && versions.length > 1) {
      const next = versions.find((v) => v.id !== id);
      if (next) onSwitch(next.id);
    }
    onVersionsChanged();
  };

  return (
    <div className="version-selector" ref={ref}>
      <button className="version-trigger" onClick={() => setOpen(!open)}>
        <span className="version-dot" />
        <span className="version-name">{current?.name || "Schedule"}</span>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ marginLeft: 4 }}>
          <path d="M3 5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      {open && (
        <div className="version-dropdown">
          <div className="version-dropdown-header">Schedule Versions</div>
          {versions.map((v) => (
            <div
              key={v.id}
              className={`version-option${v.id === activeVersionId ? " active" : ""}`}
            >
              <button
                className="version-option-btn"
                onClick={() => { onSwitch(v.id); setOpen(false); }}
              >
                <span className="version-dot" />
                {v.name}
              </button>
              <div className="version-option-actions">
                <button
                  className="version-action-btn"
                  title="Duplicate"
                  onClick={(e) => { e.stopPropagation(); setDuplicateFrom(v.id); setNewName(`${v.name} (copy)`); setCreating(true); }}
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="4" y="4" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.2"/><path d="M10 4V2.5A1.5 1.5 0 008.5 1h-6A1.5 1.5 0 001 2.5v6A1.5 1.5 0 002.5 10H4" stroke="currentColor" strokeWidth="1.2"/></svg>
                </button>
                {versions.length > 1 && (
                  <button
                    className="version-action-btn danger"
                    title="Delete"
                    onClick={(e) => { e.stopPropagation(); handleDelete(v.id); }}
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 4h10M5 4V2.5A.5.5 0 015.5 2h3a.5.5 0 01.5.5V4M6 6.5v3M8 6.5v3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/><path d="M3 4l.7 7.5a1.5 1.5 0 001.5 1.5h3.6a1.5 1.5 0 001.5-1.5L11 4" stroke="currentColor" strokeWidth="1.2"/></svg>
                  </button>
                )}
              </div>
            </div>
          ))}
          {creating ? (
            <div className="version-create-form">
              <input
                className="version-create-input"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") { setCreating(false); setDuplicateFrom(null); } }}
                placeholder="Version name..."
                autoFocus
              />
              <div className="version-create-actions">
                <button className="version-create-btn" onClick={handleCreate}>
                  {duplicateFrom ? "Duplicate" : "Create"}
                </button>
                <button className="version-create-cancel" onClick={() => { setCreating(false); setDuplicateFrom(null); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <button className="version-add-btn" onClick={() => { setCreating(true); setDuplicateFrom(null); setNewName(""); }}>
              + New Version
            </button>
          )}
        </div>
      )}
    </div>
  );
}
