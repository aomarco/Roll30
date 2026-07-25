// Pure camera helpers for the map viewport (pan + zoom). No DOM.
// The camera is { x, y, zoom }: x/y are the on-screen pixel offset of the
// world layer's top-left corner (transform-origin 0 0), zoom is the scale.

export const MIN_ZOOM = 0.35;
export const MAX_ZOOM = 3;

export const clampZoom = (zoom) =>
  Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number(zoom) || 1));

/**
 * Zoom while keeping the world point currently under `point` fixed on screen.
 * `point` is in viewport-local pixels (clientX - viewportRect.left, etc.).
 * Screen position of a world point p is: pan + p * zoom. Holding that screen
 * position constant across the zoom change gives the new pan below.
 */
export function zoomToPoint(camera, point, nextZoom) {
  const zoom = clampZoom(nextZoom);
  const ratio = zoom / camera.zoom;
  return {
    x: point.x - (point.x - camera.x) * ratio,
    y: point.y - (point.y - camera.y) * ratio,
    zoom,
  };
}

export const MIN_MAP_SCALE = 0.2;
export const MAX_MAP_SCALE = 5;

/** Clamp an independent map-image scale (separate from the camera zoom). */
export const clampMapScale = (scale) => {
  const n = Number(scale);
  if (!Number.isFinite(n)) return 1;
  return Math.min(MAX_MAP_SCALE, Math.max(MIN_MAP_SCALE, n));
};

export const DEFAULT_MAP_VIEW = { scale: 1, x: 0, y: 0 };

export const panBy = (camera, dx, dy) => ({
  ...camera,
  x: camera.x + dx,
  y: camera.y + dy,
});

export const DEFAULT_CAMERA = { x: 0, y: 0, zoom: 1 };
