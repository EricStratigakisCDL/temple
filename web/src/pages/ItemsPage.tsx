import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { apiUrl } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  Loading03Icon,
  AlertCircleIcon,
  Add01Icon,
  Delete02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

interface Item {
  id: number;
  title: string;
  description: string | null;
  status: string;
  owner_id: number | null;
  owner_name?: string;
  created_at: string;
  updated_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  draft: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  archived: "bg-stone-100 text-stone-600 dark:bg-stone-800/30 dark:text-stone-400",
};

export default function ItemsPage() {
  const { token, logout } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);

  const fetchItems = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(apiUrl("/api/items"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        await logout();
        return;
      }
      if (!res.ok) throw new Error("Failed to fetch items");
      const data = await res.json();
      setItems(data);
    } catch {
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  }, [token, logout]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setCreating(true);
    try {
      const res = await fetch(apiUrl("/api/items"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ title, description: description || null }),
      });
      if (res.status === 401) {
        await logout();
        return;
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Create failed" }));
        alert(err.detail ?? "Create failed");
        return;
      }
      setTitle("");
      setDescription("");
      setShowForm(false);
      await fetchItems();
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (itemId: number) => {
    if (!confirm("Delete this item?")) return;
    const res = await fetch(apiUrl(`/api/items/${itemId}`), {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 401) {
      await logout();
      return;
    }
    if (res.ok) {
      await fetchItems();
    }
  };

  if (isLoading) {
    return (
      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-6">
        <div className="flex flex-col items-center justify-center gap-4 py-20">
          <HugeiconsIcon icon={Loading03Icon} size={24} className="animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading items…</p>
        </div>
      </main>
    );
  }

  if (isError) {
    return (
      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-6">
        <div className="flex flex-col items-center justify-center gap-4 py-20">
          <HugeiconsIcon icon={AlertCircleIcon} size={48} className="text-muted-foreground/40" />
          <p className="text-lg font-medium">Failed to load items</p>
          <p className="text-sm text-muted-foreground">Please try again later.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Items</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <HugeiconsIcon icon={Add01Icon} size={16} />
          New Item
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="mb-6 space-y-3 rounded-lg border bg-card p-4">
          <input
            type="text"
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <textarea
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={creating}
              className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {creating ? "Creating…" : "Create"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="inline-flex h-9 items-center justify-center rounded-md border px-4 text-sm font-medium transition-colors hover:bg-muted"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-20">
          <p className="text-lg font-medium text-muted-foreground">No items yet</p>
          <p className="text-sm text-muted-foreground">Create your first item to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-start justify-between gap-4 rounded-lg border bg-card p-4"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium">{item.title}</h3>
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                      STATUS_COLORS[item.status]
                    )}
                  >
                    {item.status}
                  </span>
                </div>
                {item.description && (
                  <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                )}
                <p className="mt-2 text-xs text-muted-foreground">
                  Updated {new Date(item.updated_at).toLocaleDateString()}
                </p>
              </div>
              <button
                onClick={() => handleDelete(item.id)}
                className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              >
                <HugeiconsIcon icon={Delete02Icon} size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
