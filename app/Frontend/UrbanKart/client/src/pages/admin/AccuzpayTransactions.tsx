import { useState, useEffect, useMemo } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import {
  useAccuzpayTransactions,
  useAccuzpayTransaction,
  useAccuzpayProductSearch,
  useSaveAccuzpayItems,
  type AccuzpayTransaction,
  type AccuzpayPaymentItem,
  type AccuzpayProductResult,
} from "@/hooks/use-admin";
import { useToast } from "@/hooks/use-toast";
import { apiUrl } from "@/api/client";
import { useAuth } from "@/store/use-auth";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  X,
  Loader2,
  CheckCircle2,
  Clock,
  XCircle,
  RefreshCw,
  FileText,
  Plus,
  Minus,
  Download,
} from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_CONFIG: Record<string, { color: string; label: string; icon: typeof Clock }> = {
  PENDING:   { color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400", label: "Pending",   icon: Clock },
  CHARGED:   { color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",   label: "Charged",   icon: CheckCircle2 },
  FORWARDED: { color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",       label: "Forwarded", icon: RefreshCw },
  FAILED:    { color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",           label: "Failed",    icon: XCircle },
};

const STATUSES = ["ALL", "PENDING", "CHARGED", "FORWARDED", "FAILED"];

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { color: "bg-gray-100 text-gray-700", label: status, icon: Clock };
  const Icon = cfg.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium", cfg.color)}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

function fmt(amount: string | number) {
  return `₹${Number(amount).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ── Invoice Modal ────────────────────────────────────────────────────────────

interface InvoiceItem {
  productId: string;
  variantId?: string;
  productName: string;
  variantName?: string;
  unitPrice: number;
  quantity: number;
}

function InvoiceModal({
  txn,
  onClose,
}: {
  txn: AccuzpayTransaction;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const { accessToken } = useAuth();
  const [searchQ, setSearchQ] = useState("");
  const [items, setItems] = useState<InvoiceItem[]>(() =>
    (txn.items ?? []).map((it) => ({
      productId: it.productId,
      variantId: it.variantId ?? undefined,
      productName: it.productName,
      variantName: it.variantName ?? undefined,
      unitPrice: Number(it.unitPrice),
      quantity: it.quantity,
    }))
  );
  const [downloading, setDownloading] = useState(false);

  const { data: searchResults = [], isFetching: searching } =
    useAccuzpayProductSearch(searchQ, true);
  const saveItems = useSaveAccuzpayItems();

  const total = useMemo(
    () => items.reduce((s, it) => s + it.unitPrice * it.quantity, 0),
    [items]
  );
  const txnAmount = Number(txn.amount);
  const totalOk = Math.abs(total - txnAmount) <= 1;

  function addProduct(product: AccuzpayProductResult, variant?: AccuzpayProductResult["variants"][number]) {
    const price = Number(product.basePrice) + (variant ? Number(variant.priceAdjustment) : 0);
    const existing = items.findIndex(
      (it) => it.productId === product.id && it.variantId === (variant?.id ?? undefined)
    );
    if (existing >= 0) {
      setItems((prev) => prev.map((it, i) => i === existing ? { ...it, quantity: it.quantity + 1 } : it));
    } else {
      setItems((prev) => [
        ...prev,
        {
          productId: product.id,
          variantId: variant?.id,
          productName: product.name,
          variantName: variant?.name ?? undefined,
          unitPrice: price,
          quantity: 1,
        },
      ]);
    }
    setSearchQ("");
  }

  function changeQty(idx: number, delta: number) {
    setItems((prev) =>
      prev
        .map((it, i) => i === idx ? { ...it, quantity: it.quantity + delta } : it)
        .filter((it) => it.quantity > 0)
    );
  }

  async function handleSaveAndDownload() {
    setDownloading(true);
    try {
      await saveItems.mutateAsync({
        id: txn.id,
        items: items.map((it) => ({
          productId: it.productId,
          variantId: it.variantId,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
        })),
      });

      const url = apiUrl(`/payments/hdfc/accuzpay/transactions/${txn.id}/invoice`);
      const res = await fetch(url, {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      });
      if (!res.ok) throw new Error("Invoice generation failed");
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `invoice-${txn.referenceId}.pdf`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast({ title: "Invoice downloaded" });
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed", variant: "destructive" });
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="text-lg font-semibold">Generate Invoice</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Ref: {txn.referenceId} · {fmt(txn.amount)}
            </p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Product search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search products to add…"
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-muted rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            {searching && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
            )}
          </div>

          {/* Search results dropdown */}
          {searchQ.trim().length >= 2 && searchResults.length > 0 && (
            <div className="border border-border rounded-xl bg-card shadow-lg divide-y divide-border max-h-48 overflow-y-auto">
              {searchResults.map((product) => (
                <div key={product.id}>
                  {product.variants.length > 0 ? (
                    product.variants.map((v) => (
                      <button
                        key={v.id}
                        onClick={() => addProduct(product, v)}
                        className="w-full text-left px-4 py-2.5 hover:bg-muted transition-colors"
                      >
                        <div className="text-sm font-medium">{product.name}</div>
                        <div className="text-xs text-muted-foreground flex justify-between">
                          <span>{v.name ?? "Default"}</span>
                          <span>{fmt(Number(product.basePrice) + Number(v.priceAdjustment))}</span>
                        </div>
                      </button>
                    ))
                  ) : (
                    <button
                      onClick={() => addProduct(product)}
                      className="w-full text-left px-4 py-2.5 hover:bg-muted transition-colors"
                    >
                      <div className="text-sm font-medium">{product.name}</div>
                      <div className="text-xs text-muted-foreground text-right">
                        {fmt(product.basePrice)}
                      </div>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Items table */}
          {items.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No items added yet. Search for products above.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground text-xs uppercase tracking-wide border-b border-border">
                  <th className="text-left pb-2">Product</th>
                  <th className="text-right pb-2">Price</th>
                  <th className="text-center pb-2">Qty</th>
                  <th className="text-right pb-2">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((item, idx) => (
                  <tr key={idx}>
                    <td className="py-2">
                      <div className="font-medium">{item.productName}</div>
                      {item.variantName && (
                        <div className="text-xs text-muted-foreground">{item.variantName}</div>
                      )}
                    </td>
                    <td className="py-2 text-right text-muted-foreground">
                      {fmt(item.unitPrice)}
                    </td>
                    <td className="py-2">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => changeQty(idx, -1)}
                          className="w-6 h-6 rounded-full hover:bg-muted flex items-center justify-center"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-6 text-center">{item.quantity}</span>
                        <button
                          onClick={() => changeQty(idx, 1)}
                          className="w-6 h-6 rounded-full hover:bg-muted flex items-center justify-center"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                    <td className="py-2 text-right font-medium">
                      {fmt(item.unitPrice * item.quantity)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Totals */}
          <div className="pt-2 border-t border-border space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Items total</span>
              <span className={cn("font-medium", totalOk ? "text-green-600 dark:text-green-400" : "text-red-500")}>
                {fmt(total)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Transaction amount</span>
              <span className="font-medium">{fmt(txnAmount)}</span>
            </div>
            {!totalOk && items.length > 0 && (
              <p className="text-xs text-red-500 pt-1">
                Items total must match transaction amount (±₹1)
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-xl border border-border hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSaveAndDownload}
            disabled={!totalOk || items.length === 0 || downloading}
            className="px-4 py-2 text-sm rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {downloading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            Save & Download
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Transaction Detail Modal ─────────────────────────────────────────────────

function DetailModal({
  txnId,
  onClose,
  onInvoice,
}: {
  txnId: string;
  onClose: () => void;
  onInvoice: (txn: AccuzpayTransaction) => void;
}) {
  const { data: txn, isLoading } = useAccuzpayTransaction(txnId);
  const canInvoice = txn && (txn.status === "CHARGED" || txn.status === "FORWARDED");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold">Transaction Detail</h2>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : !txn ? (
            <p className="text-sm text-muted-foreground text-center py-8">Not found</p>
          ) : (
            <div className="space-y-4 text-sm">
              <Field label="Reference ID" value={txn.referenceId} mono />
              <Field label="HDFC Order ID" value={txn.hdfcOrderId ?? "—"} mono />
              <Field label="Transaction ID" value={txn.txnId ?? "—"} mono />
              <Field label="Amount" value={fmt(txn.amount)} />
              <Field label="Status" value={<StatusBadge status={txn.status} />} />
              <Field label="Customer" value={[txn.customerName, txn.customerPhone, txn.customerEmail].filter(Boolean).join(" · ") || "—"} />
              <Field label="Created" value={fmtDate(txn.createdAt)} />
              {txn.forwardedAt && <Field label="Forwarded" value={fmtDate(txn.forwardedAt)} />}

              {txn.items && txn.items.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    Invoice Items
                  </p>
                  <table className="w-full">
                    <tbody className="divide-y divide-border">
                      {txn.items.map((item: AccuzpayPaymentItem) => (
                        <tr key={item.id}>
                          <td className="py-1.5">
                            <div>{item.productName}</div>
                            {item.variantName && <div className="text-xs text-muted-foreground">{item.variantName}</div>}
                          </td>
                          <td className="py-1.5 text-right text-muted-foreground">×{item.quantity}</td>
                          <td className="py-1.5 text-right font-medium">{fmt(item.totalPrice)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {canInvoice && txn && (
          <div className="px-6 py-4 border-t border-border flex justify-end">
            <button
              onClick={() => { onClose(); onInvoice(txn); }}
              className="flex items-center gap-2 px-4 py-2 text-sm rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <FileText className="w-4 h-4" />
              Generate Invoice
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className={cn("text-right break-all", mono && "font-mono text-xs")}>{value}</span>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function AccuzpayTransactions() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("ALL");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [invoiceTxn, setInvoiceTxn] = useState<AccuzpayTransaction | null>(null);

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading, isFetching } = useAccuzpayTransactions({
    page,
    limit: 20,
    status,
    search: debouncedSearch,
    from,
    to,
  });

  const transactions = data?.transactions ?? [];
  const totalPages = data?.totalPages ?? 1;
  const total = data?.total ?? 0;

  function handleStatusChange(s: string) {
    setStatus(s);
    setPage(1);
  }

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        {/* Page header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Accuzpay Transactions</h1>
            <p className="text-sm text-muted-foreground mt-1">
              HDFC UPI payments processed via Accuzpay
            </p>
          </div>
          {isFetching && !isLoading && (
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-end">
          {/* Search */}
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search ref ID, customer…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-muted rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* Status filter */}
          <div className="flex rounded-xl border border-border overflow-hidden">
            {STATUSES.map((s) => (
              <button
                key={s}
                onClick={() => handleStatusChange(s)}
                className={cn(
                  "px-3 py-2 text-xs font-medium transition-colors",
                  status === s
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted text-muted-foreground"
                )}
              >
                {s === "ALL" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          {/* Date range */}
          <input
            type="date"
            value={from}
            onChange={(e) => { setFrom(e.target.value); setPage(1); }}
            className="px-3 py-2 text-sm bg-muted rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <span className="text-muted-foreground text-sm">to</span>
          <input
            type="date"
            value={to}
            onChange={(e) => { setTo(e.target.value); setPage(1); }}
            className="px-3 py-2 text-sm bg-muted rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          {(from || to) && (
            <button
              onClick={() => { setFrom(""); setTo(""); setPage(1); }}
              className="p-2 hover:bg-muted rounded-xl border border-border"
              title="Clear dates"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
        </div>

        {/* Table */}
        <div className="rounded-2xl border border-border overflow-hidden">
          {isLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground text-sm">
              No transactions found
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr className="text-muted-foreground text-xs uppercase tracking-wide">
                    <th className="text-left px-4 py-3">Reference</th>
                    <th className="text-left px-4 py-3">Customer</th>
                    <th className="text-right px-4 py-3">Amount</th>
                    <th className="text-center px-4 py-3">Status</th>
                    <th className="text-left px-4 py-3">Created</th>
                    <th className="text-center px-4 py-3">Invoice</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {transactions.map((txn) => {
                    const canInvoice = txn.status === "CHARGED" || txn.status === "FORWARDED";
                    return (
                      <tr
                        key={txn.id}
                        className="hover:bg-muted/30 transition-colors cursor-pointer"
                        onClick={() => setDetailId(txn.id)}
                      >
                        <td className="px-4 py-3">
                          <span className="font-mono text-xs">{txn.referenceId}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div>{txn.customerName ?? "—"}</div>
                          {txn.customerPhone && (
                            <div className="text-xs text-muted-foreground">{txn.customerPhone}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-medium">{fmt(txn.amount)}</td>
                        <td className="px-4 py-3 text-center">
                          <StatusBadge status={txn.status} />
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{fmtDate(txn.createdAt)}</td>
                        <td className="px-4 py-3 text-center">
                          {canInvoice && (
                            <button
                              onClick={(e) => { e.stopPropagation(); setInvoiceTxn(txn); }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                            >
                              <FileText className="w-3 h-3" />
                              Invoice
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {!isLoading && total > 0 && (
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {total} transaction{total !== 1 ? "s" : ""}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span>
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {detailId && (
        <DetailModal
          txnId={detailId}
          onClose={() => setDetailId(null)}
          onInvoice={(txn) => setInvoiceTxn(txn)}
        />
      )}

      {invoiceTxn && (
        <InvoiceModal
          txn={invoiceTxn}
          onClose={() => setInvoiceTxn(null)}
        />
      )}
    </AdminLayout>
  );
}
