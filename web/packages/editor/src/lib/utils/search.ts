import fuzzysort from "fuzzysort";

export interface FuzzyFilterOptions {
  /** Max results to return. Default: no limit (returns all matches). */
  limit?: number;
  /** Minimum score threshold. Default: -10000. Closer to 0 = stricter matching. */
  threshold?: number;
}

/**
 * Filters + sorts an array by fuzzy relevance to a query.
 *
 * @param items  Array of strings, or array of objects
 * @param query  The search query
 * @param keys   For object arrays: the keys to search. Pass empty array for string arrays.
 * @param opts   Optional configuration
 * @returns      Sorted array of matching items (best match first)
 */
export function fuzzyFilter<T>(
  items: T[],
  query: string,
  keys: (keyof T & string)[],
  opts: FuzzyFilterOptions = {}
): T[] {
  if (!query || query.trim().length === 0) return items;

  const { limit, threshold = -10000 } = opts;

  if (keys.length === 0) {
    // String array matching
    const results = fuzzysort.go(query, items as unknown as string[], {
      threshold,
      limit,
    });
    return results.map((r) => r.target as unknown as T);
  }

  // Object array with key-based matching
  const results = fuzzysort.go(query, items as unknown as any[], {
    keys: keys as string[],
    threshold,
    limit,
  });
  return (results as unknown as { obj: T }[]).map((r) => r.obj);
}

/**
 * Simple fuzzy match test: returns true if `query` fuzzily matches `target`.
 */
export function fuzzyMatch(query: string, target: string): boolean {
  if (!query || query.trim().length === 0) return true;
  const result = fuzzysort.single(query, target);
  return result !== null;
}
