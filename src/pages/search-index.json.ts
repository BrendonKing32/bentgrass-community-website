import type { APIRoute } from "astro";
import { getCollection } from "astro:content";

export const prerender = true;

interface SearchRecord {
  type: "news" | "events" | "faq" | "resources" | "newsletters" | "gallery" | "pages";
  title: string;
  excerpt: string;
  url: string;
  date: string | null;
}

function stripMarkdown(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)]\([^)]*\)/g, "$1")
    .replace(/[#>*_~`-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(text: string, max = 160): string {
  if (text.length <= max) return text;
  return text.slice(0, max).replace(/\s+\S*$/, "") + "…";
}

export const GET: APIRoute = async () => {
  const [news, events, faq, resources, newsletters, gallery, pages] = await Promise.all([
    getCollection("news"),
    getCollection("events"),
    getCollection("faq"),
    getCollection("resources"),
    getCollection("newsletters"),
    getCollection("gallery"),
    getCollection("pages"),
  ]);

  const records: SearchRecord[] = [
    ...news.map((e) => ({
      type: "news" as const,
      title: e.data.title,
      excerpt: truncate(e.data.summary ?? stripMarkdown(e.body ?? "")),
      url: `/news-announcements#news-${e.id}`,
      date: e.data.date.toISOString(),
    })),
    ...events.map((e) => ({
      type: "events" as const,
      title: e.data.title,
      excerpt: truncate([e.data.location, e.data.time].filter(Boolean).join(" · ") || stripMarkdown(e.body ?? "")),
      url: `/events-calendar#event-${e.id}`,
      date: e.data.date.toISOString(),
    })),
    ...faq.map((e) => ({
      type: "faq" as const,
      title: e.data.question,
      excerpt: truncate(stripMarkdown(e.body ?? "")),
      url: `/faq#faq-${e.id}`,
      date: null,
    })),
    ...resources.map((e) => ({
      type: "resources" as const,
      title: e.data.title,
      excerpt: truncate(stripMarkdown(e.body ?? "")),
      url: `/community-resources/general-resources#resource-${e.id}`,
      date: null,
    })),
    ...newsletters.map((e) => ({
      type: "newsletters" as const,
      title: e.data.title,
      excerpt: "",
      url: `/community-resources/monthly-newsletters`,
      date: e.data.date.toISOString(),
    })),
    ...gallery.map((e) => ({
      type: "gallery" as const,
      title: e.data.title,
      excerpt: "",
      url: `/community-gallery`,
      date: e.data.date ? e.data.date.toISOString() : null,
    })),
    ...pages.map((e) => ({
      type: "pages" as const,
      title: e.data.title,
      excerpt: "",
      url: e.id === "whmd" ? "/community-resources/whmd-information" : "/community-resources/bgmd-information",
      date: null,
    })),
  ];

  return new Response(JSON.stringify(records), { headers: { "Content-Type": "application/json" } });
};
