import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import * as notifier from './notifier';

// Security-critical contract tests for the newsletter fanout.
//
// Background: `announce` used to be a public `action()` in this file, which
// meant anyone who scraped PUBLIC_CONVEX_URL from the frontend bundle could
// POST to the Convex HTTP endpoint and trigger a mass email fanout with an
// attacker-controlled customMessage. The idempotency row in `notifiedPosts`
// only blocks REPEAT fanouts per slug — it does NOT gate the first trigger.
//
// Fix: demoted to `internalAction()`. internal functions are invokable only
// from other Convex functions or via `npx convex run` (deployer credentials),
// never from anonymous public traffic. The tests below lock that in place.

const SOURCE_PATH = path.join(__dirname, 'notifier.ts');
const source = readFileSync(SOURCE_PATH, 'utf8');

describe('convex/notifier security contract', () => {
  it('registers announce as internalAction, never as a public action', () => {
    // Catches the regression where someone reverts `internalAction` back to
    // `action`, re-exposing the admin fanout capability to the public API.
    expect(source).not.toMatch(/export\s+const\s+announce\s*=\s*action\s*\(/);
    expect(source).toMatch(
      /export\s+const\s+announce\s*=\s*internalAction\s*\(/,
    );
  });

  it('does not import the public action wrapper at all', () => {
    // Stronger guard: even importing `action` from _generated/server is a
    // smell here. If every function in this file is internal, there is no
    // legitimate reason to pull the public wrapper into scope.
    expect(source).not.toMatch(
      /import\s*\{[^}]*\baction\b[^}]*\}\s*from\s*['"]\.\/_generated\/server['"]/,
    );
  });

  it('still exports announce for npx convex run', () => {
    // Sanity: the author's deployment workflow
    //   npx convex run notifier:announce '{"slug":"/your-new-slug"}'
    // still needs this symbol to exist on the module. npx convex run has
    // deployer credentials and can invoke internal functions directly.
    expect(notifier.announce).toBeDefined();
  });
});
