from typing import Optional

from sqlmodel import Field, SQLModel


class Room(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    capacity: int
    building: str


class RoomCreate(SQLModel):
    name: str
    capacity: int
    building: str


class Exam(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    crn: Optional[int] = Field(default=None, unique=True, index=True)
    course_name: str
    subject: Optional[str] = None
    course_number: Optional[str] = None
    section: Optional[str] = None
    title: Optional[str] = None
    instructor: Optional[str] = None
    student_count: int
    duration_minutes: int


class ExamCreate(SQLModel):
    crn: Optional[int] = None
    course_name: str
    subject: Optional[str] = None
    course_number: Optional[str] = None
    section: Optional[str] = None
    title: Optional[str] = None
    instructor: Optional[str] = None
    student_count: int
    duration_minutes: int


class TimeSlot(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    start_time: str
    end_time: str
    date: str


class TimeSlotCreate(SQLModel):
    start_time: str
    end_time: str
    date: str


class ScheduleVersion(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    active: bool = True


class ScheduleVersionCreate(SQLModel):
    name: str


class Schedule(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    version_id: int = Field(default=1, foreign_key="scheduleversion.id")
    exam_id: int = Field(foreign_key="exam.id")
    room_id: int = Field(foreign_key="room.id")
    timeslot_id: int = Field(foreign_key="timeslot.id")


class ScheduleCreate(SQLModel):
    exam_id: int
    room_id: int
    timeslot_id: int


class Student(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    person_id: Optional[int] = Field(default=None, unique=True, index=True)
    name: Optional[str] = None
    email: Optional[str] = None


class StudentExam(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    student_id: int = Field(foreign_key="student.id")
    exam_id: int = Field(foreign_key="exam.id")
