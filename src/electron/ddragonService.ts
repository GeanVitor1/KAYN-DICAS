import fs from 'node:fs';
import path from 'node:path';
import bundledSnapshotJson from '../data/ddragon-snapshot.json';
import {
  validateCatalogSnapshot,
  validateRecommendationsAgainstCatalog,
} from '../engine/catalogValidator';
import type { CatalogSnapshot, CatalogStatShard, CatalogStatus } from '../shared/types';
import type { AssetCacheService } from './assetCacheService';

const bundledSnapshot = bundledSnapshotJson as unknown as CatalogSnapshot;

const OFFICIAL_STAT_SHARD_CANDIDATES: CatalogStatShard[] = [
  {
    id: 5008,
    key: 'AdaptiveForce',
    name: '+9 de Força Adaptativa',
    shortLabel: 'Força Adaptativa',
    row: 'offense',
    icon: 'perk-images/StatMods/StatModsAdaptiveForceIcon.png',
  },
  {
    id: 5005,
    key: 'AttackSpeed',
    name: '+10% de Velocidade de Ataque',
    shortLabel: 'Vel. de Ataque',
    row: 'offense',
    icon: 'perk-images/StatMods/StatModsAttackSpeedIcon.png',
  },
  {
    id: 5007,
    key: 'AbilityHaste',
    name: '+8 de Aceleração de Habilidade',
    shortLabel: 'Aceleração',
    row: 'offense',
    icon: 'perk-images/StatMods/StatModsCDRScalingIcon.png',
  },
  {
    id: 5010,
    key: 'MoveSpeed',
    name: '+2% de Velocidade de Movimento',
    shortLabel: 'Vel. Movimento',
    row: 'flex',
    icon: 'perk-images/StatMods/StatModsMovementSpeedIcon.png',
  },
  {
    id: 5001,
    key: 'HealthScaling',
    name: '+10–180 de Vida (por nível)',
    shortLabel: 'Vida Escalável',
    row: 'defense',
    icon: 'perk-images/StatMods/StatModsHealthScalingIcon.png',
  },
  {
    id: 5011,
    key: 'HealthFlat',
    name: '+65 de Vida Base',
    shortLabel: 'Vida Base',
    row: 'defense',
    icon: 'perk-images/StatMods/StatModsHealthPlusIcon.png',
  },
  {
    id: 5013,
    key: 'Tenacity',
    name: '+10% de Tenacidade e Resistência a Lentidão',
    shortLabel: 'Tenacidade',
    row: 'defense',
    icon: 'perk-images/StatMods/StatModsTenacityIcon.png',
  },
];

function snapshotHasRichIcons(snapshot: CatalogSnapshot): boolean {
  const kayn = snapshot.champions.Kayn;
  const firstTree = snapshot.runeTrees[0];
  return Boolean(kayn?.imageFull && firstTree?.icon && Array.isArray(snapshot.statShards));
}

export class DdragonCatalogService {
  private readonly cacheFilePath: string;
  private readonly assetCache?: AssetCacheService;
  private readonly fetchImpl: typeof fetch;
  private activeCatalog: CatalogSnapshot;
  private status: CatalogStatus;

  constructor(
    cacheFilePath: string,
    options?: { assetCache?: AssetCacheService; fetchImpl?: typeof fetch },
  ) {
    this.cacheFilePath = cacheFilePath;
    this.assetCache = options?.assetCache;
    this.fetchImpl = options?.fetchImpl ?? fetch;
    const loaded = this.loadInitialCatalog();
    this.activeCatalog = loaded.catalog;
    this.status = loaded.status;
  }

