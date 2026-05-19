import { useQuery, useMutation } from "@tanstack/react-query";
import { fetchApi, uploadAdminMedia } from "@/api/client";
import { queryClient } from "@/lib/queryClient";
import type {
  BackendProduct,
  BackendCategory,
  AdminOrder,
  AdminOrdersQuery,
  UpdateOrderStatusPayload,
  UpdatePaymentStatusPayload,
  ProductsQueryParams,
} from "@/api/types";

export function useAdminProducts() {
  return useQuery({
    queryKey: ["admin", "products"],
    queryFn: async (): Promise<BackendProduct[]> => {
      const res = await fetchApi<BackendProduct[]>("/products?limit=200");
      if (!res.success || !res.data) return [];
      return res.data;
    },
  });
}

export interface AdminProductsPaginatedResponse {
  products: BackendProduct[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function useAdminProductsPaginated(
  params: Pick<ProductsQueryParams, "page" | "limit" | "status" | "search">
) {
  const page = params.page ?? 1;
  const limit = params.limit ?? 50;
  const status = params.status ?? "all";
  const search = params.search?.toString().trim() ?? "";

  const searchParams = new URLSearchParams();
  searchParams.set("page", String(page));
  searchParams.set("limit", String(limit));
  // Admin can request a specific status, or "all" to see everything
  if (status) {
    searchParams.set("status", status);
  }
  // Use backend's full-text query param so search runs on the server across all products
  if (search) {
    searchParams.set("q", search);
  }
  const qs = searchParams.toString();

  return useQuery({
    queryKey: ["admin", "products", qs],
    queryFn: async (): Promise<AdminProductsPaginatedResponse> => {
      const res = await fetchApi<BackendProduct[]>(`/products?${qs}`);
      const products = res.success && Array.isArray(res.data) ? res.data : [];
      const total = typeof res.total === "number" ? res.total : products.length;
      const effectiveLimit = typeof res.limit === "number" && res.limit > 0 ? res.limit : limit;
      const effectivePage = typeof res.page === "number" && res.page > 0 ? res.page : page;
      const totalPages =
        effectiveLimit > 0 ? Math.max(1, Math.ceil(total / effectiveLimit)) : 1;

      return {
        products,
        total,
        page: effectivePage,
        limit: effectiveLimit,
        totalPages,
      };
    },
  });
}

export function useAdminProduct(id: string) {
  return useQuery({
    queryKey: ["admin", "products", id],
    queryFn: async (): Promise<BackendProduct | null> => {
      if (!id) return null;
      const res = await fetchApi<BackendProduct>(`/products/${encodeURIComponent(id)}`);
      if (!res.success || !res.data) return null;
      return res.data;
    },
    enabled: !!id,
  });
}

export function useCreateProduct() {
  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      return await fetchApi<BackendProduct>("/products", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });
}

export function useUpdateProduct() {
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      return await fetchApi<BackendProduct>(`/products/${encodeURIComponent(id)}`, {
        method: "PUT",
        body: JSON.stringify(data),
      });
    },
    onSuccess: (_res, vars) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "products", vars.id] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });
}

export function useDeleteProduct() {
  return useMutation({
    mutationFn: async (id: string) => {
      return await fetchApi<void>(`/products/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });
}

export function useAdminCategories() {
  return useQuery({
    queryKey: ["admin", "categories"],
    queryFn: async (): Promise<BackendCategory[]> => {
      const res = await fetchApi<BackendCategory[]>("/categories");
      if (!res.success || !res.data) return [];
      return res.data;
    },
  });
}

export function useCreateCategory() {
  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      return await fetchApi<BackendCategory>("/categories", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "categories"] });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
  });
}

export function useUpdateCategory() {
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      return await fetchApi<BackendCategory>(`/categories/${encodeURIComponent(id)}`, {
        method: "PUT",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "categories"] });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
  });
}

export function useDeleteCategory() {
  return useMutation({
    mutationFn: async (id: string) => {
      return await fetchApi<void>(`/categories/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "categories"] });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
  });
}

