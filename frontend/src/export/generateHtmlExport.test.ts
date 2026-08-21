import { describe, expect, it } from 'vitest';

import type { SceneDocument } from '../api/projects';
import { MEDIAPIPE_TASKS_VISION_VERSION as PROVIDER_MEDIAPIPE_VERSION } from '../tracking/mediapipeProvider';
import {
  ATTRIBUTION_PRODUCT_NAME,
  ATTRIBUTION_PRODUCT_URL,
  EXPORT_TOOL_VERSION,
  checkExportBlockingReasons,
  generateHtmlExport,
  P5_CDN_URL,
  P5_VERSION,
  type GenerateHtmlExportInput,
} from './generateHtmlExport';
import {
  MEDIAPIPE_TASKS_VISION_VERSION,
  MEDIAPIPE_VISION_BUNDLE_CDN_URL,
} from './standaloneCameraSource';

const HOSTILE_SCRIPT_BREAKOUT = '</script><script>window.__pwned = (window.__pwned||0)+1;</script>';
const HOSTILE_CASE_VARIANT = '</ScRiPt><script>window.__pwned2=true;</script>';
const HOSTILE_COMMENT_TRICK = '<!--</script><script>window.__pwned3=true;</script>-->';
const HOSTILE_ATTR_BREAKOUT = `"><img src=x onerror="window.__pwned4=true">`;

function baseScene(overrides: Partial<SceneDocument> = {}): SceneDocument {
  return {
    schemaVersion: 1,
    id: 'scene-internal-id-999',
    canvas: { width: 800, height: 600, backgroundColor: '#ffffff' },
    renderer: { preferred: 'p5' },
    layers: [{ id: 'layer-1', name: 'Layer 1', order: 0, visible: true, locked: false }],
    shapes: [
      {
        id: 'shape-1',
        type: 'circle',
        layerId: 'layer-1',
        groupId: null,
        transform: { x: 100, y: 100, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 },
        style: { fill: '#ff0000', stroke: null, strokeWidth: 0 },
        radius: 40,
      },
    ],
    groups: [],
    bindings: [],
    graph: { nodes: [], connections: [] },
    accessibility: { reducedMotion: 'auto' },
    randomness: { seed: 0, enabled: false },
    ...overrides,
  };
}

function baseInput(overrides: Partial<GenerateHtmlExportInput> = {}): GenerateHtmlExportInput {
  return {
    scene: baseScene(),
    title: 'My Gesture Animation',
    description: 'A small reactive animation.',
    interactionMode: 'demo',
    ...overrides,
  };
}

function scriptElements(html: string): HTMLScriptElement[] {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return Array.from(doc.querySelectorAll('script'));
}

describe('generateHtmlExport: happy path', () => {
  it('produces ok:true for a valid, compatible demo-mode scene', () => {
    const result = generateHtmlExport(baseInput());
    expect(result.ok).toBe(true);
  });

  it('pins the exact documented p5.js version in the CDN script tag', () => {
    const result = generateHtmlExport(baseInput());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.html).toContain(P5_CDN_URL);
    expect(P5_CDN_URL).toContain(`p5@${P5_VERSION}`);
    expect(P5_VERSION).toBe('1.11.10');
  });

  it('contains no MediaPipe references at all in demo mode', () => {
    const result = generateHtmlExport(baseInput());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.html.toLowerCase()).not.toContain('mediapipe');
    expect(result.html).not.toContain('getUserMedia');
  });

  it('derives a filename from the project title', () => {
    const result = generateHtmlExport(baseInput({ title: 'My Cool Scene!! ' }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.filename).toBe('my-cool-scene.html');
  });
});

describe('generateHtmlExport: embedded runtime script validity', () => {
  it('embeds a syntactically valid runtime script', () => {
    const result = generateHtmlExport(baseInput());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const doc = new DOMParser().parseFromString(result.html, 'text/html');
    const scripts = Array.from(doc.querySelectorAll('script'));
    const runtimeScript = scripts.find(
      (s) => !s.id && !s.hasAttribute('src') && s.getAttribute('type') !== 'application/json',
    );
    expect(runtimeScript).toBeDefined();
    const source = runtimeScript?.textContent ?? '';
    expect(source.length).toBeGreaterThan(0);
    // Throws a SyntaxError if the generated source is malformed; never
    // actually invoked (no DOM/p5 sandbox here), just parsed.
    expect(() => new Function(source)).not.toThrow();
  });
});

