import type { BackendProduct, Product, BackendCategory, Category } from "./types";

const PLACEHOLDER_IMAGE =
  "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80";

function parseDecimal(value: number | string | undefined | null): number {
  if (value === undefined || value === null) return 0;
  if (typeof value === "number") return value;
  const n = parseFloat(String(value));
  return Number.isFinite(n) ? n : 0;
}

function extractColors(variants: BackendProduct["variants"]): string[] {
  if (!variants?.length) return [];
  const set = new Set<string>();
  variants.forEach((v) => {
    const color = v.options?.color;
    if (color) set.add(color);
  });
  return Array.from(set);
}

function extractSizes(variants: BackendProduct["variants"]): string[] {
  if (!variants?.length) return [];
  const set = new Set<string>();
  variants.forEach((v) => {
    const size = v.options?.size;
    if (size) set.add(size);
  });
  return Array.from(set);
}

function totalStock(variants: BackendProduct["variants"]): number {
  if (!variants?.length) return 0;
  return variants.reduce((sum, v) => {
    const q = v.inventory?.quantity ?? 0;
    return sum + q;
  }, 0);
}

export function mapBackendProductToProduct(p: BackendProduct): Product {
  const price = parseDecimal(p.basePrice);
  const images =
    p.richContent?.media_gallery?.length &&
    p.richContent.media_gallery.some((m) => m.url)
      ? p.richContent.media_gallery
          .slice()
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
          .map((m) => m.url)
      : [PLACEHOLDER_IMAGE];
  const description =
    p.richContent?.description_html ?? (p as unknown as { description?: string }).description ?? "";
  const colors = extractColors(p.variants);
  const sizes = extractSizes(p.variants);
  const stock = totalStock(p.variants);

  return {
    id: p.id,
    sku: p.sku,
    name: p.name,
    slug: p.slug,
    price,
    // When discountPct is present, treat basePrice as discounted price,
    // compute original "strike" price and expose discount percentage.
    strikePrice:
      (p as any).discountPct != null && typeof (p as any).discountPct === "number"
        ? Number((price / (1 - (p as any).discountPct / 100)).toFixed(2))
        : null,
    discount:
      (p as any).discountPct != null && typeof (p as any).discountPct === "number"
        ? (p as any).discountPct
        : null,
    category: p.category ?? null,
    images,
    description:
      typeof description === "string"
        ? description.replace(/<[^>]*>/g, "").trim()
        : "",
    colors,
    sizes,
    rating: p.rating ?? 0,
    reviewsCount: p.reviewsCount ?? 0,
    reviews: p.reviews ?? null,
    ratingSummary: p.ratingSummary ?? null,
    stock,
    brand: p.brand ?? null,
    isFeatured: p.isFeatured ?? false,
    isTrending: p.isTrending ?? false,
    isNewArrival: p.isNewArrival ?? false,
    variants: p.variants,
    richContent: p.richContent ?? null,
  };
}

export function mapBackendProductListToProduct(p: BackendProduct): Product {
  return mapBackendProductToProduct({
    ...p,
    variants: p.variants ?? [],
  });
}

export function mapBackendCategoryToCategory(c: BackendCategory): Category {
  return {
    ...c,
    children: c.children?.map(mapBackendCategoryToCategory),
  };
}
