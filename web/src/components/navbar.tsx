import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  UserCircleIcon,
  Logout01Icon,
  UserIcon,
  Home01Icon,
  Menu01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
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

export function Navbar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  if (!user) return null;

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center px-4 md:px-8">
        <div className="flex items-center gap-2">
          <Link
            to="/"
            className="flex items-center text-base font-semibold tracking-tight"
          >
            <img
              src="/logo.svg"
              alt="T"
              className="h-6 w-6 rounded-md"
            />
            <span className="-ml-0.5">emple</span>
          </Link>
        </div>

        <nav className="flex flex-1 items-center justify-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            asChild
            className={cn(
              location.pathname === "/" && "bg-muted text-foreground"
            )}
          >
            <NavLink to="/" end>
              <HugeiconsIcon icon={Home01Icon} size={16} />
              Home
            </NavLink>
          </Button>

          <div className="mx-1.5 h-4 w-px bg-border" />

          <Button
            variant="ghost"
            size="sm"
            asChild
            className={cn(
              location.pathname.startsWith("/items") && "bg-muted text-foreground"
            )}
          >
            <NavLink to="/items">
              <HugeiconsIcon icon={Menu01Icon} size={16} />
              Items
            </NavLink>
          </Button>
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
                  <HugeiconsIcon icon={UserCircleIcon} size={24} />
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
                <HugeiconsIcon icon={UserIcon} size={16} />
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
                <HugeiconsIcon icon={Logout01Icon} size={16} />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
