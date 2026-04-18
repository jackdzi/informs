"""
Clear all schedule versions from the DB and import two new ones:
  - "Balanced"              → balanced_schedule.json
  - "Student Overlap Only"  → exam_schedule_student_overlap_only.json

Run from the backend/ directory:
    python reset_schedules.py

Rooms, exams, and students are left untouched.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from sqlmodel import Session, select, delete as sql_delete

from app.database import create_db_and_tables, engine
from app.models import Exam, Room, Schedule, ScheduleVersion
from import_data import import_schedule

BASE = Path(__file__).resolve().parent.parent  # decisionlab26/

SCHEDULES = [
    {
        "json_path": BASE / "balanced_schedule.json",
        "version_name": "Balanced",
    },
    {
        "json_path": BASE / "schedule_overlap_only.json",
        "version_name": "Student Overlap Only",
    },
]


def main():
    create_db_and_tables()

    with Session(engine) as session:
        # ── Step 1: delete all existing schedule assignments and versions ──
        deleted_schedules = session.exec(sql_delete(Schedule)).rowcount
        deleted_versions  = session.exec(sql_delete(ScheduleVersion)).rowcount
        session.flush()
        print(f"Cleared {deleted_schedules} schedule rows and {deleted_versions} version(s).")

        # ── Step 2: rebuild lookup maps from existing DB records ───────────
        room_map = {
            (r.building, r.name): r.id
            for r in session.exec(select(Room)).all()
        }
        crn_to_exam = {
            e.crn: e.id
            for e in session.exec(select(Exam)).all()
            if e.crn is not None
        }
        print(f"Found {len(room_map)} rooms and {len(crn_to_exam)} exams in DB.")

        # ── Step 3: import each new schedule ──────────────────────────────
        for cfg in SCHEDULES:
            json_path = cfg["json_path"]
            if not json_path.exists():
                print(f"  SKIPPING '{cfg['version_name']}' — file not found: {json_path}")
                continue
            print(f"\nImporting '{cfg['version_name']}' from {json_path.name} ...")
            import_schedule(session, str(json_path), crn_to_exam, room_map, cfg["version_name"])

        session.commit()
        print("\nDone. The following versions are now in the database:")
        for v in session.exec(select(ScheduleVersion)).all():
            print(f"  [{v.id}] {v.name}")


if __name__ == "__main__":
    main()
