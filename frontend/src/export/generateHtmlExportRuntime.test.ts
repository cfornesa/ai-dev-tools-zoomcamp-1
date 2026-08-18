/**
 * Task 56 (issue #57): a functional smoke test that actually *runs* the
 * exported HTML's embedded runtime script in a jsdom sandbox (not just
 * inspects it as a string), with a minimal fake `p5` global standing in
 * for the real CDN library. This exercises the real code path a browser
 * would run: parsing the safely-embedded `<script type="application/
 * json">` scene data back out via `JSON.parse(...textContent)`,
 * evaluating `scene.bindings` against demo signals, and drawing through
 * the fake p5 instance -- giving much stronger confidence than static
 * string assertions that nothing in the safe-embedding path silently
 * breaks the runtime it's meant to feed.
 */
import { describe, expect, it } from 'vitest';

import type { SceneDocument } from '../api/projects';
import { generateHtmlExport } from './generateHtmlExport';

function sceneWithFollowHandBinding(): SceneDocument {
  return {
    schemaVersion: 1,
    id: 'scene-1',
    canvas: { width: 800, height: 600, backgroundColor: '#ffffff' },
    renderer: { preferred: 'p5' },
    layers: [{ id: 'layer-1', name: 'Layer 1', order: 0, visible: true, locked: false }],
    shapes: [
      {
        id: 'shape-1',
        type: 'circle',
        layerId: 'layer-1',
        groupId: null,
        transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 },
        style: { fill: '#ff0000', stroke: null, strokeWidth: 0 },
        radius: 40,
      },
    ],
    groups: [],
    bindings: [
      {
        id: 'binding-follow-x',
        signal: 'indexTipX',
        handTarget: 'primary',
        targetScope: 'shape',
        targetId: 'shape-1',
        targetProperty: 'positionX',
        composition: 'replace',
        mapping: { inMin: 0, inMax: 1, outMin: 0, outMax: 800 },
      },
    ],
    graph: { nodes: [], connections: [] },
    accessibility: { reducedMotion: 'off' },
    randomness: { seed: 0, enabled: false },
  };
}

/** Minimal fake p5 constructor: runs `setup` once, records every
 * `circle(x, y, ...)` call so the test can assert the shape's on-screen
 * position tracked the bound signal, and exposes itself (plus a
 * controllable clock) on `window` so the test can trigger further `draw`
 * calls on demand after changing demo-control state -- standing in for a
 * real browser's ongoing animation-frame loop. Only the handful of p5 API
 * surface this export's runtime script actually calls is implemented. */
function installFakeP5(recordedCircles: Array<{ x: number; y: number }>) {
  const clock = { millis: 0 };
  class FakeP5 {
    setup?: () => void;
    draw?: () => void;
    private offsetStack: Array<{ x: number; y: number }> = [{ x: 0, y: 0 }];
    constructor(sketch: (p: FakeP5) => void) {
      sketch(this);
      this.createCanvas();
      if (this.setup) this.setup();
      if (this.draw) this.draw();
      (window as unknown as { __fakeP5Instance: FakeP5 }).__fakeP5Instance = this;
    }
    createCanvas() {
      return { parent: () => {} };
    }
    pixelDensity() {}
    noSmooth() {}
    frameRate() {}
    millis() {
      return clock.millis;
    }
    push() {
      const top = this.offsetStack[this.offsetStack.length - 1];
      this.offsetStack.push({ ...top });
    }
    pop() {
      this.offsetStack.pop();
    }
    translate(dx: number, dy: number) {
      const top = this.offsetStack[this.offsetStack.length - 1];
      top.x += dx;
      top.y += dy;
    }
    rotate() {}
    radians(deg: number) {
      return (deg * Math.PI) / 180;
    }
    scale() {}
    noFill() {}
    fill() {}
    noStroke() {}
    stroke() {}
    strokeWeight() {}
    background() {}
    circle(x: number, y: number) {
      const top = this.offsetStack[this.offsetStack.length - 1];
      recordedCircles.push({ x: top.x + x, y: top.y + y });
    }
    rect() {}
    line() {}
    beginShape() {}
    vertex() {}
    endShape() {}
    randomSeed() {}
    noiseSeed() {}
    isLooping() {
      return true;
    }
    loop() {}
    noLoop() {}
    CLOSE = 'close';
  }
  (window as unknown as { p5: unknown }).p5 = FakeP5;
  return clock;
}

