/**
 * QOL-036 — Payment / screenshot evidence metadata object.
 *
 * Pure-model tests for the additive `payment` sub-object on the EV-001
 * EvidenceArtifact, the new `payment_screenshot` kind, the redaction
 * contract, the adapter extension, the display helpers, and the doctrine
 * guards. No React, no Supabase, no network.
 *
 * Kept separate from `evidenceModel.test.ts` so the QOL-036 surface is
 * coherent and EV-001's test file is not churned (per design §7.5).
 */

import * as fs from 'fs';
import * as path from 'path';

import {
  ALL_EVIDENCE_ARTIFACT_KINDS,
  ALL_EVIDENCE_CONFIDENCES,
  PINNED_PAYMENT_CONFIDENCE,
  buildEvidenceArtifacts,
  classifyEvidenceKind,
  detectRawAccountData,
  findRawAccountDataFields,
  getPaymentEvidenceLabel,
  getTimelineEvidenceContract,
  redactPaymentParty,
  summarizeArtifactsForReceiptChip,
  summarizePaymentEvidence,
} from '../src/features/evidence';
import type {
  ClaimedApplicability,
  EvidenceAmount,
  EvidenceArtifact,
  EvidenceAttachmentInput,
  EvidenceConfidence,
  PaymentEvidenceMetadata,
  PaymentParty,
} from '../src/features/evidence';
import { _forbiddenPaymentTokens } from '../src/features/evidence/evidenceModel';

// ── Fixtures ───────────────────────────────────────────────────

const ARG_ID = 'arg-qol036-1';
const USER_ID = 'user-qol036-1';
const CREATED_AT = '2026-05-21T09:00:00.000Z';

/** A clean, full payment object — no raw account data anywhere. */
function fullPaymentFixture(): PaymentEvidenceMetadata {
  return {
    confidence: 'user_asserted',
    platform: 'a payment app',
    paidAt: '2026-03-03',
    amount: { value: 120, currency: '$' },
    payer: { displayToken: 'me', roleLabel: 'payer' },
    payee: { displayToken: 'the landlord', roleLabel: 'payee' },
    noteText: 'practice space',
    claimedApplicability: {
      statement: 'March practice-room rent',
      periodLabel: 'March 2026',
    },
    hasScreenshotImage: true,
    redactionConfirmed: true,
  };
}

/** The minimum legal payment object — only the pinned confidence. */
function emptyPaymentFixture(): PaymentEvidenceMetadata {
  return { confidence: 'user_asserted' };
}

function buildOne(att: EvidenceAttachmentInput): EvidenceArtifact[] {
  return buildEvidenceArtifacts({
    argumentId: ARG_ID,
    addedByUserId: USER_ID,
    createdAt: CREATED_AT,
    attachments: [att],
  });
}

// ══════════════════════════════════════════════════════════════
// Type / enum coverage
// ══════════════════════════════════════════════════════════════

describe('QOL-036 — type and enum coverage', () => {
  test('EvidenceArtifactKind contains exactly seven values including payment_screenshot', () => {
    expect(ALL_EVIDENCE_ARTIFACT_KINDS).toHaveLength(7);
    expect(ALL_EVIDENCE_ARTIFACT_KINDS).toContain('payment_screenshot');
    expect(Object.isFrozen(ALL_EVIDENCE_ARTIFACT_KINDS)).toBe(true);
  });

  test('EvidenceConfidence has exactly one value, user_asserted', () => {
    expect(ALL_EVIDENCE_CONFIDENCES).toEqual(['user_asserted']);
    expect(Object.isFrozen(ALL_EVIDENCE_CONFIDENCES)).toBe(true);
  });

  test('PINNED_PAYMENT_CONFIDENCE is user_asserted', () => {
    expect(PINNED_PAYMENT_CONFIDENCE).toBe('user_asserted');
    const c: EvidenceConfidence = PINNED_PAYMENT_CONFIDENCE;
    expect(c).toBe('user_asserted');
  });

  test('a PaymentEvidenceMetadata literal type-checks with only confidence set', () => {
    const minimal: PaymentEvidenceMetadata = { confidence: 'user_asserted' };
    expect(minimal.confidence).toBe('user_asserted');
    expect(minimal.amount).toBeUndefined();
    expect(minimal.payer).toBeUndefined();
    expect(minimal.claimedApplicability).toBeUndefined();
  });

  test('the supporting sub-shapes type-check independently', () => {
    const amount: EvidenceAmount = { value: 10, currency: 'USD' };
    const party: PaymentParty = { displayToken: 'me' };
    const applicability: ClaimedApplicability = { statement: 'April rent' };
    expect(amount.value).toBe(10);
    expect(party.displayToken).toBe('me');
    expect(applicability.statement).toBe('April rent');
  });

  test('an EvidenceArtifact WITH a payment field type-checks (additive)', () => {
    const withPayment: EvidenceArtifact = {
      id: 'x',
      argumentId: ARG_ID,
      kind: 'payment_screenshot',
      label: 'Payment record',
      sourceChainStatus: 'unverified',
      risk: 'unknown',
      addedByUserId: USER_ID,
      createdAt: CREATED_AT,
      payment: emptyPaymentFixture(),
    };
    expect(withPayment.payment?.confidence).toBe('user_asserted');
  });

  test('an EvidenceArtifact WITHOUT a payment field still type-checks (no-break)', () => {
    const noPayment: EvidenceArtifact = {
      id: 'y',
      argumentId: ARG_ID,
      kind: 'url',
      label: 'example.com',
      url: 'https://example.com',
      sourceChainStatus: 'source_no_quote',
      risk: 'unknown',
      addedByUserId: USER_ID,
      createdAt: CREATED_AT,
    };
    expect(noPayment.payment).toBeUndefined();
  });
});

