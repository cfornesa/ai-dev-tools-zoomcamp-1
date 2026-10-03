#!/usr/bin/env node

/**
 * Compare one Playwright shard's JSON report with its known-failure baseline.
 * Policy: docs/process.md, "CI tiers and E2E suite standards".
 */
import { appendFileSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

function fail(message) {
  throw new Error(message);
}

function normalizeSpecPath(file) {
  const normalized = String(file).replaceAll('\\', '/');
  const e2eIndex = normalized.lastIndexOf('/e2e/');
  if (e2eIndex >= 0) return normalized.slice(e2eIndex + 1);
  if (normalized.startsWith('e2e/')) return normalized;
  return `e2e/${path.posix.basename(normalized)}`;
}

function makeKey(project, spec, title) {
  return `${project}|${normalizeSpecPath(spec)}|${title}`;
}

function parseDate(value, label) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    fail(`${label} must be an ISO date (YYYY-MM-DD)`);
  }
  const milliseconds = Date.parse(`${value}T00:00:00Z`);
  if (
    !Number.isFinite(milliseconds) ||
    new Date(milliseconds).toISOString().slice(0, 10) !== value
  ) {
    fail(`${label} is not a valid calendar date: ${value}`);
  }
  return milliseconds;
}

function validateBaseline(entries) {
  if (!Array.isArray(entries)) fail('baseline must be a JSON array');
  const byKey = new Map();
  for (const [index, entry] of entries.entries()) {
    const label = `baseline[${index}]`;
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      fail(`${label} must be an object`);
    }
    if (typeof entry.key !== 'string' || entry.key.split('|').length !== 3) {
      fail(`${label}.key must be <project>|<spec path>|<full title>`);
    }
    if (!Number.isInteger(entry.issue) || entry.issue < 1) {
      fail(`${label} has no valid owner issue number`);
    }
    const addedAt = parseDate(entry.added, `${label}.added`);
    const expiresAt = parseDate(entry.expires, `${label}.expires`);
    if (expiresAt < addedAt) fail(`${label}.expires is before added`);
    if (entry.flaky !== undefined && typeof entry.flaky !== 'boolean') {
      fail(`${label}.flaky must be a boolean when present`);
    }
    if (entry.count !== undefined && (!Number.isInteger(entry.count) || entry.count < 1)) {
      fail(`${label}.count must be a positive integer`);
    }
    const count = entry.count ?? 1;
    const existing = byKey.get(entry.key);
    if (existing) {
      if (
        existing.issue !== entry.issue ||
        existing.added !== entry.added ||
        existing.expires !== entry.expires ||
        existing.flaky !== Boolean(entry.flaky)
      ) {
        fail(`duplicate baseline key has conflicting metadata: ${entry.key}`);
      }
      existing.count += count;
    } else {
      byKey.set(entry.key, { ...entry, count, flaky: Boolean(entry.flaky) });
    }
  }
  return byKey;
}

function outcomeFor(test) {
  if (test.status === 'unexpected' || test.status === 'flaky') return 'failed';
  if (test.status === 'expected') return 'passed';
  if (test.status === 'skipped') return 'skipped';
  const lastResult = Array.isArray(test.results) ? test.results.at(-1) : undefined;
  if (lastResult?.status === 'passed') return 'passed';
  if (lastResult?.status === 'skipped') return 'skipped';
  if (lastResult?.status) return 'failed';
  fail(`test has no recognizable Playwright status: ${JSON.stringify(test)}`);
}

function collectReportTests(report) {
  if (!report || !Array.isArray(report.suites)) fail('Playwright report must have a suites array');
  if (Array.isArray(report.errors) && report.errors.length > 0) {
    fail(`Playwright reported ${report.errors.length} runner/configuration error(s)`);
  }

  const tests = [];
  function visit(suite, parentTitles = [], inheritedFile = '') {
    const file = suite.file || inheritedFile;
    const title = typeof suite.title === 'string' ? suite.title : '';
    const normalizedFile = String(file).replaceAll('\\', '/');
    const isFileSuite = Boolean(
      file &&
      title &&
      (path.posix.basename(normalizedFile) === title ||
        normalizedFile === title ||
        normalizedFile.endsWith(`/${title}`)),
    );
    const titles = isFileSuite || !title ? parentTitles : [...parentTitles, title];
    for (const spec of suite.specs ?? []) {
      const specFile = spec.file || file;
      if (!specFile) fail(`Playwright spec has no file path: ${spec.title ?? '(untitled)'}`);
      const fullTitle = [...titles, spec.title].filter(Boolean).join(' › ');
      for (const test of spec.tests ?? []) {
        const project = test.projectName ?? test.project?.name;
        if (typeof project !== 'string' || !project) fail(`test in ${specFile} has no projectName`);
        const key = makeKey(project, specFile, fullTitle);
        tests.push({ key, outcome: outcomeFor(test) });
      }
    }
    for (const child of suite.suites ?? []) visit(child, titles, file);
  }
  for (const suite of report.suites) visit(suite);
  if (tests.length === 0)
    fail('Playwright report contains no tests; refusing to pass an empty or interrupted shard');
  return tests;
}

