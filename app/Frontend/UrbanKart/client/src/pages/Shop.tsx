import { useState, useEffect, useMemo, useRef } from "react";
import { useLocation, useSearch, Link } from "wouter";
import {
  Filter,
  SlidersHorizontal,
  ChevronDown,
  ChevronRight,
  X,
  Home,
  LayoutGrid,
  LayoutList,
} from "lucide-react";
import { useProducts, useProductsInfinite, useCategories } from "@/hooks/use-shop";
import { ProductCard } from "@/components/product/ProductCard";
import { cn, getMediaUrl } from "@/lib/utils";
import type { Category } from "@/api/types";

export default function Shop() {
  const searchString = useSearch();
  const searchParams = new URLSearchParams(searchString);

  const [filters, setFilters] = useState({
    category: searchParams.get("category") || "",
    subcategory: searchParams.get("subcategory") || "",
    sub_subcategory: searchParams.get("sub_subcategory") || "",
    brand: searchParams.get("brand") || "",
    price_min: searchParams.get("price_min") || "",
    price_max: searchParams.get("price_max") || "",
    size: searchParams.get("size") || "",
    color: searchParams.get("color") || "",
    featured: searchParams.get("featured") === "true",
    sort: searchParams.get("sort") || "newest",
    search: searchParams.get("search") || "",
  });

  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());

  useEffect(() => {
    setFilters({
      category: searchParams.get("category") || "",
      subcategory: searchParams.get("subcategory") || "",
      sub_subcategory: searchParams.get("sub_subcategory") || "",
      brand: searchParams.get("brand") || "",
      price_min: searchParams.get("price_min") || "",
      price_max: searchParams.get("price_max") || "",
      size: searchParams.get("size") || "",
      color: searchParams.get("color") || "",
      featured: searchParams.get("featured") === "true",
      sort: searchParams.get("sort") || "newest",
      search: searchParams.get("search") || "",
    });
  }, [searchString]);

  const isAllCategories =
    !filters.category &&
    !filters.subcategory &&
    !filters.sub_subcategory &&
    !filters.search &&
    !filters.brand &&
    !filters.size &&
    !filters.color &&
    !filters.price_min &&
    !filters.price_max &&
    !filters.featured;

  const useInfiniteScroll = !filters.search;

  const infiniteParams = useMemo(
    () =>
      useInfiniteScroll
        ? {
            category: filters.category || undefined,
            subcategory: filters.subcategory || undefined,
            sub_subcategory: filters.sub_subcategory || undefined,
            brand: filters.brand || undefined,
            price_min: filters.price_min ? Number(filters.price_min) : undefined,
            price_max: filters.price_max ? Number(filters.price_max) : undefined,
            size: filters.size || undefined,
            color: filters.color || undefined,
            featured: filters.featured || undefined,
            sort: (searchParams.get("sort") || (isAllCategories ? "random" : "newest")) as "random" | "newest" | "price_low" | "price_high",
            seed: searchParams.get("seed") ? parseFloat(searchParams.get("seed")!) : 0.5,
            status: "published" as const,
          }
        : undefined,
    [searchString, useInfiniteScroll, filters.category, filters.subcategory, filters.sub_subcategory, filters.brand, filters.price_min, filters.price_max, filters.size, filters.color, filters.featured, isAllCategories]
  );

  const {
    data: productsData,
    isLoading: loadingProducts,
  } = useProducts({
    category: filters.category || undefined,
    subcategory: filters.subcategory || undefined,
    sub_subcategory: filters.sub_subcategory || undefined,
    brand: filters.brand || undefined,
    price_min: filters.price_min ? Number(filters.price_min) : undefined,
    price_max: filters.price_max ? Number(filters.price_max) : undefined,
    size: filters.size || undefined,
    color: filters.color || undefined,
    featured: filters.featured || undefined,
    sort: filters.sort || undefined,
    status: "published",
    search: filters.search || undefined,
    limit: filters.search ? 1000 : undefined,
  });

  const infiniteQuery = useProductsInfinite(infiniteParams);

  const { data: categories = [] } = useCategories();
  const [, setLocation] = useLocation();

  const scrollSentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!useInfiniteScroll || !infiniteQuery.hasNextPage || infiniteQuery.isFetchingNextPage) return;
    const el = scrollSentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) infiniteQuery.fetchNextPage();
      },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [useInfiniteScroll, infiniteQuery.hasNextPage, infiniteQuery.isFetchingNextPage, infiniteQuery.fetchNextPage]);

  const products = useInfiniteScroll ? infiniteQuery.products : (productsData?.list ?? []);
  const totalCount = useInfiniteScroll ? infiniteQuery.total : (productsData?.total ?? products.length);
  const loadingProductsOrInfinite = loadingProducts || (useInfiniteScroll && infiniteQuery.isLoading);

  const sortedProducts = useMemo(() => {
    const list = [...(products ?? [])];
    if (filters.sort === "price_low") list.sort((a, b) => a.price - b.price);
    else if (filters.sort === "price_high") list.sort((a, b) => b.price - a.price);
    return list;
  }, [products, filters.sort]);

  const updateFilter = (key: string, value: string) => {
    const newParams = new URLSearchParams(searchString);
    if (value) {
      newParams.set(key, value);
    } else {
      newParams.delete(key);
    }
    setLocation(`/shop?${newParams.toString()}`);
  };

  const findCategoryBySlug = (list: Category[], slug: string): Category | null => {
    for (const cat of list) {
      if (cat.slug === slug) return cat;
      if (cat.children?.length) {
        const found = findCategoryBySlug(cat.children, slug);
        if (found) return found;
      }
    }
    return null;
  };

  const findParentOfSlug = (list: Category[], slug: string): Category | null => {
    for (const cat of list) {
      if (cat.children?.some((c) => c.slug === slug)) return cat;
      if (cat.children?.length) {
        const found = findParentOfSlug(cat.children, slug);
        if (found) return found;
      }
    }
    return null;
  };

  const isElectronicsSlug = (slug?: string | null) => slug === "electronics";

  const selectedCategory = useMemo(
    () => (filters.category ? findCategoryBySlug(categories, filters.category) : null),
    [categories, filters.category]
  );

  const parentCategory = useMemo(
    () => (filters.category ? findParentOfSlug(categories, filters.category) : null),
    [categories, filters.category]
  );

  const { subcategories, activeSubSlug } = useMemo(() => {
    if (!filters.category || !categories.length)
      return { subcategories: [] as Category[], activeSubSlug: "" };

    if (selectedCategory?.children?.length) {
      return { subcategories: selectedCategory.children, activeSubSlug: "" };
    }

    if (parentCategory?.children?.length) {
      return { subcategories: parentCategory.children, activeSubSlug: filters.category };
    }

    return { subcategories: [] as Category[], activeSubSlug: "" };
  }, [categories, filters.category, selectedCategory, parentCategory]);

  const breadcrumbs = useMemo(() => {
    const crumbs: { label: string; slug?: string }[] = [];
    if (!filters.category) return crumbs;

    if (parentCategory) {
      crumbs.push({ label: parentCategory.name, slug: parentCategory.slug });
    }
    if (selectedCategory) {
      crumbs.push({ label: selectedCategory.name });
    }
    return crumbs;
  }, [filters.category, selectedCategory, parentCategory]);

  const pageTitle = useMemo(() => {
    if (filters.search) return `Search results for “${filters.search}”`;
    if (filters.sub_subcategory) {
      const found = findCategoryBySlug(categories, filters.sub_subcategory);
      if (found) return found.name;
    }
    if (filters.subcategory) {
      const found = findCategoryBySlug(categories, filters.subcategory);
      if (found) return found.name;
    }
    if (filters.category && selectedCategory) return selectedCategory.name;
    if (filters.featured) return "Featured Products";
    return "All Products";
  }, [filters.category, filters.subcategory, filters.sub_subcategory, filters.featured, filters.search, selectedCategory, categories]);

  useEffect(() => {
    if (filters.category && parentCategory) {
      setExpandedCats((prev) => new Set([...prev, parentCategory.slug]));
    }
  }, [filters.category, parentCategory]);

  const toggleCatExpand = (slug: string) => {
    setExpandedCats((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };

  const activeFilters: { label: string; clear: () => void }[] = [];
  if (filters.category && selectedCategory) {
    activeFilters.push({
      label: selectedCategory.name,
      clear: () => {
        const p = new URLSearchParams(searchString);
        p.delete("category");
        p.delete("subcategory");
        p.delete("sub_subcategory");
        setLocation(`/shop?${p.toString()}`);
      },
    });
  }
  if (filters.subcategory) {
    const subCat = findCategoryBySlug(categories, filters.subcategory);
    activeFilters.push({
      label: subCat?.name || filters.subcategory,
      clear: () => {
        const p = new URLSearchParams(searchString);
        p.delete("subcategory");
        p.delete("sub_subcategory");
        setLocation(`/shop?${p.toString()}`);
      },
    });
  }
  if (filters.sub_subcategory) {
    const subSubCat = findCategoryBySlug(categories, filters.sub_subcategory);
    activeFilters.push({
      label: subSubCat?.name || filters.sub_subcategory,
      clear: () => updateFilter("sub_subcategory", ""),
    });
  }
  if (filters.brand) {
    activeFilters.push({
      label: `Brand: ${filters.brand}`,
      clear: () => updateFilter("brand", ""),
    });
  }
  if (filters.search) {
    activeFilters.push({
      label: `Search: “${filters.search}”`,
      clear: () => updateFilter("search", ""),
    });
  }
  if (filters.size) {
    activeFilters.push({
      label: `Size: ${filters.size}`,
      clear: () => updateFilter("size", ""),
    });
  }
  if (filters.color) {
    activeFilters.push({
      label: `Color: ${filters.color}`,
      clear: () => updateFilter("color", ""),
    });
  }
  if (filters.price_min || filters.price_max) {
    const label = filters.price_min && filters.price_max
      ? `₹${filters.price_min} – ₹${filters.price_max}`
      : filters.price_min
        ? `From ₹${filters.price_min}`
        : `Up to ₹${filters.price_max}`;
    activeFilters.push({
      label,
      clear: () => {
        const p = new URLSearchParams(searchString);
        p.delete("price_min");
        p.delete("price_max");
        setLocation(`/shop?${p.toString()}`);
      },
    });
  }
  if (filters.featured) {
    activeFilters.push({
      label: "Featured",
      clear: () => updateFilter("featured", ""),
    });
  }

  return (
    <div className="bg-background min-h-screen pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-4">
        <nav className="flex items-center gap-1.5 text-sm text-muted-foreground" data-testid="breadcrumb-nav">
          <Link href="/" className="hover:text-foreground transition-colors flex items-center gap-1">
            <Home className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Home</span>
          </Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <Link
            href="/shop"
            className={cn(
              "hover:text-foreground transition-colors",
              !filters.category && !filters.featured && "text-foreground font-medium"
            )}
          >
            Shop
          </Link>
          {breadcrumbs.map((crumb, i) => (
            <span key={i} className="flex items-center gap-1.5">
              <ChevronRight className="w-3.5 h-3.5" />
              {crumb.slug ? (
                <button
                  onClick={() => updateFilter("category", crumb.slug!)}
                  className="hover:text-foreground transition-colors"
                >
                  {crumb.label}
                </button>
              ) : (
                <span className="text-foreground font-medium">{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="font-display font-bold text-3xl md:text-4xl" data-testid="text-shop-title">
              {pageTitle}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {loadingProductsOrInfinite
                ? "Loading..."
                : `${totalCount.toLocaleString()} product${totalCount !== 1 ? "s" : ""}`}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMobileFiltersOpen(!isMobileFiltersOpen)}
              className="md:hidden flex items-center gap-2 px-4 py-2 border border-border rounded-xl font-medium text-sm"
              data-testid="button-mobile-filters"
            >
              <Filter className="w-4 h-4" /> Filters
            </button>

            <div className="relative">
              <select
                value={isAllCategories ? (filters.sort || "random") : filters.sort}
                onChange={(e) => updateFilter("sort", e.target.value)}
                className="appearance-none bg-card border border-border pl-4 pr-10 py-2.5 rounded-xl text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:outline-none cursor-pointer shadow-sm"
                data-testid="select-sort"
              >
                {isAllCategories && <option value="random">Random</option>}
                <option value="newest">Newest</option>
                <option value="price_low">Price: Low to High</option>
                <option value="price_high">Price: High to Low</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none text-muted-foreground" />
            </div>
          </div>
        </div>

        {activeFilters.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mb-6" data-testid="active-filters">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Active:</span>
            {activeFilters.map((f, i) => (
              <button
                key={i}
                onClick={f.clear}
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-semibold hover:bg-primary/20 transition-colors"
                data-testid={`filter-chip-${i}`}
              >
                {f.label}
                <X className="w-3 h-3" />
              </button>
            ))}
            {activeFilters.length > 1 && (
              <button
                onClick={() => setLocation("/shop")}
                className="text-xs text-muted-foreground hover:text-foreground underline"
              >
                Clear all
              </button>
            )}
          </div>
        )}

        <div className="flex flex-col md:flex-row gap-8">
          <aside
            className={cn(
              "md:w-64 shrink-0",
              isMobileFiltersOpen ? "block" : "hidden md:block"
            )}
          >
            <div className="bg-card border border-border rounded-2xl p-5 sticky top-24 shadow-sm space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-border">
                <div className="flex items-center gap-2 font-display font-bold text-base">
                  <SlidersHorizontal className="w-4 h-4" />
                  Filters
                </div>
                <button
                  className="md:hidden p-1 hover:bg-muted rounded-lg"
                  onClick={() => setIsMobileFiltersOpen(false)}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div>
                <h3 className="font-semibold text-sm mb-3">Categories</h3>
                <div className="space-y-0.5">
                  <button
                    onClick={() => {
                      setLocation(`/shop?sort=random&seed=${Math.random()}`);
                    }}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors",
                      !filters.category
                        ? "bg-primary/10 text-primary font-semibold"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                    data-testid="filter-all-categories"
                  >
                    All Categories
                  </button>

                  {categories.map((cat) => {
                    const hasChildren = cat.children && cat.children.length > 0;
                    const isExpanded = expandedCats.has(cat.slug);
                    const isParentActive = filters.category === cat.slug;
                    const isChildActive = cat.children?.some((c) => c.slug === filters.category);
                    const isElectronics = isElectronicsSlug(cat.slug);

                    return (
                      <div key={cat.id}>
                        <div className="flex items-center">
                          {isElectronics ? (
                            <span
                              className={cn(
                                "flex-1 text-left px-3 py-2 rounded-lg text-sm text-muted-foreground cursor-default select-none"
                              )}
                              data-testid={`filter-category-${cat.slug}`}
                            >
                              {cat.name}
                            </span>
                          ) : (
                            <button
                              onClick={() => updateFilter("category", cat.slug)}
                              className={cn(
                                "flex-1 text-left px-3 py-2 rounded-lg text-sm transition-colors",
                                isParentActive
                                  ? "bg-primary/10 text-primary font-semibold"
                                  : isChildActive
                                    ? "text-foreground font-medium"
                                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                              )}
                              data-testid={`filter-category-${cat.slug}`}
                            >
                              {cat.name}
                            </button>
                          )}
                          {hasChildren && !isElectronics && (
                            <button
                              onClick={() => toggleCatExpand(cat.slug)}
                              className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground"
                            >
                              <ChevronDown
                                className={cn(
                                  "w-3.5 h-3.5 transition-transform",
                                  isExpanded && "rotate-180"
                                )}
                              />
                            </button>
                          )}
                        </div>

                        {hasChildren && isExpanded && !isElectronics && (
                          <div className="ml-3 pl-3 border-l border-border space-y-0.5 mt-0.5">
                            {cat.children!.map((sub) => {
                              const isSubElectronics = isElectronicsSlug(sub.slug);
                              return isSubElectronics ? (
                                <span
                                  key={sub.id}
                                  className="w-full block text-left px-3 py-1.5 rounded-lg text-sm text-muted-foreground cursor-default select-none"
                                  data-testid={`filter-category-${sub.slug}`}
                                >
                                  {sub.name}
                                </span>
                              ) : (
                                <button
                                  key={sub.id}
                                  onClick={() => updateFilter("category", sub.slug)}
                                  className={cn(
                                    "w-full text-left px-3 py-1.5 rounded-lg text-sm transition-colors",
                                    filters.category === sub.slug
                                      ? "bg-primary/10 text-primary font-semibold"
                                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                  )}
                                  data-testid={`filter-category-${sub.slug}`}
                                >
                                  {sub.name}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="pt-2 border-t border-border">
                <h3 className="font-semibold text-sm mb-3">Display</h3>
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={filters.featured}
                    onChange={(e) =>
                      updateFilter("featured", e.target.checked ? "true" : "")
                    }
                    className="w-4 h-4 text-primary focus:ring-primary border-gray-300 rounded"
                    data-testid="checkbox-featured"
                  />
                  <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                    Featured only
                  </span>
                </label>
              </div>
            </div>
          </aside>

          <div className="flex-1 space-y-6">
            {subcategories.length > 0 && (
              <div className="flex flex-wrap gap-2" data-testid="subcategory-pills">
                {subcategories.map((sub) => {
                  const isSubElectronics = isElectronicsSlug(sub.slug);
                  return isSubElectronics ? (
                    <span
                      key={sub.id}
                      className={cn(
                        "px-4 py-2 rounded-full text-sm font-medium border border-border bg-card text-muted-foreground cursor-default select-none"
                      )}
                      data-testid={`pill-subcategory-${sub.slug}`}
                    >
                      {sub.name}
                    </span>
                  ) : (
                    <button
                      key={sub.id}
                      onClick={() => updateFilter("category", sub.slug)}
                      className={cn(
                        "px-4 py-2 rounded-full text-sm font-medium border transition-all",
                        activeSubSlug === sub.slug
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card hover:border-primary/50 hover:bg-primary/5"
                      )}
                      data-testid={`pill-subcategory-${sub.slug}`}
                    >
                      {sub.name}
                    </button>
                  );
                })}
              </div>
            )}

            {loadingProductsOrInfinite ? (
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                {[...Array(6)].map((_, i) => (
                  <div
                    key={i}
                    className="animate-pulse bg-card border border-border aspect-[3/4] rounded-2xl"
                  />
                ))}
              </div>
            ) : sortedProducts.length > 0 ? (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                  {sortedProducts.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
                {useInfiniteScroll && infiniteQuery.hasNextPage && (
                  <div ref={scrollSentinelRef} className="h-10 flex items-center justify-center py-8">
                    {infiniteQuery.isFetchingNextPage && (
                      <div className="animate-pulse text-sm text-muted-foreground">Loading more...</div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="bg-card border border-border rounded-2xl p-12 text-center">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                  <Filter className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="font-display font-bold text-xl mb-2">
                  No products found
                </h3>
                <p className="text-muted-foreground mb-6">
                  Try adjusting your filters or browse all categories.
                </p>
                <button
                  onClick={() => setLocation("/shop")}
                  className="px-6 py-2.5 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 transition-colors"
                  data-testid="button-clear-filters"
                >
                  Clear Filters
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