// ══════════════════════════════════════════════════════════════
// classifyEvidenceKind
// ══════════════════════════════════════════════════════════════

describe('QOL-036 — classifyEvidenceKind payment branch', () => {
  test('a payment sub-object with no explicit kind classifies as payment_screenshot', () => {
    expect(classifyEvidenceKind({ payment: emptyPaymentFixture() })).toBe(
      'payment_screenshot',
    );
  });

  test('an explicit kind still wins over the payment branch', () => {
    expect(
      classifyEvidenceKind({ payment: emptyPaymentFixture(), kind: 'url' }),
    ).toBe('url');
  });

  test('a payment object alongside a url (no explicit kind) classifies as payment_screenshot', () => {
    expect(
      classifyEvidenceKind({
        payment: emptyPaymentFixture(),
        url: 'https://example.com',
      }),
    ).toBe('payment_screenshot');
  });

  test('a non-payment attachment classifies unchanged (regression guard)', () => {
    expect(classifyEvidenceKind({ url: 'https://example.com' })).toBe('url');
    expect(classifyEvidenceKind({ sourceText: 'an excerpt' })).toBe('source_text');
    expect(classifyEvidenceKind({ quote: 'a quote' })).toBe('source_text');
    expect(classifyEvidenceKind({})).toBe('manual_citation');
  });
});

// ══════════════════════════════════════════════════════════════
// buildEvidenceArtifacts — payment path
// ══════════════════════════════════════════════════════════════

describe('QOL-036 — buildEvidenceArtifacts payment path', () => {
  test('a payment-only attachment (no url/quote/sourceText) is NOT dropped', () => {
    const out = buildOne({ payment: fullPaymentFixture() });
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe('payment_screenshot');
    expect(out[0].payment).toBeDefined();
    expect(out[0].payment?.amount?.value).toBe(120);
  });

  test('an empty-but-confidence payment attachment is still emitted', () => {
    const out = buildOne({ payment: emptyPaymentFixture() });
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe('payment_screenshot');
    expect(out[0].payment).toEqual({ confidence: 'user_asserted' });
  });

  test('emitted payment.confidence is pinned to user_asserted even if input differs', () => {
    // The input cannot smuggle a different confidence — cast through unknown.
    const smuggled = {
      confidence: 'admin_confirmed',
    } as unknown as PaymentEvidenceMetadata;
    const out = buildOne({ payment: smuggled });
    expect(out[0].payment?.confidence).toBe('user_asserted');
  });

  test('sourceChainStatus of a payment-only artifact is unverified (no auto-promotion)', () => {
    const out = buildOne({ payment: fullPaymentFixture() });
    expect(out[0].sourceChainStatus).toBe('unverified');
  });

  test('a payment object never promotes the chain — even a full payment stays unverified', () => {
    const out = buildOne({ payment: fullPaymentFixture() });
    expect(out[0].sourceChainStatus).not.toBe('source_and_quote');
    expect(out[0].sourceChainStatus).not.toBe('primary_present');
  });

  test('a payment artifact alongside a url+quote artifact: two artifacts, independent statuses', () => {
    const out = buildEvidenceArtifacts({
      argumentId: ARG_ID,
      addedByUserId: USER_ID,
      createdAt: CREATED_AT,
      attachments: [
        { payment: fullPaymentFixture() },
        { url: 'https://example.com', quote: 'a verbatim quote' },
      ],
    });
    expect(out).toHaveLength(2);
    expect(out[0].id).toBe(`${ARG_ID}:evidence:0`);
    expect(out[1].id).toBe(`${ARG_ID}:evidence:1`);
    expect(out[0].kind).toBe('payment_screenshot');
    expect(out[0].sourceChainStatus).toBe('unverified');
    expect(out[1].kind).toBe('url');
    expect(out[1].sourceChainStatus).toBe('source_and_quote');
  });

  test('a payment attachment that ALSO carries url+quote runs the EV-001 chain table over the url/quote', () => {
    // Kind is payment_screenshot (payment present, no explicit kind), but the
    // source-chain status reflects the url+quote, not the payment.
    const out = buildOne({
      payment: fullPaymentFixture(),
      url: 'https://example.com',
      quote: 'a verbatim quote',
    });
    expect(out[0].kind).toBe('payment_screenshot');
    expect(out[0].sourceChainStatus).toBe('source_and_quote');
    expect(out[0].url).toBe('https://example.com');
    expect(out[0].quote).toBe('a verbatim quote');
    expect(out[0].payment).toBeDefined();
  });

  test('determinism — same input twice yields deeply-equal output', () => {
    const a = buildOne({ payment: fullPaymentFixture() });
    const b = buildOne({ payment: fullPaymentFixture() });
    expect(a).toEqual(b);
  });

  test('risk stays unknown for a payment artifact (EV-001 default)', () => {
    const out = buildOne({ payment: fullPaymentFixture() });
    expect(out[0].risk).toBe('unknown');
  });

  test('regression — EV-001 url-only / empty / all-blank cases still behave', () => {
    expect(buildOne({ url: 'https://example.com' })).toHaveLength(1);
    expect(buildOne({})).toHaveLength(0);
    expect(buildOne({ url: '   ', sourceText: null, quote: undefined })).toHaveLength(0);
  });

  test('whitespace-only fields with a payment object still emit the artifact', () => {
    const out = buildOne({
      url: '   ',
      sourceText: null,
      quote: undefined,
      payment: emptyPaymentFixture(),
    });
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe('payment_screenshot');
  });
});

