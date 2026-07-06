import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { internal } from '../_generated/api';
import type { Doc } from '../_generated/dataModel';
import type { ActionCtx } from '../_generated/server';
import { SITE_ORIGIN } from './guards';
import {
  type Citation,
  createAnthropicClient,
  generateAnswerStream,
  isFiller,
  MAX_QUERY_LENGTH,
  NO_MATCH_ANSWER,
  pickColdFillerReaction,
  routeQuery,
} from './pipeline';
import { MAX_THREAD_TOKEN_LENGTH } from './threads';

// ---------------------------------------------------------------------------
// MCP server for external clients (Claude Desktop, Cursor, mcp-inspector).
//
// Runs in STATELESS Streamable HTTP mode — one server+transport pair per
// request, no session Map. Conversation continuity is application-level
// instead: ask_rehman accepts an optional `conversation_id` backed by the
// agentThreads table, which the VPS version never offered (its tool calls
// were isolated Q&A; the session Map was only transport plumbing).
// ---------------------------------------------------------------------------

export function createAgentMcpServer(ctx: ActionCtx): McpServer {
  const server = new McpServer({
    name: 'rehman-portfolio-agent',
    version: '2.0.0',
  });

  server.registerTool(
    'ask_rehman',
    {
      title: 'Ask Rehman',
      description:
        "Ask Arjunagi A. Rehman's AI persona a question about his projects, essays, technical thinking, or background. Returns a cited answer grounded in his actual writing. To hold a multi-turn conversation, pass back the conversation_id returned by the previous call — the server then remembers the prior turns.",
      inputSchema: {
        query: z
          .string()
          .min(1)
          .max(MAX_QUERY_LENGTH)
          .describe('The question to ask Rehman'),
        conversation_id: z
          .string()
          .max(MAX_THREAD_TOKEN_LENGTH)
          .optional()
          .describe(
            'Conversation token from a previous ask_rehman result. Include it to continue that conversation; omit it to start a new one.',
          ),
      },
    },
    async ({ query, conversation_id }) => {
      const startTime = Date.now();

      try {
        const { token, history } = await ctx.runMutation(
          internal.agent.threads.getOrCreate,
          { token: conversation_id, origin: 'mcp' },
        );
        const continueHint = `\n\n(conversation_id: ${token} — pass this back to continue the conversation)`;

        const client = createAnthropicClient();
        let answer: string;
        let citations: Citation[] = [];

        if (isFiller(query) && history.length === 0) {
          answer = pickColdFillerReaction(query);
        } else {
          let nodes: Doc<'agentNodes'>[] = [];
          if (!isFiller(query)) {
            const summaries = await ctx.runQuery(
              internal.agent.nodes.listSummaries,
              {},
            );
            const decision = await routeQuery(client, query, summaries);
            if (!decision.noMatch) {
              nodes = await ctx.runQuery(internal.agent.nodes.getByIds, {
                nodeIds: decision.nodeIds,
              });
            }
          }

          if (nodes.length === 0 && history.length === 0) {
            answer = NO_MATCH_ANSWER;
          } else {
            const result = await generateAnswerStream(
              client,
              query,
              nodes,
              history,
              startTime,
              () => {}, // non-streaming path — MCP tool results are one-shot
            );
            answer = result.answer;
            citations = result.citations;
          }
        }

        await ctx.runMutation(internal.agent.threads.appendExchange, {
          token,
          userContent: query,
          assistantContent: answer,
          citations: citations.length > 0 ? citations : undefined,
        });

        const citationList =
          citations.length > 0
            ? '\n\nSources:\n' +
              citations
                .map((c) => `- [${c.id}] ${c.title}: ${SITE_ORIGIN}${c.url}`)
                .join('\n')
            : '';

        return {
          content: [
            {
              type: 'text' as const,
              text: answer + citationList + continueHint,
            },
          ],
        };
      } catch (err) {
        console.error('[mcp/ask_rehman] Error:', err);
        return {
          content: [
            {
              type: 'text' as const,
              text: 'Agent pipeline error. Please try again.',
            },
          ],
          isError: true,
        };
      }
    },
  );

  server.registerTool(
    'list_nodes',
    {
      title: 'List Knowledge Nodes',
      description:
        "Returns the full list of knowledge nodes available in Rehman's knowledge base. Source categories: project (shipped artifacts), essay (long-form writing), about (bio/deny-list), experience (career arcs per company), thinking (short takes/values/reading). Useful for discovering what topics are covered before asking questions.",
      inputSchema: {
        source: z
          .enum(['project', 'essay', 'about', 'experience', 'thinking', 'all'])
          .default('all')
          .describe('Filter by source type'),
      },
    },
    async ({ source }) => {
      try {
        const nodes = await ctx.runQuery(internal.agent.nodes.list, {
          source: source ?? 'all',
        });
        const list = nodes
          .map((n) => `[${n.id}] ${n.title} (${n.source}) — ${n.summary}`)
          .join('\n');
        return {
          content: [{ type: 'text' as const, text: list || 'No nodes found.' }],
        };
      } catch (err) {
        console.error('[mcp/list_nodes] Error:', err);
        return {
          content: [{ type: 'text' as const, text: 'Failed to load nodes.' }],
          isError: true,
        };
      }
    },
  );

  return server;
}
