// @vitest-environment jsdom

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
/**
 * AgentChat unit tests
 *
 * Covers the key UI states and interactions:
 * - Idle state: headline, chips, submit disabled
 * - Chip click: pre-fills textarea
 * - Submit disabled when over char limit
 * - Loading: phases appear after form submit
 * - Done: answer and citations rendered
 * - No-match: fallback message shown
 * - Error: error message shown
 */
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import AgentChat from './AgentChat';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a mock SSE Response body from an ordered list of events.
 * Each event becomes `event: <name>\ndata: <json>\n\n` in the stream.
 */
function mkSSEResponse(
  events: Array<{ event: string; data: object }>,
): Response {
  const encoder = new TextEncoder();
  const payload = events
    .map((e) => `event: ${e.event}\ndata: ${JSON.stringify(e.data)}\n\n`)
    .join('');
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(payload));
      controller.close();
    },
  });
  return new Response(body, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  });
}

/** Convenience: a complete SSE stream for a successful answer */
function mkAnswerStream(
  answer: string,
  meta: {
    citations: Array<{
      id: string;
      title: string;
      url: string;
      source: string;
    }>;
    noMatch: boolean;
    latencyMs: number;
  },
): Response {
  return mkSSEResponse([
    { event: 'token', data: { text: answer } },
    { event: 'done', data: meta },
  ]);
}

function fillTextarea(value: string) {
  const textarea = screen.getByRole('textbox', { name: /ask a question/i });
  fireEvent.change(textarea, { target: { value } });
  return textarea as HTMLTextAreaElement;
}

const MOCK_SUCCESS = {
  answer:
    'Kalrav.AI is a vertical AI agent platform [kalrav-ai]. It powers e-commerce sites.',
  citations: [
    {
      id: 'kalrav-ai',
      title: 'Kalrav.AI',
      url: '/projects/kalrav',
      source: 'project',
    },
  ],
  noMatch: false,
  latencyMs: 420,
};

const MOCK_NO_MATCH = {
  answer: "I don't have information about that topic.",
  citations: [],
  noMatch: true,
  latencyMs: 130,
};

// ---------------------------------------------------------------------------
// Setup — jsdom doesn't implement scrollIntoView
// ---------------------------------------------------------------------------

beforeAll(() => {
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.localStorage.clear();
});

// ---------------------------------------------------------------------------
// Idle state
// ---------------------------------------------------------------------------

