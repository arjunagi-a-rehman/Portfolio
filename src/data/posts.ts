export type BlogPost = {
  id: string;
  slug: string;          // e.g. "/cli-to-ai" — leading slash, no domain
  series: string;
  part?: number;
  title: string;
  excerpt: string;
  tags: string[];
  readTime: string;
  date: string;          // currently "2025"; ISO-ready for future posts
  featured: boolean;
};

// Source of truth for the blog catalog.
// Read by src/pages/blogs/index.astro (listing page), src/pages/blogs.json.ts
// (static endpoint consumed by the Convex notifier at announce time), and the
// sitemap-driven SEO surfaces.
export const blogPosts: BlogPost[] = [
  {
    id: 'cli-to-ai',
    slug: '/cli-to-ai',
    series: 'Deep Dive',
    title: 'From CLI to AI: The Evolution of How Humans Talk to Software',
    excerpt:
      'A deep narrative spanning punch cards, blinking terminals, GUI wars, the chatbot false start, and the LLM revolution — tracing how human-computer interaction evolved across eight paradigm shifts.',
    tags: ['HCI', 'CLI', 'AI Agents', 'LLMs', 'History'],
    readTime: '18 min',
    date: '2025',
    featured: true,
  },
  {
    id: 'coders-to-owners',
    slug: '/coders-to-owners',
    series: 'Deep Dive',
    title: 'From Coders to Owners: AI Writes Code. Engineers Own Outcomes.',
    excerpt:
      'Coding used to be the scarce skill. It is not anymore. An essay on how AI collapsed the engineering ladder, why ownership is the only thing left that matters, and what it means to be an engineer when the machine already writes the code.',
    tags: ['Engineering', 'AI', 'Ownership', 'Career', 'Craft'],
    readTime: '10 min',
    date: '2026',
    featured: false,
  },
  {
    id: 'ai-agent-1',
    slug: '/study-buddy',
    series: 'AI Agent System Series',
    part: 1,
    title: 'Your First AI Agent System: Study Buddy & The First Steps to Agent Creation',
    excerpt:
      'Learn the fundamentals of AI agents and build your first Study Buddy agent from scratch using Google ADK — covering setup, configuration, prompts, and running your agent.',
    tags: ['AI Agents', 'Python', 'Google ADK', 'Architecture'],
    readTime: '12 min',
    date: '2025',
    featured: false,
  },
  {
    id: 'ai-agent-2',
    slug: '/first-ai-agent',
    series: 'AI Agent System Series',
    part: 2,
    title: 'Your First AI Agent System: Tool Calls — Giving Your Agent Superpowers',
    excerpt:
      'Equip your AI agent with real-world capabilities through tool calling. Learn how function calling works under the hood and build custom tools for your Study Buddy.',
    tags: ['Tool Use', 'Function Calling', 'Python', 'API Integration'],
    readTime: '8 min',
    date: '2025',
    featured: false,
  },
  {
    id: 'ai-agent-3',
    slug: '/agent-deployment-1',
    series: 'AI Agent System Series',
    part: 3,
    title: 'Deploying Your StudyBuddy Agent: From Code to Production',
    excerpt:
      'Deploy your AI Study Buddy agent as a production REST API using FastAPI — covering API architecture, session management, chat interface, rate limiting, and Docker containerization.',
    tags: ['Deployment', 'FastAPI', 'Docker', 'Python'],
    readTime: '12 min',
    date: '2025',
    featured: false,
  },
];
