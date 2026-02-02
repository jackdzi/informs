import { Conflict } from "./types";

export const API = "http://localhost:8000";

export function formatTime(t: string) {
  const [h, m] = t.split(":");
  const hour = parseInt(h);
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? "PM" : "AM"}`;
}

export function shortCourse(name: string) {
  const dash = name.indexOf(" - ");
  return dash > -1 ? name.substring(0, dash) : name;
}

export function formatDate(date: string) {
  const d = new Date(date + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];

export function groupConflicts(conflicts: Conflict[]) {
  const groups: Record<string, Conflict[]> = {};
  for (const c of conflicts) {
    const key = c.timeslot
      ? `${c.timeslot.date}|${c.timeslot.start_time}|${c.timeslot.end_time}`
      : "unknown";
    (groups[key] ||= []).push(c);
  }
  return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
}