describe('AgentChat — idle state', () => {
  it('renders the headline', () => {
    render(<AgentChat />);
    expect(screen.getByText(/ask me anything/i)).toBeTruthy();
  });

  it('renders all five example chips', () => {
    render(<AgentChat />);
    expect(screen.getAllByText('What is Kalrav.AI?').length).toBeGreaterThan(0);
    expect(
      screen.getAllByText('Vertical vs horizontal AI agents?').length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText('Your coders-to-owners thesis').length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText('How to deploy an AI agent?').length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText('Your background and stack').length,
    ).toBeGreaterThan(0);
  });

  it('submit button is disabled when textarea is empty', () => {
    render(<AgentChat />);
    const btn = screen.getByRole('button', {
      name: /submit question/i,
    }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('submit button becomes enabled after typing', () => {
    render(<AgentChat />);
    fillTextarea('Hello');
    const btn = screen.getByRole('button', {
      name: /submit question/i,
    }) as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Chip interaction
// ---------------------------------------------------------------------------

describe('AgentChat — chip interaction', () => {
  it('clicking a chip fills the textarea', () => {
    render(<AgentChat />);
    const chip = screen.getAllByText('What is Kalrav.AI?')[0];
    fireEvent.click(chip!);
    const textarea = screen.getByRole('textbox', {
      name: /ask a question/i,
    }) as HTMLTextAreaElement;
    expect(textarea.value).toBe('What is Kalrav.AI?');
  });

  it('chips disappear after submitting (no longer idle)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mkAnswerStream(MOCK_SUCCESS.answer, {
        citations: MOCK_SUCCESS.citations,
        noMatch: MOCK_SUCCESS.noMatch,
        latencyMs: MOCK_SUCCESS.latencyMs,
      }),
    );

    render(<AgentChat />);
    const chip = screen.getAllByText('What is Kalrav.AI?')[0];
    fireEvent.click(chip!);
    fireEvent.click(screen.getByRole('button', { name: /submit question/i }));

    // Chips should be gone once a turn exists (thread is shown instead of chips)
    await waitFor(() => {
      expect(
        screen.queryAllByText('Vertical vs horizontal AI agents?').length,
      ).toBe(0);
    });
  });
});

// ---------------------------------------------------------------------------
// Character limit
// ---------------------------------------------------------------------------

describe('AgentChat — character limit', () => {
  it('shows character count in footer', () => {
    render(<AgentChat />);
    fillTextarea('hello');
    expect(screen.getByText(/5\/500/)).toBeTruthy();
  });

  it('submit is disabled and over-limit text shown when query > 500 chars', () => {
    render(<AgentChat />);
    fillTextarea('a'.repeat(501));
    const btn = screen.getByRole('button', {
      name: /submit question/i,
    }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(screen.getByText(/over limit/i)).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Loading state (thinking dots before first token)
// ---------------------------------------------------------------------------

describe('AgentChat — loading state', () => {
  it('shows thinking dots while awaiting the first token', () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      () => new Promise(() => {}),
    );

    const { container } = render(<AgentChat />);
    fillTextarea('Tell me about Kalrav');
    fireEvent.click(screen.getByRole('button', { name: /submit question/i }));

    // The thinking indicator appears inside the pending assistant turn
    expect(container.querySelector('.ac-thinking')).toBeTruthy();
  });

  it('shows the user turn in the thread before the response arrives', () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      () => new Promise(() => {}),
    );

    render(<AgentChat />);
    fillTextarea('Tell me about Kalrav');
    fireEvent.click(screen.getByRole('button', { name: /submit question/i }));

    // The user's question is echoed in the thread immediately
    expect(screen.getByText('Tell me about Kalrav')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Successful response
// ---------------------------------------------------------------------------

describe('AgentChat — successful response', () => {
  it('renders the answer text after fetch resolves', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mkAnswerStream(MOCK_SUCCESS.answer, {
        citations: MOCK_SUCCESS.citations,
        noMatch: MOCK_SUCCESS.noMatch,
        latencyMs: MOCK_SUCCESS.latencyMs,
      }),
    );

    render(<AgentChat />);
    fillTextarea('What is Kalrav.AI?');
    fireEvent.click(screen.getByRole('button', { name: /submit question/i }));

    await waitFor(() => {
      expect(screen.getByText(/vertical ai agent platform/i)).toBeTruthy();
    });
  });

  it('renders a citation chip for [kalrav-ai]', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mkAnswerStream(MOCK_SUCCESS.answer, {
        citations: MOCK_SUCCESS.citations,
        noMatch: MOCK_SUCCESS.noMatch,
        latencyMs: MOCK_SUCCESS.latencyMs,
      }),
    );

    render(<AgentChat />);
    fillTextarea('What is Kalrav.AI?');
    fireEvent.click(screen.getByRole('button', { name: /submit question/i }));

    await waitFor(() => {
      expect(
        screen.getByRole('link', { name: /source: kalrav.ai/i }),
      ).toBeTruthy();
    });
  });

  it('renders the sources list with project type badge', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mkAnswerStream(MOCK_SUCCESS.answer, {
        citations: MOCK_SUCCESS.citations,
        noMatch: MOCK_SUCCESS.noMatch,
        latencyMs: MOCK_SUCCESS.latencyMs,
      }),
    );

    render(<AgentChat />);
    fillTextarea('What is Kalrav.AI?');
    fireEvent.click(screen.getByRole('button', { name: /submit question/i }));

    await waitFor(() => {
      // There's a "project" badge in the sources list
      expect(screen.getAllByText('project').length).toBeGreaterThan(0);
    });
  });

  it('shows latency in the response header', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mkAnswerStream(MOCK_SUCCESS.answer, {
        citations: MOCK_SUCCESS.citations,
        noMatch: MOCK_SUCCESS.noMatch,
        latencyMs: MOCK_SUCCESS.latencyMs,
      }),
    );

    render(<AgentChat />);
    fillTextarea('What is Kalrav.AI?');
    fireEvent.click(screen.getByRole('button', { name: /submit question/i }));

    await waitFor(() => {
      // 420ms = 0.4s
      expect(screen.getAllByText(/0\.4s/).length).toBeGreaterThan(0);
    });
  });
});

// ---------------------------------------------------------------------------
// No-match state
// ---------------------------------------------------------------------------

describe('AgentChat — no-match state', () => {
  it('renders the no-match fallback message', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mkAnswerStream(MOCK_NO_MATCH.answer, {
        citations: MOCK_NO_MATCH.citations,
        noMatch: MOCK_NO_MATCH.noMatch,
        latencyMs: MOCK_NO_MATCH.latencyMs,
      }),
    );

    render(<AgentChat />);
    fillTextarea('What is the weather today?');
    fireEvent.click(screen.getByRole('button', { name: /submit question/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/i don't have information about that topic/i),
      ).toBeTruthy();
    });
  });

  it('renders a "Send a note" mailto link in no-match', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mkAnswerStream(MOCK_NO_MATCH.answer, {
        citations: MOCK_NO_MATCH.citations,
        noMatch: MOCK_NO_MATCH.noMatch,
        latencyMs: MOCK_NO_MATCH.latencyMs,
      }),
    );

    render(<AgentChat />);
    fillTextarea('What is the weather today?');
    fireEvent.click(screen.getByRole('button', { name: /submit question/i }));

    await waitFor(() => {
      const link = screen.getByRole('link', { name: /send a note instead/i });
      expect(link.tagName).toBe('A');
      expect(link.getAttribute('href')).toMatch(/^mailto:/);
      expect(link.hasAttribute('data-contact-trigger')).toBe(true);
    });
  });

  it('uses the configured contactEmail in the mailto href', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mkAnswerStream(MOCK_NO_MATCH.answer, {
        citations: MOCK_NO_MATCH.citations,
        noMatch: MOCK_NO_MATCH.noMatch,
        latencyMs: MOCK_NO_MATCH.latencyMs,
      }),
    );

    render(<AgentChat contactEmail="fork-owner@example.com" />);
    fillTextarea('hi');
    fireEvent.click(screen.getByRole('button', { name: /submit question/i }));

    await waitFor(() => {
      const link = screen.getByRole('link', { name: /send a note instead/i });
      expect(link.getAttribute('href')).toContain('fork-owner%40example.com');
    });
  });
});