// ══════════════════════════════════════════════════════════════
// Redaction guard — the doctrine core
// ══════════════════════════════════════════════════════════════

describe('QOL-036 — detectRawAccountData', () => {
  test('a 16-digit card number with spaces → true', () => {
    expect(detectRawAccountData('4111 1111 1111 1111')).toBe(true);
  });

  test('a 16-digit card number with hyphens → true', () => {
    expect(detectRawAccountData('4111-1111-1111-1111')).toBe(true);
  });

  test('a bare 16-digit run → true', () => {
    expect(detectRawAccountData('4111111111111111')).toBe(true);
  });

  test('a 12-digit run → true (lower bound of the card/account band)', () => {
    expect(detectRawAccountData('123456789012')).toBe(true);
  });

  test('an already-masked tail "•••• 4821" → false', () => {
    expect(detectRawAccountData('•••• 4821')).toBe(false);
  });

  test('a role-only string "the landlord" → false', () => {
    expect(detectRawAccountData('the landlord')).toBe(false);
  });

  test('an IBAN-shaped token → true', () => {
    expect(detectRawAccountData('GB29 NWBK 6016 1331 9268 19')).toBe(true);
  });

  test('a 9-digit run adjacent to a bank keyword → true (routing shape)', () => {
    expect(detectRawAccountData('routing 021000021')).toBe(true);
  });

  test('a 9-digit run with NO bank keyword → false', () => {
    expect(detectRawAccountData('order 021000021')).toBe(false);
  });

  test('an ISO date "2026-03-03" → false (not an account shape)', () => {
    expect(detectRawAccountData('2026-03-03')).toBe(false);
  });

  test('a short amount like "$120" → false', () => {
    expect(detectRawAccountData('$120')).toBe(false);
  });

  test('empty / whitespace / non-string → false', () => {
    expect(detectRawAccountData('')).toBe(false);
    expect(detectRawAccountData('   ')).toBe(false);
    expect(detectRawAccountData(undefined as unknown as string)).toBe(false);
  });
});

describe('QOL-036 — findRawAccountDataFields', () => {
  test('a clean payment object → empty list', () => {
    expect(findRawAccountDataFields(fullPaymentFixture())).toEqual([]);
  });

  test('a raw card number in noteText → flags noteText', () => {
    const p: PaymentEvidenceMetadata = {
      confidence: 'user_asserted',
      noteText: 'paid with 4111 1111 1111 1111',
    };
    expect(findRawAccountDataFields(p)).toEqual(['noteText']);
  });

  test('a raw account number in payer.displayToken → flags payer.displayToken', () => {
    const p: PaymentEvidenceMetadata = {
      confidence: 'user_asserted',
      payer: { displayToken: '4111111111111111' },
    };
    expect(findRawAccountDataFields(p)).toEqual(['payer.displayToken']);
  });

  test('account data in multiple fields → flags every offending field path', () => {
    const p: PaymentEvidenceMetadata = {
      confidence: 'user_asserted',
      platform: 'app 4111111111111111',
      noteText: 'memo 5555444433332222',
      payee: { displayToken: '6011000000000000', roleLabel: 'the bank' },
      claimedApplicability: { statement: 'covers 9999888877776666' },
    };
    const flagged = findRawAccountDataFields(p);
    expect(flagged).toContain('platform');
    expect(flagged).toContain('noteText');
    expect(flagged).toContain('payee.displayToken');
    expect(flagged).toContain('claimedApplicability.statement');
  });

  test('the result list is frozen', () => {
    expect(Object.isFrozen(findRawAccountDataFields(fullPaymentFixture()))).toBe(true);
  });

  test('a non-object input → empty list, no throw', () => {
    expect(findRawAccountDataFields(null as unknown as PaymentEvidenceMetadata)).toEqual(
      [],
    );
  });
});

