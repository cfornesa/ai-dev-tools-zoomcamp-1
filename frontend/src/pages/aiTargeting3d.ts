import type { AITargetOption } from './aiTargeting';
import { light3DLabel, object3DLabel, type Group3D, type Scene3DDocument } from './scene3dTypes';

function descendantsOf(groupId: string, groups: Group3D[], objects: Scene3DDocument['objects']) {
  if (!groups.some((group) => group.id === groupId)) return [groupId];
  return [
    groupId,
    ...objects.filter((object) => object.groupId === groupId).map((object) => object.id),
  ];
}

export function build3DAITargetOptions(scene: Scene3DDocument): AITargetOption[] {
  const options: AITargetOption[] = [];
  const groups = Array.isArray(scene.groups) ? scene.groups : [];
  const objects = Array.isArray(scene.objects) ? scene.objects : [];
  const lights = Array.isArray(scene.lights) ? scene.lights : [];

  objects.forEach((object) => {
    const lockedGroup = object.groupId
      ? groups.some((group) => group.id === object.groupId && group.locked)
      : false;
    options.push({
      id: object.id,
      label: object3DLabel(object, objects),
      type: 'object',
      category: 'Objects',
      disabled: lockedGroup,
      disabledReason: lockedGroup ? 'Locked group' : undefined,
      descendantIds: [object.id],
    });
  });

  groups.forEach((group) => {
    options.push({
      id: group.id,
      label: group.name,
      type: 'group',
      category: 'Groups',
      disabled: group.locked,
      disabledReason: group.locked ? 'Locked' : undefined,
      descendantIds: descendantsOf(group.id, groups, objects),
    });
  });

  lights.forEach((light) => {
    options.push({
      id: light.id,
      label: light3DLabel(light, lights),
      type: 'light',
      category: 'Lights and camera',
      descendantIds: [light.id],
    });
  });
  options.push({
    id: 'camera',
    label: 'Main camera',
    type: 'camera',
    category: 'Lights and camera',
    descendantIds: ['camera'],
  });

  objects.forEach((object) => {
    options.push({
      id: `material:${object.id}`,
      label: `Material of ${object3DLabel(object, objects)}`,
      type: 'material',
      category: 'Materials',
      descendantIds: [object.id],
    });
  });

  const assets =
    (scene as Scene3DDocument & { mediaAssets?: unknown[]; assets?: unknown[] }).mediaAssets ??
    (scene as Scene3DDocument & { assets?: unknown[] }).assets ??
    [];
  if (Array.isArray(assets)) {
    assets.forEach((asset) => {
      if (!asset || typeof asset !== 'object') return;
      const value = asset as { id?: unknown; name?: unknown; filename?: unknown };
      if (typeof value.id !== 'string') return;
      options.push({
        id: value.id,
        label: String(value.name ?? value.filename ?? value.id),
        type: 'media',
        category: 'Assets',
        descendantIds: [value.id],
      });
    });
  }
  return options;
}
