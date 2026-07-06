import { v } from 'convex/values';
import { internalQuery } from '../_generated/server';

// ---------------------------------------------------------------------------
// Knowledge-node reads. The table is populated by `npm run agent:sync`
// (markdown in mcp-server/nodes/ → `npx convex import --replace`), so these
// are read-only from the app's point of view.
// ---------------------------------------------------------------------------

// The knowledge base is small by design (one opinion per node); 500 is a
// generous ceiling that keeps the read bounded if it ever grows.
const MAX_NODES = 500;

/** Router input — id + title + summary + tags only, never the bodies. */
export const listSummaries = internalQuery({
  args: {},
  handler: async (ctx) => {
    const nodes = await ctx.db.query('agentNodes').take(MAX_NODES);
    return nodes.map((n) => ({
      id: n.nodeId,
      title: n.title,
      summary: n.summary,
      tags: n.tags,
    }));
  },
});

/** Full nodes for the responder, in the order the router returned them. */
export const getByIds = internalQuery({
  args: { nodeIds: v.array(v.string()) },
  handler: async (ctx, args) => {
    // Independent lookups on the /ask time-to-first-token critical path —
    // fetch concurrently, preserve router order.
    const nodes = await Promise.all(
      args.nodeIds.map((nodeId) =>
        ctx.db
          .query('agentNodes')
          .withIndex('by_node_id', (q) => q.eq('nodeId', nodeId))
          .unique(),
      ),
    );
    return nodes.filter((n) => n !== null);
  },
});

/** Directory listing for the MCP `list_nodes` tool. Bodies excluded. */
export const list = internalQuery({
  args: {
    source: v.union(
      v.literal('project'),
      v.literal('essay'),
      v.literal('about'),
      v.literal('experience'),
      v.literal('thinking'),
      v.literal('all'),
    ),
  },
  handler: async (ctx, args) => {
    const nodes = await ctx.db.query('agentNodes').take(MAX_NODES);
    const filtered =
      args.source === 'all'
        ? nodes
        : nodes.filter((n) => n.source === args.source);
    return filtered.map((n) => ({
      id: n.nodeId,
      title: n.title,
      source: n.source,
      summary: n.summary,
    }));
  },
});
