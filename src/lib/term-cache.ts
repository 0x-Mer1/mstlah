import { fetchTerm } from "$repo";
import type { Term } from "$lib/types";

// shared by the article renderer and the popup itself: it is the
// aria-describedby target of whichever term anchor is open
export const TERM_POPUP_ID = "term-popup-card";

const NEGATIVE_TTL = 60_000;
const POSITIVE_TTL = 5 * 60_000;

interface CacheEntry {
  term: Term | null;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<Term>>();

const keyOf = (category: string, slug: string) => `${category}/${slug}`;

export function loadTerm(category: string, slug: string): Promise<Term> {
  const key = keyOf(category, slug);

  const hit = cache.get(key);
  if (hit) {
    if (hit.expiresAt > Date.now()) {
      return hit.term
        ? Promise.resolve(hit.term)
        : Promise.reject(new Error(`Unknown term "${slug}"`));
    }
    cache.delete(key);
  }

  const pending = inflight.get(key);
  if (pending) {
    return pending;
  }

  const request = fetchTerm(category, slug)
    .then((term) => {
      // finite so an edited dictionary entry shows up without a reload
      cache.set(key, { term, expiresAt: Date.now() + POSITIVE_TTL });
      return term;
    })
    .catch((error: unknown) => {
      // a miss is stable for a while: without this every hover repeats the same
      // guaranteed-to-fail request
      cache.set(key, { term: null, expiresAt: Date.now() + NEGATIVE_TTL });
      throw error;
    })
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, request);
  return request;
}