  private loadInitialCatalog(): { catalog: CatalogSnapshot; status: CatalogStatus } {
    if (fs.existsSync(this.cacheFilePath)) {
      try {
        const raw = JSON.parse(fs.readFileSync(this.cacheFilePath, 'utf-8'));
        const check = validateCatalogSnapshot(raw);
        if (check.valid && check.snapshot) {
          // Se o cache local for do mesmo patch do snapshot embutido mas sem metadados de ícone (versão antiga),
          // promove o snapshot embutido mais completo automaticamente sem misturar gerações.
          const useBundledInstead =
            check.snapshot.patch === bundledSnapshot.patch &&
            !snapshotHasRichIcons(check.snapshot) &&
            snapshotHasRichIcons(bundledSnapshot);

          if (!useBundledInstead) {
            const validation = validateRecommendationsAgainstCatalog(check.snapshot);
            return {
              catalog: check.snapshot,
              status: {
                sourceMode: 'local_cache',
                activePatch: check.snapshot.patch,
                realm: check.snapshot.realm ?? 'br',
                fetchedAt: check.snapshot.fetchedAt,
                cachedAssetsCount: this.assetCache?.countCachedAssets(check.snapshot.patch),
                validation,
              },
            };
          }
        }
      } catch {
        // Fallback automático para o snapshot embutido válido
      }
    }

    const validation = validateRecommendationsAgainstCatalog(bundledSnapshot);
    return {
      catalog: bundledSnapshot,
      status: {
        sourceMode: 'bundled_offline',
        activePatch: bundledSnapshot.patch,
        realm: bundledSnapshot.realm ?? 'br',
        fetchedAt: bundledSnapshot.fetchedAt,
        cachedAssetsCount: this.assetCache?.countCachedAssets(bundledSnapshot.patch),
        validation,
      },
    };
  }

  getCatalog(): CatalogSnapshot {
    return this.activeCatalog;
  }

  getStatus(): CatalogStatus {
    return {
      ...this.status,
      cachedAssetsCount:
        this.assetCache?.countCachedAssets(this.activeCatalog.patch) ??
        this.status.cachedAssetsCount,
    };
  }

  private async resolveBrPatchAndCdn(): Promise<{ patch: string; cdnBase: string; realm: string }> {
    try {
      const realmRes = await this.fetchImpl('https://ddragon.leagueoflegends.com/realms/br.json', {
        signal: AbortSignal.timeout(8000),
      });
      if (realmRes.ok) {
        const realmData = (await realmRes.json()) as Record<string, unknown>;
        if (typeof realmData.v === 'string' && realmData.v.trim()) {
          return {
            patch: realmData.v.trim(),
            cdnBase:
              typeof realmData.cdn === 'string' && realmData.cdn.startsWith('https://')
                ? realmData.cdn
                : 'https://ddragon.leagueoflegends.com/cdn',
            realm: 'br',
          };
        }
      }
    } catch {
      // Fallback controlado para versions.json abaixo
    }

    const versionsRes = await this.fetchImpl('https://ddragon.leagueoflegends.com/api/versions.json', {
      signal: AbortSignal.timeout(8000),
    });
    if (!versionsRes.ok) {
      throw new Error(`HTTP ${versionsRes.status} ao consultar realms/br.json e versions.json`);
    }
    const versions = (await versionsRes.json()) as unknown;
    if (!Array.isArray(versions) || typeof versions[0] !== 'string') {
      throw new Error('Formato inesperado em versions.json do Data Dragon.');
    }
    return {
      patch: versions[0],
      cdnBase: 'https://ddragon.leagueoflegends.com/cdn',
      realm: 'br',
    };
  }

