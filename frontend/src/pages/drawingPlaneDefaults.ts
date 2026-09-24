import rawLimits from '../../../schema/limits3d.json';

/** #781: the documented resolution of a new drawing plane's drawing surface (4:3, like its default 4 x 3 plane). */
export const DRAWING_PLANE_RESOLUTION = { width: 1024, height: 768 } as const;

/** The shared scene3d limits a drawing plane's ink must respect (schema/limits3d.json). */
export const DRAWING_PLANE_MAX_SHAPES: number = rawLimits.maxDrawingShapesPerPlane;
export const DRAWING_PLANE_MAX_POINTS: number = rawLimits.maxDrawingPointsPerPath;
