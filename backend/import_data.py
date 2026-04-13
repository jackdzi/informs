"""
Import data from CSVs and the optimized exam schedule JSON into the database.

Usage:
    python import_data.py \
        --schedule Schedule2023.csv \
        --students StudentRegistration2023.csv \
        --rooms Class_Info2023.csv \
        --exam-json ../../exam_schedule_optimized.json \
        [--version "Fall 2023 Optimized"] \
        [--duration 120]
"""

import argparse
import csv
import json
import sys
from datetime import datetime
from pathlib import Path

# Make sure the app package is importable when run from backend/
sys.path.insert(0, str(Path(__file__).resolve().parent))

from sqlmodel import Session, select

from app.database import create_db_and_tables, engine
from app.models import Exam, Room, Schedule, ScheduleVersion, Student, StudentExam, TimeSlot


def parse_args():
    p = argparse.ArgumentParser(description="Import exam data into the informs database.")
    p.add_argument("--schedule", required=True, help="Schedule CSV (per-CRN class info)")
    p.add_argument("--students", required=True, help="Student registration CSV")
    p.add_argument("--rooms", required=True, help="Class info / room capacity CSV")
    p.add_argument("--exam-json", required=True, help="exam_schedule_optimized.json")
    p.add_argument("--version", default="Imported Schedule", help="Schedule version name")
    p.add_argument("--duration", type=int, default=120, help="Default exam duration in minutes")
    return p.parse_args()


# ── helpers ──────────────────────────────────────────────────────────────────

def parse_time(t) -> str:
    """Normalise various time formats to HH:MM (24-hour)."""
    t = str(t).strip()
    # e.g. 900 → '0900', 1400 → '1400'
    if t.isdigit():
        t = t.zfill(4)
        return f"{t[:2]}:{t[2:]}"
    # e.g. '09:25AM'
    for fmt in ("%I:%M%p", "%H:%M", "%H%M"):
        try:
            return datetime.strptime(t, fmt).strftime("%H:%M")
        except ValueError:
            pass
    return t  # return as-is if we can't parse


def parse_date(d: str) -> str:
    """Normalise date to YYYY-MM-DD."""
    for fmt in ("%m/%d/%Y", "%Y-%m-%d", "%m/%d/%y"):
        try:
            return datetime.strptime(d.strip(), fmt).strftime("%Y-%m-%d")
        except ValueError:
            pass
    return d.strip()


# ── import steps ─────────────────────────────────────────────────────────────