describe('QOL-036 — adapter redaction degradation', () => {
  test('a raw card number in noteText → artifact emitted, payment stripped, kind downgraded', () => {
    const out = buildOne({
      payment: {
        confidence: 'user_asserted',
        noteText: 'paid with 4111 1111 1111 1111',
      },
    });
    expect(out).toHaveLength(1);
    expect(out[0].payment).toBeUndefined();
    expect(out[0].kind).toBe('screenshot_redacted');
  });

  test('after degradation no 12+ digit run survives anywhere in the artifact', () => {
    const out = buildOne({
      payment: {
        confidence: 'user_asserted',
        noteText: 'memo 4111 1111 1111 1111',
        payer: { displayToken: '5555444433332222' },
      },
    });
    const serialised = JSON.stringify(out[0]);
    // No run of 12+ digits (allowing spaces / hyphens between groups).
    expect(serialised).not.toMatch(/\d(?:[\s-]?\d){11,}/);
  });

  test('degradation is deterministic — same dirty input twice → deeply-equal output', () => {
    const dirty: EvidenceAttachmentInput = {
      payment: { confidence: 'user_asserted', noteText: 'x 4111111111111111' },
    };
    expect(buildOne(dirty)).toEqual(buildOne(dirty));
  });

  test('an explicit non-payment kind is NOT downgraded by a dirty payment object', () => {
    // Explicit kind 'url' wins classification; the dirty payment object is
    // still stripped, but the kind the caller chose is left intact.
    const out = buildOne({
      kind: 'url',
      url: 'https://example.com',
      payment: { confidence: 'user_asserted', noteText: 'x 4111111111111111' },
    });
    expect(out[0].kind).toBe('url');
    expect(out[0].payment).toBeUndefined();
  });

  test('a payment with a raw card number in payer survives as a degraded artifact', () => {
    const out = buildOne({
      payment: {
        confidence: 'user_asserted',
        amount: { value: 50, currency: 'USD' },
        payer: { displayToken: 'Acct 1234567890123456' },
      },
    });
    expect(out).toHaveLength(1);
    expect(out[0].payment).toBeUndefined();
    expect(out[0].kind).toBe('screenshot_redacted');
  });
});

describe('QOL-036 — redactPaymentParty', () => {
  test('a full 16-digit card number → masked, no 12+ digit run, ends with last 4', () => {
    const party = redactPaymentParty('Acct 1234567890123456', 'payer');
    expect(party.displayToken).not.toMatch(/\d(?:[\s-]?\d){11,}/);
    expect(party.displayToken.endsWith('3456')).toBe(true);
    expect(party.roleLabel).toBe('payer');
  });

  test('a card number with spaces → masked', () => {
    const party = redactPaymentParty('4111 1111 1111 1111');
    expect(party.displayToken).not.toMatch(/\d(?:[\s-]?\d){11,}/);
    expect(party.displayToken).toContain('••••');
  });

  test('a role-only input "the landlord" passes through unchanged', () => {
    const party = redactPaymentParty('the landlord');
    expect(party.displayToken).toBe('the landlord');
    expect(party.roleLabel).toBeUndefined();
  });

  test('an already-masked tail "•••• 4821" passes through unchanged', () => {
    const party = redactPaymentParty('•••• 4821');
    expect(party.displayToken).toBe('•••• 4821');
  });

  test('a redacted party is clean under findRawAccountDataFields', () => {
    const party = redactPaymentParty('Acct 1234567890123456', 'payer');
    const p: PaymentEvidenceMetadata = { confidence: 'user_asserted', payer: party };
    expect(findRawAccountDataFields(p)).toEqual([]);
  });

  test('the displayToken is clamped to 48 characters', () => {
    const party = redactPaymentParty('x'.repeat(200));
    expect(party.displayToken.length).toBeLessThanOrEqual(48);
  });

  test('an empty input yields an empty displayToken', () => {
    expect(redactPaymentParty('').displayToken).toBe('');
    expect(redactPaymentParty('   ').displayToken).toBe('');
  });

  test('a non-string input → empty displayToken, no throw', () => {
    expect(redactPaymentParty(undefined as unknown as string).displayToken).toBe('');
  });
});