describe('exported runtime script: functional smoke test in a jsdom sandbox', () => {
  it('parses the safely-embedded scene data and evaluates a binding to move the shape', () => {
    const result = generateHtmlExport({
      scene: sceneWithFollowHandBinding(),
      title: 'Runtime Smoke Test',
      description: 'Exercises the embedded runtime end to end.',
      interactionMode: 'demo',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const doc = new DOMParser().parseFromString(result.html, 'text/html');

    // Rehydrate the produced document's relevant nodes into the live
    // jsdom `document` this test runs in, exactly as a browser would end
    // up with them after loading the file.
    document.body.innerHTML = '';
    document.title = doc.title;
    Array.from(doc.body.children).forEach((node) => {
      if (node.tagName.toLowerCase() !== 'script') {
        document.body.appendChild(node.cloneNode(true));
      }
    });
    const sceneDataScript = doc.getElementById('scene-data');
    const configScript = doc.getElementById('export-config');
    expect(sceneDataScript).not.toBeNull();
    expect(configScript).not.toBeNull();
    const sceneScriptEl = document.createElement('script');
    sceneScriptEl.type = 'application/json';
    sceneScriptEl.id = 'scene-data';
    sceneScriptEl.textContent = sceneDataScript?.textContent ?? '';
    document.body.appendChild(sceneScriptEl);
    const configScriptEl = document.createElement('script');
    configScriptEl.type = 'application/json';
    configScriptEl.id = 'export-config';
    configScriptEl.textContent = configScript?.textContent ?? '';
    document.body.appendChild(configScriptEl);

    const recordedCircles: Array<{ x: number; y: number }> = [];
    const clock = installFakeP5(recordedCircles);

    const runtimeScripts = Array.from(doc.querySelectorAll('script')).filter(
      (s) => !s.id && !s.hasAttribute('src'),
    );
    expect(runtimeScripts).toHaveLength(1);
    const runtimeSource = runtimeScripts[0].textContent ?? '';

    // Execute the exact runtime source the exported file would run,
    // inside this jsdom document.
    // eslint-disable-next-line no-eval
    (0, eval)(runtimeSource);

    // The runtime registers its wiring on DOMContentLoaded; jsdom's
    // document is already "loaded" by the time we attach this listener,
    // so dispatch it explicitly, matching how a real browser fires it
    // once during initial page load.
    document.dispatchEvent(new Event('DOMContentLoaded'));

    // Manually drive the demo signal that the binding above reacts to:
    // find the rendered "Index fingertip X" slider and move it, then
    // simulate the DOMContentLoaded handler's own fake-p5-driven draw
    // loop having already run via the FakeP5 constructor above.
    const slider = document.getElementById('slider-indexTipX') as HTMLInputElement | null;
    expect(slider).not.toBeNull();

    // A hand must be present for a continuous signal to be non-null (see
    // the runtime's `currentSignals()`), so press "Hand present" first.
    const presentButton = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent === 'Hand present',
    );
    expect(presentButton).toBeDefined();
    presentButton?.dispatchEvent(new Event('click', { bubbles: true }));

    if (slider) {
      slider.value = '1';
      slider.dispatchEvent(new Event('input', { bubbles: true }));
    }

    // Advance the fake clock and manually trigger another draw, standing
    // in for the next real animation frame -- the same p5 instance and
    // demo controller created by the single DOMContentLoaded dispatch
    // above, now observing the updated slider value.
    const lengthBefore = recordedCircles.length;
    clock.millis += 16;
    const instance = (window as unknown as { __fakeP5Instance: { draw?: () => void } })
      .__fakeP5Instance;
    instance.draw?.();

    expect(recordedCircles.length).toBeGreaterThan(lengthBefore);
    // With indexTipX = 1 mapped to [0, 800] and no smoothing configured,
    // the circle's drawn x should have moved toward 800 (not sitting at
    // the scene's authored transform.x = 0).
    const last = recordedCircles[recordedCircles.length - 1];
    expect(last.x).toBeGreaterThan(0);
  });
});
