import { AvatarCrop } from "./types";

export const MAX_ZOOM = 4;

export const defaultCrop = (aspect: number): AvatarCrop => ({ x: 0.5, y: 0.5, zoom: 1, aspect: aspect > 0 ? aspect : 1 });

/** Keep the photo covering the whole frame: you can't drag it so far that an empty edge shows. */
export function clampCrop(c: AvatarCrop): AvatarCrop {
  const a = c.aspect > 0 ? c.aspect : 1;
  const zoom = Math.min(MAX_ZOOM, Math.max(1, c.zoom));
  // the share of the photo's width / height that is visible inside the frame
  const visX = (a >= 1 ? 1 / a : 1) / zoom;
  const visY = (a >= 1 ? 1 : a) / zoom;
  const hx = visX / 2;
  const hy = visY / 2;
  return { aspect: a, zoom, x: Math.min(1 - hx, Math.max(hx, c.x)), y: Math.min(1 - hy, Math.max(hy, c.y)) };
}

/** Where to draw the photo (size in px, frame = size × size). The photo is never stretched: width / height = aspect. */
export function cropLayout(size: number, crop: AvatarCrop) {
  const c = clampCrop(crop);
  const baseW = c.aspect >= 1 ? size * c.aspect : size;
  const baseH = c.aspect >= 1 ? size : size / c.aspect;
  const width = baseW * c.zoom;
  const height = baseH * c.zoom;
  return { width, height, left: size / 2 - c.x * width, top: size / 2 - c.y * height };
}

/** The photo follows the finger: dragging right shows more of the left side of the photo. */
export function dragCrop(c: AvatarCrop, dx: number, dy: number, size: number): AvatarCrop {
  const { width, height } = cropLayout(size, c);
  return clampCrop({ ...c, x: c.x - dx / width, y: c.y - dy / height });
}

export const zoomCrop = (c: AvatarCrop, zoom: number): AvatarCrop => clampCrop({ ...c, zoom });
export const recenter = (c: AvatarCrop): AvatarCrop => clampCrop({ ...c, x: 0.5, y: 0.5, zoom: 1 });
/** Faces in portraits are usually in the upper part of the picture. */
export const faceHigh = (c: AvatarCrop): AvatarCrop => clampCrop({ ...c, x: 0.5, y: 0.33 });
