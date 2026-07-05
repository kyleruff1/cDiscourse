/**
 * RESEED-001 — the doctrine fence.
 *
 * Source-scans (Node fs, NOT shell rg — rg is unreliable in this Git Bash env)
 * across scripts/reseeder/** :
 *   - zero service-role / direct public.arguments insert.
 *   - the posting path uses invokeSubmitArgument / buildSubmitArgumentBody.
 *   - buildSubmitArgumentBody output passes isAllowedSubmitBody.
 *   - no committed source file (reseeder scripts + the design doc) contains a
 *     raw args.me / debate.org source URL literal (license leak-scan).
 */
const fs = require('node:fs');
const path = require('node:path');
const { buildSubmitArgumentBody, isAllowedSubmitBody } = require('../scripts/bot-fixtures/submitMove');

const RESEEDER_DIR = path.resolve(__dirname, '..', 'scripts', 'reseeder');

function reseederFiles(): string[] {
  return fs
    .readdirSync(RESEEDER_DIR)
    .filter((f: string) => f.endsWith('.js'))
    .map((f: string) => path.join(RESEEDER_DIR, f));
}

function readAll(files: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of files) out[path.basename(f)] = fs.readFileSync(f, 'utf8');
  return out;
}

describe('reseeder doctrine fence — source scan', () => {
  const files = reseederFiles();
  const contents = readAll(files);

  it('has the expected 11 reseeder script modules', () => {
    expect(files.length).toBe(11);
  });

  it('contains ZERO service-role / service-client references', () => {
    const banned = ['service_role', 'SERVICE_ROLE', 'serviceClient', 'createServiceClient', 'SUPABASE_SERVICE_ROLE_KEY'];
    for (const [name, src] of Object.entries(contents)) {
      for (const b of banned) {
        expect({ file: name, token: b, found: src.includes(b) }).toEqual({ file: name, token: b, found: false });
      }
    }
  });

  it('never directly inserts into server-authoritative tables (arguments, debates)', () => {
    // public.arguments -> submit-argument only; public.debates -> create-argument-room
    // only (ARG-ROOM-002 / #613 dropped the client debates INSERT policy). A
    // direct client insert into either is an RLS-blocked doctrine violation.
    // NOTE: the `debates')` closing token means `debate_participants` (which is a
    // legitimate public-room self-join) is NOT matched by these patterns.
    const bannedPatterns = [
      ".from('arguments').insert",
      'from("arguments").insert',
      ".from(`arguments`).insert",
      ".from('debates').insert",
      'from("debates").insert',
      ".from(`debates`).insert",
    ];
    for (const [name, src] of Object.entries(contents)) {
      for (const p of bannedPatterns) {
        expect({ file: name, pattern: p, found: src.includes(p) }).toEqual({ file: name, pattern: p, found: false });
      }
    }
  });

  it('STILL allows debate_participants inserts (public-room self-join is the intended client path)', () => {
    // The ban above must not become a blanket "no participant writes" rule. A
    // public-room participant self-join is legitimate (unlike debates / arguments,
    // which are server-authoritative). Assert the reseeder still performs one and
    // that the ban patterns do not accidentally forbid it.
    const runner = contents['runReseeder.js'];
    expect(runner).toBeDefined();
    expect(runner.includes(".from('debate_participants').insert")).toBe(true);
    // The debates ban tokens end in `debates')` — prove they cannot match the
    // participant table's `debate_participants')` token.
    expect(".from('debate_participants').insert".includes(".from('debates').insert")).toBe(false);
  });

  it('routes every argument write through invokeSubmitArgument / buildSubmitArgumentBody', () => {
    const runner = contents['runReseeder.js'];
    expect(runner).toBeDefined();
    expect(runner.includes('invokeSubmitArgument')).toBe(true);
    expect(runner.includes('buildSubmitArgumentBody')).toBe(true);
    // The orchestrator imports these from the submitMove fence.
    expect(runner.includes("require('../bot-fixtures/submitMove')")).toBe(true);
  });

  it('routes room creation through the create-argument-room Edge Function', () => {
    // RESEED-002 (#867): rooms are created server-side via create-argument-room,
    // not a direct client debates insert. The runner must name the function.
    const runner = contents['runReseeder.js'];
    expect(runner).toBeDefined();
    expect(runner.includes("'create-argument-room'")).toBe(true);
    expect(runner.includes('invokeCreateArgumentRoom')).toBe(true);
  });

  it("buildSubmitArgumentBody output passes isAllowedSubmitBody for a representative reseeder move", () => {
    const body = buildSubmitArgumentBody({
      debateId: 'd1',
      parentArgumentId: null,
      move: {
        moveId: 'm0',
        argumentType: 'thesis',
        body: 'On the question of school uniforms, uniforms reduce peer pressure and lower cost.',
        selectedTagCodes: [],
      },
      side: 'affirmative',
      clientSubmissionId: 'sub-1',
    });
    expect(isAllowedSubmitBody(body)).toBe(true);

    // A reply move with target + evidence must also pass the allowed-keys fence.
    const replyBody = buildSubmitArgumentBody({
      debateId: 'd1',
      parentArgumentId: 'p1',
      move: {
        moveId: 'm1',
        argumentType: 'evidence',
        targetExcerpt: 'school uniforms',
        body: 'Evidence for the claim, drawing on the attached reference material about school uniforms.',
        selectedTagCodes: [],
        evidence: { sourceText: 'Reference material on school uniforms (dev/test source stub).' },
      },
      side: 'affirmative',
      clientSubmissionId: 'sub-2',
    });
    expect(isAllowedSubmitBody(replyBody)).toBe(true);
  });

  it('no committed reseeder source file contains a raw SCRAPED-SOURCE content URL (license leak-scan)', () => {
    // The license leak this guards is a raw scraped-source *content* URL — a
    // specific debate.org / idebate.org debate page (the CC-BY attribution that
    // must live ONLY in the gitignored bank). The args.me API base
    // (api/v2/arguments) is infrastructure, and the redactor MUST reference the
    // source hosts in order to strip them — neither is a leak. So we match a
    // debate.org/idebate.org debate/content path specifically.
    const scrapedContentUrlRe =
      /https?:\/\/(?:www\.)?(?:debate\.org|idebate\.org)\/[a-z0-9][^\s"'<>)\]]*/i;
    for (const [name, src] of Object.entries(contents)) {
      expect({ file: name, hasScrapedSourceUrl: scrapedContentUrlRe.test(src) }).toEqual({
        file: name,
        hasScrapedSourceUrl: false,
      });
    }
  });

  it('the RESEED-001 design doc contains no raw SCRAPED-SOURCE content URL', () => {
    const designPath = path.resolve(__dirname, '..', 'docs', 'designs', 'RESEED-001-HARNESS.md');
    if (!fs.existsSync(designPath)) return; // design may live elsewhere; skip if absent
    const src = fs.readFileSync(designPath, 'utf8');
    // Same scope: a specific debate.org/idebate.org content page. The args.me
    // API base referenced in the design's edge-case notes is infrastructure.
    const scrapedContentUrlRe =
      /https?:\/\/(?:www\.)?(?:debate\.org|idebate\.org)\/[a-z0-9][^\s"'<>)\]]*/i;
    expect(scrapedContentUrlRe.test(src)).toBe(false);
  });
});
