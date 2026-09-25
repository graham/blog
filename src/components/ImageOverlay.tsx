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
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  });

  if (!open || current === undefined) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 sm:p-8"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={current.alt || "Image"}
    >
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
      <figure
        className="flex max-h-full max-w-5xl flex-col items-center"
        onClick={(event) => event.stopPropagation()}
      >
        <img
          src={current.src}
          alt={current.alt}
          className="max-h-[80vh] w-auto max-w-full rounded-lg object-contain"
        />
        {(current.caption ?? current.alt) ? (
          <figcaption className="mt-3 max-w-2xl text-center font-sans text-sm leading-6 text-white">
            {current.caption ?? current.alt}
          </figcaption>
        ) : null}
        {images.length > 1 ? (
          <div className="mt-2 font-mono text-xs tabular-nums text-white/70">
            {index + 1} / {images.length}
          </div>
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
