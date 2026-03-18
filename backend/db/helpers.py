import psycopg2.extras

from backend.db.connection import get_connection


def fetch_one(sql: str, params: tuple | None = None) -> dict | None:
    conn = get_connection()
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(sql, params)
        row = cur.fetchone()
        conn.commit()
        return dict(row) if row else None
    finally:
        conn.close()


def fetch_all(sql: str, params: tuple | None = None) -> list[dict]:
    conn = get_connection()
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(sql, params)
        rows = cur.fetchall()
        conn.commit()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def execute(sql: str, params: tuple | None = None) -> int:
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(sql, params)
        count = cur.rowcount
        conn.commit()
        return count
    finally:
        conn.close()


def insert_returning(sql: str, params: tuple | None = None) -> dict | None:
    conn = get_connection()
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(sql, params)
        row = cur.fetchone()
        conn.commit()
        return dict(row) if row else None
    finally:
        conn.close()