// ══════════════════════════════════════════════════════════════
// Amount edge cases
// ══════════════════════════════════════════════════════════════

describe('QOL-036 — amount normalisation', () => {
  test('a negative amount.value is clamped to 0', () => {
    const out = buildOne({
      payment: { confidence: 'user_asserted', amount: { value: -50, currency: 'USD' } },
    });
    expect(out[0].payment?.amount?.value).toBe(0);
  });

  test('a NaN amount.value drops the whole amount (treated as absent)', () => {
    const out = buildOne({
      payment: { confidence: 'user_asserted', amount: { value: NaN, currency: 'USD' } },
    });
    expect(out[0].payment?.amount).toBeUndefined();
  });

  test('an Infinity amount.value drops the whole amount', () => {
    const out = buildOne({
      payment: {
        confidence: 'user_asserted',
        amount: { value: Infinity, currency: 'USD' },
      },
    });
    expect(out[0].payment?.amount).toBeUndefined();
  });

  test('a valid amount is preserved, currency clamped to 8 chars', () => {
    const out = buildOne({
      payment: {
        confidence: 'user_asserted',
        amount: { value: 99.5, currency: 'VERYLONGCODE' },
      },
    });
    expect(out[0].payment?.amount?.value).toBe(99.5);
    expect((out[0].payment?.amount?.currency ?? '').length).toBeLessThanOrEqual(8);
  });

  test('an empty currency falls back to a neutral label, never blank', () => {
    const out = buildOne({
      payment: { confidence: 'user_asserted', amount: { value: 10, currency: '   ' } },
    });
    expect((out[0].payment?.amount?.currency ?? '').length).toBeGreaterThan(0);
  });
});

// ══════════════════════════════════════════════════════════════
// Field clamping
// ══════════════════════════════════════════════════════════════

describe('QOL-036 — stored-field clamping', () => {
  test('noteText is clamped to 280 characters', () => {
    const out = buildOne({
      payment: { confidence: 'user_asserted', noteText: 'n'.repeat(400) },
    });
    expect((out[0].payment?.noteText ?? '').length).toBeLessThanOrEqual(280);
  });

  test('platform is clamped to 48 characters', () => {
    const out = buildOne({
      payment: { confidence: 'user_asserted', platform: 'p'.repeat(120) },
    });
    expect((out[0].payment?.platform ?? '').length).toBeLessThanOrEqual(48);
  });

  test('claimedApplicability.statement is clamped to 160 characters', () => {
    const out = buildOne({
      payment: {
        confidence: 'user_asserted',
        claimedApplicability: { statement: 's'.repeat(300) },
      },
    });
    expect((out[0].payment?.claimedApplicability?.statement ?? '').length).toBeLessThanOrEqual(
      160,
    );
  });

  test('a claimedApplicability with an empty statement is dropped', () => {
    const out = buildOne({
      payment: {
        confidence: 'user_asserted',
        claimedApplicability: { statement: '   ', periodLabel: 'March 2026' },
      },
    });
    expect(out[0].payment?.claimedApplicability).toBeUndefined();
  });

  test('a payer with neither a token nor a role is dropped', () => {
    const out = buildOne({
      payment: {
        confidence: 'user_asserted',
        payer: { displayToken: '   ' },
      },
    });
    expect(out[0].payment?.payer).toBeUndefined();
  });

  test('hasScreenshotImage / redactionConfirmed default false (omitted when not true)', () => {
    const out = buildOne({ payment: emptyPaymentFixture() });
    expect(out[0].payment?.hasScreenshotImage).toBeUndefined();
    expect(out[0].payment?.redactionConfirmed).toBeUndefined();
  });

  test('hasScreenshotImage / redactionConfirmed are preserved when true', () => {
    const out = buildOne({
      payment: {
        confidence: 'user_asserted',
        hasScreenshotImage: true,
        redactionConfirmed: true,
      },
    });
    expect(out[0].payment?.hasScreenshotImage).toBe(true);
    expect(out[0].payment?.redactionConfirmed).toBe(true);
  });

  test('paidAt is stored verbatim — a non-ISO string is not parsed or rejected', () => {
    const out = buildOne({
      payment: { confidence: 'user_asserted', paidAt: 'last Tuesday' },
    });
    expect(out[0].payment?.paidAt).toBe('last Tuesday');
  });

  test('paidAt and periodLabel are stored without being compared for a mismatch', () => {
    // QOL-036 never flags "March" period vs a February paidAt — that is the
    // QOL-037 applicability dispute, a user action, never a system verdict.
    const out = buildOne({
      payment: {
        confidence: 'user_asserted',
        paidAt: '2026-02-15',
        claimedApplicability: { statement: 'March rent', periodLabel: 'March 2026' },
      },
    });
    expect(out[0].payment?.paidAt).toBe('2026-02-15');
    expect(out[0].payment?.claimedApplicability?.periodLabel).toBe('March 2026');
  });

  test('obligationRef is stored when present (reserved for QOL-037)', () => {
    const out = buildOne({
      payment: {
        confidence: 'user_asserted',
        claimedApplicability: { statement: 'April rent', obligationRef: 'obl-123' },
      },
    });
    expect(out[0].payment?.claimedApplicability?.obligationRef).toBe('obl-123');
  });
});

