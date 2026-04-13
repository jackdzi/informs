from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from ..database import get_session
from ..models import Exam, Room, RoomCreate, Schedule, TimeSlot

router = APIRouter(prefix="/rooms", tags=["rooms"])


@router.get("/detailed")
def list_rooms_detailed(
    version_id: Optional[int] = Query(None),
    session: Session = Depends(get_session),
):
    from ..routers.schedules import _get_version_id
    vid = _get_version_id(session, version_id)

    schedules = session.exec(select(Schedule).where(Schedule.version_id == vid)).all()

    # Index schedules by room
    room_schedules: dict[int, list[dict]] = {}
    for s in schedules:
        exam = session.get(Exam, s.exam_id)
        ts = session.get(TimeSlot, s.timeslot_id)
        entry = {
            "schedule_id": s.id,
            "exam": exam.model_dump() if exam else None,
            "timeslot": ts.model_dump() if ts else None,
        }
        room_schedules.setdefault(s.room_id, []).append(entry)

    rooms = session.exec(select(Room)).all()
    result = []
    for r in rooms:
        entries = room_schedules.get(r.id, [])
        # Sort entries by date then time
        entries.sort(key=lambda e: (
            e["timeslot"]["date"] if e["timeslot"] else "",
            e["timeslot"]["start_time"] if e["timeslot"] else "",
        ))
        result.append({"room": r.model_dump(), "schedules": entries})

    # Sort: rooms with exams first, then by building + name
    result.sort(key=lambda x: (len(x["schedules"]) == 0, x["room"]["building"], x["room"]["name"]))
    return result


@router.get("/", response_model=list[Room])
def list_rooms(session: Session = Depends(get_session)):
    return session.exec(select(Room)).all()


@router.post("/", response_model=Room, status_code=201)
def create_room(body: RoomCreate, session: Session = Depends(get_session)):
    room = Room.model_validate(body)
    session.add(room)
    session.commit()
    session.refresh(room)
    return room


@router.get("/{room_id}", response_model=Room)
def get_room(room_id: int, session: Session = Depends(get_session)):
    room = session.get(Room, room_id)
    if not room:
        raise HTTPException(404, "Room not found")
    return room


@router.put("/{room_id}", response_model=Room)
def update_room(room_id: int, body: RoomCreate, session: Session = Depends(get_session)):
    room = session.get(Room, room_id)
    if not room:
        raise HTTPException(404, "Room not found")
    for key, val in body.model_dump().items():
        setattr(room, key, val)
    session.add(room)
    session.commit()
    session.refresh(room)
    return room


@router.delete("/{room_id}", status_code=204)
def delete_room(room_id: int, session: Session = Depends(get_session)):
    room = session.get(Room, room_id)
    if not room:
        raise HTTPException(404, "Room not found")
    session.delete(room)
    session.commit()
