import { cronJobs } from 'convex/server';
import { internal } from './_generated/api';

const crons = cronJobs();

// Visitor privacy + bounded tables: agent conversations idle for 30+ days
// are deleted (thread + messages), along with stale rate-limit buckets.
crons.interval(
  'purge idle agent threads',
  { hours: 24 },
  internal.agent.threads.purgeIdle,
  {},
);

export default crons;