// ══════════════════════════════════════════════════════════════
// summarizePaymentEvidence / getPaymentEvidenceLabel
// ══════════════════════════════════════════════════════════════

describe('QOL-036 — getPaymentEvidenceLabel', () => {
  test('returns the locked plain-language label', () => {
    expect(getPaymentEvidenceLabel()).toBe('Payment record');
  });

  test('the label is not a snake_case code', () => {
    expect(getPaymentEvidenceLabel()).not.toMatch(/_/);
  });
});

describe('QOL-036 — summarizePaymentEvidence', () => {
  test('a full payment → one-line summary with amount, date, quoted note, and claim', () => {
    const summary = summarizePaymentEvidence(fullPaymentFixture());
    expect(summary).toContain('Payment record');
    expect(summary).toContain('$120');
    expect(summary).toContain('2026-03-03');
    expect(summary).toContain('practice space');
    expect(summary).toContain('March practice-room rent');
  });

  test('an empty-but-confidence payment → just "Payment record"', () => {
    expect(summarizePaymentEvidence(emptyPaymentFixture())).toBe('Payment record');
  });

  test('a partial payment omits absent fields with no dangling punctuation', () => {
    const partial: PaymentEvidenceMetadata = {
      confidence: 'user_asserted',
      noteText: 'practice space',
    };
    const summary = summarizePaymentEvidence(partial);
    expect(summary).toBe('Payment record — noted "practice space"');
    expect(summary.trim()).toBe(summary);
    expect(summary.endsWith(',')).toBe(false);
    expect(summary.endsWith('—')).toBe(false);
  });

  test('an amount-only payment summarises cleanly', () => {
    const summary = summarizePaymentEvidence({
      confidence: 'user_asserted',
      amount: { value: 75, currency: 'USD' },
    });
    expect(summary).toBe('Payment record — 75 USD');
  });

  test('a symbol-like 1-char currency is prefixed; a code is suffixed', () => {
    expect(
      summarizePaymentEvidence({
        confidence: 'user_asserted',
        amount: { value: 9, currency: '£' },
      }),
    ).toContain('£9');
    expect(
      summarizePaymentEvidence({
        confidence: 'user_asserted',
        amount: { value: 9, currency: 'GBP' },
      }),
    ).toContain('9 GBP');
  });

  test('a negative amount in the input is re-clamped to 0 in the summary', () => {
    const summary = summarizePaymentEvidence({
      confidence: 'user_asserted',
      amount: { value: -40, currency: 'USD' },
    });
    expect(summary).toContain('0 USD');
    expect(summary).not.toContain('-40');
  });

  test('a NaN amount in the input is omitted from the summary', () => {
    const summary = summarizePaymentEvidence({
      confidence: 'user_asserted',
      amount: { value: NaN, currency: 'USD' },
      noteText: 'practice space',
    });
    expect(summary).toBe('Payment record — noted "practice space"');
  });

  test('defence-in-depth — a raw account run in the input note is re-redacted in the summary', () => {
    const summary = summarizePaymentEvidence({
      confidence: 'user_asserted',
      noteText: 'card 4111 1111 1111 1111',
    });
    expect(summary).not.toMatch(/\d(?:[\s-]?\d){11,}/);
  });

  test('defence-in-depth — a raw account run in the claimed applicability is re-redacted', () => {
    const summary = summarizePaymentEvidence({
      confidence: 'user_asserted',
      claimedApplicability: { statement: 'covers account 5555444433332222' },
    });
    expect(summary).not.toMatch(/\d(?:[\s-]?\d){11,}/);
  });

  test('a non-object input → "Payment record", no throw', () => {
    expect(summarizePaymentEvidence(null as unknown as PaymentEvidenceMetadata)).toBe(
      'Payment record',
    );
  });
});

// ══════════════════════════════════════════════════════════════
// Display-contract integration (EV-001 chip + timeline)
// ══════════════════════════════════════════════════════════════

