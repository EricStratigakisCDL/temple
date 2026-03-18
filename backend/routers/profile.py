import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import Response

from backend.db.helpers import (
    execute as _db_execute,
    fetch_one as _db_fetch_one,
)
from backend.routers.auth import get_current_user


router = APIRouter()

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}
MAX_IMAGE_SIZE = 8 * 1024 * 1024


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
    avatars_dir = Path(__file__).resolve().parent.parent / "avatars"
    avatars_dir.mkdir(exist_ok=True)
    avatar_path = avatars_dir / filename
    avatar_path.write_bytes(contents)

    avatar_url = f"/api/avatars/{filename}"
    _db_execute("UPDATE users SET avatar_url = %s WHERE id = %s", (avatar_url, user_id))
    return {"avatar_url": avatar_url}


@router.get("/api/avatars/{filename}")
async def get_avatar(filename: str):
    avatars_dir = Path(__file__).resolve().parent.parent / "avatars"
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
