import type { SceneDocument } from '../api/projects';
import { NO_SCENE_CHANGES_SUMMARY, summarizeSceneChange } from './draftAutosave';

export type LocalPublicUpdateDiff = {
  sceneSummary: string;
  mediaAdded: number;
  mediaRemoved: number;
  summary: string;
  changed: boolean;
};

export function collectMediaAssetIds(value: unknown, result = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    value.forEach((entry) => collectMediaAssetIds(entry, result));
  } else if (value && typeof value === 'object') {
    Object.entries(value).forEach(([key, child]) => {
      if (key === 'mediaAssetId' && typeof child === 'string') result.add(child);
      else collectMediaAssetIds(child, result);
    });
  }
  return result;
}

export function summarizeLocalPublicUpdate(
  before: SceneDocument | null,
  after: SceneDocument,
  beforeMediaIds: Iterable<string> = collectMediaAssetIds(before),
  afterMediaIds: Iterable<string> = collectMediaAssetIds(after),
): LocalPublicUpdateDiff {
  const beforeIds = new Set(beforeMediaIds);
  const afterIds = new Set(afterMediaIds);
  const mediaAdded = [...afterIds].filter((id) => !beforeIds.has(id)).length;
  const mediaRemoved = [...beforeIds].filter((id) => !afterIds.has(id)).length;
  const sceneSummary = summarizeSceneChange(before, after);
  const parts = sceneSummary === NO_SCENE_CHANGES_SUMMARY ? [] : [sceneSummary];
  if (mediaAdded) parts.push(`${mediaAdded} media asset${mediaAdded === 1 ? '' : 's'} added`);
  if (mediaRemoved)
    parts.push(`${mediaRemoved} media asset${mediaRemoved === 1 ? '' : 's'} removed`);
  const changed = parts.length > 0;
  return {
    sceneSummary:
      changed && sceneSummary !== NO_SCENE_CHANGES_SUMMARY ? sceneSummary : 'No scene changes',
    mediaAdded,
    mediaRemoved,
    summary: changed ? parts.join('; ') : NO_SCENE_CHANGES_SUMMARY,
    changed,
  };
}
