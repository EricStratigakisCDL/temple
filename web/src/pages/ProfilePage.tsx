import { useCallback, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Camera,
  SpinnerGap,
  WarningOctagon,
  Calendar,
  Envelope,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { apiUrl } from "@/lib/api";

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
  admin: "bg-red-100 text-red-800",
  manager: "bg-blue-100 text-blue-800",
  reviewer: "bg-green-100 text-green-800",
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
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const {
    data: profile,
    isLoading,
    isError,
  } = useQuery<ProfileData>({
    queryKey: ["profile"],
    queryFn: async () => {
      const res = await fetch(apiUrl("/api/profile"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        await logout();
        throw new Error("Session expired");
      }
      if (!res.ok) throw new Error("Failed to load profile");
      return res.json();
    },
    enabled: !!token,
  });

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

        queryClient.invalidateQueries({ queryKey: ["profile"] });
      } finally {
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [token, logout, queryClient, authUser]
  );

  if (isLoading) {
    return (
      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-6">
        <div className="flex flex-col items-center justify-center gap-4 py-20">
          <SpinnerGap size={24} className="animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading profile…</p>
        </div>
      </main>
    );
  }

  if (isError || !profile) {
    return (
      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-6">
        <div className="flex flex-col items-center justify-center gap-4 py-20">
          <WarningOctagon size={48} weight="light" className="text-muted-foreground/40" />
          <p className="text-lg font-medium">Failed to load profile</p>
          <p className="text-sm text-muted-foreground">Please try again later.</p>
        </div>
      </main>
    );
  }

  const { user } = profile;

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-6">
      {/* Header with avatar and user info */}
      <Card>
        <CardContent className="flex flex-col items-center gap-6 pt-6 sm:flex-row sm:items-start">
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
                <SpinnerGap size={20} className="animate-spin text-white" />
              ) : (
                <Camera size={20} weight="bold" className="text-white" />
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
                <Envelope size={14} />
                {user.email}
              </span>
              <span className="flex items-center gap-1.5">
                <Calendar size={14} />
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
        </CardContent>
      </Card>
    </main>
  );
}
