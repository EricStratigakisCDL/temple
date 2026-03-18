import os
import sys
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.db.connection import seed_db
from backend.routers.auth import router as auth_router
from backend.routers.profile import router as profile_router
from backend.routers.users import router as users_router

_project_root = Path(__file__).resolve().parent.parent
for _env_candidate in (".env.local", ".env"):
    _env_file = _project_root / _env_candidate
    if _env_file.exists():
        load_dotenv(_env_file)
        break

_backend_dir = Path(__file__).resolve().parent
sys.path.insert(0, str(_backend_dir.parent))
sys.path.insert(0, str(_backend_dir))


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


@app.get("/")
async def root():
    return {"message": "Temple API"}


@app.get("/health")
async def health():
    return {"message": "ok"}


# ── Mount routers ─────────────────────────────────────────────

base_path = os.environ.get("IDP_BASE_PATH", "").rstrip("/")
if base_path:
    app.include_router(auth_router, prefix=base_path)
    app.include_router(profile_router, prefix=base_path)
    app.include_router(users_router, prefix=base_path)
else:
    app.include_router(auth_router)
    app.include_router(profile_router)
    app.include_router(users_router)
