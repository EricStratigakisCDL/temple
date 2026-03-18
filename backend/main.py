from backend.db.connection import get_connection, seed_db
from pydantic import BaseModel
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Query, File, UploadFile
import psycopg2.extras
import psycopg2
import jwt
import json
import os
import sys
import time
import uuid
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv

_project_root = Path(__file__).resolve().parent.parent
for _env_candidate in (".env.local", ".env"):
    _env_file = _project_root / _env_candidate
    if _env_file.exists():
        load_dotenv(_env_file)
        break

_backend_dir = Path(__file__).resolve().parent
sys.path.insert(0, str(_backend_dir.parent))
sys.path.insert(0, str(_backend_dir))

IS_LOCAL = os.environ.get("IS_LOCAL", "").lower() in ("true", "1", "yes")


@asynccontextmanager
async def lifespan(app: FastAPI):
    seed_db()
    yield


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

router = APIRouter()

JWT_SECRET = os.environ.get("JWT_SECRET", "temple-dev-secret-change-in-prod")
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_SECONDS = 60 * 60 * 8

_revoked_tokens: set[str] = set()


# ── DB helpers ────────────────────────────────────────────────

def _db_fetch_one(sql: str, params: tuple | None = None) -> dict | None:
    conn = get_connection()
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(sql, params)
        row = cur.fetchone()
        conn.commit()
        return dict(row) if row else None
    finally:
        conn.close()


def _db_fetch_all(sql: str, params: tuple | None = None) -> list[dict]:
    conn = get_connection()
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(sql, params)
        rows = cur.fetchall()
        conn.commit()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def _db_execute(sql: str, params: tuple | None = None) -> int:
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(sql, params)
        count = cur.rowcount
        conn.commit()
        return count
    finally:
        conn.close()


def _db_insert_returning(sql: str, params: tuple | None = None) -> dict | None:
    conn = get_connection()
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(sql, params)
        row = cur.fetchone()
        conn.commit()
        return dict(row) if row else None
    finally:
        conn.close()


# ── Auth helpers ──────────────────────────────────────────────

def _find_user_by_email(email: str) -> dict | None:
    return _db_fetch_one("SELECT * FROM users WHERE lower(email) = lower(%s)", (email,))


