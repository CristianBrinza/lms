export const BRAND_FIELD: string;
export const TILE_RADIUS: number;
export const SPLASH_TILE: { width: number; maxWidth: number };
export const SPLASH_SCREENS: Array<{ w: number; h: number; dpr: number }>;
export function splashFileName(screen: { w: number; h: number; dpr: number }): string;
export function splashLinkTags(): string;
export function splashTileSize(screenWidth: number): number;
export function generateBrandAssets(options?: { force?: boolean; log?: (message: string) => void }): Promise<{ skipped: boolean }>;