// ---------------------------------------------------------------------------
// Error state
// ---------------------------------------------------------------------------

describe('AgentChat — error state', () => {
  it('shows an error message when fetch rejects', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(
      new Error('connection refused'),
    );

    render(<AgentChat />);
    fillTextarea('What is Kalrav.AI?');
    fireEvent.click(screen.getByRole('button', { name: /submit question/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy();
      expect(screen.getByText(/connection refused/i)).toBeTruthy();
    });
  });

  it('renders a "Drop a note directly" mailto link in error state', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('server crash'));

    render(<AgentChat />);
    fillTextarea('What is Kalrav.AI?');
    fireEvent.click(screen.getByRole('button', { name: /submit question/i }));

    await waitFor(() => {
      const link = screen.getByRole('link', { name: /drop a note directly/i });
      expect(link.tagName).toBe('A');
      expect(link.getAttribute('href')).toMatch(/^mailto:/);
      expect(link.hasAttribute('data-contact-trigger')).toBe(true);
    });
  });

  it('shows timeout message when AbortSignal fires', async () => {
    const abortErr = new Error('The operation was aborted');
    abortErr.name = 'AbortError';
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(abortErr);

    render(<AgentChat />);
    fillTextarea('What is Kalrav.AI?');
    fireEvent.click(screen.getByRole('button', { name: /submit question/i }));

    await waitFor(() => {
      expect(screen.getByText(/timed out/i)).toBeTruthy();
    });
  });

  it('renders the server error message when SSE emits an error event mid-stream', async () => {
    // This covers the SSE-parsing `event === 'error'` branch in submit():
    // status 200 + text/event-stream, but the server aborts the pipeline
    // after the user's turn was already echoed. The UI must swap the
    // pending assistant placeholder for the error UI.
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mkSSEResponse([
        {
          event: 'error',
          data: { message: 'Agent pipeline error. Please try again.' },
        },
      ]),
    );

    render(<AgentChat />);
    fillTextarea('What is Kalrav.AI?');
    fireEvent.click(screen.getByRole('button', { name: /submit question/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy();
      expect(screen.getByText(/agent pipeline error/i)).toBeTruthy();
      // The "drop a note" handoff link surfaces in the SSE-error path too
      expect(
        screen.getByRole('link', { name: /drop a note directly/i }),
      ).toBeTruthy();
    });
  });

  it('progressively assembles content across multiple SSE token events', async () => {
    // Guards the streaming-content reducer: each `token` event must append
    // to the pending assistant message, not replace it.
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mkSSEResponse([
        { event: 'token', data: { text: 'Kalrav.AI ' } },
        { event: 'token', data: { text: 'is a vertical ' } },
        { event: 'token', data: { text: 'agent platform.' } },
        {
          event: 'done',
          data: { citations: [], noMatch: false, latencyMs: 200 },
        },
      ]),
    );

    render(<AgentChat />);
    fillTextarea('What is Kalrav.AI?');
    fireEvent.click(screen.getByRole('button', { name: /submit question/i }));

    await waitFor(() => {
      // Final assembled answer contains all three chunks concatenated
      expect(
        screen.getByText(/Kalrav\.AI is a vertical agent platform\./),
      ).toBeTruthy();
    });
  });
});