export interface DashboardStats {
  totalOrders: number;
  totalRevenue: number;
  lowStockCount: number;
}

export function useDashboardStats() {
  return useQuery({
    queryKey: ["admin", "dashboard"],
    queryFn: async (): Promise<DashboardStats | null> => {
      try {
        const res = await fetchApi<DashboardStats>("/admin/dashboard/stats");
        if (res.success && res.data) return res.data;
      } catch {
        // endpoint may not be available
      }
      return null;
    },
  });
}

export interface InventoryItem {
  variantId: string;
  quantity: number;
  reservedQty?: number;
  lowThreshold?: number;
  variant?: {
    id: string;
    sku: string;
    name?: string | null;
    options: Record<string, string>;
    product?: {
      id: string;
      name: string;
      sku: string;
    };
  };
}

export function useAdminInventory() {
  return useQuery({
    queryKey: ["admin", "inventory"],
    queryFn: async (): Promise<InventoryItem[]> => {
      const res = await fetchApi<InventoryItem[]>("/admin/inventory");
      if (!res.success || !res.data) return [];
      return res.data;
    },
  });
}

export function useUpdateInventory() {
  return useMutation({
    mutationFn: async ({ variantId, quantity }: { variantId: string; quantity: number }) => {
      return await fetchApi<InventoryItem>(
        `/admin/inventory/${encodeURIComponent(variantId)}`,
        {
          method: "PATCH",
          body: JSON.stringify({ quantity }),
        }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "inventory"] });
    },
  });
}

export interface AdminFeedSection {
  id: string;
  categorySlug: string;
  type: string;
  title: string;
  image?: string | null;
  mobile_image?: string | null;
  redirect_url?: string | null;
  displayOrder: number;
  isActive: boolean;
  items?: Array<Record<string, unknown>>;
}

export function useAdminFeedSections(categorySlug: string) {
  return useQuery({
    queryKey: ["admin", "feed-sections", categorySlug],
    queryFn: async (): Promise<AdminFeedSection[]> => {
      const res = await fetchApi<AdminFeedSection[]>(
        `/admin/category-feed-sections?categorySlug=${encodeURIComponent(categorySlug)}`
      );
      if (!res.success || !res.data) return [];
      return res.data;
    },
    enabled: !!categorySlug,
  });
}

export function useCreateFeedSection() {
  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      return await fetchApi<AdminFeedSection>("/admin/category-feed-sections", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "feed-sections"] });
      queryClient.invalidateQueries({ queryKey: ["category-feed"] });
    },
  });
}

export function useUpdateFeedSection() {
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      return await fetchApi<AdminFeedSection>(
        `/admin/category-feed-sections/${encodeURIComponent(id)}`,
        {
          method: "PATCH",
          body: JSON.stringify(data),
        }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "feed-sections"] });
      queryClient.invalidateQueries({ queryKey: ["category-feed"] });
    },
  });
}

export function useDeleteFeedSection() {
  return useMutation({
    mutationFn: async (id: string) => {
      return await fetchApi<void>(
        `/admin/category-feed-sections/${encodeURIComponent(id)}`,
        { method: "DELETE" }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "feed-sections"] });
      queryClient.invalidateQueries({ queryKey: ["category-feed"] });
    },
  });
}

export interface HeroBanner {
  id: string;
  title: string;
  subtitle: string;
  image: string;
  color: string;
  isActive: boolean;
  sortOrder: number;
}

export function useAdminHeroBanners() {
  return useQuery({
    queryKey: ["admin", "hero-banners"],
    queryFn: async (): Promise<HeroBanner[]> => {
      const res = await fetchApi<HeroBanner[]>("/admin/hero-banners");
      if (!res.success || !res.data) return [];
      return res.data;
    },
  });
}

