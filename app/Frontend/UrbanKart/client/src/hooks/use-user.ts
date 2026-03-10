import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { fetchApi } from "@/api/client";
import { useAuth } from "@/store/use-auth";
import type {
  DashboardOverview,
  UserProfile,
  Order,
  UserAddress,
  WishlistItem,
  SavedCard,
  UserNotification,
  UpdateProfilePayload,
  ChangePasswordPayload,
  CreateAddressPayload,
  ApiResponse,
  BackendProduct,
} from "@/api/types";
import { mapBackendProductToProduct } from "@/api/mappers";
import { useToast } from "@/hooks/use-toast";

export function useDashboardOverview() {
  return useQuery<DashboardOverview>({
    queryKey: ["/api/v1/user/dashboard"],
    queryFn: async () => {
      const res = await fetchApi<DashboardOverview>("user/dashboard");
      return res.data!;
    },
  });
}

export function useUserProfile() {
  return useQuery<UserProfile>({
    queryKey: ["/api/v1/user/profile"],
    queryFn: async () => {
      const res = await fetchApi<UserProfile>("user/profile");
      return res.data!;
    },
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (payload: UpdateProfilePayload) => {
      return fetchApi<UserProfile>("user/profile", {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/v1/user/profile"] });
      qc.invalidateQueries({ queryKey: ["/api/v1/user/dashboard"] });
      toast({ title: "Profile updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    },
  });
}

export function useChangePassword() {
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (payload: ChangePasswordPayload) => {
      return fetchApi<void>("user/change-password", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      toast({ title: "Password changed successfully" });
    },
    onError: (err: Error) => {
      toast({ title: "Password change failed", description: err.message, variant: "destructive" });
    },
  });
}

export function useOrders(page = 1, limit = 10) {
  return useQuery<{ orders: Order[]; total: number }>({
    queryKey: ["/api/v1/user/orders", page, limit],
    queryFn: async () => {
      const res = await fetchApi<Order[]>(`user/orders?page=${page}&limit=${limit}`);
      return { orders: res.data ?? [], total: res.total ?? 0 };
    },
  });
}

export function useOrderDetail(orderId: string) {
  return useQuery<Order>({
    queryKey: ["/api/v1/user/orders", orderId],
    queryFn: async () => {
      const res = await fetchApi<Order>(`user/orders/${orderId}`);
      return res.data!;
    },
    enabled: !!orderId,
  });
}

export function useAddresses() {
  return useQuery<UserAddress[]>({
    queryKey: ["/api/v1/user/addresses"],
    queryFn: async () => {
      const res = await fetchApi<UserAddress[]>("user/addresses");
      return res.data ?? [];
    },
  });
}

export function useCreateAddress() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (payload: CreateAddressPayload) => {
      return fetchApi<UserAddress>("user/addresses", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/v1/user/addresses"] });
      qc.invalidateQueries({ queryKey: ["/api/v1/user/dashboard"] });
      toast({ title: "Address added" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to add address", description: err.message, variant: "destructive" });
    },
  });
}

export function useUpdateAddress() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, ...payload }: CreateAddressPayload & { id: string }) => {
      return fetchApi<UserAddress>(`user/addresses/${id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/v1/user/addresses"] });
      toast({ title: "Address updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to update address", description: err.message, variant: "destructive" });
    },
  });
}

export function useDeleteAddress() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: string) => {
      return fetchApi<void>(`user/addresses/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/v1/user/addresses"] });
      qc.invalidateQueries({ queryKey: ["/api/v1/user/dashboard"] });
      toast({ title: "Address deleted" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to delete address", description: err.message, variant: "destructive" });
    },
  });
}

export function useSetDefaultAddress() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: string) => {
      return fetchApi<UserAddress>(`user/addresses/${id}/default`, { method: "PATCH" });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/v1/user/addresses"] });
      toast({ title: "Default address updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to set default", description: err.message, variant: "destructive" });
    },
  });
}

