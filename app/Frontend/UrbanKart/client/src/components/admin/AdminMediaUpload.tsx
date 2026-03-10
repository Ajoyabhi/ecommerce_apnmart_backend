"use client";

import { useRef } from "react";
import { Loader2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getMediaUrl } from "@/lib/utils";
import { useAdminUploadMedia } from "@/hooks/use-admin";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

function isVideoPath(path: string): boolean {
  return /\.(mp4|webm|ogg|mov)(\?|$)/i.test(path);
}

interface AdminMediaUploadSingleProps {
  label?: string;
  value: string;
  onChange: (path: string) => void;
  accept?: string;
  className?: string;
  "data-testid"?: string;
}

export function AdminMediaUploadSingle({
  label = "Image / Video",
  value,
  onChange,
  accept = "image/jpeg,image/png,image/webp,video/mp4,video/webm",
  className,
  "data-testid": dataTestId,
}: AdminMediaUploadSingleProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const upload = useAdminUploadMedia();
  const { toast } = useToast();
  const displayUrl = getMediaUrl(value);

  const handleSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    try {
      const result = await upload.mutateAsync(Array.from(files));
      if (result.length) onChange(result[0].path);
      if (result.length > 1) {
        toast({ title: "Only first file used.", variant: "default" });
      }
    } catch (err) {
      toast({
        title: "Upload failed",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    }
    e.target.value = "";
  };

  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <label className="block text-sm font-medium">{label}</label>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={false}
          className="hidden"
          onChange={handleSelect}
          data-testid={dataTestId ? `${dataTestId}-input` : undefined}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={upload.isPending}
          onClick={() => inputRef.current?.click()}
          data-testid={dataTestId ? `${dataTestId}-button` : undefined}
        >
          {upload.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Upload className="w-4 h-4" />
          )}
          <span className="ml-2">{upload.isPending ? "Uploading…" : "Upload"}</span>
        </Button>
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange("")}
            title="Clear"
          >
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>
      {value && (
        <div className="rounded-lg border border-border overflow-hidden bg-muted aspect-video max-w-xs">
          {isVideoPath(value) ? (
            <video
              src={displayUrl}
              className="w-full h-full object-contain"
              muted
              autoPlay
              loop
              playsInline
            />
          ) : (
            <img
              src={displayUrl}
              alt="Preview"
              className="w-full h-full object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}

interface AdminMediaUploadMultipleProps {
  label?: string;
  value: string[];
  onChange: (paths: string[]) => void;
  accept?: string;
  maxFiles?: number;
  className?: string;
  "data-testid"?: string;
}

export function AdminMediaUploadMultiple({
  label = "Gallery",
  value,
  onChange,
  accept = "image/jpeg,image/png,image/webp,video/mp4,video/webm",
  maxFiles = 10,
  className,
  "data-testid": dataTestId,
}: AdminMediaUploadMultipleProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const upload = useAdminUploadMedia();
  const { toast } = useToast();

  const handleSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    const remaining = maxFiles - value.length;
    if (remaining <= 0) {
      toast({ title: `Maximum ${maxFiles} files.`, variant: "default" });
      e.target.value = "";
      return;
    }
    const toUpload = Array.from(files).slice(0, remaining);
    try {
      const result = await upload.mutateAsync(toUpload);
      const paths = result.map((f) => f.path);
      onChange([...value, ...paths]);
    } catch (err) {
      toast({
        title: "Upload failed",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    }
    e.target.value = "";
  };

  const remove = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <label className="block text-sm font-medium">{label}</label>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple
          className="hidden"
          onChange={handleSelect}
          data-testid={dataTestId ? `${dataTestId}-input` : undefined}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={upload.isPending || value.length >= maxFiles}
          onClick={() => inputRef.current?.click()}
          data-testid={dataTestId ? `${dataTestId}-button` : undefined}
        >
          {upload.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Upload className="w-4 h-4" />
          )}
          <span className="ml-2">
            {upload.isPending ? "Uploading…" : "Add files"}
          </span>
        </Button>
        <span className="text-muted-foreground text-sm">
          {value.length} / {maxFiles}
        </span>
      </div>
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {value.map((path, i) => (
            <li
              key={`${path}-${i}`}
              className="relative rounded-lg border border-border overflow-hidden bg-muted w-24 h-24 flex-shrink-0"
            >
              {isVideoPath(path) ? (
                <video
                  src={getMediaUrl(path)}
                  className="w-full h-full object-cover"
                  muted
                  playsInline
                />
              ) : (
                <img
                  src={getMediaUrl(path)}
                  alt=""
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "";
                    (e.target as HTMLImageElement).style.background = "var(--muted)";
                  }}
                />
              )}
              <button
                type="button"
                onClick={() => remove(i)}
                className="absolute top-0.5 right-0.5 rounded bg-black/60 p-1 text-white hover:bg-black/80"
                title="Remove"
              >
                <X className="w-3 h-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
