/**
 * Stage 6.1.8 — Deletion request workflow contract tests.
 *
 * No real network. Tests assert source-file shape: the Edge Function gates
 * correctly, never returns admin emails, never logs secrets, and the
 * migration declares the right RLS policies + table constraints.
 */
import * as fs from 'fs';
import * as path from 'path';

const repoRoot = process.cwd();
const fnSrc = fs.readFileSync(path.join(repoRoot, 'supabase/functions/request-argument-deletion/index.ts'), 'utf8');
const migSrc = fs.readFileSync(path.join(repoRoot, 'supabase/migrations/20260517000008_stage6_1_8_argument_deletion_requests.sql'), 'utf8');
const wrapperSrc = fs.readFileSync(path.join(repoRoot, 'src/lib/edgeFunctions.ts'), 'utf8');
const sheetSrc = fs.readFileSync(path.join(repoRoot, 'src/features/arguments/DeletionRequestSheet.tsx'), 'utf8');

describe('Migration 0008 — argument_deletion_requests', () => {
  it('creates the table with the required columns', () => {
    expect(migSrc).toMatch(/create table if not exists public\.argument_deletion_requests/);
    for (const col of ['id', 'debate_id', 'argument_id', 'requester_id', 'reason', 'status', 'created_at', 'resolved_at', 'resolved_by', 'admin_note']) {
      expect(migSrc).toContain(col);
    }
  });

  it('declares the status CHECK with all five allowed values', () => {
    expect(migSrc).toMatch(/check\s*\(\s*status in \('requested', 'reviewing', 'approved', 'rejected', 'cancelled'\)\s*\)/);
  });

  it('enables RLS and declares insert/select/update policies', () => {
    expect(migSrc).toMatch(/enable row level security/);
    expect(migSrc).toContain('adr_insert_own_argument');
    expect(migSrc).toContain('adr_select_own_or_admin');
    expect(migSrc).toContain('adr_update_admin_only');
  });

  it('requires the requester to BE the author at insert time', () => {
    expect(migSrc).toMatch(/auth\.uid\(\)\s*=\s*requester_id/);
    expect(migSrc).toMatch(/a\.author_id\s*=\s*auth\.uid\(\)/);
  });

  it('makes UPDATE admin-only (is_admin)', () => {
    expect(migSrc).toMatch(/for update\s+using \(public\.is_admin\(auth\.uid\(\)\)\)/);
  });

  it('declares the one-open-request-per-(argument,requester) unique index', () => {
    expect(migSrc).toMatch(/argument_deletion_requests_one_open_per_argument/);
    expect(migSrc).toMatch(/where status in \('requested', 'reviewing'\)/);
  });
});

describe('Edge Function — request-argument-deletion', () => {
  it('verifies the JWT via authorization header', () => {
    expect(fnSrc).toMatch(/req\.headers\.get\(['"]authorization['"]\)/);
    expect(fnSrc).toMatch(/if \(!auth\) return unauthorized\(\)/);
  });

  it('validates debateId + argumentId as UUIDs', () => {
    expect(fnSrc).toContain('isUuid');
    expect(fnSrc).toMatch(/badRequest\('debateId_and_argumentId_required'\)/);
  });

  it('refuses if the caller is not the argument author', () => {
    expect(fnSrc).toMatch(/if \(argRow\.author_id !== requesterId\) return forbidden\('not_argument_author'\)/);
  });

  it('reuses an existing open request instead of inserting a duplicate', () => {
    expect(fnSrc).toMatch(/\.in\('status', \['requested', 'reviewing'\]\)/);
  });

  it('never returns admin email addresses in the response', () => {
    // The function returns ok({ requestId, status, emailStatus, userReviewRequired: true }).
    expect(fnSrc).toMatch(/ok\(\{ requestId, status, emailStatus, userReviewRequired: true \}\)/);
    // Recipients are only used INSIDE the function (Resend call); they do not appear in the response.
    expect(fnSrc).not.toMatch(/recipients:\s*recipients/);
  });

  it('never logs Authorization or RESEND_API_KEY', () => {
    expect(fnSrc).not.toMatch(/console\.\w+\([^)]*RESEND_API_KEY/);
    expect(fnSrc).not.toMatch(/console\.\w+\([^)]*authorization/i);
    // Authorization values appear only when SETTING the header, never when LOGGING.
    expect(fnSrc).not.toMatch(/console\.\w+\([^)]*authorization:[^)]*\$\{/i);
  });

  it('returns emailStatus="not_configured" when RESEND_API_KEY is absent', () => {
    expect(fnSrc).toMatch(/RESEND_API_KEY/);
    expect(fnSrc).toMatch(/return 'not_configured'/);
  });

  it('never deletes a row in public.arguments', () => {
    expect(fnSrc).not.toMatch(/from\(['"]arguments['"]\)[\s\S]*\.delete\(/);
    expect(fnSrc).not.toMatch(/\.delete\(\)[\s\S]*from\(['"]arguments['"]\)/);
  });

  it('uses the caller-scoped client for the argument lookup (RLS path)', () => {
    expect(fnSrc).toMatch(/callerClient\s*\n?\s*\.from\(['"]arguments['"]\)/);
  });

  it('uses the service-role client only for audit + recipient lookup, never to return secrets', () => {
    expect(fnSrc).toMatch(/createServiceClient\(\)/);
    expect(fnSrc).not.toMatch(/return ok\([^)]*SERVICE_ROLE/);
  });
});

describe('Client wrapper — requestArgumentDeletion', () => {
  it('routes through supabase.functions.invoke (no direct fetch + no service-role)', () => {
    expect(wrapperSrc).toContain("supabase.functions.invoke<RequestArgumentDeletionResult>(\n    'request-argument-deletion'");
    expect(wrapperSrc).not.toMatch(/SUPABASE_SERVICE_ROLE/);
  });

  it('returns sanitized {requestId, status, emailStatus, userReviewRequired}', () => {
    expect(wrapperSrc).toContain('emailStatus:');
    expect(wrapperSrc).toContain('userReviewRequired: true');
  });
});

describe('DeletionRequestSheet — UI safety', () => {
  it('never promises deletion in copy', () => {
    const lower = sheetSrc.toLowerCase();
    expect(lower).toMatch(/an admin must review/);
    expect(lower).not.toMatch(/will be deleted/);
    expect(lower).not.toMatch(/has been deleted/);
  });

  it('explains the not_configured email-status path to the user', () => {
    expect(sheetSrc).toMatch(/admin email notifications are not configured/i);
  });

  it('never imports service-role or provider keys', () => {
    expect(sheetSrc).not.toMatch(/SUPABASE_SERVICE_ROLE/);
    expect(sheetSrc).not.toMatch(/RESEND_API_KEY/);
    expect(sheetSrc).not.toMatch(/process\.env\.ANTHROPIC_API_KEY/);
  });
});
