import os
import time

import bcrypt
import jwt
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from backend.db.helpers import fetch_one as _db_fetch_one, insert_returning as _db_insert_returning
from backend.schemas.auth import LoginRequest, SignupRequest


router = APIRouter()

JWT_SECRET = os.environ.get("JWT_SECRET", "temple-dev-secret-change-in-prod")
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_SECONDS = 60 * 60 * 8

_revoked_tokens: set[str] = set()
security = HTTPBearer()

VALID_ROLES = ("admin", "manager", "reviewer", "new")


def _hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()


def _check_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode(), hashed.encode())
    except Exception:
        return False


def _find_user_by_email(email: str) -> dict | None:
    return _db_fetch_one(
        "SELECT * FROM users WHERE lower(email) = lower(%s)",
        (email,),
    )


def _user_payload(user: dict) -> dict:
    return {
        "id": user["id"],
        "email": user["email"],
        "name": user["name"],
        "role": user["role"],
        "status": user.get("status", "active"),
        "avatar_url": user.get("avatar_url"),
    }


def _create_token(user: dict) -> str:
    payload = {
        "sub": str(user["id"]),
        "email": user["email"],
        "role": user["role"],
        "name": user["name"],
        "status": user.get("status", "active"),
        "iat": int(time.time()),
        "exp": int(time.time()) + JWT_EXPIRY_SECONDS,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


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


@router.post("/auth/signup")
async def signup(body: SignupRequest):
    existing = _find_user_by_email(body.email)
    if existing:
        raise HTTPException(status_code=409, detail="An account with this email already exists")

    if len(body.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    user = _db_insert_returning(
        "INSERT INTO users (email, password, name, role, status) "
        "VALUES (%s, %s, %s, 'new', 'active') "
        "RETURNING id, email, name, role, status, avatar_url, created_at",
        (body.email.strip(), _hash_password(body.password), body.name.strip()),
    )

    token = _create_token(user)
    return {"token": token, "user": _user_payload(user)}


@router.post("/auth/login")
async def login(body: LoginRequest):
    user = _find_user_by_email(body.email)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if user.get("status") == "disabled":
        raise HTTPException(status_code=403, detail="Your account has been disabled")

    if not _check_password(body.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = _create_token(user)
    return {"token": token, "user": _user_payload(user)}


@router.post("/auth/logout")
async def logout(
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    _revoked_tokens.add(credentials.credentials)
    return {"message": "Logged out"}


@router.get("/auth/me")
async def me(current_user: dict = Depends(get_current_user)):
    user = _db_fetch_one(
        "SELECT id, email, name, role, status, avatar_url FROM users WHERE id = %s",
        (int(current_user["sub"]),),
    )
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user
