import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFileSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { test } from '@playwright/test';

import { apiGet, apiPost } from '../e2e/support/api.js';
import { loginViaUI } from '../e2e/support/auth.js';
import { requireE2EFixtures } from '../e2e/support/prerequisites.js';

const EXPECTED_BASES = new Set([
  '5eec7ff72c2c5b854de2c8ddd026cc180ea4bcc1',
  '4175e4e6de94e84c35a2a1fa9c5cf40ceed2ac21',
]);
const EXPECTED_INK_SPEC_SHA = 'ff20af56ad374d3c8ff132bc966bfa6e7a01f60e06a11d6296a8ab32c5cf595f';
const INK_SPEC_TEXT = readFileSync(
  new URL('../e2e/inkLayerGenerated2d.spec.ts', import.meta.url),
  'utf8',
);
const ACTUAL_INK_SPEC_SHA = createHash('sha256').update(INK_SPEC_TEXT).digest('hex');
const P5_FIXTURE_SOURCE =
  'window.sketch = (p) => { p.setup = () => { p.createCanvas(320, 240); }; p.draw = () => { p.background(23, 37, 84); }; };';
const P5_FIXTURE_MATCHES = INK_SPEC_TEXT.includes(P5_FIXTURE_SOURCE);

type DiagnosticEvent = {
  atMs: number;
  kind: string;
  marker?: string;
  status?: string;
  dataKind?: string;
  dataLength?: number | null;
  sourceWindow?: 'preview' | 'other';
  harnessName?: string;
  readyState?: 'loading' | 'interactive' | 'complete' | 'other';
};

type DiagnosticWindow = Window & {
  __ci1347Events?: DiagnosticEvent[];
  __ci1347MarkClick?: () => void;
};

function installInkFreezeHooks() {
  const harnessMarker = 'ci-1347-ink-freeze';
  const sandboxMarker = 'art-piece-sandbox';
  const parentMarker = 'art-piece-parent';
  const events: Array<Record<string, unknown>> = [];
  const allowedStatuses = new Set(['ready', 'error', 'screenshot']);
  const allowedHarnessNames = new Set([
    'iframe-init',
    'iframe-readystatechange',
    'iframe-domcontentloaded',
    'iframe-load',
    'screenshot-command-received',
  ]);
  const allowedReadyStates = new Set(['loading', 'interactive', 'complete']);
  const safeReadyState = () =>
    allowedReadyStates.has(document.readyState) ? document.readyState : 'other';
  const record = (event: Record<string, unknown>) => {
    events.push({ atMs: Date.now(), ...event });
  };

  if (window === window.parent) {
    const observedFrames = new WeakSet<HTMLIFrameElement>();
    const observeFrames = () => {
      document
        .querySelectorAll<HTMLIFrameElement>('iframe[data-testid="art-piece-ink-preview"]')
        .forEach((frame) => {
          if (observedFrames.has(frame)) return;
          observedFrames.add(frame);
          frame.addEventListener('load', () => record({ kind: 'host-iframe-load' }));
        });
    };
    const observer = new MutationObserver(observeFrames);
    observer.observe(document, { childList: true, subtree: true });
    observeFrames();

    window.addEventListener(
      'message',
      (event) => {
        const data =
          typeof event.data === 'object' && event.data !== null
            ? (event.data as Record<string, unknown>)
            : {};
        const frame = document.querySelector<HTMLIFrameElement>(
          'iframe[data-testid="art-piece-ink-preview"]',
        );
        const sourceWindow: 'preview' | 'other' =
          frame?.contentWindow === event.source ? 'preview' : 'other';
        if (data.source === harnessMarker) {
          const harnessName =
            typeof data.name === 'string' && allowedHarnessNames.has(data.name)
              ? data.name
              : 'other';
          const readyState =
            typeof data.readyState === 'string' && allowedReadyStates.has(data.readyState)
              ? data.readyState
              : 'other';
          record({
            kind: 'harness-message',
            marker: 'harness',
            harnessName,
            readyState,
            sourceWindow,
          });
          return;
        }

        const marker =
          data.source === sandboxMarker
            ? 'sandbox'
            : data.source === parentMarker
              ? 'parent'
              : 'other';
        const status =
          typeof data.status === 'string' && allowedStatuses.has(data.status)
            ? data.status
            : 'other';
        const payload = data.data;
        record({
          kind: 'message',
          marker,
          status,
          dataKind: typeof payload,
          dataLength: typeof payload === 'string' ? payload.length : null,
          sourceWindow,
        });
      },
      true,
    );

    (window as DiagnosticWindow).__ci1347Events = events as DiagnosticEvent[];
    (window as DiagnosticWindow).__ci1347MarkClick = () => record({ kind: 'draw-click' });
    return;
  }

  const report = (name: string) => {
    window.parent.postMessage(
      {
        source: harnessMarker,
        name: allowedHarnessNames.has(name) ? name : 'other',
        readyState: safeReadyState(),
      },
      '*',
    );
  };
  report('iframe-init');
  document.addEventListener('readystatechange', () => report('iframe-readystatechange'));
  document.addEventListener('DOMContentLoaded', () => report('iframe-domcontentloaded'));
  window.addEventListener('load', () => report('iframe-load'));
  window.addEventListener(
    'message',
    (event) => {
      const data =
        typeof event.data === 'object' && event.data !== null
          ? (event.data as Record<string, unknown>)
          : {};
      if (
        event.source === window.parent &&
        data.source === parentMarker &&
        data.type === 'screenshot'
      ) {
        report('screenshot-command-received');
      }
    },
    true,
  );
}

