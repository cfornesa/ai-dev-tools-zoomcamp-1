export type VisitorPoint = { x: number; y: number };

export type VisitorTool = 'pencil' | 'brush' | 'eraser';

export type VisitorStroke = {
  points: VisitorPoint[];
  tool: VisitorTool;
  size: number;
  color: string;
};

export function visitorStrokeIntersects(
  stroke: VisitorStroke,
  point: VisitorPoint,
  radius: number,
): boolean {
  for (let index = 0; index < stroke.points.length; index += 1) {
    const start = stroke.points[index];
    const end = stroke.points[index + 1] ?? start;
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSquared = dx * dx + dy * dy;
    const projection =
      lengthSquared === 0
        ? 0
        : Math.max(
            0,
            Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared),
          );
    const closestX = start.x + projection * dx;
    const closestY = start.y + projection * dy;
    if (Math.hypot(point.x - closestX, point.y - closestY) <= radius) return true;
  }
  return false;
}