def _create_token(user: dict) -> str:
    payload = {
        "sub": str(user["id"]),
        "email": user["email"],
        "role": user["role"],
        "name": user["name"],
        "iat": int(time.time()),
        "exp": int(time.time()) + JWT_EXPIRY_SECONDS,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


security = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    token = credentials.credentials
    if token in _revoked_tokens:
        raise HTTPException(status_code=401, detail="Token has been revoked")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    return payload


# ── Request models ────────────────────────────────────────────

class LoginRequest(BaseModel):
    email: str
    password: str


class CreateUserRequest(BaseModel):
    email: str
    password: str
    name: str
    role: str = "reviewer"


class UpdateUserRequest(BaseModel):
    email: str | None = None
    password: str | None = None
    name: str | None = None
    role: str | None = None


class CreateItemRequest(BaseModel):
    title: str
    description: str | None = None
    status: str = "active"


class UpdateItemRequest(BaseModel):
    title: str | None = None
    description: str | None = None
    status: str | None = None


# ── Root & Health ─────────────────────────────────────────────

@router.get("/")
async def root():
    return {"message": "Temple API"}


@router.get("/health")
async def health():
    return {"message": "ok"}


# ── Auth ──────────────────────────────────────────────────────

@router.post("/auth/login")
async def login(body: LoginRequest):
    user = _find_user_by_email(body.email)
    if not user or user["password"] != body.password:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = _create_token(user)
    return {
        "token": token,
        "user": {
            "id": user["id"],
            "email": user["email"],
            "name": user["name"],
            "role": user["role"],
            "avatar_url": user.get("avatar_url"),
        },
    }


@router.post("/auth/logout")
async def logout(
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    _revoked_tokens.add(credentials.credentials)
    return {"message": "Logged out"}


@router.get("/auth/me")
async def me(current_user: dict = Depends(get_current_user)):
    user = _db_fetch_one(
        "SELECT id, email, name, role, avatar_url FROM users WHERE id = %s",
        (int(current_user["sub"]),),
    )
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


# ── Users ─────────────────────────────────────────────────────

@router.get("/users")
async def list_users(
    current_user: dict = Depends(get_current_user),
    role: str = Query(default=""),
):
    if current_user["role"] not in ("admin", "manager"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    if role:
        rows = _db_fetch_all(
            "SELECT id, email, name, role, avatar_url, created_at FROM users WHERE role = %s ORDER BY id",
            (role,),
        )
    else:
        rows = _db_fetch_all(
            "SELECT id, email, name, role, avatar_url, created_at FROM users ORDER BY id"
        )
    return rows


@router.post("/users")
async def create_user(
    body: CreateUserRequest,
    current_user: dict = Depends(get_current_user),
):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only admins can create users")
    if body.role not in ("admin", "manager", "reviewer"):
        raise HTTPException(status_code=400, detail="Invalid role")
    existing = _find_user_by_email(body.email)
    if existing:
        raise HTTPException(status_code=409, detail="A user with this email already exists")
    user = _db_insert_returning(
        "INSERT INTO users (email, password, name, role) VALUES (%s, %s, %s, %s) "
        "RETURNING id, email, name, role, created_at",
        (body.email.strip(), body.password, body.name.strip(), body.role),
    )
    return user


@router.put("/users/{user_id}")
async def update_user(
    user_id: int,
    body: UpdateUserRequest,
    current_user: dict = Depends(get_current_user),
):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only admins can update users")
    existing = _db_fetch_one("SELECT id FROM users WHERE id = %s", (user_id,))
    if not existing:
        raise HTTPException(status_code=404, detail="User not found")

    updates = []
    params: list = []
    if body.email is not None:
        dup = _db_fetch_one(
            "SELECT id FROM users WHERE lower(email) = lower(%s) AND id != %s",
            (body.email, user_id),
        )
        if dup:
            raise HTTPException(status_code=409, detail="Email already in use")
        updates.append("email = %s")
        params.append(body.email.strip())
    if body.password is not None:
        updates.append("password = %s")
        params.append(body.password)
    if body.name is not None:
        updates.append("name = %s")
        params.append(body.name.strip())
    if body.role is not None:
        if body.role not in ("admin", "manager", "reviewer"):
            raise HTTPException(status_code=400, detail="Invalid role")
        updates.append("role = %s")
        params.append(body.role)

    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    params.append(user_id)
    user = _db_insert_returning(
        f"UPDATE users SET {', '.join(updates)} WHERE id = %s "
        f"RETURNING id, email, name, role, created_at",
        tuple(params),
    )
    return user


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: int,
    current_user: dict = Depends(get_current_user),
):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only admins can delete users")
    if int(current_user["sub"]) == user_id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    existing = _db_fetch_one("SELECT id FROM users WHERE id = %s", (user_id,))
    if not existing:
        raise HTTPException(status_code=404, detail="User not found")
    _db_execute("DELETE FROM users WHERE id = %s", (user_id,))
    return {"message": "User deleted"}


# ── Profile ───────────────────────────────────────────────────

@router.get("/api/profile")
async def get_profile(current_user: dict = Depends(get_current_user)):
    user_id = int(current_user["sub"])
    user = _db_fetch_one(
        "SELECT id, email, name, role, avatar_url, created_at FROM users WHERE id = %s",
        (user_id,),
    )
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {"user": user}


@router.post("/api/profile/avatar")
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}
    MAX_IMAGE_SIZE = 8 * 1024 * 1024

    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="File must be JPEG, PNG, GIF, or WebP")
    contents = await file.read()
    if len(contents) > MAX_IMAGE_SIZE:
        raise HTTPException(status_code=400, detail="File too large (max 8 MB)")

    user_id = int(current_user["sub"])
    ext = file.filename.rsplit(".", 1)[-1].lower() if file.filename and "." in file.filename else "jpg"
    if ext not in ("jpg", "jpeg", "png", "gif", "webp"):
        ext = "jpg"

    filename = f"{uuid.uuid4().hex}.{ext}"
    avatars_dir = Path(__file__).resolve().parent / "avatars"
    avatars_dir.mkdir(exist_ok=True)
    avatar_path = avatars_dir / filename
    avatar_path.write_bytes(contents)

    avatar_url = f"/api/avatars/{filename}"
    _db_execute("UPDATE users SET avatar_url = %s WHERE id = %s", (avatar_url, user_id))
    return {"avatar_url": avatar_url}


