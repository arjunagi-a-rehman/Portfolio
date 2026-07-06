/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as agent_guards from "../agent/guards.js";
import type * as agent_mcp from "../agent/mcp.js";
import type * as agent_nodes from "../agent/nodes.js";
import type * as agent_pipeline from "../agent/pipeline.js";
import type * as agent_threads from "../agent/threads.js";
import type * as comments from "../comments.js";
import type * as contact from "../contact.js";
import type * as crons from "../crons.js";
import type * as emails from "../emails.js";
import type * as http from "../http.js";
import type * as likes from "../likes.js";
import type * as notifier from "../notifier.js";
import type * as subscribers from "../subscribers.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "agent/guards": typeof agent_guards;
  "agent/mcp": typeof agent_mcp;
  "agent/nodes": typeof agent_nodes;
  "agent/pipeline": typeof agent_pipeline;
  "agent/threads": typeof agent_threads;
  comments: typeof comments;
  contact: typeof contact;
  crons: typeof crons;
  emails: typeof emails;
  http: typeof http;
  likes: typeof likes;
  notifier: typeof notifier;
  subscribers: typeof subscribers;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
