"""
Temple DB helpers — reset and connection management.

Local connection defaults to the Docker Postgres (docker-compose).
Override with env vars: DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD.

Set IS_LOCAL=true in .env to skip AWS Secrets Manager and use local creds.
"""

import argparse
import os
import sys
from contextlib import contextmanager
from pathlib import Path
import json
import psycopg2
import psycopg2.extras

from dotenv import load_dotenv

_DIR = Path(__file__).parent
_PROJECT_ROOT = _DIR.parent.parent
for _candidate in (".env.local", ".env"):
    _env_path = _PROJECT_ROOT / _candidate
    if _env_path.exists():
        load_dotenv(_env_path)
        break

IS_LOCAL = os.environ.get("IS_LOCAL", "").lower() in ("true", "1", "yes")

DB_HOST = os.environ.get("DB_HOST", "localhost")
DB_PORT = os.environ.get("DB_PORT", "5435")
DB_NAME = os.environ.get("DB_NAME", "temple")
DB_USER = os.environ.get("DB_USER", "temple")

if IS_LOCAL:
    DB_PASSWORD = os.environ.get("DB_PASSWORD", "temple")
else:
    import boto3
    RDS_CREDENTIALS_SECRET_ID = os.environ["RDS_CREDENTIALS_SECRET_ID"]

    def get_rds_credentials() -> dict:
        secrets = boto3.client("secretsmanager", region_name="us-east-2")
        secret = secrets.get_secret_value(SecretId=RDS_CREDENTIALS_SECRET_ID)
        return json.loads(secret["SecretString"])

    DB_PASSWORD = get_rds_credentials()["password"]


def seed_db() -> None:
    seed_sql = (_DIR / "seed.sql").read_text()
    with _cursor() as cur:
        cur.execute(seed_sql)


def get_connection_string() -> str:
    return f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"


def get_connection():
    return psycopg2.connect(get_connection_string())


def _make_connection_string(host: str, port: str, name: str, user: str, password: str) -> str:
    return f"postgresql://{user}:{password}@{host}:{port}/{name}"


@contextmanager
def _cursor():
    conn = get_connection()
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        yield cur
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()


def reset_db() -> None:
    """Drop all tables, re-run seed.sql. Returns a clean schema with no data."""
    seed_sql = (_DIR / "seed.sql").read_text()

    with _cursor() as cur:
        cur.execute("""
            DROP TABLE IF EXISTS items               CASCADE;
            DROP TABLE IF EXISTS users               CASCADE;
            DROP FUNCTION IF EXISTS update_updated_at() CASCADE;
        """)

    with _cursor() as cur:
        cur.execute(seed_sql)

    print("DB reset complete — schema recreated, seed data applied.")


def provision_rds(
    host: str | None = None,
    port: str | None = None,
    name: str | None = None,
    user: str | None = None,
    password: str | None = None,
    *,
    skip_seed: bool = False,
    drop_existing: bool = False,
) -> None:
    """Apply seed.sql into an AWS RDS Postgres instance."""
    rds_host = host or os.environ.get("RDS_HOST", DB_HOST)
    rds_port = port or os.environ.get("RDS_PORT", DB_PORT)
    rds_name = name or os.environ.get("RDS_NAME", DB_NAME)
    rds_user = user or os.environ.get("RDS_USER", DB_USER)
    rds_password = password or os.environ.get("RDS_PASSWORD", DB_PASSWORD)

    dsn = _make_connection_string(rds_host, rds_port, rds_name, rds_user, rds_password)
    safe_dsn = _make_connection_string(rds_host, rds_port, rds_name, rds_user, "****")
    print(f"Connecting to RDS: {safe_dsn}")

    conn = psycopg2.connect(dsn)
    conn.autocommit = False

    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        if drop_existing:
            print("Dropping existing tables …")
            cur.execute("""
                DROP TABLE IF EXISTS items               CASCADE;
                DROP TABLE IF EXISTS users               CASCADE;
                DROP FUNCTION IF EXISTS update_updated_at() CASCADE;
            """)
            conn.commit()
            print("Tables dropped.")

        if not skip_seed:
            seed_sql = (_DIR / "seed.sql").read_text()
            print("Running seed.sql …")
            cur.execute(seed_sql)
            conn.commit()
            print("Seed complete — schema + seed data applied.")

        cur.close()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

    print("RDS provisioning complete.")


# ---------------------------------------------------------------------------
# CLI entry point:  python -m backend.db.connection [rds|local]
# ---------------------------------------------------------------------------

def _cli() -> None:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parent.parent / ".env")

    parser = argparse.ArgumentParser(description="Temple DB provisioning")
    sub = parser.add_subparsers(dest="command")

    rds = sub.add_parser("rds", help="Provision an AWS RDS instance with seed.sql")
    rds.add_argument("--host", default=None, help="RDS hostname (or set RDS_HOST)")
    rds.add_argument("--port", default=None, help="RDS port (or set RDS_PORT)")
    rds.add_argument("--dbname", default=None, help="Database name (or set RDS_NAME)")
    rds.add_argument("--user", default=None, help="DB user (or set RDS_USER)")
    rds.add_argument("--password", default=None, help="DB password (or set RDS_PASSWORD)")
    rds.add_argument("--drop", action="store_true", help="Drop all tables before seeding (full reset)")
    rds.add_argument("--skip-seed", action="store_true", help="Skip seed.sql")

    sub.add_parser("local", help="Reset the local Docker Postgres")

    args = parser.parse_args()

    if args.command == "rds":
        provision_rds(
            host=args.host,
            port=args.port,
            name=args.dbname,
            user=args.user,
            password=args.password,
            drop_existing=args.drop,
            skip_seed=args.skip_seed,
        )
    elif args.command == "local":
        reset_db()
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    _cli()
