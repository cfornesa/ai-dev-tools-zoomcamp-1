import { describe, expect, it } from 'vitest';

import { EXPORT_STAGE_TOOLBAR_CSS } from './exportStageToolbar';

describe('EXPORT_STAGE_TOOLBAR_CSS', () => {
  it('keeps mobile exported action targets at least 44px in both dimensions (#1176)', () => {
    const mobileRules = EXPORT_STAGE_TOOLBAR_CSS.match(
      /@media \(max-width: 700px\) \{([\s\S]*?)\n\}/,
    )?.[1];

    expect(mobileRules).toContain('.piece-stage-icon-button { width: 44px; height: 44px; }');
  });
});
