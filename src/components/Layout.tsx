import { ReactNode } from "react";
import { Header } from "./Header";

export function Layout({
  children,
  variant = "page",
}: {
  children: ReactNode;
  variant?: "page" | "workspace";
}) {
  if (variant === "workspace") {
    return (
      <div className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
        <Header fullWidth />
        <main className="min-h-0 flex-1 overflow-hidden">{children}</main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="mx-auto max-w-5xl px-4 py-10">{children}</main>
    </div>
  );
}
