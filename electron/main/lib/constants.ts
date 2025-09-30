// Contains constants and static configurations for the main process.

import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// --- Paths ---
process.env.APP_ROOT = path.join(__dirname, '..', '..', '..');
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL'];
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron');
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist');
export const VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST;
process.env.VITE_PUBLIC= VITE_PUBLIC

// --- Recording ---
export const MOUSE_RECORDING_FPS = 100;
export const EXCLUDED_WINDOW_NAMES = ['Screen Awesome'];

// --- Placeholders ---
export const GRAY_PLACEHOLDER_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mN88A8AAsUB4/Yo4OQAAAAASUVORK5CYII=';

// --- Export ---
export type ResolutionKey = '720p' | '1080p' | '2k';
export const RESOLUTIONS: Record<ResolutionKey, { width: number; height: number }> = {
  '720p': { width: 1280, height: 720 },
  '1080p': { width: 1920, height: 1080 },
  '2k': { width: 2560, height: 1440 },
};