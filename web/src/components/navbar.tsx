import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  UserCircle,
  SignOut,
  User,
  UsersThree,
} from "@phosphor-icons/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { apiUrl } from "@/lib/api";

export type NavPage = "users" | "profile";

export function Navbar() {
  const { user, token, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const isAdmin = user?.role === "admin";

  const currentPage: NavPage = location.pathname.startsWith("/users")
    ? "users"
    : "profile";

  if (!user) return null;

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center px-4 md:px-8">
        <div className="flex items-center gap-2">
          <Link
            to={isAdmin ? "/users" : "/profile"}
            className="flex items-center gap-1.5 text-base font-semibold tracking-tight"
          >
            <span className="flex size-7 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
              T
            </span>
            <span>Temple</span>
          </Link>
        </div>

        <nav className="flex flex-1 items-center justify-center gap-1">
          {isAdmin && (
            <Button
              variant="ghost"
              size="sm"
              asChild
              className={cn(
                currentPage === "users" && "bg-muted text-foreground"
              )}
            >
              <Link to="/users">
                <UsersThree size={16} weight={currentPage === "users" ? "fill" : "regular"} />
                Users
              </Link>
            </Button>
          )}
        </nav>

        <div className="flex items-center">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                {user.avatar_url ? (
                  <img
                    src={apiUrl(`/api/avatars/${user.avatar_url.split("/").pop()}`)}
                    alt={user.name}
                    className="size-7 rounded-full object-cover"
                    onError={(e) => { e.currentTarget.style.display = "none"; }}
                  />
                ) : (
                  <UserCircle size={24} weight="light" />
                )}
                <span className="sr-only">Account menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-medium leading-none">{user.name}</p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {user.email}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="cursor-pointer" onSelect={() => navigate("/profile")}>
                <User size={16} />
                Profile
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="cursor-pointer text-destructive focus:text-destructive"
                onSelect={async (e) => {
                  e.preventDefault();
                  await logout();
                }}
              >
                <SignOut size={16} />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
