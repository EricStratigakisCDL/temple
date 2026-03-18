# temple

Kitchen-sink fullstack template app demonstrating the standard architecture pattern.

## Architecture

- **Frontend:** React 19 + TypeScript + Vite + Tailwind 4 + shadcn/ui
- **Backend:** Python FastAPI + uvicorn
- **Database:** PostgreSQL 16 (Docker Compose)
- **Auth:** JWT with role-based access (admin / manager / reviewer)

## Quick Start

```bash
# From the repos root:
./cli env              # Generate .env files
./cli db temple up     # Start Postgres
./cli install temple   # Install deps
./cli dev temple       # Start dev servers
```

Frontend: http://localhost:5177
Backend: http://localhost:8004

## Ports

| Service  | Port |
|----------|------|
| Frontend | 5177 |
| Backend  | 8004 |
| Database | 5435 |
