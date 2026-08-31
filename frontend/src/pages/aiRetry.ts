import type { AIErrorCode } from '../api/ai';

/**
 * Issue #266: failure categories worth retrying (automatically or via an
 * explicit user confirmation). An invalid structured-output response, a
 * timeout, or a generic provider failure are all typically transient.
 * Quota/rate-limit/auth/validation errors are never retry-worthy --
 * retrying them wastes an attempt against the same limit or the same
 * invalid prompt that just rejected the request, so this set is
 * deliberately narrow rather than "every non-success phase."
 */
export const RETRYABLE_AI_ERROR_CODES: ReadonlySet<AIErrorCode> = new Set([
  'invalid_structured_output',
  'timeout',
  'provider_failure',
]);

export function isRetryableAIErrorCode(code: AIErrorCode | 'network' | undefined): boolean {
  return code != null && RETRYABLE_AI_ERROR_CODES.has(code as AIErrorCode);
}
