import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";

export function AssetCaptionDialog({
  filename,
  alt,
  description,
  onAltChange,
  onDescriptionChange,
  onClose,
}: {
  filename: string;
  alt: string;
  description: string;
  onAltChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Media text"
    >
      <div
        className="w-full max-w-md rounded-xl border border-border bg-card p-4 shadow-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="mb-3 truncate text-sm font-medium">{filename}</h2>
        <label className="block text-xs text-muted">
          Alt
          <input
            value={alt}
            onChange={(event) => onAltChange(event.target.value)}
            className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
          />
        </label>
        <label className="mt-3 block text-xs text-muted">
          Description
          <textarea
            value={description}
            onChange={(event) => onDescriptionChange(event.target.value)}
            rows={4}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
          />
        </label>
        <div className="mt-4 flex justify-end">
          <Button type="button" size="sm" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
