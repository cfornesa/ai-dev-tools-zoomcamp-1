import { expect, type Page } from '@playwright/test';

/** Install a browser-level probe before a route creates its AudioContext. */
export async function installAudioFlowProbe(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const OriginalAudioContext = window.AudioContext;
    if (!OriginalAudioContext) return;
    const probe = { sourceCreated: 0, sourceConnected: 0 };
    Object.defineProperty(window, '__audioFlowProbe', { configurable: true, value: probe });
    class ProbedAudioContext extends OriginalAudioContext {
      override createMediaStreamSource(stream: MediaStream): MediaStreamAudioSourceNode {
        const source = super.createMediaStreamSource(stream);
        probe.sourceCreated += 1;
        const connect = source.connect.bind(source) as (
          destination: AudioNode,
          output?: number,
          input?: number,
        ) => AudioNode;
        source.connect = ((destination: AudioNode, output?: number, input?: number) => {
          probe.sourceConnected += 1;
          return connect(destination, output, input);
        }) as typeof source.connect;
        return source;
      }
    }
    window.AudioContext = ProbedAudioContext;
  });
}

/** Assert a real MediaStreamAudioSourceNode connection, not only UI status. */
export async function expectMicrophoneAudioFlow(page: Page): Promise<void> {
  await expect
    .poll(() =>
      page.evaluate(() => {
        const probe = (window as typeof window & { __audioFlowProbe?: { sourceConnected: number } })
          .__audioFlowProbe;
        return probe?.sourceConnected ?? 0;
      }),
    )
    .toBeGreaterThan(0);
}
