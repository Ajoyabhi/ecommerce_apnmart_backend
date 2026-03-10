import { useState } from "react";
import { AccountLayout } from "@/components/account/AccountLayout";
import { useOrders, useOrderDetail, useRequestReturn } from "@/hooks/use-user";
import { formatPrice } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Package,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Eye,
  Truck,
  RotateCcw,
  Search,
  ShoppingBag,
  X,
} from "lucide-react";
import { Link } from "wouter";

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800 border-yellow-200",
  CONFIRMED: "bg-blue-100 text-blue-800 border-blue-200",
  PROCESSING: "bg-indigo-100 text-indigo-800 border-indigo-200",
  SHIPPED: "bg-purple-100 text-purple-800 border-purple-200",
  DELIVERED: "bg-green-100 text-green-800 border-green-200",
  CANCELLED: "bg-red-100 text-red-800 border-red-200",
  RETURNED: "bg-orange-100 text-orange-800 border-orange-200",
  REFUNDED: "bg-gray-100 text-gray-800 border-gray-200",
};

const STATUS_STEPS = ["CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED"];

export default function Orders() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useOrders(page, 10);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [returnOrderId, setReturnOrderId] = useState<string | null>(null);
  const [returnReason, setReturnReason] = useState("");
  const requestReturn = useRequestReturn();

  const { data: orderDetail, isLoading: detailLoading } = useOrderDetail(selectedOrderId || "");

  const totalPages = Math.ceil((data?.total ?? 0) / 10);

  const handleReturn = () => {
    if (!returnOrderId || !returnReason.trim()) return;
    requestReturn.mutate(
      { orderId: returnOrderId, reason: returnReason },
      {
        onSuccess: () => {
          setReturnOrderId(null);
          setReturnReason("");
        },
      }
    );
  };

  return (
    <AccountLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-display font-bold" data-testid="text-page-title">My Orders</h1>
            <p className="text-muted-foreground text-sm mt-1">
              {data?.total ?? 0} order{(data?.total ?? 0) !== 1 ? "s" : ""} placed
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : !data ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-muted-foreground">Unable to load orders. Please try again later.</p>
            </CardContent>
          </Card>
        ) : !data.orders?.length ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                <ShoppingBag className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-lg mb-1">No orders yet</h3>
              <p className="text-muted-foreground text-sm mb-4">Start shopping to see your orders here.</p>
              <Link href="/shop">
                <Button data-testid="button-start-shopping">Start Shopping</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="space-y-3">
              {data.orders.map((order) => (
                <Card key={order.id} className="hover:shadow-sm transition-shadow" data-testid={`card-order-${order.id}`}>
                  <CardContent className="p-0">
                    <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-muted/30">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="font-mono text-sm font-semibold" data-testid={`text-order-number-${order.id}`}>
                          #{order.orderNumber}
                        </span>
                        <Badge variant="outline" className={`text-[11px] ${STATUS_COLORS[order.status] || ""}`}>
                          {order.status}
                        </Badge>
                        {order.paymentStatus != null && order.paymentStatus !== "" && (
                          <span
                            className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                              (order.paymentStatus || "").toLowerCase() === "paid" || (order.paymentStatus || "").toLowerCase() === "verified"
                                ? "bg-green-100 text-green-800 border border-green-200"
                                : "bg-amber-100 text-amber-800 border border-amber-200"
                            }`}
                            data-testid={`text-payment-status-${order.id}`}
                          >
                            Payment: {(order.paymentStatus || "unpaid").charAt(0).toUpperCase() + (order.paymentStatus || "unpaid").slice(1).toLowerCase()}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(order.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                    </div>

                    <div className="px-5 py-4">
                      <div className="flex flex-wrap items-center gap-3 mb-3">
                        {order.items.slice(0, 3).map((item) => (
                          <div key={item.id} className="flex items-center gap-2">
                            {item.productImage ? (
                              <img
                                src={item.productImage}
                                alt={item.productName}
                                className="w-12 h-12 rounded-lg object-cover border border-border"
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                                <Package className="w-5 h-5 text-muted-foreground" />
                              </div>
                            )}
                            <div className="text-sm">
                              <p className="font-medium line-clamp-1 max-w-[140px]">{item.productName}</p>
                              <p className="text-xs text-muted-foreground">Qty: {item.quantity}</p>
                            </div>
                          </div>
                        ))}
                        {order.items.length > 3 && (
                          <span className="text-xs text-muted-foreground">+{order.items.length - 3} more</span>
                        )}
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-lg font-bold font-display" data-testid={`text-order-total-${order.id}`}>
                            {formatPrice(order.total)}
                          </span>
                          <span className="text-xs text-muted-foreground ml-2">
                            {order.items.length} item{order.items.length !== 1 ? "s" : ""}
                          </span>
                        </div>
                        <div className="flex gap-2">
                          {order.trackingNumber && (
                            <Button variant="outline" size="sm" className="text-xs" data-testid={`button-track-${order.id}`}>
                              <Truck className="w-3.5 h-3.5 mr-1" />
                              Track
                            </Button>
                          )}
                          {order.returnEligible && order.status === "DELIVERED" && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs"
                              onClick={() => setReturnOrderId(order.id)}
                              data-testid={`button-return-${order.id}`}
                            >
                              <RotateCcw className="w-3.5 h-3.5 mr-1" />
                              Return
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs"
                            onClick={() => setSelectedOrderId(order.id)}
                            data-testid={`button-view-${order.id}`}
                          >
                            <Eye className="w-3.5 h-3.5 mr-1" />
                            Details
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-4" data-testid="pagination-orders">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm text-muted-foreground px-3">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      <Dialog open={!!selectedOrderId} onOpenChange={(open) => !open && setSelectedOrderId(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Order Details</DialogTitle>
            <DialogDescription>
              {orderDetail ? `#${orderDetail.orderNumber}` : "Loading..."}
            </DialogDescription>
          </DialogHeader>

          {detailLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : orderDetail ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <Badge variant="outline" className={STATUS_COLORS[orderDetail.status] || ""}>
                  {orderDetail.status}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {new Date(orderDetail.createdAt).toLocaleDateString()}
                </span>
              </div>

              {(orderDetail.paymentStatus != null || orderDetail.paymentMethod != null) && (
                <div className="flex flex-wrap gap-3 text-sm">
                  {orderDetail.paymentStatus != null && orderDetail.paymentStatus !== "" && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-muted-foreground">Payment status:</span>
                      <span
                        className={`font-medium ${
                          (orderDetail.paymentStatus || "").toLowerCase() === "paid" || (orderDetail.paymentStatus || "").toLowerCase() === "verified"
                            ? "text-green-700"
                            : "text-amber-700"
                        }`}
                        data-testid="text-detail-payment-status"
                      >
                        {(orderDetail.paymentStatus || "unpaid").charAt(0).toUpperCase() + (orderDetail.paymentStatus || "unpaid").slice(1).toLowerCase()}
                      </span>
                    </div>
                  )}
                  {orderDetail.paymentMethod != null && orderDetail.paymentMethod !== "" && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-muted-foreground">Payment method:</span>
                      <span className="font-medium capitalize" data-testid="text-detail-payment-method">
                        {orderDetail.paymentMethod === "cod" ? "Cash on Delivery" : orderDetail.paymentMethod}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {!["CANCELLED", "PENDING"].includes(orderDetail.status) && (
                <div className="flex items-center gap-1 py-2">
                  {STATUS_STEPS.map((step, i) => {
                    const stepIndex = STATUS_STEPS.indexOf(orderDetail.status);
                    const isCompleted = i <= stepIndex;
                    const isCurrent = i === stepIndex;
                    return (
                      <div key={step} className="flex items-center flex-1">
                        <div className="flex flex-col items-center flex-1">
                          <div
                            className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                              isCompleted
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {i + 1}
                          </div>
                          <span className={`text-[10px] mt-1 ${isCurrent ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                            {step.charAt(0) + step.slice(1).toLowerCase()}
                          </span>
                        </div>
                        {i < STATUS_STEPS.length - 1 && (
                          <div className={`h-0.5 flex-1 mx-1 rounded ${i < stepIndex ? "bg-primary" : "bg-muted"}`} />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="divide-y divide-border rounded-xl border border-border overflow-hidden">
                {orderDetail.items.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 p-3">
                    {item.productImage ? (
                      <img src={item.productImage} alt={item.productName} className="w-14 h-14 rounded-lg object-cover border" />
                    ) : (
                      <div className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center">
                        <Package className="w-6 h-6 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm line-clamp-1">{item.productName}</p>
                      <div className="flex gap-2 text-xs text-muted-foreground mt-0.5">
                        {item.size && <span>Size: {item.size}</span>}
                        {item.color && <span>Color: {item.color}</span>}
                        <span>Qty: {item.quantity}</span>
                      </div>
                    </div>
                    <span className="font-semibold text-sm">{formatPrice(item.price * item.quantity)}</span>
                  </div>
                ))}
              </div>

              <div className="bg-muted/50 rounded-xl p-4 space-y-2 text-sm">
                {orderDetail.subtotal != null && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>{formatPrice(orderDetail.subtotal)}</span>
                  </div>
                )}
                {orderDetail.shippingCost != null && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Shipping</span>
                    <span>{orderDetail.shippingCost === 0 ? "Free" : formatPrice(orderDetail.shippingCost)}</span>
                  </div>
                )}
                {orderDetail.tax != null && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tax</span>
                    <span>{formatPrice(orderDetail.tax)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold pt-2 border-t border-border">
                  <span>Total</span>
                  <span>{formatPrice(orderDetail.total)}</span>
                </div>
              </div>

              {orderDetail.shippingAddress && (
                <div className="text-sm">
                  <p className="font-medium mb-1">Shipping Address</p>
                  <p className="text-muted-foreground">
                    {orderDetail.shippingAddress.fullName}<br />
                    {orderDetail.shippingAddress.addressLine1}<br />
                    {orderDetail.shippingAddress.addressLine2 && <>{orderDetail.shippingAddress.addressLine2}<br /></>}
                    {orderDetail.shippingAddress.city}, {orderDetail.shippingAddress.state} {orderDetail.shippingAddress.postalCode}
                  </p>
                </div>
              )}

              {orderDetail.trackingNumber && (
                <div className="text-sm">
                  <p className="font-medium mb-1">Tracking Number</p>
                  <p className="font-mono text-muted-foreground">{orderDetail.trackingNumber}</p>
                </div>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={!!returnOrderId} onOpenChange={(open) => !open && setReturnOrderId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Return</DialogTitle>
            <DialogDescription>Please let us know why you want to return this order.</DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Reason for return..."
            value={returnReason}
            onChange={(e) => setReturnReason(e.target.value)}
            rows={4}
            data-testid="input-return-reason"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setReturnOrderId(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleReturn}
              disabled={!returnReason.trim() || requestReturn.isPending}
              data-testid="button-submit-return"
            >
              {requestReturn.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit Return Request"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AccountLayout>
  );
}