export function useCreateHeroBanner() {
  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      return await fetchApi<HeroBanner>("/admin/hero-banners", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "hero-banners"] });
    },
  });
}

export function useUpdateHeroBanner() {
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      return await fetchApi<HeroBanner>(
        `/admin/hero-banners/${encodeURIComponent(id)}`,
        {
          method: "PATCH",
          body: JSON.stringify(data),
        }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "hero-banners"] });
    },
  });
}

export function useDeleteHeroBanner() {
  return useMutation({
    mutationFn: async (id: string) => {
      return await fetchApi<void>(
        `/admin/hero-banners/${encodeURIComponent(id)}`,
        {
          method: "DELETE",
        }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "hero-banners"] });
    },
  });
}

// ---- Admin Orders ----

export interface AdminOrdersResponse {
  orders: AdminOrder[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function useAdminOrders(query: AdminOrdersQuery) {
  const params = new URLSearchParams();
  if (query.page) params.set("page", String(query.page));
  if (query.limit) params.set("limit", String(query.limit));
  if (query.search) params.set("search", query.search);
  if (query.status) params.set("status", query.status);
  if (query.dateFrom) params.set("dateFrom", query.dateFrom);
  if (query.dateTo) params.set("dateTo", query.dateTo);
  if (query.sort) params.set("sort", query.sort);
  if (query.userId) params.set("userId", query.userId);
  const qs = params.toString();

  return useQuery({
    queryKey: ["admin", "orders", qs],
    queryFn: async (): Promise<AdminOrdersResponse> => {
      const res = await fetchApi<AdminOrdersResponse>(`/admin/orders?${qs}`);
      if (!res.success || !res.data) return { orders: [], total: 0, page: 1, limit: 20, totalPages: 0 };
      return res.data;
    },
  });
}

export function useAdminOrderDetail(id: string) {
  return useQuery({
    queryKey: ["admin", "orders", id],
    queryFn: async (): Promise<AdminOrder | null> => {
      if (!id) return null;
      const res = await fetchApi<AdminOrder>(`/admin/orders/${encodeURIComponent(id)}`);
      if (!res.success || !res.data) return null;
      return res.data;
    },
    enabled: !!id,
  });
}

export function useUpdateOrderStatus() {
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateOrderStatusPayload }) => {
      return await fetchApi<AdminOrder>(
        `/admin/orders/${encodeURIComponent(id)}/status`,
        {
          method: "PATCH",
          body: JSON.stringify(data),
        }
      );
    },
    onSuccess: (_res, vars) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "orders"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "orders", vars.id] });
    },
  });
}

export function useUpdatePaymentStatus() {
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdatePaymentStatusPayload }) => {
      return await fetchApi<AdminOrder>(
        `/admin/orders/${encodeURIComponent(id)}/payment-status`,
        {
          method: "PATCH",
          body: JSON.stringify(data),
        }
      );
    },
    onSuccess: (_res, vars) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "orders"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "orders", vars.id] });
    },
  });
}

export function useCancelOrder() {
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      return await fetchApi<AdminOrder>(
        `/admin/orders/${encodeURIComponent(id)}/cancel`,
        {
          method: "POST",
          body: JSON.stringify({ reason }),
        }
      );
    },
    onSuccess: (_res, vars) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "orders"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "orders", vars.id] });
    },
  });
}

export function useAddOrderNote() {
  return useMutation({
    mutationFn: async ({ id, note }: { id: string; note: string }) => {
      return await fetchApi<AdminOrder>(
        `/admin/orders/${encodeURIComponent(id)}/notes`,
        {
          method: "POST",
          body: JSON.stringify({ note }),
        }
      );
    },
    onSuccess: (_res, vars) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "orders"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "orders", vars.id] });
    },
  });
}

export function useAdminUploadMedia() {
  return useMutation({
    mutationFn: (files: File[]) => uploadAdminMedia(files),
  });
}