  async refreshFromNetwork(): Promise<{
    catalog: CatalogSnapshot;
    status: CatalogStatus;
  }> {
    try {
      const { patch: latestPatch, cdnBase, realm } = await this.resolveBrPatchAndCdn();

      const base = `${cdnBase}/${latestPatch}/data/pt_BR`;
      const [champRes, itemRes, runeRes] = await Promise.all([
        this.fetchImpl(`${base}/champion.json`, { signal: AbortSignal.timeout(10000) }),
        this.fetchImpl(`${base}/item.json`, { signal: AbortSignal.timeout(10000) }),
        this.fetchImpl(`${base}/runesReforged.json`, { signal: AbortSignal.timeout(10000) }),
      ]);

      if (!champRes.ok || !itemRes.ok || !runeRes.ok) {
        throw new Error('Falha ao baixar champion.json, item.json ou runesReforged.json (pt_BR).');
      }

      const [champRaw, itemRaw, runeRaw] = await Promise.all([
        champRes.json() as Promise<{ data?: Record<string, Record<string, unknown>> }>,
        itemRes.json() as Promise<{ data?: Record<string, Record<string, unknown>> }>,
        runeRes.json() as Promise<Array<Record<string, unknown>>>,
      ]);

      const champions: CatalogSnapshot['champions'] = {};
      for (const [id, c] of Object.entries(champRaw.data ?? {})) {
        const stats = (c.stats ?? {}) as Record<string, unknown>;
        const image = (c.image ?? {}) as Record<string, unknown>;
        champions[id] = {
          id: String(c.id ?? id),
          key: String(c.key ?? ''),
          name: String(c.name ?? id),
          title: String(c.title ?? ''),
          tags: Array.isArray(c.tags) ? c.tags.map(String) : [],
          attackrange: Number(stats.attackrange ?? 175),
          imageFull: typeof image.full === 'string' && image.full ? image.full : `${String(c.id ?? id)}.png`,
        };
      }

      const items: CatalogSnapshot['items'] = {};
      for (const [id, it] of Object.entries(itemRaw.data ?? {})) {
        const numericId = Number(id);
        const maps = (it.maps ?? {}) as Record<string, unknown>;
        const gold = (it.gold ?? {}) as Record<string, unknown>;
        const image = (it.image ?? {}) as Record<string, unknown>;
        const map11 = maps['11'] === true;
        const purchasable = gold.purchasable === true;
        const inStore = it.inStore !== false;
        const restricted = Boolean(it.requiredChampion || it.requiredAlly);
        if (map11 && purchasable && inStore && !Number.isNaN(numericId) && numericId < 10000 && !restricted) {
          items[id] = {
            id,
            name: String(it.name ?? id),
            plaintext: String(it.plaintext ?? ''),
            gold: Number(gold.total ?? 0),
            tags: Array.isArray(it.tags) ? it.tags.map(String) : [],
            maps11: true,
            purchasable: true,
            imageFull: typeof image.full === 'string' && image.full ? image.full : `${id}.png`,
          };
        }
      }

      const runeTrees: CatalogSnapshot['runeTrees'] = (Array.isArray(runeRaw) ? runeRaw : []).map((t) => {
        const treeId = Number(t.id);
        return {
          id: treeId,
          key: String(t.key ?? ''),
          name: String(t.name ?? ''),
          icon: typeof t.icon === 'string' ? t.icon : '',
          slots: Array.isArray(t.slots)
            ? t.slots.map((slot, slotIndex) => ({
                runes: Array.isArray((slot as Record<string, unknown>).runes)
                  ? ((slot as Record<string, unknown>).runes as Array<Record<string, unknown>>).map((r) => ({
                      id: Number(r.id),
                      key: String(r.key ?? ''),
                      name: String(r.name ?? ''),
                      shortDesc: String(r.shortDesc ?? ''),
                      icon: typeof r.icon === 'string' ? r.icon : '',
                      treeId,
                      slotIndex,
                    }))
                  : [],
              }))
            : [],
        };
      });

      const candidate: CatalogSnapshot = {
        patch: latestPatch,
        realm,
        cdnBase,
        locale: 'pt_BR',
        mapId: 11,
        fetchedAt: new Date().toISOString(),
        source: 'Riot Data Dragon (BR)',
        championCount: Object.keys(champions).length,
        itemCount: Object.keys(items).length,
        runeTreeCount: runeTrees.length,
        champions,
        items,
        runeTrees,
        statShards: OFFICIAL_STAT_SHARD_CANDIDATES.map((s) => ({ ...s })),
      };

      const check = validateCatalogSnapshot(candidate);
      if (!check.valid || !check.snapshot) {
        throw new Error(`Validação de esquema falhou: ${check.errors.join('; ')}`);
      }

      // Pré-carregar ícones essenciais na pasta isolada do novo patch ANTES de ativar o catálogo
      if (this.assetCache) {
        await this.assetCache.prefetchCoreAssetsForCatalog(check.snapshot);
      }

      fs.mkdirSync(path.dirname(this.cacheFilePath), { recursive: true });
      const tmp = `${this.cacheFilePath}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(check.snapshot) + '\n', 'utf-8');
      fs.renameSync(tmp, this.cacheFilePath);

      if (this.assetCache) {
        this.assetCache.pruneOldPatchCaches(check.snapshot.patch);
      }

      this.activeCatalog = check.snapshot;
      this.status = {
        sourceMode: 'live_updated',
        activePatch: check.snapshot.patch,
        realm: check.snapshot.realm ?? 'br',
        fetchedAt: check.snapshot.fetchedAt,
        cachedAssetsCount: this.assetCache?.countCachedAssets(check.snapshot.patch),
        validation: validateRecommendationsAgainstCatalog(check.snapshot),
      };
      return { catalog: this.activeCatalog, status: this.status };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido ao atualizar Data Dragon.';
      this.status = {
        ...this.status,
        lastError: `Mantendo versão válida (${this.activeCatalog.patch}). Motivo da falha: ${msg}`,
      };
      return { catalog: this.activeCatalog, status: this.status };
    }
  }
}
