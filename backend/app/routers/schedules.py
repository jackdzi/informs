from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from ..database import get_session
from ..models import (
    Exam,
    Room,
    Schedule,
    ScheduleCreate,
    Student,
    StudentExam,
    TimeSlot,
    TimeSlotCreate,
)

router = APIRouter(prefix="/schedules", tags=["schedules"])


# --- TimeSlots ---


@router.get("/timeslots", response_model=list[TimeSlot])
def list_timeslots(session: Session = Depends(get_session)):
    return session.exec(select(TimeSlot)).all()


@router.post("/timeslots", response_model=TimeSlot, status_code=201)
def create_timeslot(body: TimeSlotCreate, session: Session = Depends(get_session)):
    ts = TimeSlot.model_validate(body)
    session.add(ts)
    session.commit()
    session.refresh(ts)
    return ts


@router.delete("/timeslots/{timeslot_id}", status_code=204)
def delete_timeslot(timeslot_id: int, session: Session = Depends(get_session)):
    ts = session.get(TimeSlot, timeslot_id)
    if not ts:
        raise HTTPException(404, "TimeSlot not found")
    session.delete(ts)
    session.commit()


# --- Schedules ---


@router.get("/", response_model=list[Schedule])
def list_schedules(session: Session = Depends(get_session)):
    return session.exec(select(Schedule)).all()


@router.get("/detailed")
def list_schedules_detailed(session: Session = Depends(get_session)):
    schedules = session.exec(select(Schedule)).all()
    result = []
    for s in schedules:
        exam = session.get(Exam, s.exam_id)
        room = session.get(Room, s.room_id)
        timeslot = session.get(TimeSlot, s.timeslot_id)
        result.append({
            "id": s.id,
            "exam": exam.model_dump() if exam else None,
            "room": room.model_dump() if room else None,
            "timeslot": timeslot.model_dump() if timeslot else None,
        })
    return result


@router.post("/", response_model=Schedule, status_code=201)
def create_schedule(body: ScheduleCreate, session: Session = Depends(get_session)):
    if not session.get(Exam, body.exam_id):
        raise HTTPException(404, "Exam not found")
    if not session.get(Room, body.room_id):
        raise HTTPException(404, "Room not found")
    if not session.get(TimeSlot, body.timeslot_id):
        raise HTTPException(404, "TimeSlot not found")
    schedule = Schedule.model_validate(body)
    session.add(schedule)
    session.commit()
    session.refresh(schedule)
    return schedule


@router.put("/{schedule_id}", response_model=Schedule)
def update_schedule(schedule_id: int, body: ScheduleCreate, session: Session = Depends(get_session)):
    schedule = session.get(Schedule, schedule_id)
    if not schedule:
        raise HTTPException(404, "Schedule not found")
    schedule.exam_id = body.exam_id
    schedule.room_id = body.room_id
    schedule.timeslot_id = body.timeslot_id
    session.add(schedule)
    session.commit()
    session.refresh(schedule)
    return schedule


@router.delete("/{schedule_id}", status_code=204)
def delete_schedule(schedule_id: int, session: Session = Depends(get_session)):
    schedule = session.get(Schedule, schedule_id)
    if not schedule:
        raise HTTPException(404, "Schedule not found")
    session.delete(schedule)
    session.commit()


# --- Bulk save ---


@router.put("/bulk")
def bulk_save_schedules(items: list[ScheduleCreate], session: Session = Depends(get_session)):
    existing = session.exec(select(Schedule)).all()
    for s in existing:
        session.delete(s)
    session.flush()

    created = []
    for item in items:
        s = Schedule.model_validate(item)
        session.add(s)
        session.flush()
        session.refresh(s)
        created.append(s)
    session.commit()
    return created


# --- Students ---


@router.get("/students")
def list_students(session: Session = Depends(get_session)):
    return session.exec(select(Student)).all()


@router.get("/students/{student_id}/schedule")
def get_student_schedule(student_id: int, session: Session = Depends(get_session)):
    student = session.get(Student, student_id)
    if not student:
        raise HTTPException(404, "Student not found")

    enrollments = session.exec(
        select(StudentExam).where(StudentExam.student_id == student_id)
    ).all()
    exam_ids = {e.exam_id for e in enrollments}

    schedules = session.exec(select(Schedule)).all()
    result = []
    for s in schedules:
        if s.exam_id in exam_ids:
            exam = session.get(Exam, s.exam_id)
            room = session.get(Room, s.room_id)
            timeslot = session.get(TimeSlot, s.timeslot_id)
            result.append({
                "id": s.id,
                "exam": exam.model_dump() if exam else None,
                "room": room.model_dump() if room else None,
                "timeslot": timeslot.model_dump() if timeslot else None,
            })

    return {
        "student": student.model_dump(),
        "schedules": result,
        "enrolled_exam_ids": list(exam_ids),
    }


