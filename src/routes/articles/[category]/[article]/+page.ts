import type { PageLoad } from "./$types";
import { fetchArticle } from "$repo";
import { base, resolve } from "$app/paths";
import { Marked, type RendererObject } from "marked";

// term link: single-segment internal path whose query is exactly ?term=SLUG,
// e.g. /ai?term=artificial-intelligence. The query key is matched case
// sensitively; the values are lowercased because the repo paths are lowercase.
const TERM_LINK = /^\/([a-zA-Z0-9][\w-]*)\?term=([\w-]+)$/;

const ABSOLUTE = /^https?:\/\//i;

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function termPath(category: string, slug: string): string {
  return resolve("/[category]", { category }) + `?term=${slug}`;
}

// The raw href lands in the page as HTML, so only a narrow set of shapes may
// become an anchor: a same-document fragment, a base-prefixed internal path
// (a protocol-relative "//host" is an absolute URL in disguise and is dropped),
// or a plain http(s) URL. Everything else -- javascript:, data:, vbscript:,
// mailto:, bare relative paths -- is refused and rendered as plain text.
function safeHref(href: string): string | null {
  const value = href.trim();

  if (value === "") {
    return null;
  }
  if (value.startsWith("#")) {
    return value;
  }
  if (value.startsWith("//")) {
    return null;
  }
  if (value.startsWith("/")) {
    return base + value;
  }
  if (ABSOLUTE.test(value)) {
    return value;
  }

  return null;
}

const renderer: RendererObject = {
  link(token) {
    const body = this.parser.parseInline(token.tokens);
    const title = token.title ? ` title="${escapeAttr(token.title)}"` : "";

    const termLink = TERM_LINK.exec(token.href);
    if (termLink) {
      const category = termLink[1].toLowerCase();
      const slug = termLink[2].toLowerCase();

      // aria-describedby is set at runtime on the anchor that is actually open:
      // a static value would point at a popup that is not there
      return `<a class="term" href="${escapeAttr(
        termPath(category, slug),
      )}" aria-expanded="false" data-term-category="${escapeAttr(
        category,
      )}" data-term-slug="${escapeAttr(slug)}"${title}>${body}</a>`;
    }

    const safe = safeHref(token.href);
    if (!safe) {
      return body;
    }

    return `<a href="${escapeAttr(safe)}"${title}>${body}</a>`;
  },
};

const articleParser = new Marked({ renderer });

export const prerender = false;

export const load: PageLoad = async ({ params }) => {
  const { category, article } = params;
  const content = await fetchArticle(category, article);
  const html = await articleParser.parse(content);

  return { category, article, html };
};