const fixtures = requireE2EFixtures();

test.describe('local-only #776 p5.js ink freeze diagnostic', () => {
  test.describe.configure({ mode: 'serial' });

  for (const variant of ['natural-click', 'ready-confirmed'] as const) {
    for (let trial = 1; trial <= 10; trial += 1) {
      test(`${variant} trial ${String(trial).padStart(2, '0')}`, async ({
        page,
        context,
      }, testInfo) => {
        test.setTimeout(60_000);
        const actualBaseSha = execFileSync('git', ['rev-parse', 'HEAD'], {
          cwd: process.cwd(),
          encoding: 'utf8',
        }).trim();
        let stage = 'instrumentation';
        let outcome = 'setup-failed';
        await context.addInitScript(installInkFreezeHooks);

        try {
          if (!EXPECTED_BASES.has(actualBaseSha)) {
            outcome = 'unexpected-base';
          } else if (ACTUAL_INK_SPEC_SHA !== EXPECTED_INK_SPEC_SHA || !P5_FIXTURE_MATCHES) {
            outcome = 'ink-spec-or-fixture-mismatch';
          } else {
            stage = 'login';
            await page.setViewportSize({ width: 1280, height: 900 });
            await loginViaUI(page, fixtures.owner.email, fixtures.password);

            stage = 'fixture-create';
            const profile = (await (await apiGet(context, '/api/account/profile/')).json()) as {
              handle: string;
            };
            const safeTrial = `${variant}-${String(trial).padStart(2, '0')}`;
            const slug = `ci1347-${safeTrial}-${Date.now().toString(36)}`;
            const created = await apiPost(context, '/api/art-pieces/', {
              title: 'CI 1347 p5 freeze fixture',
              description: 'Local diagnostic fixture.',
              prompt: 'A deterministic p5.js freeze diagnostic fixture.',
              engine: 'p5js',
              public_slug: slug,
              capabilities: { screenshot: true, download: true, immersive: true },
              source: P5_FIXTURE_SOURCE,
            });
            if (created.status() !== 201) {
              outcome = 'fixture-create-failed';
            } else {
              stage = 'editor-load';
              await page.goto(`/users/@${profile.handle}/edit/${slug}`);
              await page.getByRole('heading', { name: 'Edit CI 1347 p5 freeze fixture' }).waitFor({
                state: 'visible',
                timeout: 20_000,
              });

              if (variant === 'ready-confirmed') {
                stage = 'ready-confirmation';
                await page.waitForFunction(
                  () =>
                    (window as DiagnosticWindow).__ci1347Events?.some(
                      (event) => event.marker === 'sandbox' && event.status === 'ready',
                    ) ?? false,
                  undefined,
                  { timeout: 15_000 },
                );
              }

              stage = 'draw-click';
              await page.evaluate(() => (window as DiagnosticWindow).__ci1347MarkClick?.());
              await page.getByTestId('art-piece-editor-tool-freehand-draw').click();

              stage = 'freeze-outcome';
              try {
                const result = await page.waitForFunction(
                  () => {
                    if (document.querySelector('[data-testid="ink-editor"]')) {
                      return 'session-started';
                    }
                    const message = document.querySelector(
                      '[data-testid="generated-ink-message"]',
                    )?.textContent;
                    if (message?.includes('Could not freeze this piece')) return 'freeze-failed';
                    if (message?.includes('Could not read the frozen frame')) {
                      return 'image-decode-failed';
                    }
                    return null;
                  },
                  undefined,
                  { timeout: 10_000 },
                );
                outcome = (await result.jsonValue()) as string;
              } catch {
                outcome = 'no-terminal-state';
              }
            }
          }
        } catch {
          outcome =
            stage === 'ready-confirmation'
              ? 'ready-report-not-observed'
              : `setup-failed-at-${stage}`;
        } finally {
          const timeline = await page
            .evaluate(() => (window as DiagnosticWindow).__ci1347Events ?? [])
            .catch(() => []);
          const click = timeline.find((event) => event.kind === 'draw-click');
          const clickAt = click?.atMs ?? Number.POSITIVE_INFINITY;
          const afterClick = timeline.filter((event) => event.atMs >= clickAt);
          if (outcome === 'freeze-failed') {
            if (
              afterClick.some(
                (event) =>
                  event.marker === 'sandbox' &&
                  event.status === 'error' &&
                  event.sourceWindow === 'preview',
              )
            ) {
              outcome = 'sandbox-error-reply';
            } else if (
              afterClick.some(
                (event) =>
                  event.marker === 'sandbox' &&
                  event.status === 'screenshot' &&
                  event.sourceWindow !== 'preview',
              )
            ) {
              outcome = 'ignored-screenshot-reply';
            } else {
              outcome = 'snapshot-timeout';
            }
          } else if (
            outcome === 'snapshot-timeout' &&
            afterClick.some(
              (event) =>
                event.marker === 'sandbox' &&
                ['error', 'screenshot'].includes(event.status ?? '') &&
                event.sourceWindow !== 'preview',
            )
          ) {
            outcome = 'ignored-preview-reply';
          }

          const report = {
            baseSha: actualBaseSha,
            inkSpecSha: ACTUAL_INK_SPEC_SHA,
            p5FixtureMatchesInkSpec: P5_FIXTURE_MATCHES,
            variant,
            trial,
            outcome,
            handshakeOutcome: afterClick.some(
              (event) =>
                event.marker === 'sandbox' &&
                event.status === 'screenshot' &&
                event.sourceWindow === 'preview',
            )
              ? 'screenshot'
              : afterClick.some(
                    (event) =>
                      event.marker === 'sandbox' &&
                      event.status === 'error' &&
                      event.sourceWindow === 'preview',
                  )
                ? 'error-reply'
                : afterClick.some(
                      (event) =>
                        event.marker === 'sandbox' &&
                        event.status === 'screenshot' &&
                        event.sourceWindow === 'other',
                    )
                  ? 'ignored-other-window-screenshot'
                  : outcome === 'snapshot-timeout'
                    ? 'timeout'
                    : outcome === 'no-terminal-state'
                      ? 'no-terminal-state'
                      : 'not-observed',
            stage,
            timeline,
          };
          await testInfo.attach('sanitized-freeze-timeline.json', {
            body: Buffer.from(JSON.stringify(report)),
            contentType: 'application/json',
          });
          const resultDirectory =
            process.env.CI1347_RESULTS_DIR ?? path.join(os.tmpdir(), 'ci-1347-ink-freeze-results');
          appendFileSync(
            path.join(resultDirectory, 'trials.jsonl'),
            `${JSON.stringify(report)}\n`,
            { mode: 0o600 },
          );
          console.log(`CI1347_TRIAL ${JSON.stringify(report)}`);
        }
      });
    }
  }
});
