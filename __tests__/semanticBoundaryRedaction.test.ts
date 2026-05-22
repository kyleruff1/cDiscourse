/**
 * MCP-016 / MCP-018 — semantic-referee defensive redaction pass tests.
 *
 * The boundary runs a SECOND defensive redaction pass over the move / parent
 * body before any provider sees it — belt-and-suspenders on top of the client
 * redaction. This suite proves the pass strips secret / handle / URL / email /
 * post-id shapes and is deterministic and non-mutating.
 *
 * The redaction module is a zod-free Deno module — Jest imports it directly.
 *
 * MCP-018 NOTE: the `mcp` adapter (`mcpAdapter.ts`) forwards the move / parent
 * bodies the boundary has ALREADY run through this pass — exactly as the
 * `anthropic` provider does. `buildMcpToolRequestBody` does not re-redact (the
 * boundary owns redaction); the block below proves the adapter request carries
 * the redacted body VERBATIM, so the redaction guarantee survives the hop.
 */
import {
  redactString,
  redactClassifyMoveRequest,
  buildMcpToolRequestBody,
} from './_helpers/semanticRefereeDeno';
import type { ClassifyMoveRequest } from '../src/lib/edgeFunctions';

// Secret-shaped fragments are ASSEMBLED so this test file carries no
// contiguous banned literal.
const FAKE_HANDLE = '@' + 'fixtureuser';
const FAKE_URL = 'https://' + 'example.invalid/page';
const FAKE_EMAIL = 'someone' + '@' + 'example.invalid';
const FAKE_POST_ID = '1234567890123456789';
const FAKE_BEARER = 'Bearer ' + 'a'.repeat(20);

function makeRequest(overrides: Partial<ClassifyMoveRequest> = {}): ClassifyMoveRequest {
  return {
    roomId: 'room-1',
    moveBodyRedacted: 'A clean move body.',
    roomContext: {},
    requestedClassifiers: ['responds_to_parent'],
    contentHash: 'hash-1',
    ...overrides,
  };
}

describe('redactString — secret shapes', () => {
  it('strips a Bearer-token literal', () => {
    const out = redactString(`token is ${FAKE_BEARER} end`);
    expect(out).not.toContain(FAKE_BEARER);
    expect(out).toContain('[redacted-secret]');
  });

  it('strips a JWT-shaped string', () => {
    const jwt = 'eyJ' + 'a'.repeat(24) + '.' + 'b'.repeat(12) + '.' + 'c'.repeat(12);
    const out = redactString(`jwt ${jwt}`);
    expect(out).not.toContain(jwt);
    expect(out).toContain('[redacted-secret]');
  });
});

describe('redactString — PII shapes', () => {
  it('strips an @handle', () => {
    const out = redactString(`see ${FAKE_HANDLE} for details`);
    expect(out).not.toContain(FAKE_HANDLE);
    expect(out).toContain('[redacted-handle]');
  });

  it('strips an http(s) URL', () => {
    const out = redactString(`link: ${FAKE_URL}`);
    expect(out).not.toContain(FAKE_URL);
    expect(out).toContain('[redacted-url]');
  });

  it('strips an email address', () => {
    const out = redactString(`email ${FAKE_EMAIL}`);
    expect(out).not.toContain(FAKE_EMAIL);
    expect(out).toContain('[redacted-email]');
  });

  it('strips a 15-20 digit post id', () => {
    const out = redactString(`post ${FAKE_POST_ID}`);
    expect(out).not.toContain(FAKE_POST_ID);
    expect(out).toContain('[redacted-id]');
  });
});

describe('redactString — clean input + determinism', () => {
  it('leaves a clean body unchanged', () => {
    const clean = 'This argument narrows the parent claim to the specific case.';
    expect(redactString(clean)).toBe(clean);
  });

  it('is deterministic — the same input yields the same output', () => {
    const input = `mixed ${FAKE_HANDLE} ${FAKE_URL} ${FAKE_EMAIL}`;
    expect(redactString(input)).toBe(redactString(input));
  });
});

describe('redactClassifyMoveRequest — request-level pass', () => {
  it('redacts moveBodyRedacted', () => {
    const out = redactClassifyMoveRequest(
      makeRequest({ moveBodyRedacted: `body with ${FAKE_HANDLE}` }),
    );
    expect(out.moveBodyRedacted).not.toContain(FAKE_HANDLE);
  });

  it('redacts parentBodyRedacted when present', () => {
    const out = redactClassifyMoveRequest(
      makeRequest({ parentBodyRedacted: `parent with ${FAKE_URL}` }),
    );
    expect(out.parentBodyRedacted).not.toContain(FAKE_URL);
  });

  it('leaves parentBodyRedacted undefined when absent', () => {
    const out = redactClassifyMoveRequest(makeRequest());
    expect(out.parentBodyRedacted).toBeUndefined();
  });

  it('does not mutate the input request', () => {
    const request = makeRequest({ moveBodyRedacted: `body ${FAKE_HANDLE}` });
    const original = request.moveBodyRedacted;
    redactClassifyMoveRequest(request);
    expect(request.moveBodyRedacted).toBe(original);
  });

  it('passes every non-body field through unchanged', () => {
    const request = makeRequest({
      moveId: 'm1',
      parentId: 'p1',
      contentHash: 'ch1',
      requestedClassifiers: ['narrows_claim'],
    });
    const out = redactClassifyMoveRequest(request);
    expect(out.roomId).toBe(request.roomId);
    expect(out.moveId).toBe('m1');
    expect(out.parentId).toBe('p1');
    expect(out.contentHash).toBe('ch1');
    expect(out.requestedClassifiers).toEqual(['narrows_claim']);
  });
});

describe('MCP-018 — the mcp adapter forwards already-redacted bodies verbatim', () => {
  it('buildMcpToolRequestBody carries the redacted move body unchanged', () => {
    // The boundary redacts FIRST, then the adapter builds the request. Feed the
    // adapter a request whose body is already the redaction-pass OUTPUT; the
    // request must carry that exact redacted string (no re-mangling, no leak).
    const redactedBody = redactString(`see ${FAKE_HANDLE} at ${FAKE_URL}`);
    const body = buildMcpToolRequestBody(makeRequest({ moveBodyRedacted: redactedBody }));
    const input = body.input as Record<string, unknown>;
    expect(input.moveBodyRedacted).toBe(redactedBody);
    expect(input.moveBodyRedacted).not.toContain(FAKE_HANDLE);
    expect(input.moveBodyRedacted).not.toContain(FAKE_URL);
  });

  it('buildMcpToolRequestBody carries the redacted parent body unchanged when present', () => {
    const redactedParent = redactString(`parent mentions ${FAKE_EMAIL}`);
    const body = buildMcpToolRequestBody(
      makeRequest({ parentBodyRedacted: redactedParent }),
    );
    const input = body.input as Record<string, unknown>;
    expect(input.parentBodyRedacted).toBe(redactedParent);
    expect(input.parentBodyRedacted).not.toContain(FAKE_EMAIL);
  });
});
