import { useParams, Link, useLocation } from "wouter";
import { useCategories, useProducts, useCategoryFeed, useCategoryBySlug } from "@/hooks/use-shop";
import { ProductCard } from "@/components/product/ProductCard";
import { ChevronRight, Home, ArrowRight, Sparkles, TrendingUp, Tag } from "lucide-react";
import { cn, formatPrice, getMediaUrl } from "@/lib/utils";
import type { CategoryFeedSection, CategoryFeedItem } from "@/api/types";

const CATEGORY_ICON_MAP: Record<string, string> = {
  // Fashion root subcategories
  "fashion-men": "static/ecommerce-icons/11-men-clothing.png",
  "fashion-women": "static/ecommerce-icons/12-women-clothing.png",
  "fashion-boys": "static/ecommerce-icons/13-kids-clothing.png",
  "fashion-girls": "static/ecommerce-icons/13-kids-clothing.png",

  // Beauty root
  beauty: "static/ecommerce-icons/26-makeup.png",

  // Home root subcategories
  "home-kitchen": "static/ecommerce-icons/21-cookware.png",
  "home-decor": "static/ecommerce-icons/18-furniture.png",
  "home-furnishing": "static/ecommerce-icons/19-sofas.png",
};

export default function CategoryFeed() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug || "";
  const [, setLocation] = useLocation();
  const isTopArrivalsCategory = slug === "fashion" || slug === "home";

  // Map storefront category slugs to content feed slugs, if they differ
  const feedSlug =
    slug === "men-style"
      ? "men"
      : slug === "women-style"
      ? "women"
      : slug;

  const category = useCategoryBySlug(slug);
  const { data: feedSections = [], isLoading: loadingFeed } = useCategoryFeed(feedSlug);
  const { data: productsData, isLoading: loadingProducts } = useProducts({
    category: slug,
    status: "published",
  });
  const { data: trendingData } = useProducts({
    category: slug,
    trending: true,
    status: "published",
  });
  const products = productsData?.list ?? [];
  const trendingProducts = trendingData?.list ?? [];

  const subcategories = category?.children ?? [];
  const categoryName = category?.name ?? slug.charAt(0).toUpperCase() + slug.slice(1);
  const categoryImage = category?.imageUrl;

  const newArrivalsSection =
    products.length > 0 && (
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-16">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h2 className="font-display font-bold text-2xl">New Arrivals</h2>
              <p className="text-sm text-muted-foreground">Latest additions to {categoryName}</p>
            </div>
          </div>
          <Link
            href={`/shop?category=${slug}`}
            className="text-sm font-semibold text-primary hover:underline flex items-center gap-1 hidden sm:flex"
            data-testid="link-view-all-arrivals"
          >
            View All <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
          {products.slice(0, 8).map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>
    );

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="relative bg-gradient-to-r from-foreground to-foreground/80 text-background overflow-hidden">
        {categoryImage && (
          <img
            src={getMediaUrl(categoryImage)}
            alt={categoryName}
            className="absolute inset-0 w-full h-full object-cover opacity-30"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/50 to-black/30" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
          <nav className="flex items-center gap-1.5 text-sm text-white/70 mb-6" data-testid="breadcrumb-nav">
            <Link href="/" className="hover:text-white transition-colors flex items-center gap-1">
              <Home className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Home</span>
            </Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-white font-medium">{categoryName}</span>
          </nav>
          <h1 className="font-display font-black text-4xl md:text-6xl text-white mb-3" data-testid="text-category-title">
            {categoryName}
          </h1>
          {category?.description && (
            <p className="text-white/80 text-lg max-w-xl">{category.description}</p>
          )}
          <Link
            href={`/shop?category=${slug}`}
            className="inline-flex items-center gap-2 mt-6 bg-white text-black px-6 py-3 rounded-full font-bold hover:bg-gray-100 transition-all shadow-lg"
            data-testid="button-shop-all"
          >
            Shop All {categoryName} <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </div>

      {subcategories.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8 relative z-10">
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
            {subcategories.map((sub) => {
              const iconPath = CATEGORY_ICON_MAP[sub.slug];
              return (
                <Link
                  key={sub.id}
                  href={`/shop?category=${slug}&subcategory=${sub.slug}`}
                  className="group bg-card border border-border rounded-2xl px-3 py-4 flex flex-col items-center justify-center gap-2 hover:border-primary/60 hover:shadow-md transition-all"
                  data-testid={`card-subcategory-${sub.slug}`}
                >
                  {iconPath ? (
                    <img
                      src={getMediaUrl(iconPath)}
                      alt={sub.name}
                      className="w-10 h-10 md:w-12 md:h-12 object-contain"
                    />
                  ) : sub.imageUrl ? (
                    <img
                      src={getMediaUrl(sub.imageUrl)}
                      alt={sub.name}
                      className="w-10 h-10 md:w-12 md:h-12 rounded-md object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-muted flex items-center justify-center">
                      <span className="text-sm font-semibold text-muted-foreground">
                        {sub.name.charAt(0)}
                      </span>
                    </div>
                  )}
                  <span className="text-xs md:text-sm font-medium text-center text-foreground line-clamp-2">
                    {sub.name}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {isTopArrivalsCategory && newArrivalsSection}

      {feedSections.length > 0 && (
        <div className="space-y-12 mt-12">
          {feedSections
            .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
            .map((section, idx) => (
              <FeedSection key={idx} section={section} parentSlug={slug} />
            ))}
        </div>
      )}

      {trendingProducts.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-16">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="font-display font-bold text-2xl">Trending in {categoryName}</h2>
                <p className="text-sm text-muted-foreground">Most popular picks right now</p>
              </div>
            </div>
            <Link
              href={`/shop?category=${slug}&trending=true`}
              className="text-sm font-semibold text-primary hover:underline flex items-center gap-1 hidden sm:flex"
              data-testid="link-view-all-trending"
            >
              View All <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {trendingProducts.slice(0, 4).map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      )}

      {!isTopArrivalsCategory && newArrivalsSection}

      {subcategories.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-16">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-muted rounded-xl flex items-center justify-center">
              <Tag className="w-5 h-5 text-foreground" />
            </div>
            <div>
              <h2 className="font-display font-bold text-2xl">Shop by Category</h2>
              <p className="text-sm text-muted-foreground">Browse {categoryName} collections</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {subcategories.map((sub) => (
              <Link
                key={sub.id}
                href={`/shop?category=${slug}&subcategory=${sub.slug}`}
                className="group flex items-center gap-4 p-4 bg-card border border-border rounded-xl hover:shadow-md transition-all"
                data-testid={`link-shop-category-${sub.slug}`}
              >
                {sub.imageUrl ? (
                  <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0">
                    <img src={getMediaUrl(sub.imageUrl)} alt={sub.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                  </div>
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <span className="text-lg font-bold text-muted-foreground">{sub.name.charAt(0)}</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">{sub.name}</h3>
                  {sub.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{sub.description}</p>
                  )}
                  {sub.children && sub.children.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">{sub.children.length} subcategories</p>
                  )}
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
              </Link>
            ))}
          </div>
        </section>
      )}

      {!loadingProducts && !loadingFeed && products.length === 0 && feedSections.length === 0 && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-16 text-center py-20">
          <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-6">
            <Tag className="w-10 h-10 text-muted-foreground" />
          </div>
          <h2 className="font-display font-bold text-2xl mb-3">Coming Soon</h2>
          <p className="text-muted-foreground mb-8 max-w-md mx-auto">
            We're curating the best {categoryName} collection for you. Check back soon!
          </p>
          <Link
            href="/shop"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-primary/90 transition-colors"
          >
            Browse All Products <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      )}
    </div>
  );
}

function FeedSection({ section, parentSlug }: { section: CategoryFeedSection; parentSlug: string }) {
  const [, setLocation] = useLocation();

  const navigateTo = (item: CategoryFeedItem) => {
    if (item.link) setLocation(item.link);
    else if (item.slug) setLocation(`/product/${item.slug}`);
  };

  if (section.type === "banner") {
    return (
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {section.title && <h2 className="font-display font-bold text-2xl mb-6">{section.title}</h2>}
        {section.image ? (
          <div
            className="relative rounded-2xl overflow-hidden group cursor-pointer"
            onClick={() => section.redirect_url && setLocation(section.redirect_url)}
          >
            <img src={getMediaUrl(section.image)} alt={section.title} className="w-full aspect-[21/9] object-cover group-hover:scale-105 transition-transform duration-700" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
            <div className="absolute bottom-6 left-6 right-6">
              <h3 className="text-white font-bold text-2xl">{section.title}</h3>
            </div>
          </div>
        ) : section.items && section.items.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {section.items.map((item, i) => (
              <div
                key={item.id || i}
                className="relative rounded-2xl overflow-hidden group cursor-pointer"
                onClick={() => navigateTo(item)}
              >
                {item.image && (
                  <img src={getMediaUrl(item.image)} alt={item.name} className="w-full aspect-[16/9] object-cover group-hover:scale-105 transition-transform duration-700" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <div className="absolute bottom-6 left-6 right-6">
                  {item.badge && (
                    <span className="inline-block px-3 py-1 bg-primary text-primary-foreground text-xs font-bold rounded-full mb-2">{item.badge}</span>
                  )}
                  <h3 className="text-white font-bold text-xl">{item.name}</h3>
                  {item.subtitle && <p className="text-white/80 text-sm mt-1">{item.subtitle}</p>}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </section>
    );
  }

  if (section.type === "carousel" || section.type === "product_slider") {
    return (
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display font-bold text-2xl">{section.title}</h2>
          {section.redirect_url && (
            <Link href={section.redirect_url} className="text-sm font-semibold text-primary hover:underline flex items-center gap-1">
              View All <ChevronRight className="w-4 h-4" />
            </Link>
          )}
        </div>

        {section.image && !section.items?.length && (
          <div
            className="rounded-2xl overflow-hidden cursor-pointer group"
            onClick={() => section.redirect_url && setLocation(section.redirect_url)}
          >
            <img src={getMediaUrl(section.image)} alt={section.title} className="w-full aspect-[21/9] object-cover group-hover:scale-105 transition-transform duration-500" />
          </div>
        )}

        {section.items && section.items.length > 0 && (
          <div className="flex gap-4 overflow-x-auto no-scrollbar pb-4 -mx-4 px-4">
            {section.items.map((item, i) => (
              <div
                key={item.id || i}
                className="shrink-0 w-56 rounded-xl overflow-hidden border border-border bg-card group cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => navigateTo(item)}
              >
                {item.image && (
                  <div className="relative">
                    <img src={getMediaUrl(item.image)} alt={item.name} className="w-full aspect-[3/4] object-cover group-hover:scale-105 transition-transform duration-500" />
                    {item.badge && (
                      <span className="absolute top-2 left-2 px-2 py-0.5 bg-primary text-primary-foreground text-xs font-bold rounded-full">{item.badge}</span>
                    )}
                  </div>
                )}
                <div className="p-3">
                  <h3 className="font-semibold text-sm truncate">{item.name}</h3>
                  {item.price != null && (
                    <p className="text-sm font-bold text-primary mt-1">{formatPrice(item.price)}</p>
                  )}
                  {item.subtitle && <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.subtitle}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    );
  }

  if (section.type === "brand_slider") {
    return (
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="font-display font-bold text-2xl mb-6">{section.title}</h2>
        <div className="flex gap-4 overflow-x-auto no-scrollbar pb-4 -mx-4 px-4">
          {section.items?.map((item, i) => (
            <div
              key={item.brand_id || item.id || i}
              className="shrink-0 w-36 flex flex-col items-center gap-3 p-4 rounded-xl border border-border bg-card hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => setLocation(`/shop?category=${parentSlug}&brand=${item.name}`)}
            >
              {(item.logo || item.image) && (
                <img
                  src={getMediaUrl(item.logo || item.image!)}
                  alt={item.name}
                  className="w-16 h-16 object-contain"
                />
              )}
              <span className="text-sm font-semibold text-center">{item.name}</span>
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <h2 className="font-display font-bold text-2xl mb-2">{section.title}</h2>
      {section.items && section.items.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mt-6">
          {section.items.map((item, i) => (
            <div
              key={item.id || i}
              className="rounded-xl overflow-hidden border border-border bg-card group cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigateTo(item)}
            >
              {item.image && (
                <div className="relative">
                  <img src={getMediaUrl(item.image)} alt={item.name} className="w-full aspect-square object-cover group-hover:scale-105 transition-transform duration-500" />
                  {item.badge && (
                    <span className="absolute top-3 left-3 px-2 py-0.5 bg-primary text-primary-foreground text-xs font-bold rounded-full">{item.badge}</span>
                  )}
                </div>
              )}
              <div className="p-3">
                <h3 className="font-semibold text-sm truncate">{item.name}</h3>
                {item.price != null && (
                  <p className="text-sm font-bold text-primary mt-1">{formatPrice(item.price)}</p>
                )}
                {item.subtitle && <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.subtitle}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
