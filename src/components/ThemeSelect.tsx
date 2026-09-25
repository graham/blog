import { useEffect, useId, useRef, useState } from "react";
import { THEMES, type ThemeId } from "@/lib/themes";

type Theme = (typeof THEMES)[number];

function Palette({
  colors,
}: {
  colors: { background: string; foreground: string; accent: string };
}) {
  return (
    <span className="flex shrink-0 overflow-hidden rounded-md border border-border">
      <span className="h-6 w-5" style={{ background: colors.background }} />
      <span className="h-6 w-5" style={{ background: colors.foreground }} />
      <span className="h-6 w-5" style={{ background: colors.accent }} />
    </span>
  );
}

export function ThemeSelect<Id extends ThemeId>({
  value,
  themes,
  disabled,
  onChange,
}: {
  value: Id;
  themes: Theme[];
  disabled: boolean;
  onChange: (id: Id) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const selected = themes.find((theme) => theme.id === value) ?? themes[0];

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  return (
    <div ref={rootRef} className="relative w-full min-w-0 sm:w-72">
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((current) => !current)}
        className="flex w-full min-w-0 items-center gap-2 rounded-md border border-input bg-background px-2 py-1.5 text-left text-sm outline-none ring-ring hover:bg-secondary/50 focus-visible:ring-2 disabled:opacity-50"
      >
        <Palette colors={selected.colors} />
        <span className="min-w-0 flex-1 truncate font-medium">{selected.name}</span>
        <span className="text-xs text-muted">{open ? "Hide" : "Show"}</span>
      </button>
      {open ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute right-0 z-30 mt-1 max-h-80 w-full min-w-0 overflow-auto rounded-md border-2 border-foreground/50 bg-card py-1 shadow-md sm:w-80"
        >
          {themes.map((theme) => {
            const active = theme.id === selected.id;
            return (
              <li key={theme.id} role="option" aria-selected={active}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(theme.id as Id);
                    setOpen(false);
                  }}
                  className={`flex w-full items-start gap-2 px-2 py-2 text-left text-sm hover:bg-secondary/60 ${
                    active ? "bg-secondary/80" : ""
                  }`}
                >
                  <Palette colors={theme.colors} />
                  <span className="min-w-0">
                    <span className="block font-medium">{theme.name}</span>
                    <span className="mt-0.5 block text-xs text-muted">
                      {theme.description}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
