import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import {
  useAdminFeedSections,
  useCreateFeedSection,
  useUpdateFeedSection,
  useDeleteFeedSection,
  type AdminFeedSection,
} from "@/hooks/use-admin";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Loader2,
  Eye,
  EyeOff,
  LayoutGrid,
  ChevronDown,
  Image,
  GripVertical,
} from "lucide-react";
import { cn, getMediaUrl } from "@/lib/utils";
import { AdminMediaUploadSingle } from "@/components/admin/AdminMediaUpload";

const SECTION_TYPES = [
  { value: "carousel", label: "Carousel" },
  { value: "product_grid", label: "Product Grid" },
  { value: "brand_slider", label: "Brand Slider" },
  { value: "banner", label: "Banner" },
  { value: "product_slider", label: "Product Slider" },
];

const CATEGORY_OPTIONS = [
  { value: "men", label: "Men" },
  { value: "women", label: "Women" },
  { value: "kids", label: "Kids" },
  { value: "accessories", label: "Accessories" },
  { value: "beauty", label: "Beauty" },
];

interface SectionFormData {
  categorySlug: string;
  type: string;
  title: string;
  image: string;
  mobile_image: string;
  redirect_url: string;
  displayOrder: string;
  isActive: boolean;
  itemsJson: string;
}

const EMPTY_FORM: SectionFormData = {
  categorySlug: "men",
  type: "carousel",
  title: "",
  image: "",
  mobile_image: "",
  redirect_url: "",
  displayOrder: "0",
  isActive: true,
  itemsJson: "[]",
};

