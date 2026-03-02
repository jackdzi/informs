from pathlib import Path

from sqlmodel import Session, SQLModel, create_engine, select

DB_PATH = Path(__file__).resolve().parent.parent / "informs.db"
engine = create_engine(f"sqlite:///{DB_PATH}", echo=False)


def create_db_and_tables():
    SQLModel.metadata.create_all(engine)


def get_session():
    with Session(engine) as session:
        yield session


def seed_data():
    from .models import Exam, Room, Schedule, ScheduleVersion, Student, StudentExam, TimeSlot

    with Session(engine) as session:
        if session.exec(select(Room)).first():
            return

        rooms = [
            Room(name="Room 101", capacity=120, building="Science Hall"),
            Room(name="Room 202", capacity=80, building="Science Hall"),
            Room(name="Auditorium A", capacity=300, building="Main Building"),
            Room(name="Room 305", capacity=50, building="Engineering"),
            Room(name="Lab 110", capacity=40, building="Engineering"),
            Room(name="Room 401", capacity=200, building="Liberal Arts"),
            Room(name="Room 150", capacity=60, building="Business School"),
            Room(name="Lecture Hall B", capacity=250, building="Main Building"),
        ]
        for r in rooms:
            session.add(r)
        session.flush()

        exams = [
            Exam(course_name="CS 101 - Intro to Programming", student_count=110, duration_minutes=120),
            Exam(course_name="MATH 201 - Linear Algebra", student_count=75, duration_minutes=90),
            Exam(course_name="PHYS 101 - Physics I", student_count=200, duration_minutes=120),
            Exam(course_name="ENG 102 - English Composition", student_count=45, duration_minutes=90),
            Exam(course_name="CHEM 301 - Organic Chemistry", student_count=35, duration_minutes=120),
            Exam(course_name="BUS 201 - Accounting", student_count=55, duration_minutes=90),
            Exam(course_name="CS 301 - Algorithms", student_count=60, duration_minutes=120),
            Exam(course_name="MATH 101 - Calculus I", student_count=180, duration_minutes=120),
            Exam(course_name="HIST 101 - World History", student_count=150, duration_minutes=90),
            Exam(course_name="BIO 201 - Genetics", student_count=70, duration_minutes=90),
        ]
        for e in exams:
            session.add(e)
        session.flush()

        # 2 weeks of timeslots: May 11-22, 2026
        dates = [f"2026-05-{d:02d}" for d in range(11, 23) if (d - 11) % 7 < 5]  # weekdays
        slot_times = [
            ("08:00", "10:00"),
            ("10:30", "12:30"),
            ("13:30", "15:30"),
            ("16:00", "18:00"),
        ]
        for date in dates:
            for start, end in slot_times:
                session.add(TimeSlot(start_time=start, end_time=end, date=date))
        session.flush()

        # Students with overlapping enrollments to create conflicts
        students_data = [
            ("Alice Chen", "achen@univ.edu", [1, 2, 8]),
            ("Bob Martinez", "bmart@univ.edu", [1, 3, 7]),
            ("Carol Williams", "cwill@univ.edu", [2, 4, 9]),
            ("David Kim", "dkim@univ.edu", [3, 5, 10]),
            ("Emma Johnson", "ejohn@univ.edu", [1, 6, 8]),
            ("Frank Brown", "fbrown@univ.edu", [2, 7, 9]),
            ("Grace Lee", "glee@univ.edu", [3, 4, 8]),
            ("Henry Davis", "hdavis@univ.edu", [5, 6, 10]),
            ("Ivy Wilson", "iwilson@univ.edu", [1, 4, 7]),
            ("Jack Taylor", "jtaylor@univ.edu", [2, 3, 5]),
            ("Karen Moore", "kmoore@univ.edu", [6, 8, 9]),
            ("Liam Anderson", "lander@univ.edu", [1, 5, 9]),
            ("Mia Thomas", "mthomas@univ.edu", [3, 7, 10]),
            ("Noah Jackson", "njack@univ.edu", [2, 6, 8]),
            ("Olivia White", "owhite@univ.edu", [4, 5, 7]),
            ("Pete Harris", "pharris@univ.edu", [1, 3, 9]),
            ("Quinn Clark", "qclark@univ.edu", [2, 8, 10]),
            ("Ruby Lewis", "rlewis@univ.edu", [4, 6, 7]),
            ("Sam Robinson", "srobin@univ.edu", [1, 5, 10]),
            ("Tina Walker", "twalker@univ.edu", [3, 6, 9]),
        ]
        for name, email, exam_ids in students_data:
            s = Student(name=name, email=email)
            session.add(s)
            session.flush()
            assert s.id is not None
            for eid in exam_ids:
                session.add(StudentExam(student_id=s.id, exam_id=eid))

        # Create default schedule version
        default_version = ScheduleVersion(name="Default Schedule", active=True)
        session.add(default_version)
        session.flush()
        assert default_version.id is not None

        # Schedule some exams in the same timeslots to create conflicts
        schedules = [
            Schedule(exam_id=1, room_id=1, timeslot_id=1, version_id=default_version.id),
            Schedule(exam_id=2, room_id=2, timeslot_id=1, version_id=default_version.id),
            Schedule(exam_id=3, room_id=3, timeslot_id=2, version_id=default_version.id),
            Schedule(exam_id=4, room_id=4, timeslot_id=5, version_id=default_version.id),
            Schedule(exam_id=5, room_id=5, timeslot_id=6, version_id=default_version.id),
            Schedule(exam_id=6, room_id=7, timeslot_id=9, version_id=default_version.id),
            Schedule(exam_id=7, room_id=2, timeslot_id=10, version_id=default_version.id),
            Schedule(exam_id=8, room_id=8, timeslot_id=1, version_id=default_version.id),
            Schedule(exam_id=9, room_id=6, timeslot_id=13, version_id=default_version.id),
            Schedule(exam_id=10, room_id=4, timeslot_id=14, version_id=default_version.id),
        ]
        for s in schedules:
            session.add(s)

        session.commit()
