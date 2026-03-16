import { useState, useEffect, useRef } from "react";
import { useParams } from "wouter";
import { useProduct, useProducts } from "@/hooks/use-shop";
import { useCart } from "@/store/use-cart";
import { useWishlistState } from "@/hooks/use-user";
import { useToast } from "@/hooks/use-toast";
import { formatPrice, cn, getMediaUrl } from "@/lib/utils";
import { RatingStars } from "@/components/ui/Icons";
import { ProductCard } from "@/components/product/ProductCard";
import {
  ShoppingBag,
  Heart,
  ShieldCheck,
  Truck,
  RotateCcw,
  Check,
  Star,
} from "lucide-react";

export default function ProductDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { data: product, isLoading } = useProduct(slug || "");
  const categorySlug =
    product?.category && typeof product.category === "object" && "slug" in product.category
      ? product.category.slug
      : undefined;

  const { data: sameCategoryData } = useProducts({
    category: categorySlug,
    status: "published",
    limit: 10,
  });
  const { data: fallbackData } = useProducts({
    status: "published",
    sort: "newest",
    limit: 12,
  });
  const sameCategoryProducts = sameCategoryData?.list ?? [];
  const fallbackProducts = fallbackData?.list ?? [];

  const youMayLike = (() => {
    const excludeId = product?.id;
    const fromCategory = sameCategoryProducts.filter((p) => p.id !== excludeId).slice(0, 4);
    const need = 4 - fromCategory.length;
    if (need <= 0) return fromCategory;
    const fromFallback = fallbackProducts.filter(
      (p) => p.id !== excludeId && !fromCategory.some((c) => c.id === p.id)
    );
    return [...fromCategory, ...fromFallback.slice(0, need)];
  })();

  const { addItem } = useCart();
  const { toggleWishlist, isInWishlist } = useWishlistState();
  const { toast } = useToast();

  const [selectedImage, setSelectedImage] = useState(0);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [zoomHover, setZoomHover] = useState(false);
  const [zoomPos, setZoomPos] = useState({ x: 50, y: 50 });
  const [isAdding, setIsAdding] = useState(false);
  const [addSuccess, setAddSuccess] = useState(false);
  const addTimeoutRef = useRef<number | null>(null);
  const [wishlistBump, setWishlistBump] = useState(false);
  const wishlistTimeoutRef = useRef<number | null>(null);

  const handleImageMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setZoomPos({ x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) });
  };

  const handleScrollToReviews = () => {
    const el = document.getElementById("product-ratings");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  useEffect(() => {
    if (!product) return;
    if (product.colors?.length && selectedColor === null) {
      setSelectedColor(product.colors[0]);
    }
    if (product.sizes?.length && selectedSize === null) {
      setSelectedSize(product.sizes[0]);
    }
  }, [product, selectedColor, selectedSize]);

  useEffect(() => {
    return () => {
      if (addTimeoutRef.current) {
        clearTimeout(addTimeoutRef.current);
      }
      if (wishlistTimeoutRef.current) {
        clearTimeout(wishlistTimeoutRef.current);
      }
    };
  }, []);

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          <div className="animate-pulse bg-muted aspect-square rounded-3xl" />
          <div className="space-y-6 py-8">
            <div className="animate-pulse bg-muted h-10 w-3/4 rounded-lg" />
            <div className="animate-pulse bg-muted h-6 w-1/4 rounded-lg" />
            <div className="animate-pulse bg-muted h-32 w-full rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="text-center py-20 font-bold text-2xl">
        Product not found
      </div>
    );
  }

  const isWished = isInWishlist(product.id);
  const rawImages = product.images?.length
    ? product.images
    : [
        "https://res.cloudinary.com/dbmlo1jox/image/upload/v1771961177/main-sample.png",
      ];
  const images = rawImages.map((url) => getMediaUrl(url));

  const handleAddToCart = () => {
    if (product.colors?.length && !selectedColor) {
      toast({ title: "Select a color", variant: "destructive" });
      return;
    }
    if (product.sizes?.length && !selectedSize) {
      toast({ title: "Select a size", variant: "destructive" });
      return;
    }

    const variant = product.variants?.find(
      (v) =>
        v.options?.color === selectedColor && v.options?.size === selectedSize
    );
    const variantSku = variant?.sku;

    addItem({
      product,
      quantity,
      selectedColor: selectedColor ?? undefined,
      selectedSize: selectedSize ?? undefined,
      variantSku,
    });

    setIsAdding(true);
    setAddSuccess(true);

    toast({
      title: "Added to Cart",
      description: `${quantity}x ${product.name} added to your cart.`,
    });

    if (addTimeoutRef.current) {
      clearTimeout(addTimeoutRef.current);
    }
    addTimeoutRef.current = window.setTimeout(() => {
      setAddSuccess(false);
      setIsAdding(false);
    }, 1500);
  };

  const handleWishlistToggle = () => {
    toggleWishlist(product.id);
    setWishlistBump(true);
    if (wishlistTimeoutRef.current) {
      clearTimeout(wishlistTimeoutRef.current);
    }
    wishlistTimeoutRef.current = window.setTimeout(() => {
      setWishlistBump(false);
    }, 180);
  };

  const hasDiscount =
    product.strikePrice != null && product.strikePrice > product.price;
  const maxQuantity =
    product.stock && product.stock > 0 ? Math.min(product.stock, 10) : 1;

  return (
    <div className="bg-background min-h-screen pt-8 pb-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12 mt-6">
          <div className="lg:col-span-2 flex flex-col-reverse md:flex-row gap-4 lg:sticky lg:top-28 lg:self-start">
            <div className="flex md:flex-col gap-3 overflow-x-auto md:overflow-y-auto no-scrollbar md:w-20 shrink-0">
              {images.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedImage(idx)}
                  className={cn(
                    "w-16 h-20 md:w-20 md:h-24 shrink-0 rounded-xl overflow-hidden border-2 transition-all",
                    selectedImage === idx
                      ? "border-primary"
                      : "border-transparent opacity-70 hover:opacity-100"
                  )}
                >
                  <img
                    src={img}
                    alt={`${product.name} ${idx}`}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>

            <div
              className="flex-1 relative bg-muted rounded-3xl overflow-hidden aspect-[4/5] md:aspect-square max-w-full"
              onMouseEnter={() => setZoomHover(true)}
              onMouseLeave={() => setZoomHover(false)}
              onMouseMove={handleImageMouseMove}
            >
              <img
                src={images[selectedImage] ?? images[0]}
                alt={product.name}
                className="w-full h-full object-cover object-center pointer-events-none select-none"
                draggable={false}
              />
              {product.isFeatured && (
                <div className="absolute top-4 left-4 flex flex-col gap-2 z-10">
                  <span className="bg-accent text-accent-foreground text-sm font-bold px-3 py-1.5 rounded-full shadow-lg">
                    FEATURED
                  </span>
                </div>
              )}

              {zoomHover && (
                <>
                  <div
                    className="absolute z-20 w-28 h-28 md:w-36 md:h-36 rounded-full border-2 border-white/80 bg-white/20 shadow-xl pointer-events-none"
                    style={{
                      left: `${zoomPos.x}%`,
                      top: `${zoomPos.y}%`,
                      transform: "translate(-50%, -50%)",
                    }}
                  />
                  <div className="hidden lg:block absolute z-30 right-4 top-1/2 -translate-y-1/2 w-72 h-72 xl:w-80 xl:h-80 rounded-2xl border-2 border-border bg-muted overflow-hidden shadow-2xl pointer-events-none">
                    <div
                      className="absolute inset-0 bg-cover bg-no-repeat"
                      style={{
                        backgroundImage: `url(${images[selectedImage] ?? images[0]})`,
                        backgroundSize: "250%",
                        backgroundPosition: `${zoomPos.x}% ${zoomPos.y}%`,
                      }}
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="py-6 flex flex-col lg:col-span-1">
            {product.category &&
              typeof product.category === "object" &&
              "name" in product.category && (
                <p className="text-primary font-bold tracking-widest uppercase text-sm mb-2">
                  {product.category.name}
                </p>
              )}

            <h1 className="font-display font-black text-3xl md:text-4xl text-foreground mb-4 leading-tight tracking-tight">
              {product.name}
            </h1>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mb-6 pb-6 border-b border-border">
              {(product.reviewsCount ?? 0) > 0 && product.rating != null && (
                <button
                  type="button"
                  onClick={handleScrollToReviews}
                  className="flex items-center gap-2 flex-wrap text-left group"
                >
                  <div className="flex items-center gap-1">
                    <RatingStars
                      rating={Number(product.rating)}
                      className="w-5 h-5"
                    />
                    <span className="font-medium text-foreground">
                      {product.rating}
                    </span>
                  </div>
                  <span className="text-muted-foreground text-sm group-hover:text-primary group-hover:underline underline-offset-2 cursor-pointer">
                    {product.reviewsCount} reviews
                  </span>
                </button>
              )}
              <div className="text-green-600 font-medium flex items-center gap-1">
                <Check className="w-4 h-4" />
                In Stock ({product.stock})
              </div>
            </div>

            <div className="flex flex-wrap items-end gap-3 mb-8">
              <span
                className={cn(
                  "font-display font-black text-4xl",
                  hasDiscount ? "text-accent" : "text-foreground"
                )}
              >
                {formatPrice(product.price)}
              </span>
              {product.strikePrice != null &&
                product.strikePrice > product.price && (
                  <>
                    <span className="text-xl text-muted-foreground line-through mb-1">
                      {formatPrice(product.strikePrice)}
                    </span>
                    {product.discount != null && product.discount > 0 && (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-accent text-accent-foreground">
                        {product.discount}% OFF
                      </span>
                    )}
                  </>
                )}
            </div>

            {product.description && (
              <div className="mb-8 space-y-2">
                <h2 className="text-sm font-semibold tracking-widest uppercase text-muted-foreground">
                  Description
                </h2>
                <p className="text-muted-foreground leading-relaxed text-sm md:text-base">
                  {product.description}
                </p>
              </div>
            )}

            {product.colors && product.colors.length > 0 && (
              <div className="mb-6">
                <div className="flex justify-between items-center mb-3">
                  <span className="font-bold">
                    Color:{" "}
                    <span className="font-normal text-muted-foreground">
                      {selectedColor}
                    </span>
                  </span>
                </div>
                <div className="flex flex-wrap gap-3">
                  {product.colors.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setSelectedColor(color)}
                      className={cn(
                        "relative w-9 h-9 rounded-full border-2 flex items-center justify-center transition-all",
                        selectedColor === color
                          ? "border-primary shadow-sm"
                          : "border-transparent hover:border-muted-foreground"
                      )}
                      title={color}
                    >
                      <span
                        className="w-7 h-7 rounded-full border border-border"
                        style={{ backgroundColor: color.toLowerCase() }}
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {product.sizes && product.sizes.length > 0 && (
              <div className="mb-8">
                <div className="flex justify-between items-center mb-3">
                  <span className="font-bold">
                    Size:{" "}
                    <span className="font-normal text-muted-foreground">
                      {selectedSize}
                    </span>
                  </span>
                  <button className="text-sm text-primary underline">
                    Size Guide
                  </button>
                </div>
                <div className="flex flex-wrap gap-3">
                  {product.sizes.map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setSelectedSize(size)}
                      className={cn(
                        "min-w-[3rem] h-10 px-4 rounded-full border-2 font-medium text-sm transition-all flex items-center justify-center",
                        selectedSize === size
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border hover:border-primary/50 text-foreground"
                      )}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center gap-6 mb-6">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-muted-foreground">
                  Quantity
                </span>
                <div className="inline-flex items-center rounded-full border border-border overflow-hidden">
                  <button
                    type="button"
                    onClick={() =>
                      setQuantity((q) => Math.max(1, q - 1))
                    }
                    className="w-9 h-9 flex items-center justify-center text-lg border-r border-border hover:bg-muted disabled:opacity-40"
                    disabled={quantity <= 1}
                  >
                    −
                  </button>
                  <span className="w-10 text-center text-sm font-medium select-none">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setQuantity((q) => Math.min(maxQuantity, q + 1))
                    }
                    className="w-9 h-9 flex items-center justify-center text-lg border-l border-border hover:bg-muted disabled:opacity-40"
                    disabled={quantity >= maxQuantity}
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            <div className="flex gap-4 mb-10">
              <button
                onClick={handleAddToCart}
                disabled={product.stock === 0 || isAdding}
                className="flex-1 bg-primary text-primary-foreground py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 hover:bg-primary/90 hover:shadow-lg transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {product.stock === 0 ? (
                  <>
                    <ShoppingBag className="w-5 h-5" />
                    Out of Stock
                  </>
                ) : isAdding ? (
                  <>
                    <span className="h-4 w-4 rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground animate-spin" />
                    Adding...
                  </>
                ) : addSuccess ? (
                  <>
                    <Check className="w-5 h-5" />
                    Added ✓
                  </>
                ) : (
                  <>
                    <ShoppingBag className="w-5 h-5" />
                    Add to Cart
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleWishlistToggle}
                className={cn(
                  "w-16 shrink-0 bg-card border-2 border-border flex items-center justify-center rounded-xl hover:border-primary/50 transition-colors transition-transform",
                  wishlistBump && "scale-110"
                )}
              >
                <Heart
                  className={cn(
                    "w-6 h-6 transition-colors transition-transform",
                    isWished && "fill-accent text-accent"
                  )}
                />
              </button>
            </div>

            <div className="bg-muted rounded-2xl p-6 grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="flex flex-col gap-2">
                <Truck className="w-6 h-6 text-primary" />
                <h4 className="font-bold text-sm">Free Delivery</h4>
                <p className="text-xs text-muted-foreground">
                  On orders over ₹1,000
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <RotateCcw className="w-6 h-6 text-primary" />
                <h4 className="font-bold text-sm">30 Days Return</h4>
                <p className="text-xs text-muted-foreground">
                  Easy return policy
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <ShieldCheck className="w-6 h-6 text-primary" />
                <h4 className="font-bold text-sm">Secure Payment</h4>
                <p className="text-xs text-muted-foreground">
                  100% secure checkout
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {(product.rating != null || product.ratingSummary) && (
        <section
          id="product-ratings"
          className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-16 pt-12 border-t border-border"
        >
          <h2 className="font-display font-bold text-2xl md:text-3xl text-foreground mb-6">
            Ratings
          </h2>
          <div className="flex flex-wrap items-center gap-6 mb-2">
            <span className="text-foreground font-semibold">
              {product.rating ?? "—"} Star selected
            </span>
            <span className="text-muted-foreground">
              {product.reviewsCount ?? 0} Customers
            </span>
          </div>

          {product.ratingSummary && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 mt-8">
              <div>
                <h3 className="font-semibold text-foreground mb-4">Rating Distribution</h3>
                <div className="space-y-3 max-w-md">
                  {([5, 4, 3, 2, 1] as const).map((star) => {
                    const pct = product.ratingSummary!.ratingDistribution?.[star] ?? 0;
                    return (
                      <div key={star} className="flex items-center gap-3">
                        <div className="flex items-center gap-1 w-20 shrink-0">
                          <span className="text-sm text-foreground w-4">{star}</span>
                          <Star className="w-4 h-4 fill-amber-400 text-amber-400 shrink-0" strokeWidth={1.5} />
                        </div>
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden min-w-[80px]">
                          <div
                            className="h-full bg-amber-400 rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-sm text-muted-foreground w-10 shrink-0">{pct}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-4">Customer Opinion</h3>
                <div className="space-y-6">
                  {product.ratingSummary.fitOpinion && Object.keys(product.ratingSummary.fitOpinion).length > 0 && (
                    <div>
                      <p className="text-foreground font-medium mb-2">How was the Product fit?</p>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(product.ratingSummary.fitOpinion).map(([label, pct]) => (
                          <span
                            key={label}
                            className="inline-flex items-center rounded-lg bg-muted px-3 py-1.5 text-sm text-foreground"
                          >
                            {label}({pct}%)
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  <div>
                    <p className="text-foreground font-medium mb-2">How was the Product Quality?</p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(product.ratingSummary.qualityOpinion || {}).map(([label, pct]) => (
                        <span
                          key={label}
                          className="inline-flex items-center rounded-lg bg-muted px-3 py-1.5 text-sm text-foreground"
                        >
                          {label}({pct}%)
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {youMayLike.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-24 border-t border-border pt-16">
          <h2 className="font-display font-bold text-3xl mb-10 text-center">
            You may also like
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {youMayLike.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
