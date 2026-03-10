import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import {
  useAdminCategories,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
} from "@/hooks/use-admin";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Pencil,
  Trash2,
  FolderTree,
  X,
  Loader2,
  ChevronRight,
} from "lucide-react";
import type { BackendCategory } from "@/api/types";
import { getMediaUrl } from "@/lib/utils";
import { AdminMediaUploadSingle } from "@/components/admin/AdminMediaUpload";

interface CategoryFormData {
  name: string;
  slug: string;
  description: string;
  imageUrl: string;
  parentId: string;
  sortOrder: string;
}

const EMPTY_FORM: CategoryFormData = {
  name: "",
  slug: "",
  description: "",
  imageUrl: "",
  parentId: "",
  sortOrder: "0",
};

export default function AdminCategories() {
  const { data: categories = [], isLoading } = useAdminCategories();
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();
  const { toast } = useToast();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CategoryFormData>(EMPTY_FORM);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const topLevel = categories.filter((c) => !c.parentId);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openCreate = (parentId?: string) => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, parentId: parentId || "" });
    setShowForm(true);
  };

  const openEdit = (cat: BackendCategory) => {
    setEditingId(cat.id);
    setForm({
      name: cat.name,
      slug: cat.slug,
      description: cat.description ?? "",
      imageUrl: cat.imageUrl ?? "",
      parentId: cat.parentId ?? "",
      sortOrder: String(cat.sortOrder ?? 0),
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try {
      await deleteCategory.mutateAsync(id);
      toast({ title: "Category deleted", description: `${name} removed.` });
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

    const slug =
      form.slug.trim() ||
      form.name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");

    if (slug.length < 2) {
      toast({
        title: "Invalid slug",
        description: "Slug must be at least 2 characters (or leave blank to auto-generate from name).",
        variant: "destructive",
      });
      return;
    }

    const rawImageUrl = form.imageUrl.trim();
    // Accept full URL or uploaded path (e.g. products/uuid.webp)
    const imageUrl = rawImageUrl === "" ? "" : rawImageUrl;

    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      slug,
      description: form.description.trim() || undefined,
      sortOrder: parseInt(form.sortOrder, 10) || 0,
      parentId: form.parentId || null,
    };
    payload.imageUrl = imageUrl;

    try {
      if (editingId) {
        await updateCategory.mutateAsync({ id: editingId, data: payload });
        toast({ title: "Category updated" });
      } else {
        await createCategory.mutateAsync(payload);
        toast({ title: "Category created" });
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

  const isSaving = createCategory.isPending || updateCategory.isPending;

  const flatParents = categories.filter((c) => !c.parentId);

  const renderCategoryRow = (cat: BackendCategory, depth: number = 0) => {
    const hasChildren = cat.children && cat.children.length > 0;
    const isExpanded = expandedIds.has(cat.id);

    return (
      <div key={cat.id}>
        <div
          className="flex items-center gap-3 px-5 py-3 hover:bg-muted/30 transition-colors border-b border-border last:border-0"
          style={{ paddingLeft: `${20 + depth * 24}px` }}
          data-testid={`row-category-${cat.id}`}
        >
          {hasChildren ? (
            <button
              onClick={() => toggleExpand(cat.id)}
              className="p-0.5 hover:bg-muted rounded"
            >
              <ChevronRight
                className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-90" : ""}`}
              />
            </button>
          ) : (
            <span className="w-5" />
          )}

          <div className="w-8 h-8 bg-muted rounded-lg flex items-center justify-center shrink-0">
            {cat.imageUrl ? (
              <img
                src={getMediaUrl(cat.imageUrl)}
                alt=""
                className="w-full h-full object-cover rounded-lg"
              />
            ) : (
              <FolderTree className="w-4 h-4 text-muted-foreground" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm">{cat.name}</p>
            <p className="text-xs text-muted-foreground">{cat.slug}</p>
          </div>

          {cat.children && (
            <span className="text-xs text-muted-foreground hidden sm:block">
              {cat.children.length} sub
            </span>
          )}

          <div className="flex items-center gap-1">
            <button
              onClick={() => openCreate(cat.id)}
              className="p-2 hover:bg-muted rounded-lg transition-colors"
              title="Add sub-category"
              data-testid={`button-add-sub-${cat.id}`}
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              onClick={() => openEdit(cat)}
              className="p-2 hover:bg-muted rounded-lg transition-colors"
              title="Edit"
              data-testid={`button-edit-${cat.id}`}
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleDelete(cat.id, cat.name)}
              className="p-2 hover:bg-destructive/10 text-destructive rounded-lg transition-colors"
              title="Delete"
              data-testid={`button-delete-${cat.id}`}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {hasChildren &&
          isExpanded &&
          cat.children!.map((child) => renderCategoryRow(child, depth + 1))}
      </div>
    );
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2
              className="font-display font-bold text-2xl"
              data-testid="text-categories-title"
            >
              Categories
            </h2>
            <p className="text-muted-foreground text-sm">
              {categories.length} categor{categories.length !== 1 ? "ies" : "y"}
            </p>
          </div>
          <button
            onClick={() => openCreate()}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl font-medium text-sm"
            data-testid="button-create-category"
          >
            <Plus className="w-4 h-4" /> Add Category
          </button>
        </div>

        {showForm && (
          <div className="bg-card border border-border rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-display font-bold text-lg">
                {editingId ? "Edit Category" : "New Category"}
              </h3>
              <button
                onClick={() => {
                  setShowForm(false);
                  setEditingId(null);
                }}
                className="p-1.5 hover:bg-muted rounded-lg"
                data-testid="button-close-category-form"
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
                    data-testid="input-category-name"
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
                    data-testid="input-category-slug"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    Parent Category
                  </label>
                  <select
                    value={form.parentId}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, parentId: e.target.value }))
                    }
                    className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:outline-none"
                    data-testid="select-category-parent"
                  >
                    <option value="">None (top-level)</option>
                    {flatParents.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    Sort Order
                  </label>
                  <input
                    type="number"
                    value={form.sortOrder}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, sortOrder: e.target.value }))
                    }
                    className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:outline-none"
                    data-testid="input-category-sort"
                  />
                </div>
                <div className="md:col-span-2">
                  <AdminMediaUploadSingle
                    label="Image"
                    value={form.imageUrl}
                    onChange={(path) =>
                      setForm((f) => ({ ...f, imageUrl: path }))
                    }
                    data-testid="upload-category-image"
                  />
                  <input
                    value={form.imageUrl}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, imageUrl: e.target.value }))
                    }
                    placeholder="Or paste image URL"
                    className="mt-2 w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:outline-none"
                    data-testid="input-category-image"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={form.description}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, description: e.target.value }))
                  }
                  className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:outline-none resize-none"
                  data-testid="input-category-description"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-xl font-medium text-sm disabled:opacity-60"
                  data-testid="button-save-category"
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
                  data-testid="button-cancel-category-form"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {isLoading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="animate-pulse bg-card border border-border h-14 rounded-xl"
              />
            ))}
          </div>
        ) : topLevel.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-12 text-center">
            <div className="w-14 h-14 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <FolderTree className="w-7 h-7 text-muted-foreground" />
            </div>
            <h3 className="font-display font-bold text-lg mb-1">
              No categories yet
            </h3>
            <p className="text-muted-foreground text-sm mb-6">
              Create your first category to organize products.
            </p>
            <button
              onClick={() => openCreate()}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl font-medium text-sm"
            >
              <Plus className="w-4 h-4" /> Add Category
            </button>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            {topLevel.map((cat) => renderCategoryRow(cat))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
