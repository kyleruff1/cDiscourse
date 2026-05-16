/**
 * Node.js-compatible provider registry for tests.
 * Accepts an injectable env record instead of Deno.env.get().
 * Does not make network calls. Does not call Anthropic.
 *
 * The real server registry is supabase/functions/_shared/languageProcessing/providers.ts.
 * This Node.js version is used only for unit tests and type checking.
 */
import type { LanguageProcessingInput, LanguageProcessingOutcome } from './types';
import { runMockLanguageProcessing } from './mockProvider';

/** Injectable environment for test isolation. */
export interface ProviderEnv {
  AI_LANGUAGE_PROCESSING_ENABLED?: string;
  AI_LANGUAGE_PROCESSING_PROVIDER?: string;
  AI_LANGUAGE_PROCESSING_MODEL?: string;
}

/**
 * Synchronous provider registry (Node.js / test-only).
 * Anthropic calls are not attempted here — they require the Edge Function.
 * Passing provider='anthropic' returns not_configured to indicate the caller
 * must use supabase.functions.invoke('process-language-draft') instead.
 */
export function processWithConfiguredProviderSync(
  input: LanguageProcessingInput,
  env: ProviderEnv,
): LanguageProcessingOutcome {
  if (env.AI_LANGUAGE_PROCESSING_ENABLED !== 'true') {
    return { enabled: false, reason: 'disabled' };
  }

  const providerName = env.AI_LANGUAGE_PROCESSING_PROVIDER ?? 'anthropic';

  if (providerName === 'mock') {
    return { enabled: true, ...runMockLanguageProcessing(input) };
  }

  if (providerName === 'anthropic') {
    // Anthropic provider requires Edge Function context (Deno.env + network).
    // In Node.js tests, return not_configured to signal this correctly.
    return { enabled: false, reason: 'not_configured' };
  }

  if (providerName === 'openai') {
    return { enabled: false, reason: 'not_implemented' };
  }

  return { enabled: false, reason: 'not_configured' };
}