// ---------------------------------------------------------------------------
// Footer info
// ---------------------------------------------------------------------------

describe('AgentChat — footer', () => {
  it('shows the MCP endpoint derived from mcpServerUrl', () => {
    render(<AgentChat mcpServerUrl="https://agent.example.convex.site" />);
    // Footer strips the protocol; subheadline keeps the full URL.
    const matches = screen.getAllByText(/agent\.example\.convex\.site\/mcp/);
    expect(matches.length).toBeGreaterThan(0);
  });

  it('always shows the "What to ask" section', () => {
    render(<AgentChat />);
    expect(screen.getByText(/coders to owners/i)).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Conversation reset
// ---------------------------------------------------------------------------

describe('AgentChat — Clear button', () => {
  it('does not throw when clicked after a completed turn', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mkAnswerStream(MOCK_SUCCESS.answer, {
        citations: MOCK_SUCCESS.citations,
        noMatch: MOCK_SUCCESS.noMatch,
        latencyMs: MOCK_SUCCESS.latencyMs,
      }),
    );

    render(<AgentChat />);
    fillTextarea('What is Kalrav.AI?');
    fireEvent.click(screen.getByRole('button', { name: /submit question/i }));

    // Wait for the response to land so the thread header (with Clear) is mounted
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /clear conversation/i }),
      ).toBeTruthy();
    });

    // Clicking Clear must not throw. Regression test for the phaseTimers
    // ref that was removed when streaming replaced fake phase timers.
    const clearBtn = screen.getByRole('button', {
      name: /clear conversation/i,
    });
    expect(() => fireEvent.click(clearBtn)).not.toThrow();

    // After reset, chips should be visible again (hasThread === false)
    await waitFor(() => {
      expect(screen.getAllByText('What is Kalrav.AI?').length).toBeGreaterThan(
        0,
      );
    });
  });
});

// ---------------------------------------------------------------------------
// Variant — hero (homepage embed)
// ---------------------------------------------------------------------------

