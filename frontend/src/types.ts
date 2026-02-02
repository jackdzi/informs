export interface Room { id: number; name: string; capacity: number; building: string }
export interface Exam { id: number; course_name: string; student_count: number; duration_minutes: number }
export interface TimeSlot { id: number; start_time: string; end_time: string; date: string }
export interface DetailedSchedule { id: number; exam: Exam | null; room: Room | null; timeslot: TimeSlot | null }
export interface StudentInfo { id: number; name: string; email: string }
export interface Conflict { student: StudentInfo | null; timeslot: TimeSlot | null; exams: Exam[] }
export interface ScheduleVersion { id: number; name: string; active: boolean }
export interface Analytics {
  total_exams: number; scheduled_exams: number; total_rooms: number;
  total_students: number; total_timeslots: number; conflict_count: number;
  affected_students: number;
  capacity_warnings: { exam: string; students: number; room: string; capacity: number }[];
  room_usage: { room: string; count: number }[];
}
