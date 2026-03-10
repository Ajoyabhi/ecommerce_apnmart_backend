import { useState, useMemo } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import {
  useAdminOrders,
  useUpdateOrderStatus,
  useUpdatePaymentStatus,
  useCancelOrder,
  useAddOrderNote,
} from "@/hooks/use-admin";
import { useToast } from "@/hooks/use-toast";
import type { AdminOrder } from "@/api/types";
import { cn, getMediaUrl } from "@/lib/utils";
import {
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Package,
  User,
  Mail,
  Phone,
  MapPin,
  CreditCard,
  Calendar,
  Hash,
  Truck,
  X,
  Loader2,
  StickyNote,
  ArrowUpDown,
  AlertTriangle,
  CheckCircle2,
  Clock,
  XCircle,
  RotateCcw,
  Ban,
  ShoppingBag,
} from "lucide-react";

const ORDER_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "RETURNED",
  "REFUNDED",
] as const;

const PAYMENT_STATUSES = [
  "UNPAID",
  "PAID",
  "VERIFIED",
  "REFUNDED",
  "FAILED",
] as const;

const STATUS_CONFIG: Record<string, { color: string; icon: typeof Clock; label: string }> = {
  PENDING: { color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400", icon: Clock, label: "Pending" },
  CONFIRMED: { color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400", icon: CheckCircle2, label: "Confirmed" },
  PROCESSING: { color: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400", icon: Package, label: "Processing" },
  SHIPPED: { color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400", icon: Truck, label: "Shipped" },
  DELIVERED: { color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400", icon: CheckCircle2, label: "Delivered" },
  CANCELLED: { color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400", icon: XCircle, label: "Cancelled" },
  RETURNED: { color: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400", icon: RotateCcw, label: "Returned" },
  REFUNDED: { color: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400", icon: Ban, label: "Refunded" },
};

const PAYMENT_STATUS_CONFIG: Record<string, string> = {
  UNPAID: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  PAID: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  VERIFIED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  REFUNDED: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
  FAILED: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.PENDING;
  const Icon = cfg.icon;
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold", cfg.color)} data-testid={`badge-status-${status}`}>
      <Icon className="w-3.5 h-3.5" />
      {cfg.label}
    </span>
  );
}

function PaymentBadge({ status }: { status: string | null | undefined }) {
  const s = status || "UNPAID";
  const color = PAYMENT_STATUS_CONFIG[s] || PAYMENT_STATUS_CONFIG.UNPAID;
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium", color)} data-testid={`badge-payment-${s}`}>
      <CreditCard className="w-3 h-3" />
      {s}
    </span>
  );
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function AddressDisplay({ address, label }: { address: Record<string, string> | null | undefined; label: string }) {
  if (!address) return null;
  return (
    <div className="space-y-1">
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</h4>
      <div className="text-sm space-y-0.5">
        {address.fullName && <p className="font-medium">{address.fullName}</p>}
        {address.addressLine1 && <p>{address.addressLine1}</p>}
        {address.addressLine2 && <p>{address.addressLine2}</p>}
        <p>
          {[address.city, address.state, address.pincode].filter(Boolean).join(", ")}
        </p>
        {address.country && <p>{address.country}</p>}
        {address.phone && (
          <p className="flex items-center gap-1 text-muted-foreground">
            <Phone className="w-3 h-3" /> {address.phone}
          </p>
        )}
        {address.email && (
          <p className="flex items-center gap-1 text-muted-foreground">
            <Mail className="w-3 h-3" /> {address.email}
          </p>
        )}
      </div>
    </div>
  );
}

function OrderDetailPanel({
  order,
  onClose,
}: {
  order: AdminOrder;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const updateStatus = useUpdateOrderStatus();
  const updatePayment = useUpdatePaymentStatus();
  const cancelOrder = useCancelOrder();
  const addNote = useAddOrderNote();

  const [newStatus, setNewStatus] = useState(order.status);
  const [newPaymentStatus, setNewPaymentStatus] = useState(order.paymentStatus || "UNPAID");
  const [trackingNumber, setTrackingNumber] = useState(order.trackingNumber || "");
  const [noteText, setNoteText] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const handleUpdateStatus = async () => {
    if (newStatus === order.status && !trackingNumber) return;
    try {
      const res = await updateStatus.mutateAsync({
        id: order.id,
        data: {
          status: newStatus,
          ...(trackingNumber ? { trackingNumber } : {}),
        },
      });
      if (res.success) {
        toast({ title: "Order status updated" });
      } else {
        toast({ title: "Failed to update status", description: String(res.error || "Unknown error"), variant: "destructive" });
      }
    } catch {
      toast({ title: "Error updating status", variant: "destructive" });
    }
  };

  const handleUpdatePayment = async () => {
    if (newPaymentStatus === (order.paymentStatus || "UNPAID")) return;
    try {
      const res = await updatePayment.mutateAsync({
        id: order.id,
        data: { paymentStatus: newPaymentStatus },
      });
      if (res.success) {
        toast({ title: "Payment status updated" });
      } else {
        toast({ title: "Failed to update payment", description: String(res.error || ""), variant: "destructive" });
      }
    } catch {
      toast({ title: "Error updating payment", variant: "destructive" });
    }
  };

  const handleCancel = async () => {
    try {
      const res = await cancelOrder.mutateAsync({ id: order.id, reason: cancelReason });
      if (res.success) {
        toast({ title: "Order cancelled" });
        setShowCancelConfirm(false);
      } else {
        toast({ title: "Failed to cancel order", description: String(res.error || ""), variant: "destructive" });
      }
    } catch {
      toast({ title: "Error cancelling order", variant: "destructive" });
    }
  };

  const handleAddNote = async () => {
    if (!noteText.trim()) return;
    try {
      const res = await addNote.mutateAsync({ id: order.id, note: noteText.trim() });
      if (res.success) {
        toast({ title: "Note added" });
        setNoteText("");
      } else {
        toast({ title: "Failed to add note", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error adding note", variant: "destructive" });
    }
  };

  const isCancelled = order.status === "CANCELLED" || order.status === "REFUNDED";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end" data-testid="panel-order-detail">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-2xl h-full bg-card border-l border-border overflow-y-auto animate-in slide-in-from-right-full duration-300">
        <div className="sticky top-0 z-10 bg-card border-b border-border px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="font-display font-bold text-lg" data-testid="text-order-number">
              Order #{order.orderNumber}
            </h2>
            <p className="text-sm text-muted-foreground">{formatDate(order.createdAt)}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
            data-testid="button-close-detail"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="flex flex-wrap gap-3">
            <StatusBadge status={order.status} />
            <PaymentBadge status={order.paymentStatus} />
          </div>

          <div className="bg-muted/50 rounded-xl p-4 space-y-2">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <User className="w-4 h-4" /> Customer
            </h3>
            <div className="text-sm space-y-1">
              <p className="font-medium" data-testid="text-customer-name">
                {order.user ? `${order.user.firstName} ${order.user.lastName}`.trim() || order.user.email : "Guest"}
              </p>
              <p className="flex items-center gap-1 text-muted-foreground" data-testid="text-customer-email">
                <Mail className="w-3.5 h-3.5" /> {order.user?.email ?? "—"}
              </p>
              {order.user?.phone && (
                <p className="flex items-center gap-1 text-muted-foreground" data-testid="text-customer-phone">
                  <Phone className="w-3.5 h-3.5" /> {order.user.phone}
                </p>
              )}
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
              <ShoppingBag className="w-4 h-4" /> Items ({order.items.length})
            </h3>
            <div className="border border-border rounded-xl overflow-hidden divide-y divide-border">
              {order.items.map((item, idx) => (
                <div key={idx} className="flex gap-3 p-3" data-testid={`row-order-item-${idx}`}>
                  {item.image && (
                    <img
                      src={getMediaUrl(item.image)}
                      alt={item.name}
                      className="w-14 h-14 rounded-lg object-cover border border-border shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.name}</p>
                    <div className="flex flex-wrap gap-2 mt-0.5">
                      {item.color && <span className="text-xs text-muted-foreground">Color: {item.color}</span>}
                      {item.size && <span className="text-xs text-muted-foreground">Size: {item.size}</span>}
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-muted-foreground">Qty: {item.quantity}</span>
                      <span className="text-sm font-semibold">{formatCurrency(item.price * item.quantity)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-muted/50 rounded-xl p-4 space-y-2">
            <h3 className="font-semibold text-sm mb-2">Price Breakdown</h3>
            <div className="text-sm space-y-1.5">
              {order.subtotal !== undefined && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatCurrency(order.subtotal)}</span>
                </div>
              )}
              {order.shippingCost !== undefined && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Shipping</span>
                  <span>{order.shippingCost === 0 ? "Free" : formatCurrency(order.shippingCost)}</span>
                </div>
              )}
              {order.tax !== undefined && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tax (GST)</span>
                  <span>{formatCurrency(order.tax)}</span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t border-border font-bold text-base">
                <span>Total</span>
                <span data-testid="text-order-total">{formatCurrency(order.total)}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <AddressDisplay address={order.shippingAddress} label="Shipping Address" />
            {!order.sameAsBilling && (
              <AddressDisplay address={order.billingAddress} label="Billing Address" />
            )}
          </div>

          <div className="flex items-center gap-2 text-sm">
            <CreditCard className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">Payment Method:</span>
            <span className="font-medium capitalize" data-testid="text-payment-method">
              {order.paymentMethod?.replace(/_/g, " ") || "N/A"}
            </span>
          </div>

          {order.trackingNumber && (
            <div className="flex items-center gap-2 text-sm">
              <Truck className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">Tracking:</span>
              <span className="font-mono font-medium" data-testid="text-tracking-number">{order.trackingNumber}</span>
            </div>
          )}

          {order.adminNotes && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4">
              <h4 className="text-xs font-semibold text-yellow-800 dark:text-yellow-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                <StickyNote className="w-3.5 h-3.5" /> Admin Notes
              </h4>
              <p className="text-sm text-yellow-900 dark:text-yellow-300 whitespace-pre-wrap" data-testid="text-admin-notes">
                {order.adminNotes}
              </p>
            </div>
          )}

          {!isCancelled && (
            <>
              <div className="border border-border rounded-xl p-4 space-y-3">
                <h3 className="font-semibold text-sm">Update Order Status</h3>
                <div className="flex flex-col sm:flex-row gap-2">
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value as typeof newStatus)}
                    className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
                    data-testid="select-order-status"
                  >
                    {ORDER_STATUSES.map((s) => (
                      <option key={s} value={s}>{STATUS_CONFIG[s]?.label || s}</option>
                    ))}
                  </select>
                  <button
                    onClick={handleUpdateStatus}
                    disabled={updateStatus.isPending || (newStatus === order.status && !trackingNumber)}
                    className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
                    data-testid="button-update-status"
                  >
                    {updateStatus.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Update"}
                  </button>
                </div>
                {(newStatus === "SHIPPED" || order.status === "SHIPPED") && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Tracking Number</label>
                    <input
                      value={trackingNumber}
                      onChange={(e) => setTrackingNumber(e.target.value)}
                      placeholder="Enter tracking number"
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                      data-testid="input-tracking-number"
                    />
                  </div>
                )}
              </div>

              <div className="border border-border rounded-xl p-4 space-y-3">
                <h3 className="font-semibold text-sm">Update Payment Status</h3>
                <div className="flex flex-col sm:flex-row gap-2">
                  <select
                    value={newPaymentStatus}
                    onChange={(e) => setNewPaymentStatus(e.target.value)}
                    className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
                    data-testid="select-payment-status"
                  >
                    {PAYMENT_STATUSES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  <button
                    onClick={handleUpdatePayment}
                    disabled={updatePayment.isPending || newPaymentStatus === (order.paymentStatus || "UNPAID")}
                    className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
                    data-testid="button-update-payment"
                  >
                    {updatePayment.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Update"}
                  </button>
                </div>
              </div>

              <div className="border border-border rounded-xl p-4 space-y-3">
                <h3 className="font-semibold text-sm flex items-center gap-1.5">
                  <StickyNote className="w-4 h-4" /> Add Internal Note
                </h3>
                <textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Type an internal note..."
                  rows={2}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none"
                  data-testid="input-admin-note"
                />
                <button
                  onClick={handleAddNote}
                  disabled={addNote.isPending || !noteText.trim()}
                  className="px-4 py-2 bg-secondary text-secondary-foreground text-sm font-medium rounded-lg hover:bg-secondary/80 disabled:opacity-50 transition-colors"
                  data-testid="button-add-note"
                >
                  {addNote.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add Note"}
                </button>
              </div>

              <div className="border border-destructive/30 rounded-xl p-4 space-y-3">
                <h3 className="font-semibold text-sm text-destructive flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" /> Danger Zone
                </h3>
                {!showCancelConfirm ? (
                  <button
                    onClick={() => setShowCancelConfirm(true)}
                    className="px-4 py-2 bg-destructive text-destructive-foreground text-sm font-medium rounded-lg hover:bg-destructive/90 transition-colors"
                    data-testid="button-cancel-order"
                  >
                    Cancel Order
                  </button>
                ) : (
                  <div className="space-y-2">
                    <textarea
                      value={cancelReason}
                      onChange={(e) => setCancelReason(e.target.value)}
                      placeholder="Reason for cancellation (optional)"
                      rows={2}
                      className="w-full rounded-lg border border-destructive/30 bg-background px-3 py-2 text-sm resize-none"
                      data-testid="input-cancel-reason"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleCancel}
                        disabled={cancelOrder.isPending}
                        className="px-4 py-2 bg-destructive text-destructive-foreground text-sm font-medium rounded-lg hover:bg-destructive/90 disabled:opacity-50 transition-colors"
                        data-testid="button-confirm-cancel"
                      >
                        {cancelOrder.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirm Cancel"}
                      </button>
                      <button
                        onClick={() => { setShowCancelConfirm(false); setCancelReason(""); }}
                        className="px-4 py-2 bg-muted text-muted-foreground text-sm font-medium rounded-lg hover:bg-muted/80 transition-colors"
                        data-testid="button-cancel-dismiss"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const SORT_OPTIONS = [
  { value: "latest", label: "Latest First" },
  { value: "oldest", label: "Oldest First" },
  { value: "amount_high", label: "Amount: High to Low" },
  { value: "amount_low", label: "Amount: Low to High" },
];

export default function AdminOrders() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sort, setSort] = useState("latest");
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<AdminOrder | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const searchTimer = useMemo(() => {
    let timer: ReturnType<typeof setTimeout>;
    return (val: string) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        setDebouncedSearch(val);
        setPage(1);
      }, 400);
    };
  }, []);

  const { data, isLoading } = useAdminOrders({
    page,
    limit: 20,
    search: debouncedSearch || undefined,
    status: statusFilter || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    sort,
  });

  const orders = data?.orders || [];
  const totalPages = data?.totalPages || 0;
  const totalOrders = data?.total || 0;

  const toggleExpand = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearFilters = () => {
    setSearch("");
    setDebouncedSearch("");
    setStatusFilter("");
    setDateFrom("");
    setDateTo("");
    setSort("latest");
    setPage(1);
  };

  const hasActiveFilters = statusFilter || dateFrom || dateTo || debouncedSearch;

  return (
    <AdminLayout>
      <div className="max-w-[1400px] mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-display font-bold text-2xl" data-testid="text-page-title">Order Management</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {totalOrders} total order{totalOrders !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-border space-y-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    searchTimer(e.target.value);
                  }}
                  placeholder="Search by name, email, or order ID..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                  data-testid="input-search-orders"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-colors",
                    showFilters || hasActiveFilters
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border hover:bg-muted"
                  )}
                  data-testid="button-toggle-filters"
                >
                  <Filter className="w-4 h-4" />
                  Filters
                  {hasActiveFilters && (
                    <span className="w-2 h-2 rounded-full bg-primary" />
                  )}
                </button>
                <select
                  value={sort}
                  onChange={(e) => { setSort(e.target.value); setPage(1); }}
                  className="px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  data-testid="select-sort-orders"
                >
                  {SORT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {showFilters && (
              <div className="flex flex-wrap gap-3 pt-2 border-t border-border" data-testid="panel-filters">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Status</label>
                  <select
                    value={statusFilter}
                    onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                    className="block w-40 px-3 py-2 rounded-lg border border-border bg-background text-sm"
                    data-testid="select-filter-status"
                  >
                    <option value="">All Statuses</option>
                    {ORDER_STATUSES.map((s) => (
                      <option key={s} value={s}>{STATUS_CONFIG[s]?.label || s}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">From Date</label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                    className="block px-3 py-2 rounded-lg border border-border bg-background text-sm"
                    data-testid="input-date-from"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">To Date</label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                    className="block px-3 py-2 rounded-lg border border-border bg-background text-sm"
                    data-testid="input-date-to"
                  />
                </div>
                {hasActiveFilters && (
                  <div className="flex items-end">
                    <button
                      onClick={clearFilters}
                      className="px-3 py-2 text-sm text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                      data-testid="button-clear-filters"
                    >
                      Clear All
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center px-4">
              <Package className="w-12 h-12 text-muted-foreground/40 mb-3" />
              <p className="font-medium text-muted-foreground">No orders found</p>
              <p className="text-sm text-muted-foreground/70 mt-1">
                {hasActiveFilters ? "Try adjusting your filters" : "Orders will appear here once customers place them"}
              </p>
            </div>
          ) : (
            <>
              <div className="hidden lg:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left font-semibold text-muted-foreground px-4 py-3 w-8" />
                      <th className="text-left font-semibold text-muted-foreground px-4 py-3">Order</th>
                      <th className="text-left font-semibold text-muted-foreground px-4 py-3">Customer</th>
                      <th className="text-left font-semibold text-muted-foreground px-4 py-3">Status</th>
                      <th className="text-left font-semibold text-muted-foreground px-4 py-3">Payment</th>
                      <th className="text-right font-semibold text-muted-foreground px-4 py-3">Amount</th>
                      <th className="text-left font-semibold text-muted-foreground px-4 py-3">Date</th>
                      <th className="text-right font-semibold text-muted-foreground px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {orders.map((order) => {
                      const isExpanded = expandedRows.has(order.id);
                      return (
                        <TableRow
                          key={order.id}
                          order={order}
                          isExpanded={isExpanded}
                          onToggle={() => toggleExpand(order.id)}
                          onViewDetail={() => setSelectedOrder(order)}
                        />
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="lg:hidden divide-y divide-border">
                {orders.map((order) => (
                  <MobileOrderCard
                    key={order.id}
                    order={order}
                    onViewDetail={() => setSelectedOrder(order)}
                  />
                ))}
              </div>
            </>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border" data-testid="panel-pagination">
              <p className="text-sm text-muted-foreground">
                Page {page} of {totalPages} ({totalOrders} orders)
              </p>
              <div className="flex gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="p-2 rounded-lg hover:bg-muted disabled:opacity-40 transition-colors"
                  data-testid="button-prev-page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (page <= 3) {
                    pageNum = i + 1;
                  } else if (page >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = page - 2 + i;
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setPage(pageNum)}
                      className={cn(
                        "w-9 h-9 rounded-lg text-sm font-medium transition-colors",
                        pageNum === page
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-muted"
                      )}
                      data-testid={`button-page-${pageNum}`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="p-2 rounded-lg hover:bg-muted disabled:opacity-40 transition-colors"
                  data-testid="button-next-page"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {selectedOrder && (
        <OrderDetailPanel
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
        />
      )}
    </AdminLayout>
  );
}

function TableRow({
  order,
  isExpanded,
  onToggle,
  onViewDetail,
}: {
  order: AdminOrder;
  isExpanded: boolean;
  onToggle: () => void;
  onViewDetail: () => void;
}) {
  return (
    <>
      <tr
        className="hover:bg-muted/30 transition-colors cursor-pointer"
        data-testid={`row-order-${order.id}`}
      >
        <td className="px-4 py-3">
          <button
            onClick={onToggle}
            className="p-1 rounded hover:bg-muted transition-colors"
            data-testid={`button-expand-${order.id}`}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </td>
        <td className="px-4 py-3">
          <p className="font-mono font-medium text-xs" data-testid={`text-order-id-${order.id}`}>
            #{order.orderNumber}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">{order.items.length} item{order.items.length !== 1 ? "s" : ""}</p>
        </td>
        <td className="px-4 py-3">
          <p className="font-medium text-sm">{order.user ? `${order.user.firstName} ${order.user.lastName}`.trim() || order.user.email : "Guest"}</p>
          <p className="text-xs text-muted-foreground truncate max-w-[180px]">{order.user?.email ?? "—"}</p>
        </td>
        <td className="px-4 py-3">
          <StatusBadge status={order.status} />
        </td>
        <td className="px-4 py-3">
          <PaymentBadge status={order.paymentStatus} />
        </td>
        <td className="px-4 py-3 text-right">
          <span className="font-semibold">{formatCurrency(order.total)}</span>
        </td>
        <td className="px-4 py-3">
          <span className="text-xs text-muted-foreground">{formatDate(order.createdAt)}</span>
        </td>
        <td className="px-4 py-3 text-right">
          <button
            onClick={onViewDetail}
            className="px-3 py-1.5 bg-primary text-primary-foreground text-xs font-medium rounded-lg hover:bg-primary/90 transition-colors"
            data-testid={`button-view-${order.id}`}
          >
            Manage
          </button>
        </td>
      </tr>
      {isExpanded && (
        <tr data-testid={`row-expanded-${order.id}`}>
          <td colSpan={8} className="px-8 py-4 bg-muted/20">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Items</h4>
                <div className="space-y-2">
                  {order.items.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-sm">
                      {item.image && (
                        <img src={getMediaUrl(item.image)} alt="" className="w-8 h-8 rounded object-cover border border-border" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-xs">{item.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.quantity} × {formatCurrency(item.price)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Shipping</h4>
                {order.shippingAddress ? (
                  <div className="text-xs space-y-0.5">
                    <p className="font-medium">{order.shippingAddress.fullName}</p>
                    <p>{order.shippingAddress.addressLine1}</p>
                    <p>{[order.shippingAddress.city, order.shippingAddress.state, order.shippingAddress.pincode].filter(Boolean).join(", ")}</p>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No address</p>
                )}
              </div>
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Payment</h4>
                <div className="text-xs space-y-1">
                  <p><span className="text-muted-foreground">Method:</span> <span className="capitalize">{order.paymentMethod?.replace(/_/g, " ") || "N/A"}</span></p>
                  <p><span className="text-muted-foreground">Total:</span> <span className="font-semibold">{formatCurrency(order.total)}</span></p>
                  {order.trackingNumber && (
                    <p><span className="text-muted-foreground">Tracking:</span> <span className="font-mono">{order.trackingNumber}</span></p>
                  )}
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function MobileOrderCard({ order, onViewDetail }: { order: AdminOrder; onViewDetail: () => void }) {
  return (
    <div className="p-4 space-y-3" data-testid={`card-order-${order.id}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="font-mono font-medium text-sm">#{order.orderNumber}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {order.user ? `${order.user.firstName} ${order.user.lastName}`.trim() || order.user.email : "Guest"}
          </p>
          <p className="text-xs text-muted-foreground">{order.user?.email ?? "—"}</p>
        </div>
        <span className="font-semibold text-sm">{formatCurrency(order.total)}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={order.status} />
        <PaymentBadge status={order.paymentStatus} />
        <span className="text-xs text-muted-foreground ml-auto">{formatDate(order.createdAt)}</span>
      </div>
      <div className="text-xs text-muted-foreground">
        {order.items.length} item{order.items.length !== 1 ? "s" : ""} &middot; {order.paymentMethod?.replace(/_/g, " ") || "N/A"}
      </div>
      <button
        onClick={onViewDetail}
        className="w-full py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors"
        data-testid={`button-view-mobile-${order.id}`}
      >
        Manage Order
      </button>
    </div>
  );
}