describe('AgentChat — variant="hero"', () => {
  it('renders the terminal window title and LIVE indicator', () => {
    const { container } = render(<AgentChat variant="hero" />);
    expect(container.querySelector('.ac-hero-chrome')).toBeTruthy();
    expect(screen.getByText(/arjunagi\.sh — agent/i)).toBeTruthy();
    expect(screen.getByText(/^LIVE$/)).toBeTruthy();
  });

  it('hides the page-only header ("Ask me anything")', () => {
    render(<AgentChat variant="hero" />);
    // The page variant headline must not appear in hero mode
    expect(screen.queryByText(/ask me anything/i)).toBe(null);
  });

  it('hides the page-only MCP footer info', () => {
    const { container } = render(<AgentChat variant="hero" />);
    expect(container.querySelector('.ac-footer-info')).toBe(null);
  });

  it('renders the 4 hero default chips', () => {
    render(<AgentChat variant="hero" />);
    expect(screen.getByText('What did Arjunagi build at BIAL?')).toBeTruthy();
    expect(
      screen.getByText('What production AI systems has he shipped?'),
    ).toBeTruthy();
    expect(screen.getByText('Tell me about RouteEye.')).toBeTruthy();
    expect(
      screen.getByText('How does this portfolio agent work?'),
    ).toBeTruthy();
  });

  it('does NOT render the page chip set', () => {
    render(<AgentChat variant="hero" />);
    expect(screen.queryByText('What is Kalrav.AI?')).toBe(null);
  });

  it('shows the grounding note in the empty state and hides it once a thread starts', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mkAnswerStream('ok', { citations: [], noMatch: false, latencyMs: 100 }),
    );
    render(<AgentChat variant="hero" />);

    // Empty state: grounding note visible
    expect(screen.getByText(/grounded in my projects & writing/i)).toBeTruthy();

    // Start a thread: note disappears
    fillTextarea('hi');
    fireEvent.click(screen.getByRole('button', { name: /submit question/i }));
    await waitFor(() => {
      expect(screen.queryByText(/grounded in my projects & writing/i)).toBe(
        null,
      );
    });
  });

  it('applies the .ac-hero root class', () => {
    const { container } = render(<AgentChat variant="hero" />);
    expect(container.querySelector('.agent-chat.ac-hero')).toBeTruthy();
  });

  it('LIVE indicator activates after the 4-second delay', () => {
    vi.useFakeTimers();
    try {
      const { container } = render(<AgentChat variant="hero" />);
      // Initial render: dim (no --on modifier)
      expect(container.querySelector('.ac-hero-live--on')).toBe(null);
      // Fast-forward past the 4s delay
      act(() => {
        vi.advanceTimersByTime(4100);
      });
      expect(container.querySelector('.ac-hero-live--on')).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });
});

// ---------------------------------------------------------------------------
// Variant — inline (essay/project foot)
// ---------------------------------------------------------------------------

