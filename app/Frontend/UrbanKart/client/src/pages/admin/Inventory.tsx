import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useAdminInventory, useUpdateInventory } from "@/hooks/use-admin";
import { useToast } from "@/hooks/use-toast";
import { Warehouse, Search, Loader2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export default function AdminInventory() {
  const { data: inventory = [], isLoading } = useAdminInventory();
  const updateInventory = useUpdateInventory();
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQty, setEditQty] = useState("");

  const filtered = inventory.filter((item) => {
    const q = search.toLowerCase();
    const sku = item.variant?.sku?.toLowerCase() ?? "";
    const product = item.variant?.product?.name?.toLowerCase() ?? "";
    const variantName = item.variant?.name?.toLowerCase() ?? "";
    return sku.includes(q) || product.includes(q) || variantName.includes(q);
  });

  const startEdit = (variantId: string, currentQty: number) => {
    setEditingId(variantId);
    setEditQty(String(currentQty));
  };

  const saveEdit = async (variantId: string) => {
    const quantity = parseInt(editQty);
    if (isNaN(quantity) || quantity < 0) {
      toast({ title: "Invalid quantity", variant: "destructive" });
      return;
    }
    try {
      await updateInventory.mutateAsync({ variantId, quantity });
      toast({ title: "Stock updated" });
      setEditingId(null);
    } catch (e: any) {
      toast({
        title: "Update failed",
        description: e.message,
        variant: "destructive",
      });
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h2 className="font-display font-bold text-2xl" data-testid="text-inventory-title">
            Inventory
          </h2>
          <p className="text-muted-foreground text-sm">
            {filtered.length} variant{filtered.length !== 1 ? "s" : ""}
          </p>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by SKU, product or variant..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-card border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:outline-none"
            data-testid="input-search-inventory"
          />
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="animate-pulse bg-card border border-border h-14 rounded-xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-12 text-center">
            <div className="w-14 h-14 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <Warehouse className="w-7 h-7 text-muted-foreground" />
            </div>
            <h3 className="font-display font-bold text-lg mb-1">No inventory data</h3>
            <p className="text-muted-foreground text-sm">
              {search ? "No results match your search." : "Inventory will appear here once your backend returns data."}
            </p>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="table-inventory">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left px-5 py-3 font-semibold">Product</th>
                    <th className="text-left px-5 py-3 font-semibold hidden sm:table-cell">Variant</th>
                    <th className="text-left px-5 py-3 font-semibold">SKU</th>
                    <th className="text-left px-5 py-3 font-semibold">Stock</th>
                    <th className="text-right px-5 py-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item) => {
                    const isLow = item.quantity <= (item.lowThreshold ?? 5);
                    return (
                      <tr
                        key={item.variantId}
                        className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                        data-testid={`row-inventory-${item.variantId}`}
                      >
                        <td className="px-5 py-3 font-medium">
                          {item.variant?.product?.name ?? "—"}
                        </td>
                        <td className="px-5 py-3 text-muted-foreground hidden sm:table-cell">
                          {item.variant?.name ??
                            (item.variant?.options
                              ? Object.values(item.variant.options).join(" / ")
                              : "—")}
                        </td>
                        <td className="px-5 py-3 text-muted-foreground font-mono text-xs">
                          {item.variant?.sku ?? "—"}
                        </td>
                        <td className="px-5 py-3">
                          {editingId === item.variantId ? (
                            <input
                              type="number"
                              min="0"
                              value={editQty}
                              onChange={(e) => setEditQty(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") saveEdit(item.variantId);
                                if (e.key === "Escape") setEditingId(null);
                              }}
                              className="w-20 px-2 py-1 bg-background border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:outline-none"
                              autoFocus
                              data-testid={`input-qty-${item.variantId}`}
                            />
                          ) : (
                            <span
                              className={cn(
                                "inline-flex items-center gap-1.5 font-semibold tabular-nums",
                                isLow && "text-amber-600"
                              )}
                            >
                              {isLow && <AlertTriangle className="w-3.5 h-3.5" />}
                              {item.quantity}
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-right">
                          {editingId === item.variantId ? (
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => saveEdit(item.variantId)}
                                disabled={updateInventory.isPending}
                                className="px-3 py-1 bg-primary text-primary-foreground rounded-lg text-xs font-medium disabled:opacity-60"
                                data-testid={`button-save-qty-${item.variantId}`}
                              >
                                {updateInventory.isPending ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  "Save"
                                )}
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                className="px-3 py-1 border border-border rounded-lg text-xs font-medium hover:bg-muted"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => startEdit(item.variantId, item.quantity)}
                              className="px-3 py-1 border border-border rounded-lg text-xs font-medium hover:bg-muted transition-colors"
                              data-testid={`button-edit-qty-${item.variantId}`}
                            >
                              Update
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
