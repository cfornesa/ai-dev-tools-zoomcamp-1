import type { ArtPieceRefineRun } from '../api/artPieces';

type RefineFailure = Pick<
  ArtPieceRefineRun,
  'auto_retry_enabled' | 'error_reason' | 'repairs' | 'validation_summary'
>;

function joinSummaryAndGuidance(summary: string, guidance: string): string {
  return summary ? `${summary} ${guidance}` : guidance;
}

export function artPieceRefineFailureMessage(run: RefineFailure): string {
  const summary = run.validation_summary.trim();

  if (run.error_reason === 'quota_exceeded') {
    return joinSummaryAndGuidance(
      summary || 'The art-piece refinement quota was exhausted.',
      'Wait until the quota resets before submitting another refinement.',
    );
  }

  if (run.error_reason === 'rate_limited') {
    return joinSummaryAndGuidance(
      summary || 'The refinement rate limit was reached.',
      'Wait a moment before submitting another refinement.',
    );
  }

  const failure =
    summary || 'The refinement did not produce a valid revision; the stored source is unchanged.';
  if (run.error_reason !== 'refine_failed') return failure;

  const guidance =
    run.auto_retry_enabled && run.repairs > 0
      ? 'Automatic retries were exhausted. The source was not changed; revise the request before submitting another refinement.'
      : 'No automatic retry was made. The source was not changed; revise the request or submit again to try this refinement.';
  return joinSummaryAndGuidance(failure, guidance);
}
