import os

import pymysql
from pymysql.cursors import DictCursor

DB_CONFIG = {
    "host": os.getenv("DB_HOST", "127.0.0.1"),
    "port": int(os.getenv("DB_PORT", "3306")),
    "user": os.getenv("DB_USER", "tdt"),
    "password": os.getenv("DB_PASSWORD", "tdt"),
    "database": os.getenv("DB_NAME", "taipei_day_trip"),
    "charset": "utf8mb4",
    "cursorclass": DictCursor,
}


def get_connection():
    return pymysql.connect(**DB_CONFIG)