describe('AgentChat — variant="inline"', () => {
  it('renders the lead-in label when provided', () => {
    render(
      <AgentChat
        variant="inline"
        leadInLabel="Argue with this essay →"
        chips={['why mcp?']}
      />,
    );
    expect(screen.getByText(/argue with this essay/i)).toBeTruthy();
  });

  it('does not render terminal chrome', () => {
    const { container } = render(
      <AgentChat variant="inline" leadInLabel="Ask →" chips={[]} />,
    );
    expect(container.querySelector('.ac-hero-chrome')).toBe(null);
  });

  it('does not render the page header or footer', () => {
    const { container } = render(
      <AgentChat variant="inline" leadInLabel="Ask →" chips={[]} />,
    );
    expect(screen.queryByText(/ask me anything/i)).toBe(null);
    expect(container.querySelector('.ac-footer-info')).toBe(null);
  });

  it('applies the .ac-inline root class', () => {
    const { container } = render(
      <AgentChat variant="inline" leadInLabel="Ask →" chips={[]} />,
    );
    expect(container.querySelector('.agent-chat.ac-inline')).toBeTruthy();
  });

  it('chips={[]} renders zero chip buttons (opt-out)', () => {
    const { container } = render(
      <AgentChat variant="inline" leadInLabel="Ask →" chips={[]} />,
    );
    expect(container.querySelectorAll('.ac-chip').length).toBe(0);
  });

  it('custom chips render as buttons in the order given', () => {
    render(
      <AgentChat
        variant="inline"
        leadInLabel="Ask →"
        chips={['first?', 'second?', 'third?']}
      />,
    );
    expect(screen.getByText('first?')).toBeTruthy();
    expect(screen.getByText('second?')).toBeTruthy();
    expect(screen.getByText('third?')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Surface (analytics) propagation
// ---------------------------------------------------------------------------

describe('AgentChat — surface prop', () => {
  beforeEach(() => {
    (window as unknown as { gtag: ReturnType<typeof vi.fn> }).gtag = vi.fn();
  });

  afterEach(() => {
    delete (window as Partial<{ gtag: unknown }>).gtag;
  });

  it('passes explicit surface to trackQuestionAsked', async () => {
    const gtag = (window as unknown as { gtag: ReturnType<typeof vi.fn> }).gtag;
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mkAnswerStream('ok', {
        citations: [],
        noMatch: false,
        latencyMs: 100,
      }),
    );

    render(
      <AgentChat
        variant="inline"
        surface="essay-software-can-talk"
        leadInLabel="Ask →"
        chips={['x?']}
      />,
    );
    fillTextarea('hi');
    fireEvent.click(screen.getByRole('button', { name: /submit question/i }));

    await waitFor(() => {
      const call = gtag.mock.calls.find((c) => c[1] === 'agent_question_asked');
      expect(call).toBeDefined();
      expect(call?.[2]).toMatchObject({ surface: 'essay-software-can-talk' });
    });
  });

  it('hero variant defaults surface to "home-hero" when none passed', async () => {
    const gtag = (window as unknown as { gtag: ReturnType<typeof vi.fn> }).gtag;
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mkAnswerStream('ok', {
        citations: [],
        noMatch: false,
        latencyMs: 100,
      }),
    );

    render(<AgentChat variant="hero" />);
    fillTextarea('hi');
    fireEvent.click(screen.getByRole('button', { name: /submit question/i }));

    await waitFor(() => {
      const call = gtag.mock.calls.find((c) => c[1] === 'agent_question_asked');
      expect(call?.[2]).toMatchObject({ surface: 'home-hero' });
    });
  });

  it('page variant defaults surface to "agent-page"', async () => {
    const gtag = (window as unknown as { gtag: ReturnType<typeof vi.fn> }).gtag;
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mkAnswerStream('ok', {
        citations: [],
        noMatch: false,
        latencyMs: 100,
      }),
    );

    render(<AgentChat />);
    fillTextarea('hi');
    fireEvent.click(screen.getByRole('button', { name: /submit question/i }));

    await waitFor(() => {
      const call = gtag.mock.calls.find((c) => c[1] === 'agent_question_asked');
      expect(call?.[2]).toMatchObject({ surface: 'agent-page' });
    });
  });
});

// ---------------------------------------------------------------------------
// contextHint — page context injection (essay/project embeds)
// ---------------------------------------------------------------------------

describe('AgentChat — contextHint', () => {
  it('sends contextHint as its own request field (augmentation is server-side)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mkAnswerStream('ok', {
        citations: [],
        noMatch: false,
        latencyMs: 100,
      }),
    );

    render(
      <AgentChat
        variant="inline"
        leadInLabel="Argue →"
        chips={[]}
        surface="essay-software-can-talk"
        contextHint="the essay 'Software Can Talk'"
      />,
    );
    fillTextarea('summarize this');
    fireEvent.click(screen.getByRole('button', { name: /submit question/i }));

    await waitFor(() => {
      // The query stays the user's literal words; the page context travels
      // in `contextHint` and the server does the augmentation + storage.
      const [, init] = fetchSpy.mock.calls[0]!;
      const body = JSON.parse(init?.body as string);
      expect(body.query).toBe('summarize this');
      expect(body.contextHint).toBe("the essay 'Software Can Talk'");
    });
  });

  it('keeps the displayed user turn unaugmented (UI shows user words only)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mkAnswerStream('ok', {
        citations: [],
        noMatch: false,
        latencyMs: 100,
      }),
    );

    render(
      <AgentChat
        variant="inline"
        leadInLabel="Ask →"
        chips={[]}
        surface="project-kalrav"
        contextHint="the Kalrav.AI project"
      />,
    );
    fillTextarea('how does it route?');
    fireEvent.click(screen.getByRole('button', { name: /submit question/i }));

    await waitFor(() => {
      // Visible thread shows the user's literal words; the "About the
      // Kalrav.AI project:" prefix only appears in the network payload.
      expect(screen.getByText('how does it route?')).toBeTruthy();
      expect(screen.queryByText(/About the Kalrav\.AI project:/)).toBe(null);
    });
  });

  it('omits contextHint when not provided (page/hero variants)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mkAnswerStream('ok', {
        citations: [],
        noMatch: false,
        latencyMs: 100,
      }),
    );

    render(<AgentChat />);
    fillTextarea('hi');
    fireEvent.click(screen.getByRole('button', { name: /submit question/i }));

    await waitFor(() => {
      const [, init] = fetchSpy.mock.calls[0]!;
      const body = JSON.parse(init?.body as string);
      expect(body.query).toBe('hi');
      expect(body.contextHint).toBeUndefined();
    });
  });
});

