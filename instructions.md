# First time

docker compose up --build

# After that

docker compose up

# Restart just the backend

docker compose restart backend

## For importing the backend, cd into backend directory and run:

python import_data.py \
    --schedule  ../past_group_work/2023-2024/Schedule2023.csv \
    --students  ../past_group_work/2023-2024/StudentRegistration2023.csv \
    --rooms     ../past_group_work/2023-2024/Class_Info2023.csv \
    --exam-json ../exam_schedule_optimized.json \
    --version   "Fall 2023 Optimized" \
    --duration  120
