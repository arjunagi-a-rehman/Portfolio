import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { blogPosts } from '../data/posts';

export function GET(context: APIContext) {
  return rss({
    title: 'Arjunagi A. Rehman — Blog',
    description:
      'Technical writing on building production AI agents, real-time systems, cloud-native backends, and distributed systems.',
    site: context.site ?? 'https://arjunagiarehman.com',
    items: [...blogPosts]
      .sort((a, b) => b.pubDate.localeCompare(a.pubDate))
      .map((post) => ({
        title: post.title,
        pubDate: new Date(post.pubDate),
        description: post.excerpt,
        link: `${post.slug}/`,
        categories: post.tags,
      })),
  });
}