// ---------------------------------------------------------------------------
// Server-held threads — token persistence + conversation restore
// ---------------------------------------------------------------------------

describe('AgentChat — thread persistence', () => {
  it('stores the threadId from `done` and replays it on the follow-up', async () => {
    // Each call gets a FRESH SSE Response — a one-shot ReadableStream can't be
    // replayed, so mockResolvedValue (same object twice) would drive the
    // second submit into the error path.
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(
        mkSSEResponse([
          { event: 'token', data: { text: 'answer one' } },
          {
            event: 'done',
            data: {
              citations: [],
              noMatch: false,
              latencyMs: 100,
              threadId: 'tok-abc',
            },
          },
        ]),
      ),
    );

    render(<AgentChat />);
    fillTextarea('first question');
    fireEvent.click(screen.getByRole('button', { name: /submit question/i }));

    await waitFor(() => {
      expect(screen.getByText(/answer one/)).toBeTruthy();
    });
    // Token persisted for this surface
    expect(window.localStorage.getItem('ac-thread:agent-page')).toBe('tok-abc');

    // First request carries no threadId (fresh conversation)
    const firstBody = JSON.parse(fetchSpy.mock.calls[0]![1]?.body as string);
    expect(firstBody.threadId).toBeUndefined();

    // Follow-up carries the token so the server loads the history
    fillTextarea('follow-up');
    fireEvent.click(screen.getByRole('button', { name: /submit question/i }));
    await waitFor(() => {
      const secondBody = JSON.parse(fetchSpy.mock.calls[1]![1]?.body as string);
      expect(secondBody.threadId).toBe('tok-abc');
    });
  });

  it('restores a stored conversation transcript on mount', async () => {
    window.localStorage.setItem('ac-thread:agent-page', 'tok-restored');
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          messages: [
            { role: 'user', content: 'earlier question', citations: [] },
            {
              role: 'assistant',
              content: 'earlier answer',
              citations: [],
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    render(<AgentChat />);

    await waitFor(() => {
      expect(screen.getByText('earlier question')).toBeTruthy();
      expect(screen.getByText('earlier answer')).toBeTruthy();
    });
    const url = String(fetchSpy.mock.calls[0]![0]);
    expect(url).toContain('/agent/thread?token=tok-restored');
  });

  it('forgets the stored token when the server no longer knows the thread', async () => {
    window.localStorage.setItem('ac-thread:agent-page', 'tok-purged');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'Unknown thread' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    render(<AgentChat />);

    await waitFor(() => {
      expect(window.localStorage.getItem('ac-thread:agent-page')).toBe(null);
    });
  });

  it('keeps the stored token when the restore request fails on the network', async () => {
    window.localStorage.setItem('ac-thread:agent-page', 'tok-flaky-net');
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(
      new Error('connection refused'),
    );

    render(<AgentChat />);

    // A transient network error must not forget the conversation — only a
    // definitive 404 does that.
    await waitFor(() => {
      expect(window.localStorage.getItem('ac-thread:agent-page')).toBe(
        'tok-flaky-net',
      );
    });
    expect(
      screen.getByRole('textbox', { name: /ask a question/i }),
    ).toBeTruthy();
  });

  it('degrades to per-load threads when localStorage is unavailable', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError: storage disabled');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('SecurityError: storage disabled');
    });
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(
        mkSSEResponse([
          { event: 'token', data: { text: 'still works' } },
          {
            event: 'done',
            data: {
              citations: [],
              noMatch: false,
              latencyMs: 40,
              threadId: 'tok-private-mode',
            },
          },
        ]),
      ),
    );

    // Private mode / storage-disabled must not crash mount or the done path.
    render(<AgentChat />);
    fillTextarea('does this still work?');
    fireEvent.click(screen.getByRole('button', { name: /submit question/i }));

    await waitFor(() => {
      expect(screen.getByText(/still works/)).toBeTruthy();
    });
  });

  it('drops the stored token when Clear is clicked', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mkSSEResponse([
        { event: 'token', data: { text: 'hello' } },
        {
          event: 'done',
          data: {
            citations: [],
            noMatch: false,
            latencyMs: 50,
            threadId: 'tok-clear-me',
          },
        },
      ]),
    );

    render(<AgentChat />);
    fillTextarea('hi there friend');
    fireEvent.click(screen.getByRole('button', { name: /submit question/i }));

    await waitFor(() => {
      expect(window.localStorage.getItem('ac-thread:agent-page')).toBe(
        'tok-clear-me',
      );
    });

    fireEvent.click(
      screen.getByRole('button', { name: /clear conversation/i }),
    );
    expect(window.localStorage.getItem('ac-thread:agent-page')).toBe(null);
  });
});

