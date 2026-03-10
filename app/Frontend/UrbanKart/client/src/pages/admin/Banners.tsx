import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import {
  useAdminHeroBanners,
  useCreateHeroBanner,
  useUpdateHeroBanner,
  useDeleteHeroBanner,
  type HeroBanner,
} from "@/hooks/use-admin";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Pencil,
  Trash2,
  Image,
  X,
  Loader2,
  Eye,
  EyeOff,
  GripVertical,
} from "lucide-react";
import { cn, getMediaUrl } from "@/lib/utils";
import { AdminMediaUploadSingle } from "@/components/admin/AdminMediaUpload";

interface BannerFormData {
  title: string;
  subtitle: string;
  image: string;
  color: string;
  isActive: boolean;
  sortOrder: string;
}

const EMPTY_FORM: BannerFormData = {
  title: "",
  subtitle: "",
  image: "",
  color: "text-white",
  isActive: true,
  sortOrder: "0",
};

export default function AdminBanners() {
  const { data: banners = [], isLoading } = useAdminHeroBanners();
  const createBanner = useCreateHeroBanner();
  const updateBanner = useUpdateHeroBanner();
  const deleteBanner = useDeleteHeroBanner();
  const { toast } = useToast();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<BannerFormData>(EMPTY_FORM);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEdit = (banner: HeroBanner) => {
    setEditingId(banner.id);
    setForm({
      title: banner.title,
      subtitle: banner.subtitle,
      image: banner.image,
      color: banner.color,
      isActive: banner.isActive,
      sortOrder: String(banner.sortOrder),
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string, title: string) => {
    if (!window.confirm(`Delete banner "${title}"?`)) return;
    try {
      await deleteBanner.mutateAsync(id);
      toast({ title: "Banner deleted" });
    } catch (e: any) {
      toast({
        title: "Delete failed",
        description: e.message,
        variant: "destructive",
      });
    }
  };

  const toggleActive = async (banner: HeroBanner) => {
    try {
      await updateBanner.mutateAsync({
        id: banner.id,
        data: { isActive: !banner.isActive },
      });
      toast({
        title: banner.isActive ? "Banner hidden" : "Banner visible",
      });
    } catch (e: any) {
      toast({
        title: "Update failed",
        description: e.message,
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: Record<string, unknown> = {
      title: form.title.trim(),
      subtitle: form.subtitle.trim(),
      image: form.image.trim(),
      color: form.color.trim() || "text-white",
      isActive: form.isActive,
      sortOrder: parseInt(form.sortOrder) || 0,
    };

    try {
      if (editingId) {
        await updateBanner.mutateAsync({ id: editingId, data: payload });
        toast({ title: "Banner updated" });
      } else {
        await createBanner.mutateAsync(payload);
        toast({ title: "Banner created" });
      }
      setShowForm(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
    } catch (e: any) {
      toast({
        title: "Save failed",
        description: e.message,
        variant: "destructive",
      });
    }
  };

  const isSaving = createBanner.isPending || updateBanner.isPending;

  const isVideoUrl = (url: string) =>
    /\.(mp4|webm|ogg|mov)(\?|$)/i.test(url);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2
              className="font-display font-bold text-2xl"
              data-testid="text-banners-title"
            >
              Hero Banners
            </h2>
            <p className="text-muted-foreground text-sm">
              Manage homepage carousel slides
            </p>
          </div>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl font-medium text-sm"
            data-testid="button-create-banner"
          >
            <Plus className="w-4 h-4" /> Add Banner
          </button>
        </div>

        {showForm && (
          <div className="bg-card border border-border rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-display font-bold text-lg">
                {editingId ? "Edit Banner" : "New Banner"}
              </h3>
              <button
                onClick={() => {
                  setShowForm(false);
                  setEditingId(null);
                }}
                className="p-1.5 hover:bg-muted rounded-lg"
                data-testid="button-close-banner-form"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    Title *
                  </label>
                  <input
                    required
                    value={form.title}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, title: e.target.value }))
                    }
                    placeholder="Summer Collection '25"
                    className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:outline-none"
                    data-testid="input-banner-title"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    Subtitle
                  </label>
                  <input
                    value={form.subtitle}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, subtitle: e.target.value }))
                    }
                    placeholder="Up to 50% off on selected styles"
                    className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:outline-none"
                    data-testid="input-banner-subtitle"
                  />
                </div>
                <div className="md:col-span-2">
                  <AdminMediaUploadSingle
                    label="Image / Video *"
                    value={form.image}
                    onChange={(path) =>
                      setForm((f) => ({ ...f, image: path }))
                    }
                    data-testid="upload-banner-image"
                  />
                  <input
                    required
                    value={form.image}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, image: e.target.value }))
                    }
                    placeholder="Or paste image / video URL"
                    className="mt-2 w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:outline-none"
                    data-testid="input-banner-image"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    Text Color CSS Class
                  </label>
                  <input
                    value={form.color}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, color: e.target.value }))
                    }
                    placeholder="text-white"
                    className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:outline-none"
                    data-testid="input-banner-color"
                  />
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
                    data-testid="input-banner-sort"
                  />
                </div>
              </div>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, isActive: e.target.checked }))
                  }
                  className="w-4 h-4 text-primary focus:ring-primary border-gray-300 rounded"
                  data-testid="checkbox-banner-active"
                />
                <span className="text-sm font-medium">Active (visible on storefront)</span>
              </label>

              {form.image && (
                <div className="rounded-xl overflow-hidden border border-border aspect-[3/1] bg-muted">
                  {isVideoUrl(form.image) ? (
                    <video
                      src={getMediaUrl(form.image)}
                      className="w-full h-full object-cover"
                      muted
                      autoPlay
                      loop
                      playsInline
                    />
                  ) : (
                    <img
                      src={getMediaUrl(form.image)}
                      alt="Preview"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  )}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-xl font-medium text-sm disabled:opacity-60"
                  data-testid="button-save-banner"
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
                  data-testid="button-cancel-banner-form"
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
              <div key={i} className="animate-pulse bg-card border border-border h-28 rounded-2xl" />
            ))}
          </div>
        ) : banners.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-12 text-center">
            <div className="w-14 h-14 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <Image className="w-7 h-7 text-muted-foreground" />
            </div>
            <h3 className="font-display font-bold text-lg mb-1">No hero banners</h3>
            <p className="text-muted-foreground text-sm mb-6">
              Create banners to show on the homepage carousel.
            </p>
            <button
              onClick={openCreate}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl font-medium text-sm"
            >
              <Plus className="w-4 h-4" /> Add Banner
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {banners
              .slice()
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((banner) => (
                <div
                  key={banner.id}
                  className={cn(
                    "bg-card border border-border rounded-2xl overflow-hidden flex flex-col sm:flex-row",
                    !banner.isActive && "opacity-60"
                  )}
                  data-testid={`card-banner-${banner.id}`}
                >
                  <div className="sm:w-48 h-28 sm:h-auto bg-muted shrink-0 relative">
                    {isVideoUrl(banner.image) ? (
                      <video
                        src={getMediaUrl(banner.image)}
                        className="w-full h-full object-cover"
                        muted
                        playsInline
                      />
                    ) : (
                      <img
                        src={getMediaUrl(banner.image)}
                        alt={banner.title}
                        className="w-full h-full object-cover"
                      />
                    )}
                    <div className="absolute top-2 left-2">
                      <span
                        className={cn(
                          "text-[10px] font-bold uppercase px-2 py-0.5 rounded-full",
                          banner.isActive
                            ? "bg-emerald-500 text-white"
                            : "bg-gray-500 text-white"
                        )}
                      >
                        {banner.isActive ? "Active" : "Hidden"}
                      </span>
                    </div>
                  </div>

                  <div className="flex-1 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex items-center gap-2 text-muted-foreground sm:hidden">
                      <GripVertical className="w-4 h-4" />
                      <span className="text-xs">Order: {banner.sortOrder}</span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <h4 className="font-display font-bold text-sm">
                        {banner.title}
                      </h4>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {banner.subtitle}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1 hidden sm:block">
                        Order: {banner.sortOrder} &middot; Color: {banner.color}
                      </p>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => toggleActive(banner)}
                        className="p-2 hover:bg-muted rounded-lg transition-colors"
                        title={banner.isActive ? "Hide" : "Show"}
                        data-testid={`button-toggle-${banner.id}`}
                      >
                        {banner.isActive ? (
                          <Eye className="w-4 h-4" />
                        ) : (
                          <EyeOff className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() => openEdit(banner)}
                        className="p-2 hover:bg-muted rounded-lg transition-colors"
                        title="Edit"
                        data-testid={`button-edit-${banner.id}`}
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(banner.id, banner.title)}
                        className="p-2 hover:bg-destructive/10 text-destructive rounded-lg transition-colors"
                        title="Delete"
                        data-testid={`button-delete-${banner.id}`}
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