// ---- Accuzpay Transactions ----

export interface AccuzpayTransaction {
  id: string;
  referenceId: string;
  hdfcOrderId: string | null;
  txnId: string | null;
  customerId: string | null;
  amount: string;
  status: string;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  forwardedAt: string | null;
  createdAt: string;
  updatedAt: string;
  items?: AccuzpayPaymentItem[];
}

export interface AccuzpayPaymentItem {
  id: string;
  productId: string;
  variantId: string | null;
  productName: string;
  variantName: string | null;
  unitPrice: string;
  quantity: number;
  totalPrice: string;
}

export interface AccuzpayProductResult {
  id: string;
  name: string;
  sku: string;
  basePrice: string;
  variants: { id: string; name: string | null; priceAdjustment: string }[];
}

export interface AccuzpayTransactionsQuery {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
  from?: string;
  to?: string;
}

export interface AccuzpayTransactionsResponse {
  transactions: AccuzpayTransaction[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function useAccuzpayTransactions(query: AccuzpayTransactionsQuery) {
  const qs = new URLSearchParams();
  if (query.page) qs.set("page", String(query.page));
  if (query.limit) qs.set("limit", String(query.limit));
  if (query.status && query.status !== "ALL") qs.set("status", query.status);
  if (query.search) qs.set("search", query.search);
  if (query.from) qs.set("startDate", query.from);
  if (query.to) qs.set("endDate", query.to);
  const qStr = qs.toString();

  return useQuery({
    queryKey: ["admin", "accuzpay-transactions", qStr],
    queryFn: async (): Promise<AccuzpayTransactionsResponse> => {
      const raw = await fetchApi<AccuzpayTransaction[]>(
        `/payments/hdfc/accuzpay/transactions?${qStr}`
      ) as unknown as {
        success: boolean;
        data?: AccuzpayTransaction[];
        pagination?: { total: number; page: number; limit: number; pages: number };
      };
      const transactions = raw.data ?? [];
      const pg = raw.pagination;
      return {
        transactions,
        total: pg?.total ?? transactions.length,
        page: pg?.page ?? (query.page ?? 1),
        limit: pg?.limit ?? (query.limit ?? 20),
        totalPages: pg?.pages ?? 1,
      };
    },
  });
}

export function useAccuzpayTransaction(id: string) {
  return useQuery({
    queryKey: ["admin", "accuzpay-transactions", id],
    queryFn: async (): Promise<AccuzpayTransaction | null> => {
      if (!id) return null;
      const res = await fetchApi<AccuzpayTransaction>(
        `/payments/hdfc/accuzpay/transactions/${encodeURIComponent(id)}`
      );
      return res.success && res.data ? res.data : null;
    },
    enabled: !!id,
  });
}

export function useAccuzpayProductSearch(q: string, enabled: boolean) {
  return useQuery({
    queryKey: ["admin", "accuzpay-products", q],
    queryFn: async (): Promise<AccuzpayProductResult[]> => {
      const qs = new URLSearchParams({ q });
      const res = await fetchApi<AccuzpayProductResult[]>(
        `/payments/hdfc/accuzpay/products?${qs}`
      );
      return res.success && Array.isArray(res.data) ? res.data : [];
    },
    enabled: enabled && q.trim().length >= 2,
  });
}

export function useSaveAccuzpayItems() {
  return useMutation({
    mutationFn: async ({
      id,
      items,
    }: {
      id: string;
      items: { productId: string; variantId?: string; quantity: number; unitPrice: number }[];
    }) => {
      return fetchApi(`/payments/hdfc/accuzpay/transactions/${encodeURIComponent(id)}/items`, {
        method: "POST",
        body: JSON.stringify({ items }),
      });
    },
    onSuccess: (_res, vars) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "accuzpay-transactions", vars.id] });
    },
  });
}