describe('QOL-036 — receipt-chip + timeline integration', () => {
  test('a payment artifact contributes payment_screenshot to the chip kinds array', () => {
    const artifacts = buildOne({ payment: fullPaymentFixture() });
    const chip = summarizeArtifactsForReceiptChip(artifacts);
    expect(chip.kinds).toContain('payment_screenshot');
  });

  test('the chip status is the base EV-001 status — a payment object does NOT upgrade it', () => {
    const artifacts = buildOne({ payment: fullPaymentFixture() });
    const chip = summarizeArtifactsForReceiptChip(artifacts);
    // A payment-only artifact is `unverified`; the chip reflects that, not an
    // upgrade to source_and_quote / primary_present.
    expect(chip.status).toBe('unverified');
  });

  test('two payment artifacts on one move list payment_screenshot once in kinds', () => {
    const out = buildEvidenceArtifacts({
      argumentId: ARG_ID,
      addedByUserId: USER_ID,
      createdAt: CREATED_AT,
      attachments: [
        { payment: fullPaymentFixture() },
        { payment: emptyPaymentFixture() },
      ],
    });
    expect(out).toHaveLength(2);
    const chip = summarizeArtifactsForReceiptChip(out);
    const paymentEntries = chip.kinds.filter((k) => k === 'payment_screenshot');
    expect(paymentEntries).toHaveLength(1);
  });

  test('a payment artifact next to a url+quote artifact: worst-status rule still runs', () => {
    const out = buildEvidenceArtifacts({
      argumentId: ARG_ID,
      addedByUserId: USER_ID,
      createdAt: CREATED_AT,
      attachments: [
        { payment: fullPaymentFixture() },
        { url: 'https://example.com', quote: 'a verbatim quote' },
      ],
    });
    const chip = summarizeArtifactsForReceiptChip(out);
    // unverified (payment) is worse than source_and_quote → chip reflects it.
    expect(chip.status).toBe('unverified');
    expect(chip.kinds).toContain('payment_screenshot');
    expect(chip.kinds).toContain('url');
  });

  test('getTimelineEvidenceContract over a payment artifact returns the unchanged contract shape', () => {
    const artifacts = buildOne({ payment: fullPaymentFixture() });
    const contract = getTimelineEvidenceContract('evidence', artifacts);
    expect(contract).toHaveProperty('rendersAsEvidenceNode');
    expect(contract).toHaveProperty('rendersSourceChainRing');
    expect(contract).toHaveProperty('accessibilityLabelSuffix');
    expect(contract).toHaveProperty('receiptChip');
    // No new flag was added to the contract for QOL-036.
    expect(Object.keys(contract).sort()).toEqual(
      [
        'rendersAsEvidenceNode',
        'rendersSourceChainRing',
        'accessibilityLabelSuffix',
        'receiptChip',
      ].sort(),
    );
  });
});

// ══════════════════════════════════════════════════════════════
// Doctrine — no truth, no standing
// ══════════════════════════════════════════════════════════════

describe('QOL-036 — doctrine: evidence is never truth', () => {
  test('PaymentEvidenceMetadata carries no truth-claim field', () => {
    // Structural assertion over a full fixture's keys.
    const keys = Object.keys(fullPaymentFixture());
    const forbidden = ['verified', 'confirmed', 'proven', 'valid', 'isTrue', 'truthValue'];
    for (const f of forbidden) {
      expect(keys).not.toContain(f);
    }
  });

  test('the only confidence value the system stores is user_asserted', () => {
    expect(ALL_EVIDENCE_CONFIDENCES).toEqual(['user_asserted']);
    // Every emitted payment object is pinned, regardless of what arrives.
    const out = buildOne({ payment: fullPaymentFixture() });
    expect(out[0].payment?.confidence).toBe('user_asserted');
  });

  test('a payment artifact never carries a sourceChainStatus that reads as verified', () => {
    const out = buildOne({ payment: fullPaymentFixture() });
    expect(['source_and_quote', 'primary_present']).not.toContain(
      out[0].sourceChainStatus,
    );
  });
});

