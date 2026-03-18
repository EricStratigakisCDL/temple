import { useCallback, useRef, useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { apiUrl } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  Camera02Icon,
  Loading03Icon,
  Mail01Icon,
  Calendar03Icon,
  AlertCircleIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

interface ProfileData {
  user: {
    id: number;
    email: string;
    name: string;
    role: string;
    avatar_url: string | null;
    created_at: string;
  };
}

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  manager: "Manager",
  reviewer: "Reviewer",
};

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  manager: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300",
  reviewer: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function ProfilePage() {
  const { token, logout, user: authUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetch(apiUrl("/api/profile"), {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        if (res.status === 401) {
          await logout();
          throw new Error("Session expired");
        }
        if (!res.ok) throw new Error("Failed to load profile");
        return res.json();
      })
      .then(setProfile)
      .catch(() => setIsError(true))
      .finally(() => setIsLoading(false));
  }, [token, logout]);

  const handleAvatarUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setUploading(true);
      try {
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch(apiUrl("/api/profile/avatar"), {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });

        if (res.status === 401) {
          await logout();
          return;
        }

        if (!res.ok) {
          const err = await res.json().catch(() => ({ detail: "Upload failed" }));
          alert(err.detail ?? "Upload failed");
          return;
        }

        const data = await res.json();

        if (authUser) {
          const updatedUser = { ...authUser, avatar_url: data.avatar_url };
          localStorage.setItem("temple_user", JSON.stringify(updatedUser));
        }

        setProfile((prev) =>
          prev
            ? { ...prev, user: { ...prev.user, avatar_url: data.avatar_url } }
            : prev
        );
      } finally {
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [token, logout, authUser]
  );

  if (isLoading) {
    return (
      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-6">
        <div className="flex flex-col items-center justify-center gap-4 py-20">
          <HugeiconsIcon icon={Loading03Icon} size={24} className="animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading profile…</p>
        </div>
      </main>
    );
  }

  if (isError || !profile) {
    return (
      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-6">
        <div className="flex flex-col items-center justify-center gap-4 py-20">
          <HugeiconsIcon icon={AlertCircleIcon} size={48} className="text-muted-foreground/40" />
          <p className="text-lg font-medium">Failed to load profile</p>
          <p className="text-sm text-muted-foreground">Please try again later.</p>
        </div>
      </main>
    );
  }

  const { user } = profile;

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-6">
      <div className="mb-8 flex flex-col items-center gap-6 sm:flex-row sm:items-start">
        <div className="group relative">
          <div className="relative size-24 overflow-hidden rounded-full border-2 border-border bg-muted">
            {user.avatar_url ? (
              <img
                src={apiUrl(`/api/avatars/${user.avatar_url.split("/").pop()}?t=${Date.now()}`)}
                alt={user.name}
                className="size-full object-cover"
                onError={(e) => { e.currentTarget.style.display = "none"; }}
              />
            ) : (
              <div className="flex size-full items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
                <span className="text-3xl font-bold text-primary/60">
                  {user.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase()
                    .slice(0, 2)}
                </span>
              </div>
            )}
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 transition-opacity group-hover:opacity-100"
          >
            {uploading ? (
              <HugeiconsIcon icon={Loading03Icon} size={20} className="animate-spin text-white" />
            ) : (
              <HugeiconsIcon icon={Camera02Icon} size={20} className="text-white" />
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            onChange={handleAvatarUpload}
            className="hidden"
          />
        </div>

        <div className="flex-1 text-center sm:text-left">
          <h1 className="text-2xl font-bold tracking-tight">{user.name}</h1>
          <div className="mt-1.5 flex flex-wrap items-center justify-center gap-3 text-sm text-muted-foreground sm:justify-start">
            <span className="flex items-center gap-1.5">
              <HugeiconsIcon icon={Mail01Icon} size={14} />
              {user.email}
            </span>
            <span className="flex items-center gap-1.5">
              <HugeiconsIcon icon={Calendar03Icon} size={14} />
              Joined {formatDate(user.created_at)}
            </span>
          </div>
          <div className="mt-2">
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                ROLE_COLORS[user.role]
              )}
            >
              {ROLE_LABELS[user.role]}
            </span>
          </div>
        </div>
      </div>
    </main>
  );
}
