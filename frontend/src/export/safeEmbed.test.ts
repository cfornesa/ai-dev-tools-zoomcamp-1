import { describe, expect, it } from 'vitest';

import { embedJsonScript, escapeHtml, safeJsonForScriptTag } from './safeEmbed';

describe('escapeHtml', () => {
  it('escapes all five HTML-significant characters', () => {
    expect(escapeHtml(`&<>"'`)).toBe('&amp;&lt;&gt;&quot;&#39;');
  });

  it('neutralizes a script-tag breakout attempt', () => {
    const hostile = '</script><script>alert(1)</script>';
    const escaped = escapeHtml(hostile);
    expect(escaped).not.toContain('<script>');
    expect(escaped).not.toContain('</script>');
    expect(escaped).toBe('&lt;/script&gt;&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('neutralizes an attribute-breakout attempt', () => {
    const hostile = `"><img src=x onerror=alert(1)>`;
    const escaped = escapeHtml(hostile);
    expect(escaped).not.toContain('"');
    expect(escaped).not.toContain('<img');
  });

  it('passes ordinary text through unchanged', () => {
    expect(escapeHtml('My cool animation')).toBe('My cool animation');
  });
});

describe('safeJsonForScriptTag', () => {
  it('never contains a literal "<" character for any input', () => {
    const hostiles = [
      '</script><script>alert(1)</script>',
      '</SCRIPT><script>alert(1)</script>',
      '</ScRiPt >',
      '<!--<script>alert(1)</script>-->',
      '<style>body{display:none}</style>',
      String.fromCharCode(0x2028) + '</script>',
    ];
    for (const hostile of hostiles) {
      const result = safeJsonForScriptTag({ label: hostile });
      expect(result).not.toContain('<');
    }
  });

  it('round-trips through JSON.parse to the original value', () => {
    const data = { title: '</script><script>alert(1)</script>', n: 42, nested: { ok: true } };
    const serialized = safeJsonForScriptTag(data);
    expect(JSON.parse(serialized)).toEqual(data);
  });

  it('escapes U+2028/U+2029 line/paragraph separators', () => {
    const data = { text: `line1${String.fromCharCode(0x2028)}line2${String.fromCharCode(0x2029)}` };
    const serialized = safeJsonForScriptTag(data);
    expect(serialized).not.toContain(String.fromCharCode(0x2028));
    expect(serialized).not.toContain(String.fromCharCode(0x2029));
    expect(JSON.parse(serialized)).toEqual(data);
  });
});

describe('embedJsonScript', () => {
  it('produces a script tag whose content, when read via textContent-equivalent parsing, contains no live <script> break', () => {
    const hostile = '</script><script>window.__pwned = true;</script>';
    const html = embedJsonScript('scene-data', { name: hostile });

    // A DOM parse of the full document is the strongest test: if the
    // payload could break out of its <script type="application/json">
    // element, DOMParser would produce a *second* real <script> element
    // in the document (or the content would visibly split across
    // elements). Assert neither happens.
    const doc = new DOMParser().parseFromString(
      `<!doctype html><html><body>${html}</body></html>`,
      'text/html',
    );
    const scripts = doc.querySelectorAll('script');
    expect(scripts.length).toBe(1);
    expect(scripts[0].getAttribute('type')).toBe('application/json');
    expect(scripts[0].id).toBe('scene-data');

    const parsed = JSON.parse(scripts[0].textContent ?? '');
    expect(parsed).toEqual({ name: hostile });

    // No executable script node of any kind exists anywhere in the parsed
    // document beyond the one, inert, application/json block.
    const executableScripts = Array.from(scripts).filter((s) => {
      const type = s.getAttribute('type');
      return type === null || type === '' || type === 'text/javascript' || type === 'module';
    });
    expect(executableScripts).toHaveLength(0);
  });

  it('escapes a hostile id argument too', () => {
    const html = embedJsonScript('"><script>alert(1)</script>', {});
    expect(html).not.toContain('"><script>');
  });
});
