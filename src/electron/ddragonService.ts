import fs from 'node:fs';
import path from 'node:path';
import bundledSnapshotJson from '../data/ddragon-snapshot.json';
import {
  validateCatalogSnapshot,
  validateRecommendationsAgainstCatalog,
} from '../engine/catalogValidator';
import type { CatalogSnapshot, CatalogStatus } from '../shared/types';

const bundledSnapshot = bundledSnapshotJson as unknown as CatalogSnapshot;

export class DdragonCatalogService {
  private readonly cacheFilePath: string;
  private activeCatalog: CatalogSnapshot;
  private status: CatalogStatus;

  constructor(cacheFilePath: string) {
    this.cacheFilePath = cacheFilePath;
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
          const validation = validateRecommendationsAgainstCatalog(check.snapshot);
          return {
            catalog: check.snapshot,
            status: {
              sourceMode: 'local_cache',
              activePatch: check.snapshot.patch,
              fetchedAt: check.snapshot.fetchedAt,
              validation,
            },
          };
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
        fetchedAt: bundledSnapshot.fetchedAt,
        validation,
      },
    };
  }

  getCatalog(): CatalogSnapshot {
    return this.activeCatalog;
  }

  getStatus(): CatalogStatus {
    return this.status;
  }

  async refreshFromNetwork(): Promise<{
    catalog: CatalogSnapshot;
    status: CatalogStatus;
  }> {
    try {
      const versionsRes = await fetch('https://ddragon.leagueoflegends.com/api/versions.json', {
        signal: AbortSignal.timeout(8000),
      });
      if (!versionsRes.ok) {
        throw new Error(`HTTP ${versionsRes.status} ao consultar versions.json`);
      }
      const versions = (await versionsRes.json()) as unknown;
      if (!Array.isArray(versions) || typeof versions[0] !== 'string') {
        throw new Error('Formato inesperado em versions.json do Data Dragon.');
      }
      const latestPatch = versions[0];

      const base = `https://ddragon.leagueoflegends.com/cdn/${latestPatch}/data/pt_BR`;
      const [champRes, itemRes, runeRes] = await Promise.all([
        fetch(`${base}/champion.json`, { signal: AbortSignal.timeout(10000) }),
        fetch(`${base}/item.json`, { signal: AbortSignal.timeout(10000) }),
        fetch(`${base}/runesReforged.json`, { signal: AbortSignal.timeout(10000) }),
      ]);

      if (!champRes.ok || !itemRes.ok || !runeRes.ok) {
        throw new Error('Falha ao baixar champion.json, item.json ou runesReforged.json.');
      }

      const [champRaw, itemRaw, runeRaw] = await Promise.all([
        champRes.json() as Promise<{ data?: Record<string, Record<string, unknown>> }>,
        itemRes.json() as Promise<{ data?: Record<string, Record<string, unknown>> }>,
        runeRes.json() as Promise<Array<Record<string, unknown>>>,
      ]);

      const champions: CatalogSnapshot['champions'] = {};
      for (const [id, c] of Object.entries(champRaw.data ?? {})) {
        const stats = (c.stats ?? {}) as Record<string, unknown>;
        champions[id] = {
          id: String(c.id ?? id),
          key: String(c.key ?? ''),
          name: String(c.name ?? id),
          title: String(c.title ?? ''),
          tags: Array.isArray(c.tags) ? c.tags.map(String) : [],
          attackrange: Number(stats.attackrange ?? 175),
        };
      }

      const items: CatalogSnapshot['items'] = {};
      for (const [id, it] of Object.entries(itemRaw.data ?? {})) {
        const numericId = Number(id);
        const maps = (it.maps ?? {}) as Record<string, unknown>;
        const gold = (it.gold ?? {}) as Record<string, unknown>;
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
          };
        }
      }

      const runeTrees: CatalogSnapshot['runeTrees'] = (Array.isArray(runeRaw) ? runeRaw : []).map((t) => ({
        id: Number(t.id),
        key: String(t.key ?? ''),
        name: String(t.name ?? ''),
        slots: Array.isArray(t.slots)
          ? t.slots.map((slot) => ({
              runes: Array.isArray((slot as Record<string, unknown>).runes)
                ? ((slot as Record<string, unknown>).runes as Array<Record<string, unknown>>).map((r) => ({
                    id: Number(r.id),
                    key: String(r.key ?? ''),
                    name: String(r.name ?? ''),
                    shortDesc: String(r.shortDesc ?? ''),
                  }))
                : [],
            }))
          : [],
      }));

      const candidate: CatalogSnapshot = {
        patch: latestPatch,
        locale: 'pt_BR',
        mapId: 11,
        fetchedAt: new Date().toISOString(),
        source: 'Riot Data Dragon',
        championCount: Object.keys(champions).length,
        itemCount: Object.keys(items).length,
        runeTreeCount: runeTrees.length,
        champions,
        items,
        runeTrees,
      };

      const check = validateCatalogSnapshot(candidate);
      if (!check.valid || !check.snapshot) {
        throw new Error(`Validação de esquema falhou: ${check.errors.join('; ')}`);
      }

      fs.mkdirSync(path.dirname(this.cacheFilePath), { recursive: true });
      const tmp = `${this.cacheFilePath}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(check.snapshot) + '\n', 'utf-8');
      fs.renameSync(tmp, this.cacheFilePath);

      this.activeCatalog = check.snapshot;
      this.status = {
        sourceMode: 'live_updated',
        activePatch: check.snapshot.patch,
        fetchedAt: check.snapshot.fetchedAt,
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
