import Anthropic from '@anthropic-ai/sdk';
import { getNodeSummaries } from './nodes.js';
import { type RouterDecision, RouterDecisionSchema } from './types.js';

// ---------------------------------------------------------------------------
// Router — Haiku reads node summaries, picks the 2-3 most relevant node IDs
// ---------------------------------------------------------------------------

// Lazily-created singleton — can be overridden in tests via routeQuery options
let _defaultClient: Anthropic | null = null;
function getDefaultClient(): Anthropic {
  if (!_defaultClient) _defaultClient = new Anthropic();
  return _defaultClient;
}

const ROUTER_MODEL = 'claude-haiku-4-5';

const SYSTEM_PROMPT = `You are a routing agent for Arjunagi A. Rehman's personal knowledge base.
Your job is to look at a user's question and decide which knowledge nodes (if any) are relevant.

You will be given:
1. The user's question
2. A list of nodes with id, title, summary, and tags

Rules:
- Pick at most 3 node IDs that directly address the question
- For greetings, casual openers ("hi", "hello", "ok", "hey", "what can you do", "who are you"), always include the about node if available
- For general questions about the person, their work, or what they think, prefer the about node
- If no nodes are relevant AND it's not a greeting/casual message, set noMatch: true and nodeIds: []
- If the question is about something completely unrelated (weather, sports, cooking, etc.), set noMatch: true
- Prefer fewer, high-quality matches over many loose ones
- confidence: "high" = strong match, "medium" = tangential but useful, "low" = speculative

Respond ONLY with valid JSON matching this schema:
{
  "nodeIds": string[],
  "confidence": "high" | "medium" | "low",
  "noMatch": boolean,
  "reasoning": string
}`;

/** Escape layer: strip any content that looks like XML/HTML injection */
function sanitizeQuery(query: string): string {
  return query
    .replace(/<[^>]*>/g, '') // strip any HTML/XML tags
    .replace(/\n{3,}/g, '\n\n') // collapse excess newlines
    .trim()
    .slice(0, 500);
}

export interface RouteQueryOptions {
  nodesDir?: string;
  /** Override the Anthropic client — used in tests */
  client?: Anthropic;
}

export async function routeQuery(
  query: string,
  options: RouteQueryOptions | string = {},
): Promise<RouterDecision> {
  // Back-compat: accept bare nodesDir string (used internally)
  const opts: RouteQueryOptions =
    typeof options === 'string' ? { nodesDir: options } : options;
  const nodesDir = opts.nodesDir;
  const client = opts.client ?? getDefaultClient();
  const sanitized = sanitizeQuery(query);
  const summaries = await getNodeSummaries(nodesDir);

  if (summaries.length === 0) {
    return { nodeIds: [], confidence: 'low', noMatch: true };
  }

  const nodeList = summaries
    .map(
      (n) =>
        `id: ${n.id}\ntitle: ${n.title}\nsummary: ${n.summary}\ntags: ${n.tags.join(', ')}`,
    )
    .join('\n\n');

  const userMessage = `Question: ${sanitized}\n\nAvailable nodes:\n${nodeList}`;

  let raw: string;
  try {
    const response = await client.messages.create({
      model: ROUTER_MODEL,
      max_tokens: 256,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    });

    const block = response.content[0];
    if (!block || block.type !== 'text')
      throw new Error('Non-text block from router');
    raw = block.text;
  } catch (err) {
    console.error('[router] LLM call failed:', err);
    throw err;
  }

  // Parse and validate JSON
  let parsed: unknown;
  try {
    // Extract JSON from the response (model may wrap in markdown code fences)
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON object found in response');
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    console.error('[router] Failed to parse JSON response:', raw);
    return { nodeIds: [], confidence: 'low', noMatch: true };
  }

  const result = RouterDecisionSchema.safeParse(parsed);
  if (!result.success) {
    console.error('[router] Schema validation failed:', result.error.message);
    return { nodeIds: [], confidence: 'low', noMatch: true };
  }

  // Safety: only return node IDs that actually exist in the knowledge base
  const validIds = new Set(summaries.map((s) => s.id));
  const safeNodeIds = result.data.nodeIds.filter((id) => validIds.has(id));

  return { ...result.data, nodeIds: safeNodeIds };
}
