/** Safe renderer for the versioned draw.io subset in scene.schema.json.
 * It intentionally knows only the finite object types accepted by the
 * schema; no XML, HTML, URLs, plugins, or mxGraph attributes are interpreted.
 */
import type { SceneDocument } from '../api/projects';
import { validateScene } from '../validation/scene';
import type {
  RenderableCameraOverlay,
  RenderableParticle,
  RenderableTrail,
  ScenePreview,
} from './scenePreview';
import { SceneRenderError } from './sceneDrawPlan';

type DrawioLayer = { id: string; visible: boolean; locked: boolean; order: number };
type DrawioObject = {
  id: string;
  type: 'rect' | 'ellipse' | 'line' | 'text';
  layerId: string;
  parentId: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  text?: string;
  fill?: string | null;
  stroke?: string | null;
};

function readDrawio(scene: SceneDocument): { layers: DrawioLayer[]; objects: DrawioObject[] } {
  const document = scene.drawio;
  if (!document || typeof document !== 'object')
    throw new SceneRenderError('Missing draw.io document.');
  const value = document as { layers?: unknown; objects?: unknown };
  if (!Array.isArray(value.layers) || !Array.isArray(value.objects)) {
    throw new SceneRenderError('Invalid draw.io document.');
  }
  return { layers: value.layers as DrawioLayer[], objects: value.objects as DrawioObject[] };
}

function paint(ctx: CanvasRenderingContext2D, object: DrawioObject): void {
  ctx.save();
  ctx.translate(object.x + object.width / 2, object.y + object.height / 2);
  ctx.rotate(((object.rotation ?? 0) * Math.PI) / 180);
  const x = -object.width / 2;
  const y = -object.height / 2;
  if (object.fill) {
    ctx.fillStyle = object.fill;
    if (object.type === 'ellipse') {
      ctx.beginPath();
      ctx.ellipse(0, 0, object.width / 2, object.height / 2, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (object.type === 'rect') {
      ctx.fillRect(x, y, object.width, object.height);
    }
  }
  if (object.stroke) {
    ctx.strokeStyle = object.stroke;
    ctx.lineWidth = 1;
    if (object.type === 'ellipse') {
      ctx.beginPath();
      ctx.ellipse(0, 0, object.width / 2, object.height / 2, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (object.type === 'rect') {
      ctx.strokeRect(x, y, object.width, object.height);
    } else if (object.type === 'line') {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + object.width, y + object.height);
      ctx.stroke();
    }
  }
  if (object.type === 'text' && object.text) {
    ctx.fillStyle = object.fill ?? '#111111';
    ctx.font = '16px sans-serif';
    ctx.fillText(object.text, x, y + Math.max(16, object.height));
  }
  ctx.restore();
}

export function createDrawioScenePreview(container: HTMLElement): ScenePreview {
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-label', 'Draw.io scene preview');
  container.replaceChildren(canvas);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new SceneRenderError('Canvas 2D is unavailable.');

  return {
    render(
      scene,
      _particles?: readonly RenderableParticle[],
      _trails?: readonly RenderableTrail[],
      transparentBackground = false,
      _cameraOverlay?: RenderableCameraOverlay,
    ) {
      const validation = validateScene(scene);
      if (!validation.valid || scene.documentType !== 'drawio') {
        throw new SceneRenderError(
          validation.errors[0]?.message ?? 'Scene is not a valid supported draw.io document.',
        );
      }
      const { layers, objects } = readDrawio(scene);
      const canvasConfig = (scene.canvas ?? {}) as {
        width?: number;
        height?: number;
        backgroundColor?: string;
      };
      canvas.width = canvasConfig.width ?? 800;
      canvas.height = canvasConfig.height ?? 600;
      if (transparentBackground) ctx.clearRect(0, 0, canvas.width, canvas.height);
      else {
        ctx.fillStyle = canvasConfig.backgroundColor ?? '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      const visible = new Set(layers.filter((layer) => layer.visible).map((layer) => layer.id));
      const layerOrder = new Map(layers.map((layer) => [layer.id, layer.order]));
      [...objects]
        .filter((object) => visible.has(object.layerId))
        .sort((a, b) => (layerOrder.get(b.layerId) ?? 0) - (layerOrder.get(a.layerId) ?? 0))
        .forEach((object) => paint(ctx, object));
    },
    destroy() {
      canvas.remove();
    },
    getCanvasElement() {
      return canvas;
    },
  };
}
