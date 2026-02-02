from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from ..database import get_session
from ..models import Exam, ExamCreate

router = APIRouter(prefix="/exams", tags=["exams"])


@router.get("/", response_model=list[Exam])
def list_exams(session: Session = Depends(get_session)):
    return session.exec(select(Exam)).all()


@router.post("/", response_model=Exam, status_code=201)
def create_exam(body: ExamCreate, session: Session = Depends(get_session)):
    exam = Exam.model_validate(body)
    session.add(exam)
    session.commit()
    session.refresh(exam)
    return exam


@router.get("/{exam_id}", response_model=Exam)
def get_exam(exam_id: int, session: Session = Depends(get_session)):
    exam = session.get(Exam, exam_id)
    if not exam:
        raise HTTPException(404, "Exam not found")
    return exam


@router.put("/{exam_id}", response_model=Exam)
def update_exam(exam_id: int, body: ExamCreate, session: Session = Depends(get_session)):
    exam = session.get(Exam, exam_id)
    if not exam:
        raise HTTPException(404, "Exam not found")
    for key, val in body.model_dump().items():
        setattr(exam, key, val)
    session.add(exam)
    session.commit()
    session.refresh(exam)
    return exam


@router.delete("/{exam_id}", status_code=204)
def delete_exam(exam_id: int, session: Session = Depends(get_session)):
    exam = session.get(Exam, exam_id)
    if not exam:
        raise HTTPException(404, "Exam not found")
    session.delete(exam)
    session.commit()
