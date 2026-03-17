import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import {
  useAdminProductsPaginated,
  useDeleteProduct,
  useCreateProduct,
  useUpdateProduct,
} from "@/hooks/use-admin";
import { useAdminCategories } from "@/hooks/use-admin";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  Package,
  X,
  Loader2,
} from "lucide-react";
import { cn, getMediaUrl } from "@/lib/utils";
import {
  AdminMediaUploadSingle,
  AdminMediaUploadMultiple,
} from "@/components/admin/AdminMediaUpload";

interface ProductFormData {
  name: string;
  sku: string;
  slug: string;
  basePrice: string;
  initialStock: string;
  variantSizes: string[];
  variantColors: string[];
  categoryId: string;
  status: string;
  isFeatured: boolean;
  isTrending: boolean;
  isNewArrival: boolean;
  description: string;
  primaryImage: string;
  galleryImages: string[];
}

const EMPTY_FORM: ProductFormData = {
  name: "",
  sku: "",
  slug: "",
  basePrice: "",
  initialStock: "",
  variantSizes: [],
  variantColors: [],
  categoryId: "",
  status: "draft",
  isFeatured: false,
  isTrending: false,
  isNewArrival: false,
  description: "",
  primaryImage: "",
  galleryImages: [],
};

export default function AdminProducts() {
  const [page, setPage] = useState(1);
  const pageSize = 50;
  const [statusFilter, setStatusFilter] = useState<"all" | "draft" | "published" | "archived">(
    "all"
  );

  const { data, isLoading } = useAdminProductsPaginated({
    page,
    limit: pageSize,
    status: statusFilter,
  });
  const products = data?.products ?? [];
  const { data: categories = [] } = useAdminCategories();
  const deleteProduct = useDeleteProduct();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProductFormData>(EMPTY_FORM);

  // Flatten full category tree (root → children → grandchildren...) so that
  // Fashion → Men/Women/Boys/Girls and all of their subcategories seeded in
  // the backend (T‑Shirts & Polos, Sarees, Anarkali Suits, etc.) appear as
  // selectable options in the admin product form.
  type FlatCategory = (typeof categories)[number] & { depth?: number };

  const flatCategories: FlatCategory[] = (() => {
    const out: FlatCategory[] = [];

    const walk = (nodes: any[], depth: number) => {
      if (!nodes?.length) return;
      for (const node of nodes) {
        out.push({ ...node, depth });
        if (node.children && node.children.length) {
          walk(node.children, depth + 1);
        }
      }
    };

    walk(categories as any[], 0);
    return out;
  })();

  const filtered = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase())
  );

  const selectedCategory = flatCategories.find((c) => c.id === form.categoryId);
  const categorySlug = selectedCategory?.slug ?? "";
  const isFashion = categorySlug.startsWith("fashion");
  const isFootwear = categorySlug.includes("footwear");
  const isKids =
    categorySlug.includes("fashion-boys") || categorySlug.includes("fashion-girls");
  const isHome = categorySlug.startsWith("home");

  let availableSizes: string[] = [];
  let availableColors: string[] = [];

  if (isFashion) {
    if (isFootwear) {
      availableSizes = ["6", "7", "8", "9", "10"];
    } else if (isKids) {
      availableSizes = ["<1 year", "1-3 years", "3-5 years"];
    } else {
      availableSizes = ["XS", "S", "M", "L", "XL", "XXL"];
    }
    availableColors = ["White", "Black", "Blue", "Red", "Green"];
  } else if (isHome) {
    availableSizes = ["Single", "Set of 3", "Set of 6"];
    availableColors = ["White", "Grey", "Beige", "Navy"];
  }

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEdit = (product: (typeof products)[0]) => {
    setEditingId(product.id);
    const gallery = product.richContent?.media_gallery ?? [];
    const primary = gallery.find((m: { is_primary?: boolean }) => m.is_primary) ?? gallery[0];
    const primaryUrl = primary?.url ?? "";
    const rest = gallery.filter((m: { url?: string }) => m.url !== primaryUrl);
    setForm({
      name: product.name,
      sku: product.sku,
      slug: product.slug,
      basePrice: String(product.basePrice),
      initialStock: "",
      variantSizes: [],
      variantColors: [],
      categoryId: product.categoryId || "",
      status: product.status || "draft",
      isFeatured: product.isFeatured,
      isTrending: (product as any).isTrending ?? false,
      isNewArrival: (product as any).isNewArrival ?? false,
      description:
        product.richContent?.description_html?.replace(/<[^>]*>/g, "") ?? "",
      primaryImage: primaryUrl,
      galleryImages: rest.map((m: { url?: string }) => m.url).filter((u): u is string => Boolean(u)),
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try {
      await deleteProduct.mutateAsync(id);
      toast({ title: "Product deleted", description: `${name} has been removed.` });
    } catch (e: any) {
      toast({
        title: "Delete failed",
        description: e.message || "Something went wrong.",
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const price = parseFloat(form.basePrice);
    if (!price || price <= 0) {
      toast({
        title: "Invalid price",
        description: "Base price must be greater than 0.",
        variant: "destructive",
      });
      return;
    }

    if (!form.categoryId) {
      toast({
        title: "Category required",
        description: "Please select a category for this product.",
        variant: "destructive",
      });
      return;
    }

    const normalizedStatus =
      form.status === "active" ? "published" : form.status || "draft";

    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      sku: form.sku.trim(),
      slug:
        form.slug.trim() ||
        form.name
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, ""),
      basePrice: price,
      categoryId: form.categoryId,
      status: normalizedStatus,
      isFeatured: form.isFeatured,
      isTrending: form.isTrending,
      isNewArrival: form.isNewArrival,
    };

    if (!editingId && form.initialStock.trim()) {
      const stock = parseInt(form.initialStock.trim(), 10);
      if (!Number.isNaN(stock) && stock >= 0) {
        payload.initialStock = stock;
      }
    }

    if (form.description.trim()) {
      payload.descriptionHtml = `<p>${form.description.trim()}</p>`;
    }

    const imageUrls: string[] = [];
    if (form.primaryImage.trim()) imageUrls.push(form.primaryImage.trim());
    form.galleryImages.forEach((url) => {
      if (url.trim()) imageUrls.push(url.trim());
    });

    if (imageUrls.length) {
      payload.mediaGallery = imageUrls.map((url, index) => ({
        url,
        type: "image",
        order: index,
        is_primary: index === 0,
        alt: form.name.trim() || undefined,
      }));
    }

    if (!editingId) {
      const sizes = form.variantSizes;
      const colors = form.variantColors;
      const variants: { size?: string; color?: string; stock?: number }[] = [];

      if (sizes.length && colors.length) {
        sizes.forEach((size) => {
          colors.forEach((color) => {
            variants.push({ size, color });
          });
        });
      } else if (sizes.length) {
        sizes.forEach((size) => variants.push({ size }));
      } else if (colors.length) {
        colors.forEach((color) => variants.push({ color }));
      }

      if (variants.length) {
        payload.variants = variants;
      }
    }

    try {
      if (editingId) {
        await updateProduct.mutateAsync({ id: editingId, data: payload });
        toast({ title: "Product updated" });
      } else {
        await createProduct.mutateAsync(payload);
        toast({ title: "Product created" });
      }
      setShowForm(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
    } catch (e: any) {
      toast({
        title: "Save failed",
        description: e.message || "Something went wrong.",
        variant: "destructive",
      });
    }
  };

  const isSaving = createProduct.isPending || updateProduct.isPending;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2
              className="font-display font-bold text-2xl"
              data-testid="text-products-title"
            >
              Products
            </h2>
            <p className="text-muted-foreground text-sm">
              Showing {filtered.length} of {data?.total ?? filtered.length} product
              {(data?.total ?? filtered.length) !== 1 ? "s" : ""} (
              {statusFilter === "all" ? "all statuses" : `${statusFilter} only`})
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-muted-foreground">
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as "all" | "draft" | "published" | "archived")
                }
                className="px-3 py-1.5 bg-card border border-border rounded-xl text-xs focus:ring-2 focus:ring-primary/20 focus:outline-none"
                data-testid="select-product-status-filter"
              >
                <option value="all">All</option>
                <option value="draft">Draft only</option>
                <option value="published">Published only</option>
                <option value="archived">Archived only</option>
              </select>
            </div>
            <button
              onClick={openCreate}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl font-medium text-sm transition-colors"
              data-testid="button-create-product"
            >
              <Plus className="w-4 h-4" /> Add Product
            </button>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
          <div className="relative max-w-sm w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder={
                statusFilter === "draft"
                  ? "Search within draft products..."
                  : "Search by name or SKU..."
              }
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-card border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:outline-none"
              data-testid="input-search-products"
            />
          </div>
        </div>

        {showForm && (
          <div className="bg-card border border-border rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-display font-bold text-lg">
                {editingId ? "Edit Product" : "New Product"}
              </h3>
              <button
                onClick={() => {
                  setShowForm(false);
                  setEditingId(null);
                }}
                className="p-1.5 hover:bg-muted rounded-lg"
                data-testid="button-close-form"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    Name *
                  </label>
                  <input
                    required
                    value={form.name}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, name: e.target.value }))
                    }
                    className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:outline-none"
                    data-testid="input-product-name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    SKU *
                  </label>
                  <input
                    required
                    value={form.sku}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, sku: e.target.value }))
                    }
                    className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:outline-none"
                    data-testid="input-product-sku"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    Slug
                  </label>
                  <input
                    value={form.slug}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, slug: e.target.value }))
                    }
                    placeholder="auto-generated from name"
                    className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:outline-none"
                    data-testid="input-product-slug"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    Base Price (₹) *
                  </label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.basePrice}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, basePrice: e.target.value }))
                    }
                    className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:outline-none"
                    data-testid="input-product-price"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    Initial Stock
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={form.initialStock}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, initialStock: e.target.value }))
                    }
                    placeholder="e.g. 10"
                    className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:outline-none"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Optional. Creates a default variant with this stock. You can fine-tune stock per variant in the Inventory screen.
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    Category *
                  </label>
                  <select
                    required
                    value={form.categoryId}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, categoryId: e.target.value }))
                    }
                    className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:outline-none"
                    data-testid="select-product-category"
                  >
                    <option value="">None</option>
                    {flatCategories.map((cat) => {
                      const depth = cat.depth ?? 0;
                      const prefix =
                        depth === 0 ? "" : `${"— ".repeat(Math.min(depth, 3))}`;
                      return (
                        <option key={cat.id} value={cat.id}>
                          {prefix}
                          {cat.name}
                        </option>
                      );
                    })}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    Status
                  </label>
                  <select
                    value={form.status}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, status: e.target.value }))
                    }
                    className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:outline-none"
                    data-testid="select-product-status"
                  >
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                    <option value="active">Active</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, description: e.target.value }))
                  }
                  className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:outline-none resize-none"
                  data-testid="input-product-description"
                />
              </div>

              {(availableSizes.length > 0 || availableColors.length > 0) && !editingId && (
                <div className="border border-dashed border-border rounded-2xl p-4 space-y-4">
                  <h4 className="font-semibold text-sm">Variants (based on category)</h4>
                  {availableSizes.length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-2">
                        Sizes:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {availableSizes.map((size) => {
                          const checked = form.variantSizes.includes(size);
                          return (
                            <label
                              key={size}
                              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border text-xs cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                className="w-3 h-3"
                                checked={checked}
                                onChange={(e) => {
                                  const next = e.target.checked
                                    ? [...form.variantSizes, size]
                                    : form.variantSizes.filter((s) => s !== size);
                                  setForm((f) => ({ ...f, variantSizes: next }));
                                }}
                              />
                              <span>{size}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {availableColors.length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-2">
                        Colors:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {availableColors.map((color) => {
                          const checked = form.variantColors.includes(color);
                          return (
                            <label
                              key={color}
                              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border text-xs cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                className="w-3 h-3"
                                checked={checked}
                                onChange={(e) => {
                                  const next = e.target.checked
                                    ? [...form.variantColors, color]
                                    : form.variantColors.filter((c) => c !== color);
                                  setForm((f) => ({ ...f, variantColors: next }));
                                }}
                              />
                              <span>{color}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  <p className="text-[11px] text-muted-foreground">
                    We&apos;ll create one variant for each selected size/color combination and
                    attach stock using Initial Stock. You can fine-tune per-variant stock later in
                    the Inventory screen.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <AdminMediaUploadSingle
                    label="Primary Image"
                    value={form.primaryImage}
                    onChange={(path) =>
                      setForm((f) => ({ ...f, primaryImage: path }))
                    }
                    data-testid="upload-primary-image"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Used as the main product image. You can also paste a URL below.
                  </p>
                  <input
                    type="text"
                    value={form.primaryImage}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, primaryImage: e.target.value }))
                    }
                    placeholder="Or paste image URL or stored path"
                    className="mt-2 w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:outline-none"
                  />
                </div>
                <div>
                  <AdminMediaUploadMultiple
                    label="Gallery Images"
                    value={form.galleryImages}
                    onChange={(paths) =>
                      setForm((f) => ({ ...f, galleryImages: paths }))
                    }
                    maxFiles={10}
                    data-testid="upload-gallery-images"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Optional. Add up to 10 images for the product gallery.
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isFeatured}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, isFeatured: e.target.checked }))
                    }
                    className="w-4 h-4 text-primary focus:ring-primary border-gray-300 rounded"
                    data-testid="checkbox-product-featured"
                  />
                  <span className="text-sm font-medium">Featured product</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isTrending}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, isTrending: e.target.checked }))
                    }
                    className="w-4 h-4 text-primary focus:ring-primary border-gray-300 rounded"
                    data-testid="checkbox-product-trending"
                  />
                  <span className="text-sm font-medium">Trending product</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isNewArrival}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, isNewArrival: e.target.checked }))
                    }
                    className="w-4 h-4 text-primary focus:ring-primary border-gray-300 rounded"
                    data-testid="checkbox-product-new-arrival"
                  />
                  <span className="text-sm font-medium">New arrival</span>
                </label>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-xl font-medium text-sm disabled:opacity-60"
                  data-testid="button-save-product"
                >
                  {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingId ? "Update" : "Create"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingId(null);
                  }}
                  className="px-6 py-2.5 border border-border rounded-xl text-sm font-medium hover:bg-muted transition-colors"
                  data-testid="button-cancel-form"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="animate-pulse bg-card border border-border h-16 rounded-xl"
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-12 text-center">
            <div className="w-14 h-14 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <Package className="w-7 h-7 text-muted-foreground" />
            </div>
            <h3 className="font-display font-bold text-lg mb-1">
              No products found
            </h3>
            <p className="text-muted-foreground text-sm mb-6">
              {search
                ? "Try a different search query."
                : "Add your first product to get started."}
            </p>
            {!search && (
              <button
                onClick={openCreate}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl font-medium text-sm"
              >
                <Plus className="w-4 h-4" /> Add Product
              </button>
            )}
          </div>
        ) : (
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="table-products">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left px-5 py-3 font-semibold">
                      Product
                    </th>
                    <th className="text-left px-5 py-3 font-semibold hidden md:table-cell">
                      SKU
                    </th>
                    <th className="text-left px-5 py-3 font-semibold">
                      Price
                    </th>
                    <th className="text-left px-5 py-3 font-semibold hidden sm:table-cell">
                      Status
                    </th>
                    <th className="text-right px-5 py-3 font-semibold">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((product) => (
                    <tr
                      key={product.id}
                      className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                      data-testid={`row-product-${product.id}`}
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-muted rounded-lg shrink-0 overflow-hidden">
                            {product.richContent?.media_gallery?.[0]?.url ? (
                              <img
                                src={getMediaUrl(product.richContent.media_gallery[0].url)}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Package className="w-4 h-4 text-muted-foreground" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium truncate max-w-[200px]">
                              {product.name}
                            </p>
                            {product.isFeatured && (
                              <span className="text-[10px] font-bold uppercase text-primary">
                                Featured
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-muted-foreground hidden md:table-cell">
                        {product.sku}
                      </td>
                      <td className="px-5 py-3 font-semibold tabular-nums">
                        ${parseFloat(String(product.basePrice)).toFixed(2)}
                      </td>
                      <td className="px-5 py-3 hidden sm:table-cell">
                        <span
                          className={cn(
                            "text-xs font-semibold px-2.5 py-1 rounded-full",
                            product.status === "published" || product.status === "active"
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
                              : product.status === "draft"
                                ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400"
                                : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                          )}
                        >
                          {product.status}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEdit(product)}
                            className="p-2 hover:bg-muted rounded-lg transition-colors"
                            title="Edit"
                            data-testid={`button-edit-${product.id}`}
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() =>
                              handleDelete(product.id, product.name)
                            }
                            className="p-2 hover:bg-destructive/10 text-destructive rounded-lg transition-colors"
                            title="Delete"
                            data-testid={`button-delete-${product.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between pt-2">
            <p className="text-sm text-muted-foreground">
              Page {data.page} of {data.totalPages} ({data.total} products)
            </p>
            <div className="flex gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-muted disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                disabled={page >= data.totalPages}
                className="px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-muted disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