describe('generateHtmlExport: title/description population', () => {
  it('sets document title, meta description, and a visible heading from current title/description', () => {
    const result = generateHtmlExport(
      baseInput({ title: 'Bouncing Circles', description: 'Circles that bounce with your hand.' }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const doc = new DOMParser().parseFromString(result.html, 'text/html');
    expect(doc.title).toBe('Bouncing Circles');
    expect(doc.querySelector('meta[name="description"]')?.getAttribute('content')).toBe(
      'Circles that bounce with your hand.',
    );
    const h1 = doc.querySelector('h1');
    expect(h1?.textContent).toBe('Bouncing Circles');
    expect(doc.getElementById('project-description')?.textContent).toBe(
      'Circles that bounce with your hand.',
    );
  });

  it('omits the description panel entirely when description is blank', () => {
    // Metadata gating upstream (ExportConfigDialog) normally prevents an
    // empty description reaching here, but this module should still
    // degrade safely rather than render an empty/misleading panel.
    const result = generateHtmlExport(baseInput({ description: '' }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const doc = new DOMParser().parseFromString(result.html, 'text/html');
    expect(doc.getElementById('project-description')).toBeNull();
  });

  it('HTML-escapes a hostile title so it cannot break out of <title>/<h1>', () => {
    const result = generateHtmlExport(baseInput({ title: HOSTILE_SCRIPT_BREAKOUT }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.html).not.toContain('<script>window.__pwned');

    const doc = new DOMParser().parseFromString(result.html, 'text/html');
    // The literal text survives (escaped), and produces no extra <script>.
    expect(doc.title).toBe(HOSTILE_SCRIPT_BREAKOUT);
    const scripts = scriptElements(result.html);
    expect(scripts.some((s) => (s.textContent ?? '').includes('__pwned ='))).toBe(false);
  });

  it('HTML-escapes a hostile description containing an attribute breakout', () => {
    const result = generateHtmlExport(baseInput({ description: HOSTILE_ATTR_BREAKOUT }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const doc = new DOMParser().parseFromString(result.html, 'text/html');
    const meta = doc.querySelector('meta[name="description"]');
    // The attribute must contain the literal text as *data*, not create a
    // new attribute/element boundary.
    expect(meta?.getAttribute('content')).toBe(HOSTILE_ATTR_BREAKOUT);
    expect(doc.querySelectorAll('img[onerror]')).toHaveLength(0);
  });
});

describe('generateHtmlExport: safe scene embedding (XSS prevention)', () => {
  const hostilePayloads = [
    HOSTILE_SCRIPT_BREAKOUT,
    HOSTILE_CASE_VARIANT,
    HOSTILE_COMMENT_TRICK,
    HOSTILE_ATTR_BREAKOUT,
    '</SCRIPT/ ><script>window.__pwned5=true;</script>',
    String.fromCharCode(0x2028) + '</script><script>window.__pwned6=true;</script>',
  ];

  for (const payload of hostilePayloads) {
    it(`neutralizes a hostile layer name (${JSON.stringify(payload).slice(0, 40)}...)`, () => {
      const scene = baseScene({
        layers: [{ id: 'layer-1', name: payload, order: 0, visible: true, locked: false }],
      });
      const result = generateHtmlExport(baseInput({ scene }));
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      // Parse the produced document exactly as a real browser would.
      const doc = new DOMParser().parseFromString(result.html, 'text/html');
      const scripts = Array.from(doc.querySelectorAll('script'));

      // Exactly the four expected scripts exist: the p5 CDN tag, the two
      // application/json data blocks, and the runtime script -- never a
      // fifth one an injection could have created.
      expect(scripts).toHaveLength(4);

      const sceneDataScript = doc.getElementById('scene-data');
      expect(sceneDataScript?.getAttribute('type')).toBe('application/json');

      // The payload must survive intact as *data*, recoverable via
      // JSON.parse, and never as live script that ran.
      const parsedScene = JSON.parse(sceneDataScript?.textContent ?? 'null');
      expect(parsedScene.layers[0].name).toBe(payload);

      // No executable script anywhere in the parsed document contains the
      // attacker's payload marker.
      for (const script of scripts) {
        const type = script.getAttribute('type');
        const isExecutable = type === null || type === '' || type === 'text/javascript';
        if (isExecutable) {
          expect(script.textContent ?? '').not.toContain('__pwned');
        }
      }
    });
  }

  it('never contains a literal "<" inside the embedded scene JSON script blocks', () => {
    const scene = baseScene({
      layers: [
        { id: 'layer-1', name: HOSTILE_SCRIPT_BREAKOUT, order: 0, visible: true, locked: false },
      ],
    });
    const result = generateHtmlExport(baseInput({ scene }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const doc = new DOMParser().parseFromString(result.html, 'text/html');
    const raw = result.html;
    const sceneScriptStart = raw.indexOf('id="scene-data"');
    const sceneScriptEnd = raw.indexOf('</script>', sceneScriptStart);
    const sceneScriptBody = raw.slice(raw.indexOf('>', sceneScriptStart) + 1, sceneScriptEnd);
    expect(sceneScriptBody).not.toContain('<');
    expect(doc.getElementById('scene-data')).not.toBeNull();
  });
});

describe('generateHtmlExport: internal data exclusion', () => {
  it('does not embed the scene document top-level id', () => {
    const scene = baseScene({ id: 'scene-internal-id-999' });
    const result = generateHtmlExport(baseInput({ scene }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.html).not.toContain('scene-internal-id-999');
  });

  it('embeds no field beyond the canonical scene schema vocabulary (no version/creator/prompt/history/draft/provenance keys)', () => {
    const result = generateHtmlExport(baseInput());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const doc = new DOMParser().parseFromString(result.html, 'text/html');
    const parsedScene = JSON.parse(doc.getElementById('scene-data')?.textContent ?? 'null');
    const forbiddenKeys = [
      'sequence',
      'origin',
      'change_label',
      'created_by',
      'parent',
      'fork_source_version',
      'created_at',
      'owner',
      'prompt',
      'ai_request_id',
      'draft',
      'fork_provenance',
    ];
    for (const key of forbiddenKeys) {
      expect(parsedScene).not.toHaveProperty(key);
    }
  });

  it('never renders the raw description/title anywhere outside the two designated, escaped locations plus the safe JSON scene-data block', () => {
    // Sanity check that config-only project fields aren't accidentally
    // dumped into the export config JSON.
    const result = generateHtmlExport(baseInput());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const doc = new DOMParser().parseFromString(result.html, 'text/html');
    const configScript = doc.getElementById('export-config');
    const parsedConfig = JSON.parse(configScript?.textContent ?? 'null');
    expect(parsedConfig).toEqual({ interactionMode: 'demo' });
  });
});

describe('generateHtmlExport: blocking on unsupported/invalid scenes', () => {
  it('blocks and names the exact unsupported shape type', () => {
    const scene = baseScene({
      shapes: [{ id: 'shape-1', type: 'notARealShape', layerId: 'layer-1' }],
    });
    const result = generateHtmlExport(baseInput({ scene }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reasons.some((r) => r.includes('notARealShape'))).toBe(true);
  });

  it('blocks and names the exact unsupported graph node type', () => {
    const scene = baseScene({
      graph: {
        nodes: [{ id: 'node-1', family: 'transform', type: 'notARealNodeType', params: {} }],
        connections: [],
      },
    });
    const result = generateHtmlExport(baseInput({ scene }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reasons.some((r) => r.includes('notARealNodeType'))).toBe(true);
  });

  it('blocks a structurally invalid scene via the buildScenePlan safety net (dangling layerId reference)', () => {
    const scene = baseScene({
      shapes: [
        {
          id: 'shape-1',
          type: 'circle',
          layerId: 'does-not-exist',
          groupId: null,
          transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 },
          style: { fill: '#ff0000', stroke: null, strokeWidth: 0 },
          radius: 40,
        },
      ],
    });
    const result = generateHtmlExport(baseInput({ scene }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reasons.some((r) => r.toLowerCase().includes('layerid'))).toBe(true);
  });

  it('blocks a scene missing required shape fields via the buildScenePlan safety net', () => {
    const scene = baseScene({
      shapes: [{ id: 'shape-1', type: 'circle', layerId: 'layer-1' }],
    });
    const result = generateHtmlExport(baseInput({ scene }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it('produces no download-worthy html at all when blocked', () => {
    const scene = baseScene({ shapes: [{ id: 's', type: 'bogus', layerId: 'layer-1' }] });
    const result = generateHtmlExport(baseInput({ scene }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect('html' in result).toBe(false);
  });

  it('checkExportBlockingReasons and generateHtmlExport agree on blocking', () => {
    const scene = baseScene({ shapes: [{ id: 's', type: 'bogus', layerId: 'layer-1' }] });
    const input = baseInput({ scene });
    const reasons = checkExportBlockingReasons(input);
    expect(reasons.length).toBeGreaterThan(0);
    const result = generateHtmlExport(input);
    expect(result.ok).toBe(false);
  });
});

describe('generateHtmlExport: camera-mode generation (Task 57, issue #56)', () => {
  it('generates a real, downloadable export for "camera" mode (no longer hard-blocked)', () => {
    const result = generateHtmlExport(baseInput({ interactionMode: 'camera' }));
    expect(result.ok).toBe(true);
  });

  it('generates a real, downloadable export for "demo-camera" mode', () => {
    const result = generateHtmlExport(baseInput({ interactionMode: 'demo-camera' }));
    expect(result.ok).toBe(true);
  });

  it('records the selected camera-inclusive interaction mode in the embedded config', () => {
    const result = generateHtmlExport(baseInput({ interactionMode: 'demo-camera' }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const doc = new DOMParser().parseFromString(result.html, 'text/html');
    const parsedConfig = JSON.parse(doc.getElementById('export-config')?.textContent ?? 'null');
    expect(parsedConfig).toEqual({ interactionMode: 'demo-camera' });
  });

  it("embeds the pinned MediaPipe CDN URL, matching mediapipeProvider.ts's exact pinned version", () => {
    expect(MEDIAPIPE_TASKS_VISION_VERSION).toBe(PROVIDER_MEDIAPIPE_VERSION);

    const cameraResult = generateHtmlExport(baseInput({ interactionMode: 'camera' }));
    expect(cameraResult.ok).toBe(true);
    if (!cameraResult.ok) return;
    expect(cameraResult.html).toContain(MEDIAPIPE_VISION_BUNDLE_CDN_URL);
    expect(cameraResult.html.toLowerCase()).toContain('mediapipe');

    const demoCameraResult = generateHtmlExport(baseInput({ interactionMode: 'demo-camera' }));
    expect(demoCameraResult.ok).toBe(true);
    if (!demoCameraResult.ok) return;
    expect(demoCameraResult.html).toContain(MEDIAPIPE_VISION_BUNDLE_CDN_URL);
  });

  it('still contains no MediaPipe reference at all for demo-only exports (regression check)', () => {
    const result = generateHtmlExport(baseInput({ interactionMode: 'demo' }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.html.toLowerCase()).not.toContain('mediapipe');
    expect(result.html).not.toContain('getUserMedia');
  });

  it('renders a dedicated camera-controls host for camera-inclusive modes only', () => {
    const cameraResult = generateHtmlExport(baseInput({ interactionMode: 'camera' }));
    expect(cameraResult.ok).toBe(true);
    if (!cameraResult.ok) return;
    const cameraDoc = new DOMParser().parseFromString(cameraResult.html, 'text/html');
    expect(cameraDoc.getElementById('camera-controls-host')).not.toBeNull();

    const demoResult = generateHtmlExport(baseInput({ interactionMode: 'demo' }));
    expect(demoResult.ok).toBe(true);
    if (!demoResult.ok) return;
    const demoDoc = new DOMParser().parseFromString(demoResult.html, 'text/html');
    expect(demoDoc.getElementById('camera-controls-host')).toBeNull();
  });

  it('keeps the demo controls host present and populated for every interaction mode, including camera-only', () => {
    (['demo', 'camera', 'demo-camera'] as const).forEach((interactionMode) => {
      const result = generateHtmlExport(baseInput({ interactionMode }));
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const doc = new DOMParser().parseFromString(result.html, 'text/html');
      const demoHost = doc.getElementById('demo-controls-host');
      expect(demoHost).not.toBeNull();
      // Statically-rendered demo heading/status paragraph always present --
      // never removed or hidden by interaction mode (issue #56's "demo
      // controls remain usable in every camera failure state").
      expect(demoHost?.querySelector('#demo-status')).not.toBeNull();
    });
  });

  it('embeds a syntactically valid camera runtime script', () => {
    const result = generateHtmlExport(baseInput({ interactionMode: 'demo-camera' }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const doc = new DOMParser().parseFromString(result.html, 'text/html');
    const scripts = Array.from(doc.querySelectorAll('script'));
    const inlineScripts = scripts.filter(
      (s) => !s.id && !s.hasAttribute('src') && s.getAttribute('type') !== 'application/json',
    );
    // The demo runtime script plus the camera script.
    expect(inlineScripts).toHaveLength(2);
    inlineScripts.forEach((s) => {
      const source = s.textContent ?? '';
      expect(source.length).toBeGreaterThan(0);
      expect(() => new Function(source)).not.toThrow();
    });
  });
});

/**
 * Task 60 (issue #60): optional product attribution.
 *
 * Covers every acceptance criterion: the off state is genuinely clean (no
 * visible branding, link, comment, or marker anywhere in the source, not
 * just "the product name string doesn't appear" -- the actual footer
 * element, comment text, and marker are all checked for absence), the on
 * state contains the exact documented footer/comment/marker, the footer
 * link is a real focusable `<a href>` with accessible text (checked via
 * DOM parsing, not string matching), the footer is positioned so it can't
 * overlap the canvas/controls, and toggling the flag changes *only*
 * attribution-related content in the rest of the document.
 */
describe('generateHtmlExport: optional product attribution (Task 60, issue #60)', () => {
  it('uses the Creatrweb product name for attribution', () => {
    expect(ATTRIBUTION_PRODUCT_NAME).toBe('Creatrweb Animation Studio');
  });

  it('includes zero attribution content -- visible text, comment, and marker -- when disabled or omitted', () => {
    const explicitlyOff = generateHtmlExport(baseInput({ includeAttribution: false }));
    const omitted = generateHtmlExport(baseInput());

    [explicitlyOff, omitted].forEach((result) => {
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const html = result.html;

      // No product name, link, or marker substrings anywhere in the source.
      expect(html).not.toContain(ATTRIBUTION_PRODUCT_NAME);
      expect(html).not.toContain(ATTRIBUTION_PRODUCT_URL);
      expect(html).not.toContain('export-tool-version');
      expect(html).not.toContain('export-attribution');
      expect(html.toLowerCase()).not.toContain('created with');

      // No footer element, no attribution id, anywhere in the parsed DOM
      // (rules out the element existing but hidden, styled off-screen,
      // etc. -- it must not be emitted at all).
      const doc = new DOMParser().parseFromString(html, 'text/html');
      expect(doc.querySelector('footer')).toBeNull();
      expect(doc.getElementById('export-attribution')).toBeNull();
      expect(doc.querySelectorAll('a').length).toBe(0);

      // No leftover HTML comments (the attribution comment and export
      // version marker are both HTML comments; jsdom's HTML parser does
      // create Comment nodes, so walk for them explicitly rather than
      // relying on innerHTML, which wouldn't include them either way).
      const walker = doc.createTreeWalker(doc, NodeFilter.SHOW_COMMENT);
      const comments: string[] = [];
      let node = walker.nextNode();
      while (node) {
        comments.push(node.textContent ?? '');
        node = walker.nextNode();
      }
      expect(comments).toHaveLength(0);
    });
  });

  it('includes the exact documented visible footer, matching HTML comment, and export version marker when enabled', () => {
    const result = generateHtmlExport(baseInput({ includeAttribution: true }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Exact HTML comment and export version marker text.
    expect(result.html).toContain(
      `<!-- Created with ${ATTRIBUTION_PRODUCT_NAME} (${ATTRIBUTION_PRODUCT_URL}) -->`,
    );
    expect(result.html).toContain(`<!-- export-tool-version: ${EXPORT_TOOL_VERSION} -->`);

    // Exact visible footer content, verified by DOM parsing rather than
    // string matching alone.
    const doc = new DOMParser().parseFromString(result.html, 'text/html');
    const footer = doc.getElementById('export-attribution');
    expect(footer).not.toBeNull();
    expect(footer?.tagName).toBe('FOOTER');
    expect(footer?.textContent).toContain('Created with');

    const link = footer?.querySelector('a');
    expect(link).not.toBeNull();
    expect(link?.tagName).toBe('A');
    expect(link?.getAttribute('href')).toBe(ATTRIBUTION_PRODUCT_URL);
    expect(link?.textContent?.trim()).toBe(ATTRIBUTION_PRODUCT_NAME);
  });

  it('renders the footer link as a real, keyboard-focusable <a href> with accessible text', () => {
    const result = generateHtmlExport(baseInput({ includeAttribution: true }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const doc = new DOMParser().parseFromString(result.html, 'text/html');
    const link = doc.querySelector('#export-attribution a');

    expect(link).not.toBeNull();
    // A real anchor with an href -- naturally tabbable, not a div/span
    // with a click handler and no href.
    expect(link?.tagName).toBe('A');
    expect(link?.hasAttribute('href')).toBe(true);
    expect((link?.getAttribute('href') ?? '').length).toBeGreaterThan(0);
    // Never pulled out of the tab order or hidden from assistive tech.
    expect(link?.getAttribute('tabindex')).not.toBe('-1');
    expect(link?.hasAttribute('aria-hidden')).toBe(false);
    // Meaningful accessible text -- not a bare icon/logo with no label.
    expect((link?.textContent ?? '').trim()).toBe(ATTRIBUTION_PRODUCT_NAME);
    expect((link?.textContent ?? '').trim().length).toBeGreaterThan(0);
    // Opens safely in a new context without leaking a window.opener
    // reference back to this document.
    expect(link?.getAttribute('rel')).toContain('noopener');
  });

  it('positions the footer after the canvas and every control section, never as an overlay', () => {
    const result = generateHtmlExport(
      baseInput({ includeAttribution: true, interactionMode: 'demo-camera' }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // The footer's own CSS rule never uses fixed/absolute positioning,
    // which is what would be needed to overlay it on top of other content.
    const styleMatch = result.html.match(/<style>([\s\S]*?)<\/style>/);
    expect(styleMatch).not.toBeNull();
    const footerRuleMatch = styleMatch?.[1].match(/#export-attribution\s*\{[^}]*\}/);
    expect(footerRuleMatch).not.toBeNull();
    expect(footerRuleMatch?.[0]).not.toMatch(/position:\s*(fixed|absolute)/);

    // Document order: the footer is the last element in <body>, after the
    // canvas host and every control section -- normal flow, so it can
    // never visually cover them.
    const doc = new DOMParser().parseFromString(result.html, 'text/html');
    const body = doc.body;
    const footer = doc.getElementById('export-attribution');
    const canvasHost = doc.getElementById('scene-canvas-host');
    const demoHost = doc.getElementById('demo-controls-host');
    const cameraHost = doc.getElementById('camera-controls-host');
    expect(footer).not.toBeNull();
    expect(canvasHost).not.toBeNull();
    expect(demoHost).not.toBeNull();
    expect(cameraHost).not.toBeNull();

    const children = Array.from(body.children);
    const footerIndex = children.indexOf(footer as Element);
    expect(footerIndex).toBeGreaterThan(children.indexOf(canvasHost as Element));
    expect(footerIndex).toBeGreaterThan(children.indexOf(demoHost as Element));
    expect(footerIndex).toBeGreaterThan(children.indexOf(cameraHost as Element));
  });

  it('changes only attribution-related content when toggled -- everything else is byte-for-byte identical modulo whitespace', () => {
    const sharedInput = {
      title: 'Bouncing Circles',
      description: 'Circles that bounce with your hand.',
      interactionMode: 'demo-camera' as const,
    };
    const onResult = generateHtmlExport(baseInput({ ...sharedInput, includeAttribution: true }));
    const offResult = generateHtmlExport(baseInput({ ...sharedInput, includeAttribution: false }));
    expect(onResult.ok).toBe(true);
    expect(offResult.ok).toBe(true);
    if (!onResult.ok || !offResult.ok) return;

    // Filename derivation never depends on attribution.
    expect(onResult.filename).toBe(offResult.filename);

    const normalizeWhitespace = (value: string) => value.replace(/\s+/g, ' ').trim();
    const stripAttributionArtifacts = (html: string) =>
      normalizeWhitespace(
        html
          .replace(/<!--[\s\S]*?-->/g, '')
          .replace(/<footer id="export-attribution">[\s\S]*?<\/footer>/g, '')
          .replace(/#export-attribution\s*\{[^}]*\}/g, ''),
      );

    expect(stripAttributionArtifacts(onResult.html)).toBe(normalizeWhitespace(offResult.html));
  });
});
