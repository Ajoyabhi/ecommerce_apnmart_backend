import { AccountLayout } from "@/components/account/AccountLayout";
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from "@/hooks/use-user";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Bell,
  Package,
  Tag,
  Settings,
  RotateCcw,
  Loader2,
  CheckCheck,
  Circle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "wouter";

const TYPE_CONFIG: Record<string, { icon: typeof Bell; color: string; bg: string }> = {
  ORDER: { icon: Package, color: "text-blue-600", bg: "bg-blue-100" },
  PROMO: { icon: Tag, color: "text-green-600", bg: "bg-green-100" },
  SYSTEM: { icon: Settings, color: "text-gray-600", bg: "bg-gray-100" },
  RETURN: { icon: RotateCcw, color: "text-orange-600", bg: "bg-orange-100" },
};

export default function Notifications() {
  const { data: notifications, isLoading } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const unreadCount = notifications?.filter((n) => !n.isRead).length ?? 0;

  return (
    <AccountLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold" data-testid="text-page-title">Notifications</h1>
            <p className="text-muted-foreground text-sm mt-1">
              {unreadCount > 0 ? `${unreadCount} unread` : "All caught up!"}
            </p>
          </div>
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
              data-testid="button-mark-all-read"
            >
              <CheckCheck className="w-4 h-4 mr-1.5" />
              Mark All Read
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : !notifications ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-muted-foreground">Unable to load notifications. Please try again later.</p>
            </CardContent>
          </Card>
        ) : !notifications.length ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                <Bell className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-lg mb-1">No notifications</h3>
              <p className="text-muted-foreground text-sm">We'll notify you about orders, promotions, and updates.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {notifications.map((notif) => {
              const config = TYPE_CONFIG[notif.type] || TYPE_CONFIG.SYSTEM;
              const Icon = config.icon;
              return (
                <Card
                  key={notif.id}
                  className={cn(
                    "transition-colors cursor-pointer",
                    !notif.isRead && "bg-primary/[0.02] border-primary/20"
                  )}
                  data-testid={`card-notification-${notif.id}`}
                  onClick={() => {
                    if (!notif.isRead) markRead.mutate(notif.id);
                  }}
                >
                  <CardContent className="p-4 flex items-start gap-3">
                    <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5", config.bg)}>
                      <Icon className={cn("w-4 h-4", config.color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className={cn("text-sm font-semibold line-clamp-1", !notif.isRead && "text-foreground")}>
                          {notif.title}
                        </p>
                        {!notif.isRead && (
                          <Circle className="w-2 h-2 fill-primary text-primary shrink-0" />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">{notif.message}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-xs text-muted-foreground">
                          {formatRelativeTime(notif.createdAt)}
                        </span>
                        {notif.link && (
                          <Link
                            href={notif.link}
                            className="text-xs text-primary hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            View Details
                          </Link>
                        )}
                      </div>
                    </div>
                    <Badge variant="secondary" className={cn("text-[10px] shrink-0", config.bg, config.color)}>
                      {notif.type}
                    </Badge>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AccountLayout>
  );
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
