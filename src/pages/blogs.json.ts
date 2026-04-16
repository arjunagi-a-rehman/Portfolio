import type { APIRoute } from 'astro';
import { blogPosts } from '../data/posts';

// Force static prerender so this is served as a plain file (dist/blogs.json)
// rather than a runtime endpoint. Defensive — Astro prerenders by default in
// static output mode, but being explicit keeps things working if output mode
// ever changes.
export const prerender = true;

// Lean payload tailored for the Convex notifier. Only fields the email
// template needs; full metadata lives in src/data/posts.ts.
export const GET: APIRoute = () => {
  const payload = {
    posts: blogPosts.map((p) => ({
      slug: p.slug,
      title: p.title,
      excerpt: p.excerpt,
      readTime: p.readTime,
      series: p.series,
      part: p.part ?? null,
    })),
    generatedAt: new Date().toISOString(),
  };

  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      'content-type': 'application/json',
      'cache-control': 'public, max-age=60',
    },
  });
};
