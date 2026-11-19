import fs from 'node:fs';
import path from 'node:path';
import type { CatalogSnapshot } from '../shared/types';
import {
  collectBlueprintItemIds,
  collectBlueprintRuneIds,
} from '../engine/buildProfiles';

export type AssetCategory = 'champion' | 'item' | 'img' | 'splash';

export interface ParsedAssetRequest {
  patch: string;
  category: AssetCategory;
  relPath: string;
}

const VALID_PATCH_RE = /^\d+\.\d+\.\d+$/;
const SAFE_SEGMENT_RE = /^[A-Za-z0-9_.-]+$/;

export function parseAssetUrl(rawUrl: string): ParsedAssetRequest | null {
  try {
    const u = new URL(rawUrl);
    if (u.protocol !== 'kayn-asset:' || u.hostname !== 'ddragon') {
      return null;
    }
    const parts = u.pathname
      .split('/')
      .filter(Boolean)
      .map((p) => decodeURIComponent(p));
    if (parts.length < 3) return null;

    const [patch, category, ...rest] = parts;
    if (!VALID_PATCH_RE.test(patch)) return null;
    if (
      category !== 'champion' &&
      category !== 'item' &&
      category !== 'img' &&
      category !== 'splash'
    ) {
      return null;
    }
    if (rest.length === 0) return null;
    for (const seg of rest) {
      if (seg === '.' || seg === '..' || !SAFE_SEGMENT_RE.test(seg)) {
        return null;
      }
    }

    const relPath = rest.join('/');
    if (category === 'champion' || category === 'item') {
      if (rest.length !== 1 || !relPath.endsWith('.png')) return null;
    } else if (category === 'img') {
      if (!relPath.startsWith('perk-images/') || !relPath.endsWith('.png')) return null;
    } else if (category === 'splash') {
      if (relPath !== 'Kayn_0.jpg') return null;
    }

    return { patch, category, relPath };
  } catch {
    return null;
  }
}

export function buildOfficialDdragonAssetUrl(
  req: ParsedAssetRequest,
  cdnBase = 'https://ddragon.leagueoflegends.com/cdn',
): string {
  if (req.category === 'champion') {
    return `${cdnBase}/${req.patch}/img/champion/${req.relPath}`;
  }
  if (req.category === 'item') {
    return `${cdnBase}/${req.patch}/img/item/${req.relPath}`;
  }
  if (req.category === 'splash') {
    return `${cdnBase}/img/champion/splash/${req.relPath}`;
  }
  // perk-images
  return `${cdnBase}/img/${req.relPath}`;
}

export function mimeTypeForPath(relPath: string): string {
  const lower = relPath.toLowerCase();
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  return 'image/png';
}

export class AssetCacheService {
  private readonly cacheRoot: string;
  private readonly bundledRoot: string;
  private readonly fetchImpl: typeof fetch;
  private readonly allowNetwork: boolean;

  constructor(options: {
    cacheRoot: string;
    bundledRoot: string;
    fetchImpl?: typeof fetch;
    allowNetwork?: boolean;
  }) {
    this.cacheRoot = options.cacheRoot;
    this.bundledRoot = options.bundledRoot;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.allowNetwork = options.allowNetwork ?? true;
  }

  private resolveLocalPath(baseDir: string, req: ParsedAssetRequest): string {
    return path.join(baseDir, req.patch, req.category, ...req.relPath.split('/'));
  }

  /**
   * Lê um ativo exclusivamente da geração de patch solicitada (cache local -> bundle do patch).
   * Nunca mistura arquivos de um patch diferente.
   */
  readFromDisk(req: ParsedAssetRequest): Buffer | null {
    const cachePath = this.resolveLocalPath(this.cacheRoot, req);
    if (fs.existsSync(cachePath)) {
      try {
        const buf = fs.readFileSync(cachePath);
        if (buf.length > 0) return buf;
      } catch {
        // segue para bundle
      }
    }

    const bundledPath = this.resolveLocalPath(this.bundledRoot, req);
    if (fs.existsSync(bundledPath)) {
      try {
        const buf = fs.readFileSync(bundledPath);
        if (buf.length > 0) return buf;
      } catch {
        return null;
      }
    }

    return null;
  }

