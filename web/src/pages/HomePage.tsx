import { useAuth } from "@/contexts/AuthContext";

export default function HomePage() {
  const { user } = useAuth();

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-10">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Welcome, {user?.name?.split(" ")[0]}
          </h1>
          <p className="mt-2 text-muted-foreground">
            This is Temple — a kitchen-sink fullstack template that
            demonstrates the standard architecture pattern.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-lg border bg-card p-6">
            <h3 className="font-semibold">Auth & Users</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              JWT login, role-based guards, profile with avatar upload.
            </p>
          </div>
          <div className="rounded-lg border bg-card p-6">
            <h3 className="font-semibold">CRUD Items</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Full create / read / update / delete example with status filtering.
            </p>
          </div>
          <div className="rounded-lg border bg-card p-6">
            <h3 className="font-semibold">Dark Mode</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              System-aware theme toggle. Press <kbd className="rounded border bg-muted px-1.5 py-0.5 text-xs">D</kbd> to switch.
            </p>
          </div>
          <div className="rounded-lg border bg-card p-6">
            <h3 className="font-semibold">PostgreSQL</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Docker Compose Postgres 16 with seed data and migration support.
            </p>
          </div>
          <div className="rounded-lg border bg-card p-6">
            <h3 className="font-semibold">FastAPI Backend</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Python backend with auto-reload, CORS, and structured routes.
            </p>
          </div>
          <div className="rounded-lg border bg-card p-6">
            <h3 className="font-semibold">Vite + React</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              React 19, TypeScript, Tailwind 4, shadcn/ui, and Radix primitives.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
