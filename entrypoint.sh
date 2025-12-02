#!/bin/sh
set -e
python3 /app/init_db.py
exec "$@"