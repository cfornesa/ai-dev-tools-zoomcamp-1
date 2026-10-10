import { describe, expect, it } from 'vitest';

import { artPieceRefineFailureMessage } from './artPieceRefineFailureMessage';

const run = {
  auto_retry_enabled: false,
  error_reason: 'refine_failed',
  repairs: 0,
  validation_summary: 'The candidate did not pass validation.',
};

describe('artPieceRefineFailureMessage', () => {
  it('explains a failed refinement when automatic retries are off', () => {
    expect(artPieceRefineFailureMessage(run)).toBe(
      'The candidate did not pass validation. No automatic retry was made. The source was not changed; revise the request or submit again to try this refinement.',
    );
  });

  it('says retries were exhausted only when an automatic repair ran', () => {
    expect(
      artPieceRefineFailureMessage({
        ...run,
        auto_retry_enabled: true,
        repairs: 2,
      }),
    ).toBe(
      'The candidate did not pass validation. Automatic retries were exhausted. The source was not changed; revise the request before submitting another refinement.',
    );
    expect(
      artPieceRefineFailureMessage({ ...run, auto_retry_enabled: true, repairs: 0 }),
    ).toContain('No automatic retry was made.');
  });

  it('asks the owner to wait for quota reset without encouraging immediate resubmission', () => {
    const message = artPieceRefineFailureMessage({
      ...run,
      error_reason: 'quota_exceeded',
      validation_summary: 'The art-piece refinement quota was exhausted.',
    });
    expect(message).toContain('The art-piece refinement quota was exhausted.');
    expect(message).toContain('Wait until the quota resets');
    expect(message).not.toContain('retries were exhausted');
    expect(message).not.toContain('submit again');
  });

  it('asks the owner to wait after a rate limit and preserves other failure details', () => {
    const rateMessage = artPieceRefineFailureMessage({
      ...run,
      error_reason: 'rate_limited',
      validation_summary: '',
    });
    expect(rateMessage).toBe(
      'The refinement rate limit was reached. Wait a moment before submitting another refinement.',
    );
    expect(rateMessage).not.toContain('retries were exhausted');
    expect(artPieceRefineFailureMessage({ ...run, error_reason: 'provider_failure' })).toBe(
      'The candidate did not pass validation.',
    );
  });
});