@router.get("/api/avatars/{filename}")
async def get_avatar(filename: str):
    avatars_dir = Path(__file__).resolve().parent / "avatars"
    avatar_path = avatars_dir / filename
    if not avatar_path.exists():
        raise HTTPException(status_code=404, detail="Avatar not found")

    data = avatar_path.read_bytes()
    ext = filename.rsplit(".", 1)[-1].lower()
    content_type_map = {
        "jpg": "image/jpeg", "jpeg": "image/jpeg",
        "png": "image/png", "gif": "image/gif", "webp": "image/webp",
    }
    content_type = content_type_map.get(ext, "image/jpeg")
    return Response(
        content=data,
        media_type=content_type,
        headers={"Cache-Control": "public, max-age=3600"},
    )


# ── Items (kitchen-sink CRUD example) ────────────────────────

@router.get("/api/items")
async def list_items(
    current_user: dict = Depends(get_current_user),
    status: str = Query(default=""),
):
    if status:
        rows = _db_fetch_all(
            "SELECT * FROM items WHERE status = %s ORDER BY updated_at DESC",
            (status,),
        )
    else:
        rows = _db_fetch_all("SELECT * FROM items ORDER BY updated_at DESC")
    return rows


@router.post("/api/items")
async def create_item(
    body: CreateItemRequest,
    current_user: dict = Depends(get_current_user),
):
    owner_id = int(current_user["sub"])
    if body.status not in ("active", "archived", "draft"):
        raise HTTPException(status_code=400, detail="Invalid status")
    item = _db_insert_returning(
        """
        INSERT INTO items (title, description, status, owner_id)
        VALUES (%s, %s, %s, %s)
        RETURNING *
        """,
        (body.title.strip(), body.description, body.status, owner_id),
    )
    return item


@router.get("/api/items/{item_id}")
async def get_item(
    item_id: int,
    current_user: dict = Depends(get_current_user),
):
    item = _db_fetch_one(
        """
        SELECT i.*, u.name AS owner_name
        FROM items i
        LEFT JOIN users u ON u.id = i.owner_id
        WHERE i.id = %s
        """,
        (item_id,),
    )
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return item


@router.put("/api/items/{item_id}")
async def update_item(
    item_id: int,
    body: UpdateItemRequest,
    current_user: dict = Depends(get_current_user),
):
    existing = _db_fetch_one("SELECT id FROM items WHERE id = %s", (item_id,))
    if not existing:
        raise HTTPException(status_code=404, detail="Item not found")

    updates = []
    params: list = []
    if body.title is not None:
        updates.append("title = %s")
        params.append(body.title.strip())
    if body.description is not None:
        updates.append("description = %s")
        params.append(body.description)
    if body.status is not None:
        if body.status not in ("active", "archived", "draft"):
            raise HTTPException(status_code=400, detail="Invalid status")
        updates.append("status = %s")
        params.append(body.status)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    params.append(item_id)
    item = _db_insert_returning(
        f"UPDATE items SET {', '.join(updates)} WHERE id = %s RETURNING *",
        tuple(params),
    )
    return item


@router.delete("/api/items/{item_id}")
async def delete_item(
    item_id: int,
    current_user: dict = Depends(get_current_user),
):
    existing = _db_fetch_one("SELECT id, owner_id FROM items WHERE id = %s", (item_id,))
    if not existing:
        raise HTTPException(status_code=404, detail="Item not found")
    user_id = int(current_user["sub"])
    if existing["owner_id"] != user_id and current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only the owner or an admin can delete this item")
    _db_execute("DELETE FROM items WHERE id = %s", (item_id,))
    return {"message": "Item deleted"}


# ── Mount router ──────────────────────────────────────────────

base_path = os.environ.get("IDP_BASE_PATH", "").rstrip("/")
if base_path:
    app.include_router(router, prefix=base_path)
else:
    app.include_router(router)
