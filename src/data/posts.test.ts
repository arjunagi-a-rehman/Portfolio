import { describe, expect, it } from 'vitest';
import { blogPosts } from './posts';

describe('blogPosts catalog invariants', () => {
  it('has at least one post', () => {
    expect(blogPosts.length).toBeGreaterThan(0);
  });

  it('every post has required fields', () => {
    for (const post of blogPosts) {
      expect(post.id, `post missing id: ${JSON.stringify(post)}`).toBeTruthy();
      expect(post.slug, `post ${post.id} missing slug`).toBeTruthy();
      expect(post.title, `post ${post.id} missing title`).toBeTruthy();
      expect(post.excerpt, `post ${post.id} missing excerpt`).toBeTruthy();
      expect(post.series, `post ${post.id} missing series`).toBeTruthy();
      expect(
        Array.isArray(post.tags) && post.tags.length > 0,
        `post ${post.id} missing tags`,
      ).toBe(true);
      expect(post.readTime, `post ${post.id} missing readTime`).toBeTruthy();
      expect(post.date, `post ${post.id} missing date`).toBeTruthy();
    }
  });

  it('every slug starts with exactly one leading slash', () => {
    // Invariant enforced by convex/notifier.ts canonicalization and the
    // sitemap. A "cli-to-ai" slug (no slash) or "//cli-to-ai" (double) would
    // break email links and the static routing contract.
    for (const post of blogPosts) {
      expect(
        /^\/[^/]/.test(post.slug),
        `post ${post.id} has malformed slug: ${post.slug}`,
      ).toBe(true);
    }
  });

  it('no slug has a trailing slash', () => {
    // A trailing slash would produce double slashes when the notifier joins
    // the slug onto the site URL (https://site.com + /foo/ -> https://site.com/foo/
    // vs the canonical https://site.com/foo), which breaks emailed links on
    // some mail clients that normalize URLs.
    for (const post of blogPosts) {
      expect(
        post.slug.endsWith('/'),
        `post ${post.id} has trailing slash in slug: ${post.slug}`,
      ).toBe(false);
    }
  });

  it('has no duplicate slugs', () => {
    // A duplicate slug means two posts claim the same URL. The build would
    // silently pick one and the notifier could email the wrong post body.
    const slugs = blogPosts.map((p) => p.slug);
    const unique = new Set(slugs);
    expect(
      unique.size,
      `duplicate slugs detected: ${slugs.filter((s, i) => slugs.indexOf(s) !== i).join(', ')}`,
    ).toBe(slugs.length);
  });

  it('has no duplicate ids', () => {
    const ids = blogPosts.map((p) => p.id);
    const unique = new Set(ids);
    expect(
      unique.size,
      `duplicate ids detected: ${ids.filter((s, i) => ids.indexOf(s) !== i).join(', ')}`,
    ).toBe(ids.length);
  });

  it('part numbers are positive integers when present', () => {
    for (const post of blogPosts) {
      if (post.part !== undefined) {
        expect(
          Number.isInteger(post.part) && post.part > 0,
          `post ${post.id} has bad part: ${post.part}`,
        ).toBe(true);
      }
    }
  });

  it('slugs use URL-safe kebab-case only', () => {
    // Enforced charset: lowercase letters, digits, hyphens. No spaces, no
    // uppercase (URLs are case-sensitive in some environments), no underscores
    // (inconsistent with existing slugs), no %-encoding required.
    const slugBody = /^\/[a-z0-9]+(-[a-z0-9]+)*$/;
    for (const post of blogPosts) {
      expect(
        slugBody.test(post.slug),
        `post ${post.id} slug "${post.slug}" contains non-URL-safe chars`,
      ).toBe(true);
    }
  });

  it('dates all use the same format (year-only or full ISO)', () => {
    // Mixing '2025' with '2026-04-18' silently corrupts the home-page sort
    // because localeCompare on different-length strings puts "2025" after
    // "2026-04-18" lexicographically. Force one format across the catalog.
    const formats = new Set(
      blogPosts.map((p) => {
        if (/^\d{4}$/.test(p.date)) return 'year';
        if (/^\d{4}-\d{2}-\d{2}$/.test(p.date)) return 'iso';
        return `bad:${p.date}`;
      }),
    );
    expect(
      formats.size === 1 &&
        !Array.from(formats).some((f) => f.startsWith('bad:')),
      `mixed date formats in catalog: ${Array.from(formats).join(', ')}`,
    ).toBe(true);
  });

  it('featured is a real boolean (not truthy string)', () => {
    // TypeScript says `featured: boolean` but JSON-ish hand-typed data can
    // slip through with the string "true" or 1. The sort comparator relies on
    // identity inequality, which would misbehave on coerced values.
    for (const post of blogPosts) {
      expect(
        typeof post.featured === 'boolean',
        `post ${post.id} featured is ${typeof post.featured}, not boolean`,
      ).toBe(true);
    }
  });
});
