import { Link } from "wouter";
import { AccountLayout } from "@/components/account/AccountLayout";
import { useDashboardOverview } from "@/hooks/use-user";
import { useAuth } from "@/store/use-auth";
import { formatPrice } from "@/lib/utils";
import {
  Package,
  Heart,
  MapPin,
  Bell,
  ChevronRight,
  Truck,
  Plus,
  Loader2,
  ShoppingBag,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  CONFIRMED: "bg-blue-100 text-blue-800",
  PROCESSING: "bg-indigo-100 text-indigo-800",
  SHIPPED: "bg-purple-100 text-purple-800",
  DELIVERED: "bg-green-100 text-green-800",
  CANCELLED: "bg-red-100 text-red-800",
  RETURNED: "bg-orange-100 text-orange-800",
  REFUNDED: "bg-gray-100 text-gray-800",
};

export default function AccountOverview() {
  const { user } = useAuth();
  const { data, isLoading, isError } = useDashboardOverview();

  return (
    <AccountLayout>
      <div className="space-y-6">
        <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent rounded-2xl p-6 md:p-8 border border-primary/10">
          <h1 className="text-2xl md:text-3xl font-display font-bold mb-1" data-testid="text-welcome">
            Welcome back, {user?.firstName}!
          </h1>
          <p className="text-muted-foreground">Manage your orders, addresses, and account settings all in one place.</p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : isError ? (
          <div className="text-center py-16 text-muted-foreground">
            <p>Unable to load dashboard data. Your backend may need the dashboard API configured.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Link href="/account/orders">
                <Card className="hover:shadow-md hover:border-primary/30 transition-all cursor-pointer group" data-testid="card-stat-orders">
                  <CardContent className="p-5">
                    <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                      <Package className="w-5 h-5 text-blue-600" />
                    </div>
                    <p className="text-2xl font-bold font-display">{data?.totalOrders ?? 0}</p>
                    <p className="text-sm text-muted-foreground">Total Orders</p>
                  </CardContent>
                </Card>
              </Link>

              <Link href="/account/wishlist">
                <Card className="hover:shadow-md hover:border-primary/30 transition-all cursor-pointer group" data-testid="card-stat-wishlist">
                  <CardContent className="p-5">
                    <div className="w-10 h-10 bg-pink-100 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                      <Heart className="w-5 h-5 text-pink-600" />
                    </div>
                    <p className="text-2xl font-bold font-display">{data?.wishlistCount ?? 0}</p>
                    <p className="text-sm text-muted-foreground">Wishlist Items</p>
                  </CardContent>
                </Card>
              </Link>

              <Link href="/account/addresses">
                <Card className="hover:shadow-md hover:border-primary/30 transition-all cursor-pointer group" data-testid="card-stat-addresses">
                  <CardContent className="p-5">
                    <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                      <MapPin className="w-5 h-5 text-green-600" />
                    </div>
                    <p className="text-2xl font-bold font-display">{data?.addressCount ?? 0}</p>
                    <p className="text-sm text-muted-foreground">Saved Addresses</p>
                  </CardContent>
                </Card>
              </Link>

              <Link href="/account/notifications">
                <Card className="hover:shadow-md hover:border-primary/30 transition-all cursor-pointer group" data-testid="card-stat-notifications">
                  <CardContent className="p-5">
                    <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                      <Bell className="w-5 h-5 text-amber-600" />
                    </div>
                    <p className="text-2xl font-bold font-display">{data?.unreadNotifications ?? 0}</p>
                    <p className="text-sm text-muted-foreground">Unread Alerts</p>
                  </CardContent>
                </Card>
              </Link>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <Link href="/account/orders" className="md:col-span-1">
                <Card className="hover:shadow-md hover:border-primary/30 transition-all cursor-pointer h-full" data-testid="card-quicklink-track">
                  <CardContent className="p-5 flex items-center gap-4">
                    <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
                      <Truck className="w-6 h-6 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm">Track Orders</p>
                      <p className="text-xs text-muted-foreground">View status & delivery updates</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground ml-auto shrink-0" />
                  </CardContent>
                </Card>
              </Link>

              <Link href="/account/addresses" className="md:col-span-1">
                <Card className="hover:shadow-md hover:border-primary/30 transition-all cursor-pointer h-full" data-testid="card-quicklink-address">
                  <CardContent className="p-5 flex items-center gap-4">
                    <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
                      <Plus className="w-6 h-6 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm">Add Address</p>
                      <p className="text-xs text-muted-foreground">Save a new delivery address</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground ml-auto shrink-0" />
                  </CardContent>
                </Card>
              </Link>

              <Link href="/shop" className="md:col-span-1">
                <Card className="hover:shadow-md hover:border-primary/30 transition-all cursor-pointer h-full" data-testid="card-quicklink-shop">
                  <CardContent className="p-5 flex items-center gap-4">
                    <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
                      <ShoppingBag className="w-6 h-6 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm">Continue Shopping</p>
                      <p className="text-xs text-muted-foreground">Explore latest collections</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground ml-auto shrink-0" />
                  </CardContent>
                </Card>
              </Link>
            </div>

            {(data?.recentOrders?.length ?? 0) > 0 && (
              <Card data-testid="card-recent-orders">
                <CardContent className="p-0">
                  <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                    <h2 className="font-display font-bold text-lg">Recent Orders</h2>
                    <Link href="/account/orders">
                      <Button variant="ghost" size="sm" className="text-primary" data-testid="link-view-all-orders">
                        View All <ChevronRight className="w-4 h-4 ml-1" />
                      </Button>
                    </Link>
                  </div>
                  <div className="divide-y divide-border">
                    {data!.recentOrders.map((order) => (
                      <Link
                        key={order.id}
                        href={`/account/orders?id=${order.id}`}
                        className="flex items-center gap-4 px-5 py-4 hover:bg-muted/50 transition-colors"
                        data-testid={`row-order-${order.id}`}
                      >
                        <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center shrink-0">
                          <Package className="w-5 h-5 text-muted-foreground" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm">#{order.orderNumber}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(order.createdAt).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                            {" · "}
                            {order.items.length} item{order.items.length !== 1 ? "s" : ""}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-semibold text-sm">{formatPrice(order.total)}</p>
                          <Badge variant="secondary" className={`text-[10px] px-2 py-0 mt-1 ${STATUS_COLORS[order.status] || ""}`}>
                            {order.status}
                          </Badge>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                      </Link>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </AccountLayout>
  );
}
