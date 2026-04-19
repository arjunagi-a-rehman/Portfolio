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
});
