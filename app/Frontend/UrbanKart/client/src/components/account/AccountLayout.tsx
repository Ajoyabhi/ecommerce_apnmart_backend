import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  User,
  Package,
  Heart,
  MapPin,
  CreditCard,
  RotateCcw,
  Bell,
  LogOut,
  Menu,
  X,
  ArrowLeft,
  ChevronRight,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/store/use-auth";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/account", icon: LayoutDashboard },
  { label: "My Profile", href: "/account/profile", icon: User },
  { label: "My Orders", href: "/account/orders", icon: Package },
  { label: "Wishlist", href: "/account/wishlist", icon: Heart },
  { label: "Address Book", href: "/account/addresses", icon: MapPin },
  { label: "Saved Cards", href: "/account/payments", icon: CreditCard },
  { label: "Returns & Refunds", href: "/account/returns", icon: RotateCcw },
  { label: "Notifications", href: "/account/notifications", icon: Bell },
];

export function AccountLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();

  const isActive = (href: string) => {
    if (href === "/account") return location === "/account";
    return location.startsWith(href);
  };

  const handleLogout = () => {
    logout();
    setLocation("/signin");
  };

  const activeItem = NAV_ITEMS.find((i) => isActive(i.href));

  return (
    <div className="min-h-[calc(100vh-128px)] bg-muted/30">
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-6 md:py-8">
        <div className="mb-6 flex items-center gap-2 text-sm text-muted-foreground" data-testid="breadcrumb-account">
          <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-foreground font-medium">My Account</span>
          {activeItem && activeItem.href !== "/account" && (
            <>
              <ChevronRight className="w-3.5 h-3.5" />
              <span className="text-foreground font-medium">{activeItem.label}</span>
            </>
          )}
        </div>

        <div className="flex gap-6 md:gap-8">
          <div
            className={cn(
              "fixed inset-0 z-40 bg-black/40 md:hidden transition-opacity",
              sidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none"
            )}
            onClick={() => setSidebarOpen(false)}
          />

          <aside
            className={cn(
              "fixed inset-y-0 left-0 z-50 w-72 bg-card border-r border-border flex flex-col transition-transform md:translate-x-0 md:static md:z-auto md:w-64 md:shrink-0 md:border md:rounded-2xl md:self-start md:sticky md:top-24",
              sidebarOpen ? "translate-x-0" : "-translate-x-full"
            )}
          >
            <div className="p-5 border-b border-border flex items-center gap-3">
              <div className="w-11 h-11 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
                <span className="text-primary font-bold text-lg" data-testid="text-avatar-initial">
                  {user?.firstName?.[0]?.toUpperCase() || "U"}
                </span>
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-sm truncate" data-testid="text-user-name">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="text-xs text-muted-foreground truncate" data-testid="text-user-email">{user?.email}</p>
              </div>
              <button
                className="md:hidden ml-auto p-1 hover:bg-muted rounded-lg"
                onClick={() => setSidebarOpen(false)}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
                    isActive(item.href)
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                  data-testid={`link-account-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  <item.icon className="w-[18px] h-[18px] shrink-0" />
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="px-3 py-3 border-t border-border">
              <Link
                href="/"
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <ArrowLeft className="w-[18px] h-[18px] shrink-0" />
                Continue Shopping
              </Link>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                data-testid="button-account-logout"
              >
                <LogOut className="w-[18px] h-[18px] shrink-0" />
                Sign Out
              </button>
            </div>
          </aside>

          <div className="flex-1 min-w-0">
            <div className="md:hidden mb-4">
              <button
                className="flex items-center gap-2 px-4 py-2.5 bg-card border border-border rounded-xl text-sm font-medium hover:bg-muted transition-colors"
                onClick={() => setSidebarOpen(true)}
                data-testid="button-account-menu"
              >
                <Menu className="w-4 h-4" />
                {activeItem?.label ?? "Account Menu"}
              </button>
            </div>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