function evaluateReport(report, baseline, { today = new Date() } = {}) {
  const baselineByKey = validateBaseline(baseline);
  const tests = collectReportTests(report);
  const observed = new Map();
  for (const test of tests) {
    const counts = observed.get(test.key) ?? { failed: 0, passed: 0, skipped: 0 };
    counts[test.outcome] += 1;
    observed.set(test.key, counts);
  }

  const result = {
    newFailures: [],
    fixed: [],
    expired: [],
    baselinedStillFailing: 0,
    skippedBaseline: [],
    reportedFailures: tests.filter((test) => test.outcome === 'failed').length,
  };
  const todayMs = Date.parse(`${today.toISOString().slice(0, 10)}T00:00:00Z`);

  for (const [key, counts] of observed) {
    const known = baselineByKey.get(key);
    if (!known) {
      if (counts.failed) result.newFailures.push({ key, count: counts.failed });
      continue;
    }

    if (parseDate(known.expires, `baseline expiry for ${key}`) < todayMs) {
      result.expired.push({ key, issue: known.issue, expires: known.expires });
    }
    if (counts.skipped)
      result.skippedBaseline.push({ key, issue: known.issue, count: counts.skipped });
    if (counts.passed && !known.flaky) {
      result.fixed.push({ key, issue: known.issue, count: Math.min(counts.passed, known.count) });
    }
    result.baselinedStillFailing += Math.min(counts.failed, known.count);
    if (counts.failed > known.count) {
      result.newFailures.push({ key, count: counts.failed - known.count });
    }
  }
  return result;
}

function formatSummary(result) {
  const newCount = result.newFailures.reduce((sum, item) => sum + item.count, 0);
  const fixedCount = result.fixed.reduce((sum, item) => sum + item.count, 0);
  return [
    '## Browser E2E known-failure ratchet',
    '',
    `| New | Fixed | Expired | Baselined still failing |`,
    `| ---: | ---: | ---: | ---: |`,
    `| ${newCount} | ${fixedCount} | ${result.expired.length} | ${result.baselinedStillFailing} |`,
    '',
  ].join('\n');
}

function printResult(result) {
  const newCount = result.newFailures.reduce((sum, item) => sum + item.count, 0);
  const fixedCount = result.fixed.reduce((sum, item) => sum + item.count, 0);
  console.log(
    `Ratchet counts: new=${newCount}, fixed=${fixedCount}, expired=${result.expired.length}, baselined-still-failing=${result.baselinedStillFailing}`,
  );
  for (const item of result.newFailures) console.log(`NEW (${item.count}): ${item.key}`);
  for (const item of result.fixed)
    console.log(`FIXED (#${item.issue}, ${item.count}; reduce/remove baseline count): ${item.key}`);
  for (const item of result.expired)
    console.log(`EXPIRED (#${item.issue}, ${item.expires}): ${item.key}`);
  for (const item of result.skippedBaseline)
    console.log(`SKIPPED BASELINE (#${item.issue}, ${item.count}): ${item.key}`);
}

function parseArgs(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const option = args[index];
    if (!['--report', '--baseline', '--today', '--playwright-exit-code'].includes(option)) {
      fail(`unknown option: ${option}`);
    }
    const value = args[index + 1];
    if (!value || value.startsWith('--')) fail(`missing value for ${option}`);
    options[option.slice(2)] = value;
    index += 1;
  }
  if (!options.report || !options.baseline)
    fail(
      'usage: node scripts/e2e-ratchet.mjs --report <results.json> --baseline <known-failures.json>',
    );
  return options;
}

function main(args = process.argv.slice(2)) {
  try {
    const options = parseArgs(args);
    const report = JSON.parse(readFileSync(options.report, 'utf8'));
    const baseline = JSON.parse(readFileSync(options.baseline, 'utf8'));
    const now = options.today ? new Date(`${options.today}T00:00:00Z`) : new Date();
    if (!Number.isFinite(now.getTime())) fail(`invalid --today date: ${options.today}`);
    const result = evaluateReport(report, baseline, { today: now });
    if (options['playwright-exit-code'] !== undefined) {
      const playwrightExitCode = Number(options['playwright-exit-code']);
      if (!Number.isInteger(playwrightExitCode) || playwrightExitCode < 0) {
        fail(`invalid Playwright exit code: ${options['playwright-exit-code']}`);
      }
      if (playwrightExitCode === 0 && result.reportedFailures > 0) {
        fail('Playwright exited successfully but its JSON report contains failed tests');
      }
      if (playwrightExitCode !== 0 && result.reportedFailures === 0) {
        fail(`Playwright exited ${playwrightExitCode} without a failed test in its JSON report`);
      }
    }
    printResult(result);
    if (process.env.GITHUB_STEP_SUMMARY)
      appendFileSync(process.env.GITHUB_STEP_SUMMARY, formatSummary(result));
    const failure =
      result.newFailures.length > 0 ||
      result.fixed.length > 0 ||
      result.expired.length > 0 ||
      result.skippedBaseline.length > 0;
    return failure ? 1 : 0;
  } catch (error) {
    console.error(`E2E ratchet error: ${error.message}`);
    if (process.env.GITHUB_STEP_SUMMARY) {
      appendFileSync(
        process.env.GITHUB_STEP_SUMMARY,
        `## Browser E2E known-failure ratchet\n\n**Error:** ${error.message}\n`,
      );
    }
    return 1;
  }
}

export { collectReportTests, evaluateReport, makeKey, normalizeSpecPath, validateBaseline };

const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) process.exitCode = main();
