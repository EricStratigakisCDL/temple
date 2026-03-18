from fastapi import APIRouter, Depends, HTTPException, Query

from backend.db.helpers import (
    execute as _db_execute,
    fetch_all as _db_fetch_all,
    fetch_one as _db_fetch_one,
    insert_returning as _db_insert_returning,
)
from backend.routers.auth import get_current_user, _hash_password, VALID_ROLES
from backend.schemas.users import CreateUserRequest, UpdateUserRequest


router = APIRouter()


def _find_user_by_email(email: str) -> dict | None:
    return _db_fetch_one(
        "SELECT * FROM users WHERE lower(email) = lower(%s)", (email,)
    )


@router.get("/api/users")
async def list_users(
    current_user: dict = Depends(get_current_user),
    role: str = Query(default=""),
):
    if current_user["role"] not in ("admin", "manager"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    if role:
        rows = _db_fetch_all(
            "SELECT id, email, name, role, status, avatar_url, created_at FROM users WHERE role = %s ORDER BY id",
            (role,),
        )
    else:
        rows = _db_fetch_all(
            "SELECT id, email, name, role, status, avatar_url, created_at FROM users ORDER BY id"
        )
    return rows


@router.post("/api/users")
async def create_user(
    body: CreateUserRequest,
    current_user: dict = Depends(get_current_user),
):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only admins can create users")

    if body.role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail="Invalid role")

    existing = _find_user_by_email(body.email)
    if existing:
        raise HTTPException(
            status_code=409, detail="A user with this email already exists"
        )

    user = _db_insert_returning(
        "INSERT INTO users (email, password, name, role) VALUES (%s, %s, %s, %s) "
        "RETURNING id, email, name, role, status, created_at",
        (body.email.strip(), _hash_password(body.password), body.name.strip(), body.role),
    )
    return user


@router.put("/api/users/{user_id}")
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
        params.append(_hash_password(body.password))
    if body.name is not None:
        updates.append("name = %s")
        params.append(body.name.strip())
    if body.role is not None:
        if body.role not in VALID_ROLES:
            raise HTTPException(status_code=400, detail="Invalid role")
        updates.append("role = %s")
        params.append(body.role)
    if body.status is not None:
        if body.status not in ("active", "disabled"):
            raise HTTPException(status_code=400, detail="Invalid status")
        updates.append("status = %s")
        params.append(body.status)

    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    params.append(user_id)
    user = _db_insert_returning(
        f"UPDATE users SET {', '.join(updates)} WHERE id = %s "
        f"RETURNING id, email, name, role, status, created_at",
        tuple(params),
    )
    return user


@router.delete("/api/users/{user_id}")
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
