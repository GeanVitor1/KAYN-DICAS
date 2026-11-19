import { describe, expect, it } from 'vitest';
import snapshotJson from '../src/data/ddragon-snapshot.json';
import {
  BUILD_DATA_META,
  buildItemRecommendation,
  buildRuneRecommendation,
} from '../src/engine/buildProfiles';
import {
  validateCatalogSnapshot,
  validateRecommendationsAgainstCatalog,
} from '../src/engine/catalogValidator';
import { getChampionTacticalProfile } from '../src/engine/championTactics';
import type { CatalogSnapshot } from '../src/shared/types';

const catalog = snapshotJson as unknown as CatalogSnapshot;

describe('Validação do Catálogo Data Dragon e Recomendações', () => {
  it('snapshot embutido é válido em pt_BR no mapa 11 (Summoner\'s Rift) e não inclui itens removidos/não compráveis', () => {
    const check = validateCatalogSnapshot(catalog);
    expect(check.valid).toBe(true);
    expect(catalog.locale).toBe('pt_BR');
    expect(catalog.mapId).toBe(11);
    expect(catalog.championCount).toBeGreaterThanOrEqual(170);

    // Itens não compráveis / removidos do loja em 16.23.1 não devem constar como compráveis
    expect(catalog.items['6701']).toBeUndefined(); // Oportunidade inStore=false
    expect(catalog.items['3042']).toBeUndefined(); // Muramana é transformado (Manamune 3004 é o comprável)
    expect(catalog.items['3004']?.purchasable).toBe(true);
  });

  it('todos os IDs de itens e runas recomendados existem e são válidos no catálogo', () => {
    const report = validateRecommendationsAgainstCatalog(catalog);
    expect(report.validSnapshot).toBe(true);
    expect(report.validRecommendations).toBe(true);
    expect(report.missingItemIds).toEqual([]);
    expect(report.missingRuneIds).toEqual([]);
    expect(report.patchMismatch).toBe(false);
  });

  it('detecta divergência de patch entre catálogo e recomendações sem quebrar o motor', () => {
    const newerCatalog: CatalogSnapshot = {
      ...catalog,
      patch: '16.24.1',
    };
    const report = validateRecommendationsAgainstCatalog(newerCatalog);
    expect(report.patchMismatch).toBe(true);
    expect(report.warnings.length).toBeGreaterThan(0);

    const runes = buildRuneRecommendation('blue', newerCatalog);
    expect(runes.validatedPatch).toBe(BUILD_DATA_META.validatedPatch);
    expect(runes.statShardsNote).toContain('16.24.1');

    const enemyProfiles = ['Aatrox', 'Soraka', 'Lulu']
      .map((id) => getChampionTacticalProfile(id, newerCatalog))
      .filter((p): p is NonNullable<typeof p> => Boolean(p));

    const build = buildItemRecommendation('red', enemyProfiles, newerCatalog);
    expect(build.patchWarning).toContain('16.24.1');
    expect(build.situational.find((s) => s.key === 'excesso_cura')?.activeInDraft).toBe(true);
  });

  it('rejeita payload corrompido ou incompatível antes de substituir o cache', () => {
    const badMap = { ...catalog, mapId: 12 };
    expect(validateCatalogSnapshot(badMap).valid).toBe(false);

    const badLocale = { ...catalog, locale: 'en_US' };
    expect(validateCatalogSnapshot(badLocale).valid).toBe(false);

    expect(validateCatalogSnapshot(null).valid).toBe(false);
    expect(validateCatalogSnapshot({ patch: '16.23.1' }).valid).toBe(false);
  });
});