describe('AgentChat — selected page context', () => {
  const selectionContext = {
    selectedText: 'monolith',
    surroundingText: 'A monolith keeps the application in one deployable unit.',
    nearestHeading: 'Architecture',
    pageTitle: 'Example project',
    pathname: '/projects/example',
  };

  it('attaches selected text to the next question and renders it as a quote', async () => {
    const onSelectionConsumed = vi.fn();
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mkAnswerStream('It means one deployable application.', {
        citations: [],
        noMatch: false,
        latencyMs: 80,
      }),
    );

    render(
      <AgentChat
        variant="inline"
        surface="selection-drawer:/projects/example"
        selectionContext={selectionContext}
        onSelectionConsumed={onSelectionConsumed}
      />,
    );
    expect(screen.getByText('“monolith”')).toBeTruthy();

    fillTextarea('What does this mean here?');
    fireEvent.click(screen.getByRole('button', { name: /submit question/i }));

    await waitFor(() => expect(onSelectionConsumed).toHaveBeenCalledOnce());
    const askRequest = fetchSpy.mock.calls.find(([url]) =>
      String(url).endsWith('/ask'),
    );
    expect(askRequest).toBeTruthy();
    const body = JSON.parse(String((askRequest?.[1] as RequestInit).body));
    expect(body.selectionContext).toEqual(selectionContext);
  });

  it('lets the reader remove attached selection context', () => {
    const onSelectionConsumed = vi.fn();
    render(
      <AgentChat
        variant="inline"
        selectionContext={selectionContext}
        onSelectionConsumed={onSelectionConsumed}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: /remove selected text from this question/i,
      }),
    );
    expect(onSelectionConsumed).toHaveBeenCalledOnce();
  });
});
