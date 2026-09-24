import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import {
  AFRAME_EDITOR_BRIDGE_SCRIPT,
  cameraFromReport,
  parseReportedCamera,
} from './aframeEditorBridge';

describe('A-Frame editor bridge (#796)', () => {
  it('the injected script is syntactically valid and only posts the two bridge messages', () => {
    const body = AFRAME_EDITOR_BRIDGE_SCRIPT.replace(/^<script>/, '').replace(/<\/script>$/, '');
    expect(() => new Function(body)).not.toThrow();
    expect(body).toContain("'scene3d-camera'");
    expect(body).toContain("'scene3d-click'");
    expect(body).not.toContain('eval(');
  });

  it('rejects malformed camera reports', () => {
    expect(parseReportedCamera(null)).toBeNull();
    expect(parseReportedCamera({ status: 'other' })).toBeNull();
    expect(
      parseReportedCamera({
        status: 'scene3d-camera',
        matrix: [1, 2],
        fov: 50,
        width: 1,
        height: 1,
      }),
    ).toBeNull();
    const nan = Array.from({ length: 16 }, () => 0);
    nan[3] = Number.NaN;
    expect(
      parseReportedCamera({
        status: 'scene3d-camera',
        matrix: nan,
        fov: 50,
        width: 10,
        height: 10,
      }),
    ).toBeNull();
    expect(
      parseReportedCamera({
        status: 'scene3d-camera',
        matrix: Array(16).fill(0),
        fov: 50,
        width: 0,
        height: 10,
      }),
    ).toBeNull();
  });

  it('rebuilds a Three.js camera at the reported pose', () => {
    const source = new THREE.PerspectiveCamera(50, 800 / 600, 0.1, 1000);
    source.position.set(1, 2, 8);
    source.lookAt(0, 0, 0);
    source.updateMatrixWorld(true);
    const report = parseReportedCamera({
      status: 'scene3d-camera',
      matrix: source.matrixWorld.toArray(),
      fov: 50,
      width: 800,
      height: 600,
    })!;
    const camera = cameraFromReport(report);
    expect(camera.position.x).toBeCloseTo(1, 5);
    expect(camera.position.y).toBeCloseTo(2, 5);
    expect(camera.position.z).toBeCloseTo(8, 5);
    const target = new THREE.Vector3(0, 0, 0).project(camera);
    expect(target.x).toBeCloseTo(0, 5);
    expect(target.y).toBeCloseTo(0, 5);
    expect(camera.aspect).toBeCloseTo(800 / 600, 5);
  });
});
