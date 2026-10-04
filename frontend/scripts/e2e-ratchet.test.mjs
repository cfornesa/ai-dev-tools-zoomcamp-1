import assert from 'node:assert/strict';
import test from 'node:test';

import { evaluateReport, validateBaseline } from './e2e-ratchet.mjs';

const keyA = 'chromium|e2e/accountSettings.spec.ts|Account settings › stays grouped';
const keyB = 'webkit|e2e/manual2dStageChrome.spec.ts|Fullscreen › exits with Escape';

function reportFor(specs) {
  const suitesByFile = new Map();
  for (const { key, status } of specs) {
    const [projectName, file, ...titleParts] = key.split('|');
    const title = titleParts.join('|');
    const [describeTitle, testTitle] = title.includes(' › ')
      ? [title.slice(0, title.lastIndexOf(' › ')), title.slice(title.lastIndexOf(' › ') + 3)]
      : ['', title];
    let suite = suitesByFile.get(file);
    if (!suite) {
      suite = { title: file.split('/').at(-1), file, specs: [], suites: [] };
      suitesByFile.set(file, suite);
    }
    const parent = describeTitle
      ? (suite.suites.find((item) => item.title === describeTitle) ??
        (() => {
          const item = { title: describeTitle, file, specs: [], suites: [] };
          suite.suites.push(item);
          return item;
        })())
      : suite;
    parent.specs.push({
      title: testTitle,
      file,
      tests: [{ projectName, status }],
    });
  }
  return { suites: [...suitesByFile.values()] };
}

function baselineFor(key, overrides = {}) {
  return {
    key,
    issue: 1160,
    added: '2026-10-03',
    expires: '2026-10-24',
    count: 1,
    ...overrides,
  };
}

test('passes when every reported failure matches an active baseline entry', () => {
  const report = reportFor([
    { key: keyA, status: 'unexpected' },
    { key: keyB, status: 'unexpected' },
  ]);
  const result = evaluateReport(report, [baselineFor(keyA), baselineFor(keyB, { issue: 1166 })], {
    today: new Date('2026-10-03T00:00:00Z'),
  });
  assert.deepEqual(result.newFailures, []);
  assert.equal(result.baselinedStillFailing, 2);
  assert.equal(result.fixed.length, 0);
  assert.equal(result.expired.length, 0);
});

test('fails when a shard has a synthetic failure without a baseline entry', () => {
  const report = reportFor([{ key: keyA, status: 'unexpected' }]);
  const result = evaluateReport(report, [], { today: new Date('2026-10-03T00:00:00Z') });
  assert.deepEqual(result.newFailures, [{ key: keyA, count: 1 }]);
});

test('fails when a reported baseline test now passes and names it for removal', () => {
  const report = reportFor([{ key: keyA, status: 'expected' }]);
  const result = evaluateReport(report, [baselineFor(keyA)], {
    today: new Date('2026-10-03T00:00:00Z'),
  });
  assert.deepEqual(result.fixed, [{ key: keyA, issue: 1160, count: 1 }]);
});

test('fails when a reported baseline entry has expired', () => {
  const report = reportFor([{ key: keyA, status: 'unexpected' }]);
  const result = evaluateReport(
    report,
    [baselineFor(keyA, { added: '2026-09-01', expires: '2026-09-30' })],
    {
      today: new Date('2026-10-03T00:00:00Z'),
    },
  );
  assert.deepEqual(result.expired, [{ key: keyA, issue: 1160, expires: '2026-09-30' }]);
});

test('rejects a baseline entry with no owner issue during load', () => {
  assert.throws(
    () => validateBaseline([baselineFor(keyA, { issue: null })]),
    /no valid owner issue number/,
  );
});

test('ignores baseline entries not present in this shard report', () => {
  const report = reportFor([{ key: keyA, status: 'unexpected' }]);
  const result = evaluateReport(
    report,
    [baselineFor(keyA), baselineFor(keyB, { added: '2026-08-01', expires: '2026-09-01' })],
    { today: new Date('2026-10-03T00:00:00Z') },
  );
  assert.equal(result.expired.length, 0);
  assert.equal(result.baselinedStillFailing, 1);
  assert.deepEqual(result.newFailures, []);
});

test('uses baseline count to distinguish same-title generated tests', () => {
  const report = reportFor([
    { key: keyA, status: 'unexpected' },
    { key: keyA, status: 'unexpected' },
    { key: keyA, status: 'unexpected' },
  ]);
  const result = evaluateReport(report, [baselineFor(keyA, { count: 2 })], {
    today: new Date('2026-10-03T00:00:00Z'),
  });
  assert.equal(result.baselinedStillFailing, 2);
  assert.deepEqual(result.newFailures, [{ key: keyA, count: 1 }]);
});
