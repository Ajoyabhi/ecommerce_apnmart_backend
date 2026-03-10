import { Package, FolderTree, DollarSign, ShoppingCart, AlertTriangle } from "lucide-react";
import { useAdminProducts, useAdminCategories, useDashboardStats } from "@/hooks/use-admin";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Link } from "wouter";
import { useAuth } from "@/store/use-auth";
import { getMediaUrl } from "@/lib/utils";

export default function AdminDashboard() {
  const { data: products = [] } = useAdminProducts();
  const { data: categories = [] } = useAdminCategories();
  const { data: stats } = useDashboardStats();
  const { user } = useAuth();

  const totalProducts = products.length;
  const totalCategories = categories.length;
  const totalOrders = stats?.totalOrders ?? 0;
  const revenue = stats?.totalRevenue ?? 0;
  const lowStockCount = stats?.lowStockCount ?? 0;

  const featuredCount = products.filter((p) => p.isFeatured).length;

  const cards = [
    {
      label: "Total Products",
      value: totalProducts,
      icon: Package,
      color: "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400",
      href: "/admin/products",
    },
    {
      label: "Categories",
      value: totalCategories,
      icon: FolderTree,
      color: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400",
      href: "/admin/categories",
    },
    {
      label: "Total Orders",
      value: totalOrders,
      icon: ShoppingCart,
      color: "bg-purple-50 text-purple-600 dark:bg-purple-950 dark:text-purple-400",
      href: "/admin",
    },
    {
      label: "Revenue",
      value: `$${revenue.toLocaleString()}`,
      icon: DollarSign,
      color: "bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400",
      href: "/admin",
    },
  ];

  return (
    <AdminLayout>
      <div className="space-y-8">
        <div>
          <h2 className="font-display font-bold text-2xl mb-1" data-testid="text-dashboard-title">
            Welcome back{user ? `, ${user.firstName}` : ""}
          </h2>
          <p className="text-muted-foreground text-sm">
            Here's what's happening with your store.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {cards.map((card) => (
            <Link
              key={card.label}
              href={card.href}
              className="bg-card border border-border rounded-2xl p-6 hover:shadow-md transition-shadow"
              data-testid={`card-stat-${card.label.toLowerCase().replace(/\s/g, "-")}`}
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${card.color}`}>
                  <card.icon className="w-5 h-5" />
                </div>
              </div>
              <p className="font-display font-bold text-2xl">{card.value}</p>
              <p className="text-sm text-muted-foreground mt-1">{card.label}</p>
            </Link>
          ))}
        </div>

        {lowStockCount > 0 && (
          <Link
            href="/admin/inventory"
            className="flex items-center gap-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-2xl p-4 hover:shadow-sm transition-shadow"
          >
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <p className="font-medium text-sm text-amber-800 dark:text-amber-300">
                {lowStockCount} item{lowStockCount !== 1 ? "s" : ""} with low stock
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Click to review inventory levels
              </p>
            </div>
          </Link>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-card border border-border rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-display font-bold text-lg">Recent Products</h3>
              <Link
                href="/admin/products"
                className="text-sm text-primary font-medium hover:underline"
                data-testid="link-view-all-products"
              >
                View All
              </Link>
            </div>
            {products.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-8">
                No products found. Make sure your backend is running.
              </p>
            ) : (
              <div className="space-y-3">
                {products.slice(0, 5).map((product) => (
                  <div
                    key={product.id}
                    className="flex items-center gap-4 py-2"
                    data-testid={`row-product-${product.id}`}
                  >
                    <div className="w-10 h-10 bg-muted rounded-lg shrink-0 overflow-hidden">
                      {product.richContent?.media_gallery?.[0]?.url ? (
                        <img
                          src={getMediaUrl(product.richContent.media_gallery[0].url)}
                          alt={product.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                          <Package className="w-4 h-4" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{product.name}</p>
                      <p className="text-xs text-muted-foreground">{product.sku}</p>
                    </div>
                    <span className="text-sm font-semibold tabular-nums">
                      ${parseFloat(String(product.basePrice)).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-card border border-border rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-display font-bold text-lg">Quick Stats</h3>
            </div>
            <div className="space-y-5">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Featured Products</span>
                <span className="font-bold tabular-nums">{featuredCount}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Total Products</span>
                <span className="font-bold tabular-nums">{totalProducts}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Total Categories</span>
                <span className="font-bold tabular-nums">{totalCategories}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Low Stock Items</span>
                <span className="font-bold tabular-nums text-amber-600">{lowStockCount}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Published</span>
                <span className="font-bold tabular-nums">
                  {products.filter((p) => p.status === "published" || p.status === "active").length}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