export function useWishlist(options?: { enabled?: boolean }) {
  return useQuery<WishlistItem[]>({
    queryKey: ["/api/v1/user/wishlist"],
    queryFn: async () => {
      const res = await fetchApi<unknown>("user/wishlist");
      const raw = (res as ApiResponse<unknown>).data as
        | Array<{ id: string; productId: string; addedAt: string; product: BackendProduct }>
        | undefined;
      const items = raw ?? [];
      return items.map((item) => ({
        ...item,
        product: mapBackendProductToProduct({
          ...item.product,
          variants: (item.product as any).variants ?? [],
          richContent: (item.product as any).richContent ?? null,
        }),
      }));
    },
    enabled: options?.enabled !== false,
  });
}

export function useAddToWishlist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (productId: string) => {
      return fetchApi<WishlistItem>("user/wishlist", {
        method: "POST",
        body: JSON.stringify({ productId }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/v1/user/wishlist"] });
      qc.invalidateQueries({ queryKey: ["/api/v1/user/dashboard"] });
    },
  });
}

export function useRemoveFromWishlist() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (itemId: string) => {
      return fetchApi<void>(`user/wishlist/${itemId}`, { method: "DELETE" });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/v1/user/wishlist"] });
      qc.invalidateQueries({ queryKey: ["/api/v1/user/dashboard"] });
      toast({ title: "Removed from wishlist" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to remove", description: err.message, variant: "destructive" });
    },
  });
}

/**
 * Account-specific wishlist: when logged in uses API; when guest prompts login.
 * Use this in ProductCard, ProductDetail, and Header for consistent behavior.
 */
export function useWishlistState() {
  const { isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { data: items = [], isLoading } = useWishlist({ enabled: isAuthenticated() });
  const addToWishlist = useAddToWishlist();
  const removeFromWishlist = useRemoveFromWishlist();

  const wishlistIds = items.map((i) => i.productId);
  const count = items.length;
  const isInWishlist = (productId: string) => wishlistIds.includes(productId);

  const toggleWishlist = (productId: string) => {
    if (!isAuthenticated()) {
      toast({
        title: "Sign in to save items",
        description: "Please sign in to add products to your wishlist.",
        variant: "destructive",
      });
      setLocation("/signin");
      return;
    }
    if (isInWishlist(productId)) {
      const item = items.find((i) => i.productId === productId);
      if (item) removeFromWishlist.mutate(item.id);
    } else {
      addToWishlist.mutate(productId);
    }
  };

  return {
    wishlistIds,
    count,
    isInWishlist,
    toggleWishlist,
    isLoading: isAuthenticated() ? isLoading : false,
  };
}

export function useSavedCards() {
  return useQuery<SavedCard[]>({
    queryKey: ["/api/v1/user/saved-cards"],
    queryFn: async () => {
      const res = await fetchApi<SavedCard[]>("user/saved-cards");
      return res.data ?? [];
    },
  });
}

export function useDeleteSavedCard() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: string) => {
      return fetchApi<void>(`user/saved-cards/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/v1/user/saved-cards"] });
      toast({ title: "Card removed" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to remove card", description: err.message, variant: "destructive" });
    },
  });
}

export function useNotifications() {
  return useQuery<UserNotification[]>({
    queryKey: ["/api/v1/user/notifications"],
    queryFn: async () => {
      const res = await fetchApi<UserNotification[]>("user/notifications");
      return res.data ?? [];
    },
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      return fetchApi<void>(`user/notifications/${id}/read`, { method: "PATCH" });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/v1/user/notifications"] });
      qc.invalidateQueries({ queryKey: ["/api/v1/user/dashboard"] });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async () => {
      return fetchApi<void>("user/notifications/read-all", { method: "PATCH" });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/v1/user/notifications"] });
      qc.invalidateQueries({ queryKey: ["/api/v1/user/dashboard"] });
      toast({ title: "All notifications marked as read" });
    },
  });
}

export function useRequestReturn() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ orderId, reason }: { orderId: string; reason: string }) => {
      return fetchApi<void>(`user/orders/${orderId}/return`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/v1/user/orders"] });
      toast({ title: "Return request submitted" });
    },
    onError: (err: Error) => {
      toast({ title: "Return request failed", description: err.message, variant: "destructive" });
    },
  });
}