export default function AdminFeedSections() {
  const [selectedCategory, setSelectedCategory] = useState("men");
  const { data: sections = [], isLoading } = useAdminFeedSections(selectedCategory);
  const createSection = useCreateFeedSection();
  const updateSection = useUpdateFeedSection();
  const deleteSection = useDeleteFeedSection();
  const { toast } = useToast();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<SectionFormData>(EMPTY_FORM);

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, categorySlug: selectedCategory });
    setShowForm(true);
  };

  const openEdit = (section: AdminFeedSection) => {
    setEditingId(section.id);
    setForm({
      categorySlug: section.categorySlug,
      type: section.type,
      title: section.title,
      image: section.image || "",
      mobile_image: section.mobile_image || "",
      redirect_url: section.redirect_url || "",
      displayOrder: String(section.displayOrder),
      isActive: section.isActive,
      itemsJson: section.items ? JSON.stringify(section.items, null, 2) : "[]",
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string, title: string) => {
    if (!window.confirm(`Delete section "${title}"?`)) return;
    try {
      await deleteSection.mutateAsync(id);
      toast({ title: "Section deleted" });
    } catch (e: any) {
      toast({ title: "Delete failed", description: e.message, variant: "destructive" });
    }
  };

  const toggleActive = async (section: AdminFeedSection) => {
    try {
      await updateSection.mutateAsync({
        id: section.id,
        data: { isActive: !section.isActive },
      });
      toast({ title: section.isActive ? "Section hidden" : "Section visible" });
    } catch (e: any) {
      toast({ title: "Update failed", description: e.message, variant: "destructive" });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    let parsedItems: unknown[] = [];
    try {
      parsedItems = JSON.parse(form.itemsJson);
      if (!Array.isArray(parsedItems)) throw new Error("Items must be an array");
    } catch (err: any) {
      toast({ title: "Invalid items JSON", description: err.message, variant: "destructive" });
      return;
    }

    const payload: Record<string, unknown> = {
      categorySlug: form.categorySlug,
      type: form.type,
      title: form.title.trim(),
      displayOrder: parseInt(form.displayOrder) || 0,
      isActive: form.isActive,
      items: parsedItems,
    };
    if (form.image.trim()) payload.image = form.image.trim();
    if (form.mobile_image.trim()) payload.mobile_image = form.mobile_image.trim();
    if (form.redirect_url.trim()) payload.redirect_url = form.redirect_url.trim();

    try {
      if (editingId) {
        await updateSection.mutateAsync({ id: editingId, data: payload });
        toast({ title: "Section updated" });
      } else {
        await createSection.mutateAsync(payload);
        toast({ title: "Section created" });
      }
      setShowForm(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    }
  };

  const isSaving = createSection.isPending || updateSection.isPending;

  const sortedSections = [...sections].sort((a, b) => a.displayOrder - b.displayOrder);

  const typeLabel = (type: string) =>
    SECTION_TYPES.find((t) => t.value === type)?.label || type;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="font-display font-bold text-2xl" data-testid="text-feed-sections-title">
              Category Feed Sections
            </h2>
            <p className="text-muted-foreground text-sm">
              Manage dynamic content blocks on category landing pages
            </p>
          </div>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl font-medium text-sm"
            data-testid="button-create-section"
          >
            <Plus className="w-4 h-4" /> Add Section
          </button>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {CATEGORY_OPTIONS.map((cat) => (
            <button
              key={cat.value}
              onClick={() => setSelectedCategory(cat.value)}
              className={cn(
                "px-4 py-2 rounded-full text-sm font-medium border transition-all",
                selectedCategory === cat.value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card hover:border-primary/50"
              )}
              data-testid={`tab-category-${cat.value}`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {showForm && (
          <div className="bg-card border border-border rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-display font-bold text-lg">
                {editingId ? "Edit Section" : "New Section"}
              </h3>
              <button
                onClick={() => { setShowForm(false); setEditingId(null); }}
                className="p-1.5 hover:bg-muted rounded-lg"
                data-testid="button-close-section-form"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Category *</label>
                  <div className="relative">
                    <select
                      value={form.categorySlug}
                      onChange={(e) => setForm((f) => ({ ...f, categorySlug: e.target.value }))}
                      className="w-full appearance-none px-3 py-2.5 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:outline-none pr-10"
                      data-testid="select-section-category"
                    >
                      {CATEGORY_OPTIONS.map((c) => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none text-muted-foreground" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Section Type *</label>
                  <div className="relative">
                    <select
                      value={form.type}
                      onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                      className="w-full appearance-none px-3 py-2.5 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:outline-none pr-10"
                      data-testid="select-section-type"
                    >
                      {SECTION_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none text-muted-foreground" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Display Order</label>
                  <input
                    type="number"
                    value={form.displayOrder}
                    onChange={(e) => setForm((f) => ({ ...f, displayOrder: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:outline-none"
                    data-testid="input-section-order"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">Title *</label>
                <input
                  required
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="Trending Now"
                  className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:outline-none"
                  data-testid="input-section-title"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <AdminMediaUploadSingle
                    label="Banner Image"
                    value={form.image}
                    onChange={(path) => setForm((f) => ({ ...f, image: path }))}
                    data-testid="upload-section-image"
                  />
                  <input
                    value={form.image}
                    onChange={(e) => setForm((f) => ({ ...f, image: e.target.value }))}
                    placeholder="Or paste image URL"
                    className="mt-2 w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:outline-none"
                    data-testid="input-section-image"
                  />
                </div>
                <div>
                  <AdminMediaUploadSingle
                    label="Mobile Image"
                    value={form.mobile_image}
                    onChange={(path) => setForm((f) => ({ ...f, mobile_image: path }))}
                    data-testid="upload-section-mobile-image"
                  />
                  <input
                    value={form.mobile_image}
                    onChange={(e) => setForm((f) => ({ ...f, mobile_image: e.target.value }))}
                    placeholder="Or paste image URL"
                    className="mt-2 w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:outline-none"
                    data-testid="input-section-mobile-image"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">Redirect URL</label>
                <input
                  value={form.redirect_url}
                  onChange={(e) => setForm((f) => ({ ...f, redirect_url: e.target.value }))}
                  placeholder="/shop?category=men&subcategory=clothing"
                  className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:outline-none"
                  data-testid="input-section-redirect"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Items (JSON array)
                </label>
                <p className="text-xs text-muted-foreground mb-2">
                  For <strong>product items</strong>: {`[{"id":"...", "name":"...", "image":"...", "price":1999, "slug":"..."}]`}<br />
                  For <strong>brand items</strong>: {`[{"brand_id":"nike", "name":"Nike", "logo":"https://..."}]`}
                </p>
                <textarea
                  value={form.itemsJson}
                  onChange={(e) => setForm((f) => ({ ...f, itemsJson: e.target.value }))}
                  rows={6}
                  className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm font-mono focus:ring-2 focus:ring-primary/20 focus:outline-none resize-y"
                  data-testid="textarea-section-items"
                />
              </div>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                  className="w-4 h-4 text-primary focus:ring-primary border-gray-300 rounded"
                  data-testid="checkbox-section-active"
                />
                <span className="text-sm font-medium">Active (visible on storefront)</span>
              </label>

              {form.image && (
                <div className="rounded-xl overflow-hidden border border-border aspect-[3/1] bg-muted">
                  <img
                    src={getMediaUrl(form.image)}
                    alt="Preview"
                    className="w-full h-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-xl font-medium text-sm disabled:opacity-60"
                  data-testid="button-save-section"
                >
                  {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingId ? "Update" : "Create"}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setEditingId(null); }}
                  className="px-6 py-2.5 border border-border rounded-xl text-sm font-medium hover:bg-muted transition-colors"
                  data-testid="button-cancel-section-form"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {isLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse bg-card border border-border h-24 rounded-2xl" />
            ))}
          </div>
        ) : sortedSections.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-12 text-center">
            <div className="w-14 h-14 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <LayoutGrid className="w-7 h-7 text-muted-foreground" />
            </div>
            <h3 className="font-display font-bold text-lg mb-1">No feed sections</h3>
            <p className="text-muted-foreground text-sm mb-6">
              Create sections to show on the {selectedCategory} category landing page.
            </p>
            <button
              onClick={openCreate}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl font-medium text-sm"
            >
              <Plus className="w-4 h-4" /> Add Section
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {sortedSections.map((section) => (
              <div
                key={section.id}
                className={cn(
                  "bg-card border border-border rounded-2xl overflow-hidden flex flex-col sm:flex-row",
                  !section.isActive && "opacity-60"
                )}
                data-testid={`card-section-${section.id}`}
              >
                {section.image ? (
                  <div className="sm:w-40 h-24 sm:h-auto bg-muted shrink-0 relative">
                    <img src={getMediaUrl(section.image)} alt={section.title} className="w-full h-full object-cover" />
                    <div className="absolute top-2 left-2">
                      <span className={cn(
                        "text-[10px] font-bold uppercase px-2 py-0.5 rounded-full",
                        section.isActive ? "bg-emerald-500 text-white" : "bg-gray-500 text-white"
                      )}>
                        {section.isActive ? "Active" : "Hidden"}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="sm:w-40 h-24 sm:h-auto bg-muted shrink-0 flex items-center justify-center relative">
                    <Image className="w-8 h-8 text-muted-foreground" />
                    <div className="absolute top-2 left-2">
                      <span className={cn(
                        "text-[10px] font-bold uppercase px-2 py-0.5 rounded-full",
                        section.isActive ? "bg-emerald-500 text-white" : "bg-gray-500 text-white"
                      )}>
                        {section.isActive ? "Active" : "Hidden"}
                      </span>
                    </div>
                  </div>
                )}

                <div className="flex-1 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex items-center gap-2 text-muted-foreground sm:hidden">
                    <GripVertical className="w-4 h-4" />
                    <span className="text-xs">Order: {section.displayOrder}</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <h4 className="font-display font-bold text-sm">{section.title}</h4>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-muted text-xs font-medium">
                        {typeLabel(section.type)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Order: {section.displayOrder}
                      </span>
                      {section.items && section.items.length > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {section.items.length} item{section.items.length !== 1 ? "s" : ""}
                        </span>
                      )}
                      {section.redirect_url && (
                        <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                          → {section.redirect_url}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => toggleActive(section)}
                      className="p-2 hover:bg-muted rounded-lg transition-colors"
                      title={section.isActive ? "Hide" : "Show"}
                      data-testid={`button-toggle-${section.id}`}
                    >
                      {section.isActive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => openEdit(section)}
                      className="p-2 hover:bg-muted rounded-lg transition-colors"
                      title="Edit"
                      data-testid={`button-edit-${section.id}`}
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(section.id, section.title)}
                      className="p-2 hover:bg-destructive/10 text-destructive rounded-lg transition-colors"
                      title="Delete"
                      data-testid={`button-delete-${section.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
