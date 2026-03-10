import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import {
  useAdminProducts,
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
  categoryId: string;
  status: string;
  isFeatured: boolean;
  description: string;
  primaryImage: string;
  galleryImages: string[];
}

const EMPTY_FORM: ProductFormData = {
  name: "",
  sku: "",
  slug: "",
  basePrice: "",
  categoryId: "",
  status: "draft",
  isFeatured: false,
  description: "",
  primaryImage: "",
  galleryImages: [],
};

export default function AdminProducts() {
  const { data: products = [], isLoading } = useAdminProducts();
  const { data: categories = [] } = useAdminCategories();
  const deleteProduct = useDeleteProduct();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProductFormData>(EMPTY_FORM);

  const flatCategories = categories.flatMap((c) => [
    c,
    ...(c.children ?? []),
  ]);

  const filtered = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase())
  );

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
      categoryId: product.categoryId || "",
      status: product.status || "draft",
      isFeatured: product.isFeatured,
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
    };

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
              {filtered.length} product{filtered.length !== 1 ? "s" : ""}
            </p>
          </div>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl font-medium text-sm transition-colors"
            data-testid="button-create-product"
          >
            <Plus className="w-4 h-4" /> Add Product
          </button>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by name or SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-card border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:outline-none"
            data-testid="input-search-products"
          />
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
                    {flatCategories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.parentId ? "— " : ""}
                        {cat.name}
                      </option>
                    ))}
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
                    type="url"
                    value={form.primaryImage}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, primaryImage: e.target.value }))
                    }
                    placeholder="Or paste image URL"
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
      </div>
    </AdminLayout>
  );
}
