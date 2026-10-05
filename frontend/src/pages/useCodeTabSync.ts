import { useEffect, useRef, useState } from 'react';

import type { SceneDocument } from '../api/projects';
import {
  generateEditableCss,
  generateEditableHtml,
  generateEditableJs,
  isEditableJsUnchanged,
  parseEditableHtmlAndCss,
  parseEditableJs,
} from '../export/codeGrammar';

type Commit = (scene: SceneDocument) => void;

export interface HtmlCssCodeSync {
  htmlText: string;
  cssText: string;
  errors: string[] | null;
  externalChangePending: boolean;
  onHtmlChange: (value: string) => void;
  onCssChange: (value: string) => void;
  onSave: () => void;
  onReload: () => void;
}

export interface JsCodeSync {
  text: string;
  errors: string[] | null;
  externalChangePending: boolean;
  onChange: (value: string) => void;
  onSave: () => void;
  onReload: () => void;
}

export function useCodeTabSync(
  kind: 'html-css',
  workingCopy: SceneDocument | null,
  onCommit: Commit,
): HtmlCssCodeSync;
export function useCodeTabSync(
  kind: 'js',
  workingCopy: SceneDocument | null,
  onCommit: Commit,
): JsCodeSync;
export function useCodeTabSync(
  kind: 'html-css' | 'js',
  workingCopy: SceneDocument | null,
  onCommit: Commit,
): HtmlCssCodeSync | JsCodeSync {
  const [htmlText, setHtmlText] = useState(() => generateEditableHtml(workingCopy));
  const [cssText, setCssText] = useState(() => generateEditableCss(workingCopy));
  const [text, setText] = useState(() => generateEditableJs(workingCopy));
  const [errors, setErrors] = useState<string[] | null>(null);
  const [externalChangePending, setExternalChangePending] = useState(false);
  const htmlTextRef = useRef(htmlText);
  const cssTextRef = useRef(cssText);
  const textRef = useRef(text);
  const lastSyncedHtmlRef = useRef(htmlText);
  const lastSyncedCssRef = useRef(cssText);
  const lastSyncedTextRef = useRef(text);
  const lastSyncedWorkingCopyRef = useRef(workingCopy);

  useEffect(() => {
    if (workingCopy === lastSyncedWorkingCopyRef.current) return;
    lastSyncedWorkingCopyRef.current = workingCopy;
    const dirty =
      kind === 'html-css'
        ? htmlTextRef.current !== lastSyncedHtmlRef.current ||
          cssTextRef.current !== lastSyncedCssRef.current
        : textRef.current !== lastSyncedTextRef.current;
    if (dirty) {
      setExternalChangePending(true);
      return;
    }
    if (kind === 'html-css') {
      const nextHtml = generateEditableHtml(workingCopy);
      const nextCss = generateEditableCss(workingCopy);
      lastSyncedHtmlRef.current = nextHtml;
      lastSyncedCssRef.current = nextCss;
      htmlTextRef.current = nextHtml;
      cssTextRef.current = nextCss;
      setHtmlText(nextHtml);
      setCssText(nextCss);
    } else {
      const next = generateEditableJs(workingCopy);
      lastSyncedTextRef.current = next;
      textRef.current = next;
      setText(next);
    }
  }, [kind, workingCopy]);

  const onReload = () => {
    if (kind === 'html-css') {
      const nextHtml = generateEditableHtml(workingCopy);
      const nextCss = generateEditableCss(workingCopy);
      lastSyncedHtmlRef.current = nextHtml;
      lastSyncedCssRef.current = nextCss;
      htmlTextRef.current = nextHtml;
      cssTextRef.current = nextCss;
      setHtmlText(nextHtml);
      setCssText(nextCss);
    } else {
      const next = generateEditableJs(workingCopy);
      lastSyncedTextRef.current = next;
      textRef.current = next;
      setText(next);
    }
    lastSyncedWorkingCopyRef.current = workingCopy;
    setErrors(null);
    setExternalChangePending(false);
  };

  const onSave = () => {
    if (!workingCopy) return;
    if (kind === 'html-css') {
      const result = parseEditableHtmlAndCss(htmlTextRef.current, cssTextRef.current, workingCopy);
      if (!result.ok) {
        setErrors(result.errors);
        return;
      }
      onCommit(result.scene);
      const nextHtml = generateEditableHtml(result.scene);
      const nextCss = generateEditableCss(result.scene);
      lastSyncedHtmlRef.current = nextHtml;
      lastSyncedCssRef.current = nextCss;
      htmlTextRef.current = nextHtml;
      cssTextRef.current = nextCss;
      lastSyncedWorkingCopyRef.current = result.scene;
      setHtmlText(nextHtml);
      setCssText(nextCss);
    } else {
      if (isEditableJsUnchanged(textRef.current, workingCopy)) {
        setErrors(null);
        return;
      }
      const result = parseEditableJs(textRef.current, workingCopy);
      if (!result.ok) {
        setErrors(result.errors);
        return;
      }
      onCommit(result.scene);
      const next = generateEditableJs(result.scene);
      lastSyncedTextRef.current = next;
      textRef.current = next;
      lastSyncedWorkingCopyRef.current = result.scene;
      setText(next);
    }
    setErrors(null);
    setExternalChangePending(false);
  };

  if (kind === 'html-css') {
    return {
      htmlText,
      cssText,
      errors,
      externalChangePending,
      onHtmlChange: (value) => {
        htmlTextRef.current = value;
        setHtmlText(value);
      },
      onCssChange: (value) => {
        cssTextRef.current = value;
        setCssText(value);
      },
      onSave,
      onReload,
    };
  }
  return {
    text,
    errors,
    externalChangePending,
    onChange: (value) => {
      textRef.current = value;
      setText(value);
    },
    onSave,
    onReload,
  };
}
