import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { fetchApi } from "@/api/client";
import type {
  BackendProduct,
  BackendCategory,
  ProductsQueryParams,
  HeroBanner,
  CategoryFeedSection,
  MenuCategory,
} from "@/api/types";
import { getHeroBanners } from "@/api/content";
import {
  mapBackendProductListToProduct,
  mapBackendProductToProduct,
  mapBackendCategoryToCategory,
} from "@/api/mappers";
import type { Product, Category } from "@/api/types";

export function useProducts(params?: ProductsQueryParams) {
  return useQuery({
    queryKey: ["products", params],
    queryFn: async (): Promise<{ list: Product[]; total: number }> => {
      const search = new URLSearchParams();
      if (params?.category) search.set("category", params.category);
      if (params?.subcategory) search.set("subcategory", params.subcategory);
      if (params?.sub_subcategory) search.set("sub_subcategory", params.sub_subcategory);
      if (params?.brand) search.set("brand", params.brand);
      if (params?.price_min !== undefined) search.set("price_min", String(params.price_min));
      if (params?.price_max !== undefined) search.set("price_max", String(params.price_max));
      if (params?.size) search.set("size", params.size);
      if (params?.color) search.set("color", params.color);
      if (params?.featured !== undefined) search.set("featured", String(params.featured));
      if (params?.trending !== undefined) search.set("trending", String(params.trending));
      if (params?.newArrivals !== undefined) search.set("new_arrivals", String(params.newArrivals));
      if (params?.status) search.set("status", params.status);
      if (params?.sort) search.set("sort", params.sort);
      if (params?.page !== undefined) search.set("page", String(params.page));
      if (params?.limit !== undefined) search.set("limit", String(params.limit));
      if (params?.search) search.set("q", params.search);
      if (params?.seed !== undefined) search.set("seed", String(params.seed));
      const path = `/products${search.toString() ? `?${search.toString()}` : ""}`;
      const res = await fetchApi<BackendProduct[]>(path);
      if (!res.success || !res.data) return { list: [], total: 0 };
      const total = typeof res.total === "number" ? res.total : res.data.length;
      return { list: res.data.map(mapBackendProductListToProduct), total };
    },
  });
}

const PRODUCTS_PAGE_SIZE = 24;

/** Paginated products with infinite scroll. Use for All Categories / full listing. */
export function useProductsInfinite(params?: ProductsQueryParams) {
  const query = useInfiniteQuery({
    queryKey: ["products-infinite", params],
    enabled: !!params,
    queryFn: async ({ pageParam = 1 }): Promise<{ list: Product[]; total: number; page: number; limit: number }> => {
      const search = new URLSearchParams();
      if (params?.category) search.set("category", params.category);
      if (params?.subcategory) search.set("subcategory", params.subcategory);
      if (params?.sub_subcategory) search.set("sub_subcategory", params.sub_subcategory);
      if (params?.brand) search.set("brand", params.brand);
      if (params?.price_min !== undefined) search.set("price_min", String(params.price_min));
      if (params?.price_max !== undefined) search.set("price_max", String(params.price_max));
      if (params?.size) search.set("size", params.size);
      if (params?.color) search.set("color", params.color);
      if (params?.featured !== undefined) search.set("featured", String(params.featured));
      if (params?.trending !== undefined) search.set("trending", String(params.trending));
      if (params?.newArrivals !== undefined) search.set("new_arrivals", String(params.newArrivals));
      if (params?.status) search.set("status", params.status);
      if (params?.sort) search.set("sort", params.sort);
      if (params?.seed !== undefined) search.set("seed", String(params.seed));
      search.set("page", String(pageParam));
      search.set("limit", String(params?.limit ?? PRODUCTS_PAGE_SIZE));
      if (params?.search) search.set("q", params.search);
      const path = `/products?${search.toString()}`;
      const res = await fetchApi<BackendProduct[]>(path);
      if (!res.success || !res.data) {
        return { list: [], total: 0, page: pageParam, limit: PRODUCTS_PAGE_SIZE };
      }
      const total = typeof res.total === "number" ? res.total : res.data.length;
      const list = res.data.map(mapBackendProductListToProduct);
      return {
        list,
        total,
        page: typeof res.page === "number" ? res.page : pageParam,
        limit: typeof res.limit === "number" ? res.limit : PRODUCTS_PAGE_SIZE,
      };
    },
    getNextPageParam: (lastPage) => {
      const { total, page, limit } = lastPage;
      const nextPage = page + 1;
      if ((nextPage - 1) * limit >= total) return undefined;
      return nextPage;
    },
    initialPageParam: 1,
  });

  const products = query.data?.pages.flatMap((p) => p.list) ?? [];
  const total = query.data?.pages[0]?.total ?? 0;

  return {
    ...query,
    products,
    total,
  };
}

export function useProduct(slug: string) {
  return useQuery({
    queryKey: ["product", slug],
    queryFn: async (): Promise<Product | null> => {
      if (!slug) return null;
      const res = await fetchApi<BackendProduct>(`/products/${encodeURIComponent(slug)}`);
      if (!res.success || !res.data) return null;
      return mapBackendProductToProduct(res.data);
    },
    enabled: !!slug,
  });
}

export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: async (): Promise<Category[]> => {
      const res = await fetchApi<BackendCategory[]>("/categories");
      if (!res.success || !res.data) return [];
      return res.data.map(mapBackendCategoryToCategory);
    },
  });
}

export function useMenuCategories() {
  return useQuery({
    queryKey: ["categories-menu"],
    queryFn: async (): Promise<MenuCategory[]> => {
      const res = await fetchApi<MenuCategory[]>("/categories/menu");
      if (!res.success || !res.data) return [];
      return res.data;
    },
    staleTime: 1 * 60 * 1000, // 1 min so navbar updates soon after DB seed
  });
}

export function useHeroBanners() {
  return useQuery({
    queryKey: ["hero-banners"],
    queryFn: async (): Promise<HeroBanner[]> => {
      return getHeroBanners();
    },
  });
}

export function useCategoryFeed(slug: string) {
  return useQuery({
    queryKey: ["category-feed", slug],
    queryFn: async (): Promise<CategoryFeedSection[]> => {
      if (!slug) return [];
      try {
        const res = await fetchApi<never>(`/content/category-feed/${encodeURIComponent(slug)}`);
        if (!res.success) return [];
        if (res.sections) return res.sections;
        if (res.data && Array.isArray(res.data)) return res.data as unknown as CategoryFeedSection[];
        return [];
      } catch {
        return [];
      }
    },
    enabled: !!slug,
    staleTime: 2 * 60 * 1000,
  });
}

export function useCategoryBySlug(slug: string) {
  const { data: categories = [] } = useCategories();

  function find(list: Category[], s: string): Category | null {
    for (const cat of list) {
      if (cat.slug === s) return cat;
      if (cat.children?.length) {
        const found = find(cat.children, s);
        if (found) return found;
      }
    }
    return null;
  }

  return find(categories, slug);
}

/** Top 4–5 product matches for search dropdown. Pass debounced query. */
export function useSearchSuggestions(query: string) {
  const trimmed = query.trim();
  return useQuery({
    queryKey: ["products", "suggestions", trimmed],
    queryFn: async (): Promise<Product[]> => {
      if (!trimmed) return [];
      const params = new URLSearchParams({ q: trimmed, limit: "5" });
      const res = await fetchApi<BackendProduct[]>(`/products?${params.toString()}`);
      if (!res.success || !res.data) return [];
      return res.data.map(mapBackendProductListToProduct);
    },
    enabled: trimmed.length >= 2,
    staleTime: 60 * 1000,
  });
}
