import { Link, useLocation, useSearch } from "wouter";
import { Search, ShoppingBag, Heart, User, Menu, ChevronDown, ChevronRight, LogOut, X } from "lucide-react";
import { useCart } from "@/store/use-cart";
import { useAuth } from "@/store/use-auth";
import { useWishlistState } from "@/hooks/use-user";
import { useMenuCategories, useSearchSuggestions } from "@/hooks/use-shop";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { cn, getMediaUrl, formatPrice } from "@/lib/utils";
import type { MenuCategory } from "@/api/types";

const STATIC_NAV_START = [
  { label: "New Arrivals", href: "/shop?sort=newest", hasMega: false as const },
  { label: "Trending", href: "/shop?featured=true", hasMega: false as const },
];
const STATIC_NAV_END = [
  { label: "Sale", href: "/shop?featured=true", hasMega: false as const },
];
type NavItem = { label: string; href: string; hasMega: boolean; slug?: string };

export function Header() {
  const [, setLocation] = useLocation();
  const { getCartCount, openCart } = useCart();
  const { count: wishlistCount } = useWishlistState();
  const { user, logout } = useAuth();
  const { data: menuCategories = [] } = useMenuCategories();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchDropdownOpen, setSearchDropdownOpen] = useState(false);
  const searchDropdownRef = useRef<HTMLDivElement>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [activeMega, setActiveMega] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileExpanded, setMobileExpanded] = useState<Set<string>>(new Set());
  const megaTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");

  const searchString = useSearch();
  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const q = params.get("search");
    if (q !== null) setSearchQuery(q);
  }, [searchString]);

  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
      searchDebounceRef.current = null;
    }, 300);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [searchQuery]);

  const { data: searchSuggestions = [], isFetching: searchSuggestionsLoading } = useSearchSuggestions(debouncedSearchQuery);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchDropdownRef.current && !searchDropdownRef.current.contains(e.target as Node)) {
        setSearchDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const navItems: NavItem[] = useMemo(() => {
    const fromApi = menuCategories.map((c) => {
      const hasSubs = !!(c.subcategories && c.subcategories.length > 0);
      return {
        label: c.name,
        href: `/category/${c.slug}`,
        slug: c.slug,
        hasMega: hasSubs,
      };
    });
    return [...STATIC_NAV_START, ...fromApi, ...STATIC_NAV_END];
  }, [menuCategories]);

  const findMenuCategory = useCallback(
    (slug: string): MenuCategory | null => {
      return menuCategories.find((c) => c.slug === slug) || null;
    },
    [menuCategories]
  );

  const handleMegaEnter = (slug: string) => {
    if (megaTimeout.current) clearTimeout(megaTimeout.current);
    setActiveMega(slug);
  };

  const handleMegaLeave = () => {
    megaTimeout.current = setTimeout(() => setActiveMega(null), 150);
  };

  useEffect(() => {
    return () => {
      if (megaTimeout.current) clearTimeout(megaTimeout.current);
    };
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchDropdownOpen(false);
    if (searchQuery.trim()) {
      setLocation(`/shop?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const showSearchDropdown = searchDropdownOpen && debouncedSearchQuery.trim().length >= 2;

  const toggleMobileExpand = (slug: string) => {
    setMobileExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };

  const megaCategory = activeMega ? findMenuCategory(activeMega) : null;

  return (
    <>
      <div className="bg-primary text-primary-foreground text-xs py-2 px-4 text-center font-medium tracking-wide">
        Free express delivery on orders over ₹2,000. <span className="underline cursor-pointer">Shop Now</span>
      </div>

      <header className="sticky top-0 z-40 glass-header shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20 gap-4 md:gap-8">
            <div className="flex items-center gap-4">
              <button
                className="md:hidden p-2 -ml-2 text-foreground hover:bg-muted rounded-lg"
                onClick={() => setMobileMenuOpen(true)}
                data-testid="button-mobile-menu"
              >
                <Menu className="w-6 h-6" />
              </button>
              <Link href="/" className="font-display font-black text-2xl tracking-tighter shrink-0 flex items-center gap-0">
                <img
                  src="https://res.cloudinary.com/dbmlo1jox/image/upload/v1773217272/Untitled_pkxap0.png"
                  alt="Apnamart"
                  className="h-12 w-14 rounded-lg m-2"
                  style={{ objectPosition: 'center top' }}
                />
                <span className="hidden sm:inline">Apnamart</span>
              </Link>
            </div>

            <div className="hidden md:flex flex-1 max-w-2xl">
              <div ref={searchDropdownRef} className="w-full relative">
                <form onSubmit={handleSearch} className="w-full relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Search className="h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  </div>
                  <input
                    type="text"
                    className="block w-full pl-11 pr-4 py-3 bg-muted border-transparent rounded-full text-sm placeholder:text-muted-foreground focus:border-primary focus:bg-background focus:ring-4 focus:ring-primary/10 transition-all duration-300"
                    placeholder="Search for products, brands and more..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onFocus={() => setSearchDropdownOpen(true)}
                    data-testid="input-search"
                  />
                  <button type="submit" className="absolute inset-y-1.5 right-1.5 px-4 bg-primary text-primary-foreground rounded-full text-sm font-medium hover:bg-primary/90 transition-colors" data-testid="button-search">
                    Search
                  </button>
                </form>
                {showSearchDropdown && (
                  <div className="absolute left-0 right-0 top-full mt-1 py-2 rounded-xl border bg-card shadow-lg z-50 overflow-hidden">
                    <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Top match
                    </div>
                    {searchSuggestionsLoading ? (
                      <div className="px-3 py-4 text-sm text-muted-foreground">Searching...</div>
                    ) : searchSuggestions.length === 0 ? (
                      <div className="px-3 py-4 text-sm text-muted-foreground">No products found. Try different keywords.</div>
                    ) : (
                      <ul className="max-h-72 overflow-y-auto">
                        {searchSuggestions.map((p) => (
                          <li key={p.id}>
                            <Link
                              href={`/product/${p.slug}`}
                              onClick={() => { setSearchDropdownOpen(false); setSearchQuery(p.name); }}
                              className="flex items-center gap-3 px-3 py-2 hover:bg-muted text-left"
                              data-testid={`search-suggestion-${p.slug}`}
                            >
                              <div className="w-10 h-10 rounded-lg bg-muted overflow-hidden shrink-0">
                                <img src={getMediaUrl(p.images[0])} alt={p.name} className="w-full h-full object-cover" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium truncate">{p.name}</p>
                                <p className="text-xs text-muted-foreground">{formatPrice(p.price)}</p>
                              </div>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                    {searchSuggestions.length > 0 && (
                      <Link
                        href={`/shop?search=${encodeURIComponent(debouncedSearchQuery)}`}
                        onClick={() => setSearchDropdownOpen(false)}
                        className="block px-3 py-2 text-sm font-medium text-primary border-t bg-muted/50 hover:bg-muted"
                        data-testid="link-view-all-search"
                      >
                        View all results
                      </Link>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-4">
              {user ? (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setUserMenuOpen((o) => !o)}
                    className="flex items-center gap-2 p-2 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted"
                    data-testid="button-user-menu"
                  >
                    <User className="w-5 h-5" />
                    <span className="text-sm font-medium hidden lg:block max-w-[120px] truncate">
                      {user.firstName || user.email}
                    </span>
                  </button>
                  {userMenuOpen && (
                    <>
                      <div className="fixed inset-0 z-40" aria-hidden onClick={() => setUserMenuOpen(false)} />
                      <div className="absolute right-0 top-full mt-1 py-1 w-48 rounded-lg border bg-card shadow-lg z-50">
                        <div className="px-3 py-2 border-b text-sm text-muted-foreground truncate">{user.email}</div>
                        <Link
                          href="/account"
                          onClick={() => setUserMenuOpen(false)}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted"
                          data-testid="link-my-account"
                        >
                          <User className="w-4 h-4" /> My Account
                        </Link>
                        <Link
                          href="/account/orders"
                          onClick={() => setUserMenuOpen(false)}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted"
                          data-testid="link-my-orders"
                        >
                          <ShoppingBag className="w-4 h-4" /> My Orders
                        </Link>
                        <button
                          type="button"
                          onClick={() => { logout(); setUserMenuOpen(false); }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-muted text-destructive"
                          data-testid="button-logout"
                        >
                          <LogOut className="w-4 h-4" /> Sign out
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <Link href="/signin" className="flex items-center gap-2 p-2 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted" data-testid="link-signin">
                  <User className="w-5 h-5" />
                  <span className="text-sm font-medium hidden lg:block">Sign In</span>
                </Link>
              )}

              <Link href="/account/wishlist" className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted relative" data-testid="link-wishlist">
                <Heart className="w-5 h-5" />
                {user && wishlistCount > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-accent rounded-full border-2 border-background" />
                )}
              </Link>

              <button
                onClick={openCart}
                className="p-2 text-foreground hover:bg-muted transition-colors rounded-lg relative flex items-center gap-2"
                data-testid="button-cart"
              >
                <div className="relative">
                  <ShoppingBag className="w-5 h-5" />
                  {getCartCount() > 0 && (
                    <span className="absolute -top-2 -right-2 w-5 h-5 bg-primary text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-background">
                      {getCartCount()}
                    </span>
                  )}
                </div>
                <span className="text-sm font-medium hidden lg:block">Cart</span>
              </button>
            </div>
          </div>
        </div>

        <div className="md:hidden px-4 pb-4">
          <form onSubmit={handleSearch} className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              className="w-full bg-muted pl-10 pr-4 py-2.5 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              data-testid="input-search-mobile"
            />
          </form>
        </div>

        <div className="border-t border-border/50 bg-background/50 hidden md:block">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <nav className="flex items-center gap-1 overflow-x-auto no-scrollbar">
              {navItems.map((item) => (
                <div
                  key={item.label}
                  className="relative"
                  onMouseEnter={() => item.hasMega && item.slug && handleMegaEnter(item.slug)}
                  onMouseLeave={() => item.hasMega && handleMegaLeave()}
                >
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center gap-1 px-3 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors",
                      activeMega === item.slug
                        ? "text-primary border-primary"
                        : "text-muted-foreground border-transparent hover:text-primary hover:border-primary"
                    )}
                    data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                  >
                    {item.label}
                    {item.hasMega && (
                      <ChevronDown className={cn("w-3 h-3 transition-transform", activeMega === item.slug && "rotate-180")} />
                    )}
                  </Link>
                </div>
              ))}
            </nav>
          </div>
        </div>

        {activeMega && megaCategory && megaCategory.subcategories && megaCategory.subcategories.length > 0 && (
          <div
            className="absolute left-0 right-0 z-50 bg-card border-b border-border shadow-xl hidden md:block"
            onMouseEnter={() => handleMegaEnter(activeMega)}
            onMouseLeave={handleMegaLeave}
          >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              <div className="grid grid-cols-5 gap-8">
                {megaCategory.subcategories.map((sub) => (
                  <div key={sub.id}>
                    <Link
                      href={`/shop?category=${megaCategory.slug}&subcategory=${sub.slug}`}
                      className="font-semibold text-sm text-foreground hover:text-primary transition-colors block mb-3 uppercase tracking-wider"
                      onClick={() => setActiveMega(null)}
                      data-testid={`mega-sub-${sub.slug}`}
                    >
                      {sub.name}
                    </Link>
                    {sub.sub_subcategories && sub.sub_subcategories.length > 0 && (
                      <ul className="space-y-2">
                        {sub.sub_subcategories.map((child) => (
                          <li key={child.id}>
                            <Link
                              href={`/shop?category=${megaCategory.slug}&subcategory=${sub.slug}&sub_subcategory=${child.slug}`}
                              className="text-sm text-muted-foreground hover:text-primary transition-colors"
                              onClick={() => setActiveMega(null)}
                              data-testid={`mega-child-${child.slug}`}
                            >
                              {child.name}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}

                {megaCategory.imageUrl && (
                  <div className="col-span-1 relative rounded-xl overflow-hidden">
                    <img
                      src={getMediaUrl(megaCategory.imageUrl)}
                      alt={megaCategory.name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                    <div className="absolute bottom-4 left-4 right-4">
                      <p className="text-white text-sm font-bold">Explore {megaCategory.name}</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-6 pt-6 border-t border-border flex items-center justify-between">
                <Link
                  href={`/category/${activeMega}`}
                  className="text-sm font-semibold text-primary hover:underline flex items-center gap-1"
                  onClick={() => setActiveMega(null)}
                  data-testid={`mega-view-all-${activeMega}`}
                >
                  View all {megaCategory.name} <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        )}
      </header>

      {mobileMenuOpen && (
        <>
          <div className="fixed inset-0 bg-black/40 z-50 md:hidden" onClick={() => setMobileMenuOpen(false)} />
          <div className="fixed inset-y-0 left-0 w-80 bg-card z-50 md:hidden overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <span className="font-display font-bold text-lg">Menu</span>
              <button onClick={() => setMobileMenuOpen(false)} className="p-2 hover:bg-muted rounded-lg" data-testid="button-close-mobile-menu">
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="py-2">
              {navItems.map((item) => {
                const cat = item.slug ? findMenuCategory(item.slug) : null;
                const hasSubs = cat?.subcategories && cat.subcategories.length > 0;
                const isExpanded = item.slug ? mobileExpanded.has(item.slug) : false;

                return (
                  <div key={item.label}>
                    <div className="flex items-center">
                      <Link
                        href={item.href}
                        className="flex-1 px-5 py-3 text-sm font-medium text-foreground hover:bg-muted"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        {item.label}
                      </Link>
                      {item.hasMega && hasSubs && (
                        <button
                          onClick={() => toggleMobileExpand(item.slug!)}
                          className="px-4 py-3 text-muted-foreground hover:bg-muted"
                        >
                          <ChevronDown className={cn("w-4 h-4 transition-transform", isExpanded && "rotate-180")} />
                        </button>
                      )}
                    </div>
                    {item.hasMega && isExpanded && cat?.subcategories && (
                      <div className="bg-muted/50 py-1">
                        {cat.subcategories.map((sub) => (
                          <div key={sub.id}>
                            <Link
                              href={`/shop?category=${cat.slug}&subcategory=${sub.slug}`}
                              className="block px-8 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
                              onClick={() => setMobileMenuOpen(false)}
                            >
                              {sub.name}
                            </Link>
                            {sub.sub_subcategories?.map((child) => (
                              <Link
                                key={child.id}
                                href={`/shop?category=${cat.slug}&subcategory=${sub.slug}&sub_subcategory=${child.slug}`}
                                className="block px-12 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                                onClick={() => setMobileMenuOpen(false)}
                              >
                                {child.name}
                              </Link>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>
          </div>
        </>
      )}

      <CartDrawer />
    </>
  );
}
