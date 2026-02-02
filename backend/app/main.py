from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import create_db_and_tables, seed_data
from .routers import exams, rooms, schedules


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db_and_tables()
    seed_data()
    yield


app = FastAPI(title="InForms", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(rooms.router)
app.include_router(exams.router)
app.include_router(schedules.router)