# --- Conflicts ---


@router.get("/conflicts")
def get_conflicts(session: Session = Depends(get_session)):
    schedules = session.exec(select(Schedule)).all()
    enrollments = session.exec(select(StudentExam)).all()
    students = session.exec(select(Student)).all()
    exams = session.exec(select(Exam)).all()
    timeslots = session.exec(select(TimeSlot)).all()

    student_map = {s.id: s for s in students}
    exam_map = {e.id: e for e in exams}
    ts_map = {t.id: t for t in timeslots}

    exam_to_ts: dict[int, int] = {}
    for s in schedules:
        exam_to_ts[s.exam_id] = s.timeslot_id

    student_exams: dict[int, list[int]] = defaultdict(list)
    for se in enrollments:
        student_exams[se.student_id].append(se.exam_id)

    conflicts = []
    seen = set()
    for sid, eids in student_exams.items():
        ts_exams: dict[int, list[int]] = defaultdict(list)
        for eid in eids:
            if eid in exam_to_ts:
                ts_exams[exam_to_ts[eid]].append(eid)

        for tsid, conflicting_eids in ts_exams.items():
            if len(conflicting_eids) > 1:
                key = (sid, tsid)
                if key not in seen:
                    seen.add(key)
                    student = student_map.get(sid)
                    ts = ts_map.get(tsid)
                    conflicts.append({
                        "student": student.model_dump() if student else None,
                        "timeslot": ts.model_dump() if ts else None,
                        "exams": [exam_map[e].model_dump() for e in conflicting_eids if e in exam_map],
                    })

    return {
        "total_conflicts": len(conflicts),
        "conflicts": conflicts,
    }


# --- Analytics ---


@router.get("/analytics")
def get_analytics(session: Session = Depends(get_session)):
    schedules = session.exec(select(Schedule)).all()
    rooms = session.exec(select(Room)).all()
    exams = session.exec(select(Exam)).all()
    timeslots = session.exec(select(TimeSlot)).all()
    enrollments = session.exec(select(StudentExam)).all()
    students = session.exec(select(Student)).all()

    room_map = {r.id: r for r in rooms}
    exam_map = {e.id: e for e in exams}

    exam_to_ts: dict[int, int] = {}
    for s in schedules:
        exam_to_ts[s.exam_id] = s.timeslot_id

    student_exams: dict[int, list[int]] = defaultdict(list)
    for se in enrollments:
        student_exams[se.student_id].append(se.exam_id)

    conflict_count = 0
    affected_students = set()
    for sid, eids in student_exams.items():
        ts_exams: dict[int, list[int]] = defaultdict(list)
        for eid in eids:
            if eid in exam_to_ts:
                ts_exams[exam_to_ts[eid]].append(eid)
        for tsid, ceids in ts_exams.items():
            if len(ceids) > 1:
                conflict_count += 1
                affected_students.add(sid)

    room_usage: dict[int, int] = defaultdict(int)
    for s in schedules:
        room_usage[s.room_id] += 1

    capacity_warnings = []
    for s in schedules:
        exam = exam_map.get(s.exam_id)
        room = room_map.get(s.room_id)
        if exam and room and exam.student_count > room.capacity:
            capacity_warnings.append({
                "exam": exam.course_name,
                "students": exam.student_count,
                "room": room.name,
                "capacity": room.capacity,
            })

    scheduled_ids = set(exam_to_ts.keys())
    return {
        "total_exams": len(exams),
        "scheduled_exams": len(scheduled_ids),
        "total_rooms": len(rooms),
        "total_students": len(students),
        "total_timeslots": len(timeslots),
        "conflict_count": conflict_count,
        "affected_students": len(affected_students),
        "capacity_warnings": capacity_warnings,
        "room_usage": [
            {"room": room_map[rid].name, "count": c}
            for rid, c in sorted(room_usage.items())
            if rid in room_map
        ],
    }
