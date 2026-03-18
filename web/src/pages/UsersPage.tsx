import { useCallback, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  UserPlus,
  PencilSimple,
  Trash,
  SpinnerGap,
  ShieldCheck,
  UserCircle,
  Eye,
  EyeSlash,
  CheckCircle,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { apiUrl } from "@/lib/api";

interface UserRecord {
  id: number;
  email: string;
  name: string;
  role: "admin" | "manager" | "reviewer" | "new";
  status: "active" | "disabled";
  created_at: string;
}

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  manager: "Manager",
  reviewer: "Reviewer",
  new: "New",
};

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-red-100 text-red-800",
  manager: "bg-blue-100 text-blue-800",
  reviewer: "bg-green-100 text-green-800",
  new: "bg-amber-100 text-amber-800",
};

const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-800",
  disabled: "bg-gray-100 text-gray-500",
};

type ModalMode = "create" | "edit";

export default function UsersPage() {
  const { token, logout, user: currentUser } = useAuth();
  const queryClient = useQueryClient();

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>("create");
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<UserRecord | null>(null);
  const [approveLoading, setApproveLoading] = useState<number | null>(null);

  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formName, setFormName] = useState("");
  const [formRole, setFormRole] = useState("reviewer");
  const [formStatus, setFormStatus] = useState("active");
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const {
    data: users = [],
    isLoading,
    isError,
  } = useQuery<UserRecord[]>({
    queryKey: ["all-users"],
    queryFn: async () => {
      const res = await fetch(apiUrl("/api/users"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        await logout();
        throw new Error("Session expired");
      }
      if (!res.ok) throw new Error("Failed to load users");
      return res.json();
    },
    enabled: !!token,
  });

  const newUsers = users.filter((u) => u.role === "new");
  const approvedUsers = users.filter((u) => u.role !== "new");

  const openCreate = useCallback(() => {
    setModalMode("create");
    setEditingUser(null);
    setFormEmail("");
    setFormPassword("");
    setFormName("");
    setFormRole("reviewer");
    setFormStatus("active");
    setFormError("");
    setShowPassword(false);
    setModalOpen(true);
  }, []);

  const openEdit = useCallback((u: UserRecord) => {
    setModalMode("edit");
    setEditingUser(u);
    setFormEmail(u.email);
    setFormPassword("");
    setFormName(u.name);
    setFormRole(u.role);
    setFormStatus(u.status);
    setFormError("");
    setShowPassword(false);
    setModalOpen(true);
  }, []);

  const handleQuickApprove = useCallback(async (userId: number, role: string) => {
    setApproveLoading(userId);
    try {
      const res = await fetch(apiUrl(`/api/users/${userId}`), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ role }),
      });
      if (res.status === 401) {
        await logout();
        return;
      }
      if (!res.ok) return;
      queryClient.invalidateQueries({ queryKey: ["all-users"] });
    } finally {
      setApproveLoading(null);
    }
  }, [token, logout, queryClient]);

  const handleSave = useCallback(async () => {
    setFormError("");

    if (!formName.trim()) {
      setFormError("Name is required");
      return;
    }
    if (!formEmail.trim()) {
      setFormError("Email is required");
      return;
    }
    if (modalMode === "create" && !formPassword) {
      setFormError("Password is required");
      return;
    }

    setIsSaving(true);
    try {
      if (modalMode === "create") {
        const res = await fetch(apiUrl("/api/users"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            email: formEmail.trim(),
            password: formPassword,
            name: formName.trim(),
            role: formRole,
          }),
        });
        if (res.status === 401) {
          await logout();
          return;
        }
        if (!res.ok) {
          const err = await res.json().catch(() => ({ detail: "Failed to create user" }));
          setFormError(err.detail ?? "Failed to create user");
          return;
        }
      } else if (editingUser) {
        const body: Record<string, string> = {
          email: formEmail.trim(),
          name: formName.trim(),
          role: formRole,
          status: formStatus,
        };
        if (formPassword) {
          body.password = formPassword;
        }
        const res = await fetch(apiUrl(`/api/users/${editingUser.id}`), {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(body),
        });
        if (res.status === 401) {
          await logout();
          return;
        }
        if (!res.ok) {
          const err = await res.json().catch(() => ({ detail: "Failed to update user" }));
          setFormError(err.detail ?? "Failed to update user");
          return;
        }
      }

      queryClient.invalidateQueries({ queryKey: ["all-users"] });
      setModalOpen(false);
    } finally {
      setIsSaving(false);
    }
  }, [modalMode, editingUser, formEmail, formPassword, formName, formRole, formStatus, token, logout, queryClient]);

  const handleDelete = useCallback(async () => {
    if (!deleteConfirmUser) return;
    setIsDeleting(true);
    try {
      const res = await fetch(apiUrl(`/api/users/${deleteConfirmUser.id}`), {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        await logout();
        return;
      }
      if (!res.ok) return;
      queryClient.invalidateQueries({ queryKey: ["all-users"] });
      setDeleteConfirmUser(null);
    } finally {
      setIsDeleting(false);
    }
  }, [deleteConfirmUser, token, logout, queryClient]);

  if (currentUser?.role !== "admin") {
    return (
      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-6">
        <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
          <ShieldCheck size={48} weight="light" className="text-muted-foreground/40" />
          <p className="text-lg font-medium">Access Denied</p>
          <p className="text-sm text-muted-foreground">
            Only administrators can manage users.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Users</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage user accounts and roles.
          </p>
        </div>
        <Button onClick={openCreate}>
          <UserPlus size={16} />
          Add User
        </Button>
      </div>

      {/* Pending Approvals */}
      {newUsers.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Awaiting Approval ({newUsers.length})
          </h2>
          <div className="overflow-hidden rounded-xl border border-amber-200 bg-amber-50/30">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-amber-200 bg-amber-50 text-left text-xs font-medium uppercase tracking-wider text-amber-800">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Signed Up</th>
                  <th className="px-4 py-3 text-right">Approve As</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-100">
                {newUsers.map((u) => (
                  <tr key={u.id} className="transition-colors hover:bg-amber-50/50">
                    <td className="px-4 py-3 font-medium">{u.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {(["reviewer", "manager", "admin"] as const).map((role) => (
                          <Button
                            key={role}
                            variant="ghost"
                            size="sm"
                            className="text-xs capitalize hover:bg-green-50 hover:text-green-700"
                            disabled={approveLoading === u.id}
                            onClick={() => handleQuickApprove(u.id, role)}
                          >
                            {approveLoading === u.id ? (
                              <SpinnerGap size={12} className="animate-spin" />
                            ) : (
                              <CheckCircle size={14} weight="bold" />
                            )}
                            {role}
                          </Button>
                        ))}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-destructive hover:text-destructive"
                          onClick={() => setDeleteConfirmUser(u)}
                        >
                          <Trash size={14} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Active Users */}
      <div>
        {newUsers.length > 0 && (
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Active Users ({approvedUsers.length})
          </h2>
        )}
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/80 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <SpinnerGap size={20} className="inline animate-spin text-muted-foreground" />
                    <span className="ml-2 text-muted-foreground">Loading users...</span>
                  </td>
                </tr>
              )}
              {isError && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-destructive">
                    Failed to load users.
                  </td>
                </tr>
              )}
              {!isLoading && !isError && approvedUsers.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                    <UserCircle size={28} weight="light" className="mx-auto mb-2" />
                    No users found.
                  </td>
                </tr>
              )}
              {!isLoading &&
                !isError &&
                approvedUsers.map((u) => (
                  <tr key={u.id} className="transition-colors hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">{u.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                          ROLE_COLORS[u.role]
                        )}
                      >
                        {ROLE_LABELS[u.role]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
                          STATUS_COLORS[u.status]
                        )}
                      >
                        {u.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          onClick={() => openEdit(u)}
                        >
                          <PencilSimple size={14} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-destructive hover:text-destructive"
                          disabled={u.id === currentUser?.id}
                          onClick={() => setDeleteConfirmUser(u)}
                        >
                          <Trash size={14} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit User Dialog */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {modalMode === "create" ? "Add User" : "Edit User"}
            </DialogTitle>
            <DialogDescription>
              {modalMode === "create"
                ? "Create a new user account."
                : `Editing ${editingUser?.name ?? "user"}.`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Name</label>
              <Input
                placeholder="Full name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Email</label>
              <Input
                type="email"
                placeholder="user@example.com"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                Password{modalMode === "edit" && " (leave blank to keep current)"}
              </label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder={modalMode === "edit" ? "Leave blank to keep" : "Password"}
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  className="pr-9"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeSlash size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Role</label>
              <Select value={formRole} onValueChange={setFormRole}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="reviewer">Reviewer</SelectItem>
                  <SelectItem value="new">New (awaiting approval)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {modalMode === "edit" && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Status</label>
                <Select value={formStatus} onValueChange={setFormStatus}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="disabled">Disabled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {formError && (
              <p className="text-sm text-destructive">{formError}</p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <SpinnerGap size={14} className="animate-spin" />}
              {modalMode === "create" ? "Create User" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deleteConfirmUser}
        onOpenChange={(open) => !open && setDeleteConfirmUser(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-medium text-foreground">
                {deleteConfirmUser?.name}
              </span>
              ? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmUser(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting && <SpinnerGap size={14} className="animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
