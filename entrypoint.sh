#!/bin/sh
set -e

# Apply database migrations, then start the API
flask --app run db upgrade

exec gunicorn --bind 0.0.0.0:8000 --workers "${GUNICORN_WORKERS:-4}" --timeout 120 run:app