def import_rooms(session: Session, csv_path: str) -> dict[str, int]:
    """
    Import rooms from Class_Info CSV.
    Returns {(building_code, room_number) -> room_id}.
    """
    # Deduplicate: keep max capacity per (building, room)
    room_caps: dict[tuple[str, str], tuple[str, int]] = {}  # (code,room) -> (full_name, cap)
    with open(csv_path, newline="", encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            key = (row["BUILDING_CODE"].strip(), row["ROOM_NUMBER"].strip())
            cap = int(row["ROOM_CAPACITY"]) if row["ROOM_CAPACITY"].strip() else 0
            building_name = row.get("BUILDING", row["BUILDING_CODE"]).strip()
            if key not in room_caps or cap > room_caps[key][1]:
                room_caps[key] = (building_name, cap)

    room_map: dict[tuple[str, str], int] = {}
    for (code, room_num), (building_name, cap) in room_caps.items():
        existing = session.exec(
            select(Room).where(Room.building == code, Room.name == room_num)
        ).first()
        if existing:
            existing.capacity = max(existing.capacity, cap)
            room_map[(code, room_num)] = existing.id
        else:
            r = Room(name=room_num, building=code, capacity=cap)
            session.add(r)
            session.flush()
            room_map[(code, room_num)] = r.id

    session.flush()
    print(f"  Rooms: {len(room_map)} upserted")
    return room_map


def import_exams(session: Session, csv_path: str, duration_minutes: int) -> dict[int, int]:
    """
    Import exams from Schedule CSV (one row per CRN).
    Returns {crn -> exam_id}.
    """
    crn_map: dict[int, int] = {}
    with open(csv_path, newline="", encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            crn = int(row["CRN"])
            enrollment = int(row.get("SECTION_ENROLLMENT") or 0)
            course_name = (
                f"{row['SUBJECT'].strip()} {row['COURSE_NUMBER'].strip()} "
                f"§{row['SECTION'].strip()}"
            )
            existing = session.exec(select(Exam).where(Exam.crn == crn)).first()
            if existing:
                crn_map[crn] = existing.id
                continue
            exam = Exam(
                crn=crn,
                course_name=course_name,
                subject=row.get("SUBJECT", "").strip() or None,
                course_number=row.get("COURSE_NUMBER", "").strip() or None,
                section=row.get("SECTION", "").strip() or None,
                title=row.get("COURSE_TITLE", "").strip() or None,
                instructor=row.get("INSTRUCTOR", "").strip() or None,
                student_count=enrollment,
                duration_minutes=duration_minutes,
            )
            session.add(exam)
            session.flush()
            crn_map[crn] = exam.id

    session.flush()
    print(f"  Exams: {len(crn_map)} upserted")
    return crn_map


def import_students(session: Session, csv_path: str, crn_to_exam: dict[int, int]) -> None:
    """
    Import students and their exam enrollments from Student Registration CSV.
    """
    student_map: dict[int, int] = {}  # person_id -> student.id
    enrollment_pairs: set[tuple[int, int]] = set()  # (student_id, exam_id)

    with open(csv_path, newline="", encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            person_id = int(row["PERSON_IDENTIFIER"])
            crn = int(row["CRN"])

            if person_id not in student_map:
                existing = session.exec(
                    select(Student).where(Student.person_id == person_id)
                ).first()
                if existing:
                    student_map[person_id] = existing.id
                else:
                    s = Student(person_id=person_id)
                    session.add(s)
                    session.flush()
                    student_map[person_id] = s.id

            exam_id = crn_to_exam.get(crn)
            if exam_id is None:
                continue  # CRN not in schedule (e.g. no final exam)

            pair = (student_map[person_id], exam_id)
            if pair not in enrollment_pairs:
                existing_se = session.exec(
                    select(StudentExam).where(
                        StudentExam.student_id == pair[0],
                        StudentExam.exam_id == pair[1],
                    )
                ).first()
                if not existing_se:
                    session.add(StudentExam(student_id=pair[0], exam_id=pair[1]))
                enrollment_pairs.add(pair)

    session.flush()
    print(f"  Students: {len(student_map)} upserted")
    print(f"  StudentExam enrollments: {len(enrollment_pairs)} upserted")


def import_schedule(
    session: Session,
    json_path: str,
    crn_to_exam: dict[int, int],
    room_map: dict[tuple[str, str], int],
    version_name: str,
) -> None:
    """
    Import schedule assignments from exam_schedule_optimized.json.
    Creates TimeSlots as needed, then Schedule rows.
    """
    with open(json_path, encoding="utf-8") as f:
        data: dict[str, dict] = json.load(f)

    # Upsert schedule version
    version = session.exec(
        select(ScheduleVersion).where(ScheduleVersion.name == version_name)
    ).first()
    if not version:
        version = ScheduleVersion(name=version_name, active=True)
        session.add(version)
        session.flush()

    timeslot_cache: dict[tuple[str, str], int] = {}  # (date, start_time) -> timeslot_id

    def get_or_create_timeslot(date_str: str, start: str) -> int:
        key = (date_str, start)
        if key in timeslot_cache:
            return timeslot_cache[key]
        existing = session.exec(
            select(TimeSlot).where(TimeSlot.date == date_str, TimeSlot.start_time == start)
        ).first()
        if existing:
            timeslot_cache[key] = existing.id
            return existing.id
        # Assume 2-hour slots; adjust if needed
        h, m = int(start[:2]), int(start[3:])
        end_h = h + 2
        end = f"{end_h:02d}:{m:02d}"
        ts = TimeSlot(date=date_str, start_time=start, end_time=end)
        session.add(ts)
        session.flush()
        timeslot_cache[key] = ts.id
        return ts.id

    assigned = 0
    skipped_crn = 0
    skipped_room = 0

    for crn_str, info in data.items():
        crn = int(crn_str)
        exam_id = crn_to_exam.get(crn)
        if exam_id is None:
            skipped_crn += 1
            continue

        building = info["building"].strip()
        room_num = str(info["room"]).strip()
        room_id = room_map.get((building, room_num))
        if room_id is None:
            # Room not in Class_Info — create a placeholder
            r = session.exec(
                select(Room).where(Room.building == building, Room.name == room_num)
            ).first()
            if not r:
                r = Room(name=room_num, building=building, capacity=0)
                session.add(r)
                session.flush()
                room_map[(building, room_num)] = r.id
            room_id = r.id

        date_str = parse_date(info["date"])
        start_str = parse_time(info["time"])
        timeslot_id = get_or_create_timeslot(date_str, start_str)

        existing = session.exec(
            select(Schedule).where(
                Schedule.version_id == version.id,
                Schedule.exam_id == exam_id,
            )
        ).first()
        if not existing:
            session.add(
                Schedule(
                    version_id=version.id,
                    exam_id=exam_id,
                    room_id=room_id,
                    timeslot_id=timeslot_id,
                )
            )
            assigned += 1

    session.flush()
    print(f"  Schedule entries: {assigned} created")
    if skipped_crn:
        print(f"  Skipped {skipped_crn} CRNs not found in Schedule CSV")


# ── main ─────────────────────────────────────────────────────────────────────

def main():
    args = parse_args()
    create_db_and_tables()

    with Session(engine) as session:
        print("Importing rooms...")
        room_map = import_rooms(session, args.rooms)

        print("Importing exams (classes)...")
        crn_to_exam = import_exams(session, args.schedule, args.duration)

        print("Importing students and enrollments...")
        import_students(session, args.students, crn_to_exam)

        print("Importing optimized exam schedule...")
        import_schedule(session, args.exam_json, crn_to_exam, room_map, args.version)

        session.commit()
        print("Done.")


if __name__ == "__main__":
    main()
