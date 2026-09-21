import { useCallback, useState } from "react";

const STORAGE_KEY = "blog:postWide";

function readStored(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeStored(wide: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, wide ? "1" : "0");
  } catch {
    // Ignore quota / private-mode failures; the in-memory toggle still works.
  }
}

export function usePostWide(): [boolean, () => void] {
  const [wide, setWide] = useState(readStored);

  const toggle = useCallback(() => {
    setWide((current) => {
      const next = !current;
      writeStored(next);
      return next;
    });
  }, []);

  return [wide, toggle];
}
