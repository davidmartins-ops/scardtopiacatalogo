import { useEffect, useState } from "react";

export interface MtgSet {
  code: string;
  name: string;
}

const CACHE_KEY = "scryfall_sets_cache";
const CACHE_TTL = 24 * 60 * 60 * 1000;

let inFlight: Promise<MtgSet[]> | null = null;

const fetchSets = async (): Promise<MtgSet[]> => {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed?.ts && Date.now() - parsed.ts < CACHE_TTL && Array.isArray(parsed.sets)) {
        return parsed.sets;
      }
    }
  } catch {}

  const res = await fetch("https://api.scryfall.com/sets");
  if (!res.ok) throw new Error("scryfall sets failed");
  const json = await res.json();
  const sets: MtgSet[] = (json.data ?? []).map((s: any) => ({
    code: String(s.code).toLowerCase(),
    name: s.name,
  }));
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), sets }));
  } catch {}
  return sets;
};

export const useMtgSets = () => {
  const [sets, setSets] = useState<MtgSet[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!inFlight) inFlight = fetchSets().catch(() => []);
    inFlight.then((s) => {
      if (!cancelled) {
        setSets(s);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { sets, loading };
};

/** Extracts set code from inventory id (single format: SET-NUM-LANG-F/NF-COND) */
export const extractSetCode = (inventoryId: string): string | null => {
  const parts = inventoryId.split("-");
  if (parts.length < 5) return null;
  const code = parts[0]?.toLowerCase();
  return code || null;
};
