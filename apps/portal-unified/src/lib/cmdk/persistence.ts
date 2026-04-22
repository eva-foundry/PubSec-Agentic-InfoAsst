import { useCallback, useEffect, useState } from "react";

const RECENT_KEY = "aia.cmdk.recent.v1";
const PINNED_KEY = "aia.cmdk.pinned.v1";

export const RECENT_LIMIT = 6;
export const PINNED_LIMIT = 8;

function readList(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}
function writeList(key: string, list: string[]) {
  try { localStorage.setItem(key, JSON.stringify(list)); } catch { /* ignore */ }
}

export interface PaletteMemory {
  recent: string[];
  pinned: string[];
  pushRecent: (id: string) => void;
  togglePin: (id: string) => "pinned" | "unpinned" | "limit";
  clearRecent: () => void;
}

export function usePaletteMemory(): PaletteMemory {
  const [recent, setRecent] = useState<string[]>(() => readList(RECENT_KEY));
  const [pinned, setPinned] = useState<string[]>(() => readList(PINNED_KEY));

  useEffect(() => { writeList(RECENT_KEY, recent); }, [recent]);
  useEffect(() => { writeList(PINNED_KEY, pinned); }, [pinned]);

  const pushRecent = useCallback((id: string) => {
    setRecent((prev) => [id, ...prev.filter((x) => x !== id)].slice(0, RECENT_LIMIT));
  }, []);

  const togglePin = useCallback((id: string): "pinned" | "unpinned" | "limit" => {
    let result: "pinned" | "unpinned" | "limit" = "pinned";
    setPinned((prev) => {
      if (prev.includes(id)) {
        result = "unpinned";
        return prev.filter((x) => x !== id);
      }
      if (prev.length >= PINNED_LIMIT) {
        result = "limit";
        return prev;
      }
      result = "pinned";
      return [id, ...prev];
    });
    return result;
  }, []);

  const clearRecent = useCallback(() => setRecent([]), []);

  return { recent, pinned, pushRecent, togglePin, clearRecent };
}
