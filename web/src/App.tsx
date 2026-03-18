import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import LoginPage from "@/pages/LoginPage";
import SignupPage from "@/pages/SignupPage";
import AwaitingApprovalPage from "@/pages/AwaitingApprovalPage";
import DashboardLayout from "@/layouts/DashboardLayout";
import UsersPage from "@/pages/UsersPage";
import ProfilePage from "@/pages/ProfilePage";

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (user) {
    if (user.role === "new") {
      return <Navigate to="/awaiting-approval" replace />;
    }
    const target = user.role === "admin" ? "/users" : "/profile";
    return <Navigate to={target} replace />;
  }

  return <>{children}</>;
}

function NewUserGuard() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "new") {
    const target = user.role === "admin" ? "/users" : "/profile";
    return <Navigate to={target} replace />;
  }

  return <AwaitingApprovalPage />;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<AuthGuard><LoginPage /></AuthGuard>} />
      <Route path="/signup" element={<AuthGuard><SignupPage /></AuthGuard>} />
      <Route path="/awaiting-approval" element={<NewUserGuard />} />
      <Route element={<DashboardLayout />}>
        <Route path="users" element={<UsersPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route index element={<DefaultRedirect />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function DefaultRedirect() {
  const { user } = useAuth();
  if (user?.role === "new") return <Navigate to="/awaiting-approval" replace />;
  const target = user?.role === "admin" ? "/users" : "/profile";
  return <Navigate to={target} replace />;
}

export default App;