  async resolveAssetBytes(
    req: ParsedAssetRequest,
    cdnBase = 'https://ddragon.leagueoflegends.com/cdn',
  ): Promise<{ bytes: Buffer; mimeType: string; fromCache: boolean } | null> {
    const existing = this.readFromDisk(req);
    if (existing) {
      return { bytes: existing, mimeType: mimeTypeForPath(req.relPath), fromCache: true };
    }

    if (!this.allowNetwork) {
      return null;
    }

    const url = buildOfficialDdragonAssetUrl(req, cdnBase);
    try {
      const res = await this.fetchImpl(url, {
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return null;
      const contentType = res.headers.get('content-type') ?? '';
      if (contentType && !contentType.startsWith('image/')) {
        return null;
      }
      const bytes = Buffer.from(await res.arrayBuffer());
      if (bytes.length === 0) return null;

      const cachePath = this.resolveLocalPath(this.cacheRoot, req);
      fs.mkdirSync(path.dirname(cachePath), { recursive: true });
      const tmp = `${cachePath}.tmp`;
      fs.writeFileSync(tmp, bytes);
      fs.renameSync(tmp, cachePath);

      return { bytes, mimeType: mimeTypeForPath(req.relPath), fromCache: false };
    } catch {
      return null;
    }
  }

  /**
   * Pré-carrega os ícones críticos do Kayn (itens, runas, árvores, fragmentos, Kayn)
   * em um diretório isolado para o novo patch antes de ativá-lo.
   */
  async prefetchCoreAssetsForCatalog(
    catalog: CatalogSnapshot,
  ): Promise<{ fetched: number; failed: number }> {
    const cdnBase = catalog.cdnBase || 'https://ddragon.leagueoflegends.com/cdn';
    const requests: ParsedAssetRequest[] = [
      { patch: catalog.patch, category: 'splash', relPath: 'Kayn_0.jpg' },
    ];

    const kaynChamp = catalog.champions.Kayn;
    if (kaynChamp) {
      requests.push({
        patch: catalog.patch,
        category: 'champion',
        relPath: kaynChamp.imageFull || 'Kayn.png',
      });
    }

    for (const itemId of collectBlueprintItemIds()) {
      const it = catalog.items[itemId];
      if (it && it.maps11 && it.purchasable) {
        requests.push({
          patch: catalog.patch,
          category: 'item',
          relPath: it.imageFull || `${it.id}.png`,
        });
      }
    }

    const reqRuneSet = new Set(collectBlueprintRuneIds());
    for (const tree of catalog.runeTrees) {
      if (tree.icon) {
        requests.push({ patch: catalog.patch, category: 'img', relPath: tree.icon });
      }
      for (const slot of tree.slots) {
        for (const r of slot.runes) {
          if (reqRuneSet.has(r.id) && r.icon) {
            requests.push({ patch: catalog.patch, category: 'img', relPath: r.icon });
          }
        }
      }
    }

    for (const shard of catalog.statShards ?? []) {
      if (shard.icon) {
        requests.push({ patch: catalog.patch, category: 'img', relPath: shard.icon });
      }
    }

    let fetched = 0;
    let failed = 0;
    let idx = 0;
    const worker = async () => {
      while (idx < requests.length) {
        const req = requests[idx++];
        const res = await this.resolveAssetBytes(req, cdnBase);
        if (res) fetched += 1;
        else failed += 1;
      }
    };

    await Promise.all(Array.from({ length: Math.min(8, requests.length) }, () => worker()));
    return { fetched, failed };
  }

  /**
   * Remove gerações antigas do cache de disco após confirmar um novo patch válido,
   * garantindo que imagens velhas não coexistam com o patch atual.
   */
  pruneOldPatchCaches(activePatch: string): void {
    if (!fs.existsSync(this.cacheRoot)) return;
    try {
      for (const entry of fs.readdirSync(this.cacheRoot)) {
        if (entry !== activePatch) {
          fs.rmSync(path.join(this.cacheRoot, entry), { recursive: true, force: true });
        }
      }
    } catch {
      // Ignora erro de limpeza não fatal
    }
  }

  countCachedAssets(patch: string): number {
    const files = new Set<string>();
    const walk = (base: string, relPrefix = '') => {
      if (!fs.existsSync(base)) return;
      for (const entry of fs.readdirSync(base, { withFileTypes: true })) {
        const full = path.join(base, entry.name);
        const rel = relPrefix ? `${relPrefix}/${entry.name}` : entry.name;
        if (entry.isDirectory()) walk(full, rel);
        else if (entry.isFile() && !entry.name.endsWith('.tmp')) files.add(rel);
      }
    };
    walk(path.join(this.bundledRoot, patch));
    walk(path.join(this.cacheRoot, patch));
    return files.size;
  }
}
