import { useEffect, useState, type DragEvent } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import type { OverlayImage } from "@/lib/images";

function wrapIndex(index: number, length: number, delta: number) {
  return (index + delta + length) % length;
}

function Chevron({ dir }: { dir: "left" | "right" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="h-6 w-6"
      aria-hidden="true"
    >
      {dir === "left" ? (
        <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}

export function ImageOverlay({
  images,
  index,
  open,
  onClose,
  onIndexChange,
  onStepPast,
}: {
  images: OverlayImage[];
  index: number;
  open: boolean;
  onClose: () => void;
  onIndexChange: (index: number) => void;
  // When set, stepping before the first or after the last image calls this
  // instead of wrapping, so the caller can load the neighbouring images.
  onStepPast?: (direction: -1 | 1) => void;
}) {
  const current = images[index];
  const canStep = images.length > 1 || onStepPast !== undefined;

  function step(direction: -1 | 1) {
    const next = index + direction;
    if (onStepPast && (next < 0 || next >= images.length)) {
      onStepPast(direction);
      return;
    }
    onIndexChange(wrapIndex(index, images.length, direction));
  }

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (!canStep) return;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        step(-1);
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        step(1);
      }
    }
    // The page scrolls on <html>, so lock both to hide its scrollbar too.
    const previousBody = document.body.style.overflow;
    const previousRoot = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousBody;
      document.documentElement.style.overflow = previousRoot;
      window.removeEventListener("keydown", onKey);
    };
  });

  if (!open || current === undefined) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={current.alt || "Image"}
    >
      <button
        type="button"
        aria-label="Close"
        className="absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/55 text-xl leading-none text-white hover:bg-black/75"
        onClick={(event) => {
          event.stopPropagation();
          onClose();
        }}
      >
        ×
      </button>
      {canStep ? (
        <button
          type="button"
          aria-label="Previous image"
          className="absolute left-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white hover:bg-black/75 sm:left-6"
          onClick={(event) => {
            event.stopPropagation();
            step(-1);
          }}
        >
          <Chevron dir="left" />
        </button>
      ) : null}
      {canStep ? (
        <button
          type="button"
          aria-label="Next image"
          className="absolute right-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white hover:bg-black/75 sm:right-6"
          onClick={(event) => {
            event.stopPropagation();
            step(1);
          }}
        >
          <Chevron dir="right" />
        </button>
      ) : null}
      {/* The image fills whatever the caption leaves, scaling up small
          images while object-contain keeps their proportions. */}
      <figure className="flex h-full w-full min-w-0 flex-col items-center">
        <img
          src={current.src}
          alt={current.alt}
          onClick={(event) => event.stopPropagation()}
          className="min-h-0 w-full flex-1 object-contain"
        />
        {(current.caption ?? current.alt) || images.length > 1 ? (
          <figcaption
            onClick={(event) => event.stopPropagation()}
            className="flex w-full shrink-0 items-baseline justify-center gap-3 px-4 py-2 text-center font-sans text-sm text-white"
          >
            <span className="min-w-0 truncate">{current.caption ?? current.alt}</span>
            {images.length > 1 ? (
              <span className="shrink-0 font-mono text-xs tabular-nums text-white/60">
                {index + 1} / {images.length}
              </span>
            ) : null}
          </figcaption>
        ) : null}
      </figure>
    </div>,
    document.body,
  );
}

export function ZoomableImage({
  src,
  alt,
  className,
  draggable,
  onDragStart,
  gallery,
}: {
  src: string;
  alt: string;
  className?: string;
  draggable?: boolean;
  onDragStart?: (event: DragEvent<HTMLImageElement>) => void;
  gallery?: OverlayImage[];
}) {
  const [open, setOpen] = useState(false);
  const images =
    gallery && gallery.length > 0
      ? gallery.some((image) => image.src === src)
        ? gallery
        : [{ src, alt }, ...gallery]
      : [{ src, alt }];
  const startIndex = Math.max(
    0,
    images.findIndex((image) => image.src === src),
  );
  const [index, setIndex] = useState(startIndex);

  return (
    <>
      <img
        src={src}
        alt={alt}
        draggable={draggable}
        onDragStart={onDragStart}
        onClick={() => {
          setIndex(startIndex);
          setOpen(true);
        }}
        className={cn("h-auto max-w-full cursor-zoom-in", className)}
      />
      <ImageOverlay
        images={images}
        index={index}
        open={open}
        onClose={() => setOpen(false)}
        onIndexChange={setIndex}
      />
    </>
  );
}
