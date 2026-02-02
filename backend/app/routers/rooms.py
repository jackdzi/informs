from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from ..database import get_session
from ..models import Room, RoomCreate

router = APIRouter(prefix="/rooms", tags=["rooms"])


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
