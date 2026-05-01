import { z } from 'zod';

// ---------------------------------------------------------------------------
// Node — a single unit of knowledge (project, essay, about entry)
// ---------------------------------------------------------------------------

/**
 * Source categories for a node.
 *
 *   project     — something shipped (Kalrav.AI, RouteEye, portfolio itself, …)
 *   essay       — long-form writing (coders-to-owners, cli-to-ai, …)
 *   about       — background / bio-adjacent content, plus deny-list
 *   experience  — career arcs scoped to a company / role (Irisidea, Jano Health)
 *   thinking    — short opinionated takes, reading lists, values — not tied to
 *                 a shipped artifact or a multi-hour essay
 *
 * Forkers: extend freely. The router LLM reads `source` as context, the
 * `list_nodes` MCP tool's filter keeps `source` parity with this enum.
 */
export const NODE_SOURCES = [
  'project',
  'essay',
  'about',
  'experience',
  'thinking',
] as const;

export type NodeSource = (typeof NODE_SOURCES)[number];

export const NodeFrontmatterSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  /** Category of content — see NODE_SOURCES */
  source: z.enum(NODE_SOURCES),
  /** URL path on the live site (e.g. /projects/kalrav) */
  url: z.string().min(1),
  /** ISO date string */
  date: z.string().optional(),
  /** Searchable tags for routing hints */
  tags: z.array(z.string()).default([]),
  /**
   * One-sentence summary fed to the router LLM.
   * Should be <120 chars and capture the core claim.
   */
  summary: z.string().min(1),
});

export type NodeFrontmatter = z.infer<typeof NodeFrontmatterSchema>;

/** A fully loaded node — frontmatter + full markdown body */
export interface KnowledgeNode {
  frontmatter: NodeFrontmatter;
  /** Raw markdown body (everything after the YAML fence) */
  body: string;
}

// ---------------------------------------------------------------------------
// Router — Haiku decides which nodes are relevant
// ---------------------------------------------------------------------------

export const RouterDecisionSchema = z.object({
  nodeIds: z.array(z.string()),
  confidence: z.enum(['high', 'medium', 'low']),
  /** true when the question is outside the knowledge base entirely */
  noMatch: z.boolean().default(false),
  reasoning: z.string().optional(),
});

export type RouterDecision = z.infer<typeof RouterDecisionSchema>;

// ---------------------------------------------------------------------------
// /ask endpoint — request and response
// ---------------------------------------------------------------------------

/** A single turn in an ongoing conversation */
export const ChatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(2000),
});

export type ChatMessage = z.infer<typeof ChatMessageSchema>;

export const AskRequestSchema = z.object({
  query: z
    .string()
    .max(500, 'Query must be under 500 characters')
    // Trim first, then validate non-empty — catches whitespace-only queries
    .transform((s) => s.trim())
    .refine((s) => s.length > 0, 'Query cannot be empty or whitespace'),
  /** Prior conversation turns (excluding the current query). Oldest first. */
  history: z.array(ChatMessageSchema).max(20).default([]),
});

export type AskRequest = z.infer<typeof AskRequestSchema>;

/** A single inline citation chip */
export interface Citation {
  id: string;
  title: string;
  url: string;
  source: NodeFrontmatter['source'];
}

export interface AskResponse {
  answer: string;
  citations: Citation[];
  /** If true, the answer is a handoff message (nothing matched) */
  noMatch: boolean;
  /** Milliseconds taken end-to-end */
  latencyMs: number;
}

// ---------------------------------------------------------------------------
// Health / Ready
// ---------------------------------------------------------------------------

export interface HealthResponse {
  status: 'ok';
  uptime: number;
}

export interface ReadyResponse {
  status: 'ready' | 'not_ready';
  nodesLoaded: number;
  llmReachable: boolean;
}
