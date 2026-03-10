import { AccountLayout } from "@/components/account/AccountLayout";
import { useOrders } from "@/hooks/use-user";
import { formatPrice } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, RotateCcw, Package } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

const RETURN_STATUSES = ["RETURNED", "REFUNDED"];

export default function Returns() {
  const { data, isLoading } = useOrders(1, 100);

  const returnOrders = data?.orders?.filter((o) => RETURN_STATUSES.includes(o.status)) ?? [];

  return (
    <AccountLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-display font-bold" data-testid="text-page-title">Returns & Refunds</h1>
          <p className="text-muted-foreground text-sm mt-1">Track your return requests and refund statuses.</p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : !returnOrders.length ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                <RotateCcw className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-lg mb-1">No returns or refunds</h3>
              <p className="text-muted-foreground text-sm mb-4">
                You can request a return from the Orders page for eligible orders.
              </p>
              <Link href="/account/orders">
                <Button variant="outline" data-testid="link-go-to-orders">Go to Orders</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {returnOrders.map((order) => (
              <Card key={order.id} data-testid={`card-return-${order.id}`}>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm font-semibold">#{order.orderNumber}</span>
                      <Badge
                        variant="outline"
                        className={
                          order.status === "REFUNDED"
                            ? "bg-green-100 text-green-800 border-green-200"
                            : "bg-orange-100 text-orange-800 border-orange-200"
                        }
                      >
                        {order.status}
                      </Badge>
                    </div>
                    <span className="text-sm font-semibold">{formatPrice(order.total)}</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    {order.items.slice(0, 4).map((item) => (
                      <div key={item.id} className="flex items-center gap-2">
                        {item.productImage ? (
                          <img
                            src={item.productImage}
                            alt={item.productName}
                            className="w-10 h-10 rounded-lg object-cover border"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                            <Package className="w-4 h-4 text-muted-foreground" />
                          </div>
                        )}
                        <span className="text-sm text-muted-foreground line-clamp-1 max-w-[120px]">
                          {item.productName}
                        </span>
                      </div>
                    ))}
                  </div>

                  <p className="text-xs text-muted-foreground mt-3">
                    {order.status === "REFUNDED" ? "Refund processed" : "Return in progress"} ·{" "}
                    {new Date(order.updatedAt || order.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AccountLayout>
  );
}
