import { ConvexAuthProvider, type TokenStorage } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import { ReactNode } from "react";

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL!);

function browserAuthStorage(): TokenStorage | undefined {
  if (typeof window === "undefined") return undefined;
  const raw = window.localStorage;
  return {
    getItem(key) {
      const value = raw.getItem(key);
      if (value == null) return null;
      if (key.includes("RefreshToken") && !value.includes("|")) {
        raw.removeItem(key);
        return null;
      }
      return value;
    },
    setItem(key, value) {
      raw.setItem(key, value);
    },
    removeItem(key) {
      raw.removeItem(key);
    },
  };
}

export default function ConvexClientProvider({ children }: { children: ReactNode }) {
  return (
    <ConvexAuthProvider client={convex} storage={browserAuthStorage()}>
      {children}
    </ConvexAuthProvider>
  );
}