describe('QOL-036 — doctrine: no point-standing delta from a payment object', () => {
  test('evidenceModel.ts imports nothing from src/features/pointStanding/', () => {
    const modelPath = path.join(
      __dirname,
      '..',
      'src',
      'features',
      'evidence',
      'evidenceModel.ts',
    );
    const source = fs.readFileSync(modelPath, 'utf8');
    expect(source).not.toMatch(/from\s+['"][^'"]*pointStanding[^'"]*['"]/);
    expect(source).not.toMatch(/from\s+['"][^'"]*antiAmplification[^'"]*['"]/);
  });

  test('no QOL-036 helper returns a PointStandingDelta-shaped object', () => {
    // A payment object is inert: the public helpers return strings, booleans,
    // arrays, or artifact records — never a { ... delta ... } score object.
    expect(typeof getPaymentEvidenceLabel()).toBe('string');
    expect(typeof summarizePaymentEvidence(fullPaymentFixture())).toBe('string');
    expect(typeof detectRawAccountData('x')).toBe('boolean');
    expect(Array.isArray(findRawAccountDataFields(fullPaymentFixture()))).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════
// Ban-list — no verdict / amplification vocabulary
// ══════════════════════════════════════════════════════════════

const BANNED = [
  'winner',
  'loser',
  'correct',
  'incorrect',
  'true',
  'false',
  'liar',
  'dishonest',
  'bad faith',
  'manipulative',
  'extremist',
  'propagandist',
  'troll',
  'bot',
  'astroturfer',
  'verdict',
  'proof',
  'proven',
  'disproven',
  'case closed',
];

const AMPLIFICATION_BANNED = [
  'likes',
  'retweets',
  'shares',
  'views',
  'followers',
  'verified',
  'engagement',
  'virality',
  'viral',
  'trending',
];

describe('QOL-036 — ban-list', () => {
  test('_forbiddenPaymentTokens is non-empty and frozen', () => {
    const tokens = _forbiddenPaymentTokens();
    expect(tokens.length).toBeGreaterThan(0);
    expect(Object.isFrozen(tokens)).toBe(true);
  });

  test('getPaymentEvidenceLabel contains no banned verdict token', () => {
    const label = getPaymentEvidenceLabel().toLowerCase();
    for (const b of BANNED) {
      expect(label).not.toContain(b);
    }
  });

  test('summarizePaymentEvidence scaffold contains no banned verdict token (clean fixture)', () => {
    const summary = summarizePaymentEvidence(fullPaymentFixture()).toLowerCase();
    for (const b of BANNED) {
      expect(summary).not.toContain(b);
    }
  });

  test('summarizePaymentEvidence scaffold words stay clean even when the user note is not', () => {
    // The user typed a verdict word in their own free-text note. The model
    // does NOT sanitise user content — but the SCAFFOLD words the model adds
    // around it ("Payment record — ", "noted ") must be ban-list clean. We
    // assert that by removing the quoted user note and scanning what is left.
    const summary = summarizePaymentEvidence({
      confidence: 'user_asserted',
      noteText: 'this proves I am the winner',
      amount: { value: 30, currency: 'USD' },
    });
    const scaffold = summary.replace(/"[^"]*"/g, '""').toLowerCase();
    for (const b of BANNED) {
      expect(scaffold).not.toContain(b);
    }
  });

  test('getPaymentEvidenceLabel + summary scaffold contain no amplification token', () => {
    const label = getPaymentEvidenceLabel().toLowerCase();
    const scaffold = summarizePaymentEvidence(fullPaymentFixture())
      .replace(/"[^"]*"/g, '""')
      .toLowerCase();
    for (const b of AMPLIFICATION_BANNED) {
      expect(label).not.toContain(b);
      expect(scaffold).not.toContain(b);
    }
  });

  test('no QOL-036 system string matches a snake_case internal-code pattern', () => {
    const systemStrings = [getPaymentEvidenceLabel(), summarizePaymentEvidence(fullPaymentFixture())];
    for (const s of systemStrings) {
      // A quoted user note may contain anything; scan only the scaffold.
      const scaffold = s.replace(/"[^"]*"/g, '""');
      expect(scaffold).not.toMatch(/[a-z]+_[a-z]+/);
    }
  });
});

// ══════════════════════════════════════════════════════════════
// Source scan (per repo convention)
// ══════════════════════════════════════════════════════════════

describe('QOL-036 — source purity', () => {
  test('evidenceModel.ts imports no React / Supabase / network library', () => {
    const modelPath = path.join(
      __dirname,
      '..',
      'src',
      'features',
      'evidence',
      'evidenceModel.ts',
    );
    const source = fs.readFileSync(modelPath, 'utf8');
    expect(source).not.toMatch(/from\s+['"]react['"]/);
    expect(source).not.toMatch(/from\s+['"]react-native['"]/);
    expect(source).not.toMatch(/from\s+['"]@supabase\//);
    expect(source).not.toMatch(/\bfetch\s*\(/);
  });

  test('the QOL-036 section introduces no Date.now() / new Date() in the model', () => {
    const modelPath = path.join(
      __dirname,
      '..',
      'src',
      'features',
      'evidence',
      'evidenceModel.ts',
    );
    const source = fs.readFileSync(modelPath, 'utf8');
    // EV-001 already documents "No Date.now()"; the QOL-036 additions must
    // not reintroduce it. Strip line + block comments first so a doc comment
    // that *names* Date.now() (the QOL-036 section header does) is not a false
    // positive — we are asserting no Date.now() / new Date() CALL exists.
    const code = source
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/[^\n]*/g, '');
    expect(code).not.toMatch(/Date\.now\s*\(/);
    expect(code).not.toMatch(/new\s+Date\s*\(/);
  });
});
