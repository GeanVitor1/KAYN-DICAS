import { isRunningInElectron } from './desktopBridge';

function buildBase(patch: string): string {
  if (isRunningInElectron()) {
    return `kayn-asset://ddragon/${encodeURIComponent(patch)}`;
  }
  return `./ddragon-assets/${encodeURIComponent(patch)}`;
}

export function getChampionIconUrl(patch: string, imageFull?: string | null): string | null {
  if (!patch || !imageFull) return null;
  return `${buildBase(patch)}/champion/${encodeURIComponent(imageFull)}`;
}

export function getItemIconUrl(patch: string, imageFull?: string | null): string | null {
  if (!patch || !imageFull) return null;
  return `${buildBase(patch)}/item/${encodeURIComponent(imageFull)}`;
}

export function getRuneIconUrl(patch: string, iconPath?: string | null): string | null {
  if (!patch || !iconPath) return null;
  const clean = iconPath.replace(/^\/+/, '');
  const encodedPath = clean
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/');
  return `${buildBase(patch)}/img/${encodedPath}`;
}

export function getKaynSplashUrl(patch: string): string | null {
  if (!patch) return null;
  return `${buildBase(patch)}/splash/Kayn_0.jpg`;
}
