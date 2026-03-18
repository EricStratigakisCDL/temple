import { useAuth } from "@/contexts/AuthContext";
import { HourglassMedium, SignOut, ArrowsClockwise } from "@phosphor-icons/react";
import { useState } from "react";

export default function AwaitingApprovalPage() {
  const { user, logout, refreshUser } = useAuth();
  const [checking, setChecking] = useState(false);

  async function handleCheck() {
    setChecking(true);
    try {
      await refreshUser();
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6 text-center">
        <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-amber-100">
          <HourglassMedium size={40} weight="duotone" className="text-amber-600" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">
            Awaiting Approval
          </h1>
          <p className="text-muted-foreground">
            Hi{user?.name ? ` ${user.name.split(" ")[0]}` : ""}! Your account
            has been created, but an administrator needs to approve your access
            and assign you a role before you can use Temple.
          </p>
        </div>

        <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          Signed in as <span className="font-medium text-foreground">{user?.email}</span>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            onClick={handleCheck}
            disabled={checking}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50"
          >
            <ArrowsClockwise size={16} className={checking ? "animate-spin" : ""} />
            {checking ? "Checking..." : "Check status"}
          </button>
          <button
            onClick={() => logout()}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <SignOut size={16} />
            Sign out
          </button>
        </div>

        <p className="text-xs text-muted-foreground">
          You'll be redirected automatically once your access is approved.
        </p>
      </div>
    </div>
  );
}
