import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import snapshotJson from '../src/data/ddragon-snapshot.json';
import { AssetCacheService, parseAssetUrl } from '../src/electron/assetCacheService';
import { DdragonCatalogService } from '../src/electron/ddragonService';
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

describe('Validação do Catálogo Data Dragon (BR), Ícones e Atualizações', () => {
  it('snapshot embutido é válido em pt_BR (realm BR) no mapa 11 com ícones oficiais verificados', () => {
    const check = validateCatalogSnapshot(catalog);
    expect(check.valid).toBe(true);
    expect(catalog.locale).toBe('pt_BR');
    expect(catalog.realm).toBe('br');
    expect(catalog.mapId).toBe(11);
    expect(catalog.championCount).toBeGreaterThanOrEqual(170);
    expect(catalog.champions.Kayn?.imageFull).toBe('Kayn.png');
    expect(catalog.items['6692']?.imageFull).toBe('6692.png');
    expect(catalog.runeTrees[0]?.icon).toContain('perk-images/');
    expect((catalog.statShards ?? []).length).toBeGreaterThanOrEqual(6);

    // Itens não compráveis / removidos da loja em 16.23.1 não devem constar como compráveis
    expect(catalog.items['6701']).toBeUndefined();
    expect(catalog.items['3042']).toBeUndefined();
    expect(catalog.items['3004']?.purchasable).toBe(true);
  });

  it('todos os IDs de itens, runas, slots e fragmentos recomendados são válidos no catálogo ativo', () => {
    const report = validateRecommendationsAgainstCatalog(catalog);
    expect(report.validSnapshot).toBe(true);
    expect(report.validRecommendations).toBe(true);
    expect(report.missingItemIds).toEqual([]);
    expect(report.missingRuneIds).toEqual([]);
    expect(report.invalidSlotRuneIds).toEqual([]);
    expect(report.missingShardIds).toEqual([]);
    expect(report.patchMismatch).toBe(false);

    // Garante separação realista por forma: Kayn Azul (guia KarasMaii 26.23) nunca recomenda Céu Dividido (6610), Hidra Profana (6698) nem Cicloespada Voltaica (6699)
    const blueBuild = buildItemRecommendation('blue', [], catalog);
    const allBlueIds = [
      ...blueBuild.core.map((i) => i.id),
      ...blueBuild.situational.flatMap((s) => s.items.map((i) => i.id)),
    ];
    expect(allBlueIds).not.toContain('6610');
    expect(allBlueIds).not.toContain('6698');
    expect(allBlueIds).not.toContain('6699');
    expect(blueBuild.variantKey).toBe('blue_standard');
    expect(blueBuild.boots.map((b) => b.id)).toEqual(['1001']); // Apenas Botas Tier 1
    expect(blueBuild.core.map((i) => i.id)).toEqual(['3142', '6696', '3036', '2517', '3026']); // Youmuu -> Axioma -> Dominik -> Fome Eterna -> Anjo Guardião
    expect(blueBuild.fullBuildBootReplacement?.id).toBe('3814'); // Vender Botas -> Limiar da Noite

    // Rhaast usa núcleo bruiser completo (5 itens) + 1 única bota e nunca inclui Cicloespada/Hidra Profana
    const redBuild = buildItemRecommendation('red', [], catalog);
    const allRedIds = [
      ...redBuild.core.map((i) => i.id),
      ...redBuild.situational.flatMap((s) => s.items.map((i) => i.id)),
    ];
    expect(redBuild.boots.length).toBe(1);
    expect(redBuild.core.length).toBe(5);
    expect(redBuild.core.slice(0, 3).map((i) => i.id)).toEqual(['6692', '3071', '6333']);
    expect(new Set(redBuild.core.map((i) => i.id)).size).toBe(5);
    expect(allRedIds).not.toContain('6698');
    expect(allRedIds).not.toContain('6699');
  });

  it('recomenda sempre 1 única bota certeira (Mercúrio vs Aço/Tabi vs Ionianas) e build completa (5 itens) conforme dano, CC, cura e escudos', () => {
    const profileOf = (ids: string[]) =>
      ids
        .map((id) => getChampionTacticalProfile(id, catalog))
        .filter((p): p is NonNullable<typeof p> => Boolean(p));

    // 1. Rhaast contra muito CC + AP + cura (Ornn, Sejuani, Sylas, Xayah, Alistar) -> Passos de Mercúrio (3111) + Semblante + Serrespada
    const heavyCcApEnemies = profileOf(['Ornn', 'Sejuani', 'Sylas', 'Xayah', 'Alistar']);
    const redCcAp = buildItemRecommendation('red', heavyCcApEnemies, catalog);
    expect(redCcAp.boots.map((b) => b.id)).toEqual(['3111']); // 1 única bota: Mercúrio
    expect(redCcAp.core.length).toBe(5);
    expect(redCcAp.core.map((i) => i.id)).toContain('3065'); // Semblante Espiritual
    expect(redCcAp.core.map((i) => i.id)).toContain('6609'); // Serrespada Quimiopunk (anti-cura)
    expect(new Set(redCcAp.core.map((i) => i.id)).size).toBe(5);

    // 2. Rhaast contra muito AD / ataques básicos (Darius, LeeSin, Yasuo, Caitlyn, Thresh) -> Botas de Aço / Tabi (3047) + Dança da Morte
    const heavyAdEnemies = profileOf(['Darius', 'LeeSin', 'Yasuo', 'Caitlyn', 'Thresh']);
    const redAd = buildItemRecommendation('red', heavyAdEnemies, catalog);
    expect(redAd.boots.map((b) => b.id)).toEqual(['3047']); // 1 única bota: Tabi / Aço
    expect(redAd.core.length).toBe(5);
    expect(redAd.core.slice(0, 3).map((i) => i.id)).toEqual(['6692', '3071', '6333']);
    // Nunca mistura Sterak (3053) e Malmortius (3156) (passiva única Salva-Vidas)
    expect(
      redAd.core.some((i) => i.id === '3053') && redAd.core.some((i) => i.id === '3156'),
    ).toBe(false);

    // 3. Rhaast contra pouco CC e dano misto equilibrado -> Botas Ionianas (3158)
    const lowCcMixed = profileOf(['DrMundo', 'Graves', 'Vladimir', 'Ezreal', 'Yuumi']);
    const redLowCc = buildItemRecommendation('red', lowCcMixed, catalog);
    expect(redLowCc.boots.map((b) => b.id)).toEqual(['3158']); // 1 única bota: Ionianas
    expect(redLowCc.core.length).toBe(5);

    // 4. Kayn Azul contra QUALQUER fonte forte de escudos (não apenas Milio/Lulu — inclui Shen, Sett, Ivern, Karma, Janna, ou 2+ escudos como Riven + Yasuo)
    const milioEnemies = profileOf(['Vladimir', 'Zed', 'Fizz', 'Jhin', 'Milio']);
    const blueVsMilio = buildItemRecommendation('blue', milioEnemies, catalog);
    expect(blueVsMilio.boots.map((b) => b.id)).toEqual(['1001']);
    expect(blueVsMilio.variantKey).toBe('blue_shields');
    expect(blueVsMilio.core.map((i) => i.id)).toEqual(['3142', '6695', '3033', '2517', '3026']); // Youmuu -> Presa da Serpente -> Lembrete Mortal -> Fome Eterna -> GA

    const shenEnemies = profileOf(['Shen', 'Graves', 'Syndra', 'Jinx', 'Nami']);
    const blueVsShen = buildItemRecommendation('blue', shenEnemies, catalog);
    expect(blueVsShen.variantKey).toBe('blue_shields');
    expect(blueVsShen.core.map((i) => i.id)).toContain('6695'); // Presa da Serpente contra Shen (Top)

    const ivernEnemies = profileOf(['Jayce', 'Ivern', 'Syndra', 'Jinx', 'Nami']);
    const blueVsIvern = buildItemRecommendation('blue', ivernEnemies, catalog);
    expect(blueVsIvern.variantKey).toBe('blue_shields');
    expect(blueVsIvern.core.map((i) => i.id)).toContain('6695'); // Presa da Serpente contra Ivern (Jungle)

    const duoShieldEnemies = profileOf(['Riven', 'Graves', 'Yasuo', 'Jinx', 'Nami']);
    const blueVsDuoShield = buildItemRecommendation('blue', duoShieldEnemies, catalog);
    expect(blueVsDuoShield.variantKey).toBe('blue_shields');
    expect(blueVsDuoShield.core.map((i) => i.id)).toContain('6695'); // Presa da Serpente contra Riven + Yasuo (2 fontes de escudo)
  });

  it('aplica corretamente as 3 rotas do guia KarasMaii (Patch 26.23) para Kayn Azul conforme CC, Escudos e Cura inimigos', () => {
    const profileOf = (ids: string[]) =>
      ids
        .map((id) => getChampionTacticalProfile(id, catalog))
        .filter((p): p is NonNullable<typeof p> => Boolean(p));

    // 1. Sem muito CC nem escudos -> Padrão (Youmuu -> Axioma -> Dominik -> Fome Eterna -> GA | Full build: Limiar da Noite)
    const stdEnemies = profileOf(['Jayce', 'Graves', 'Syndra', 'Jinx', 'Lux']);
    const stdBuild = buildItemRecommendation('blue', stdEnemies, catalog);
    const stdRunes = buildRuneRecommendation('blue', catalog, stdEnemies);
    expect(stdBuild.variantKey).toBe('blue_standard');
    expect(stdBuild.boots.map((b) => b.id)).toEqual(['1001']);
    expect(stdBuild.core.map((i) => i.id)).toEqual(['3142', '6696', '3036', '2517', '3026']);
    expect(stdBuild.fullBuildBootReplacement?.id).toBe('3814');
    expect(stdRunes.primaryRunes.map((r) => r.id)).toEqual([8112, 8143, 8140, 8135]); // Eletrocutar, Impacto Repentino, Lembranças Aterrorizantes, Caçador de Tesouros
    expect(stdRunes.secondaryTreeId).toBe(8300); // Inspiração
    expect(stdRunes.secondaryRunes.map((r) => r.id)).toEqual([8321, 8347]); // Reembolso, Perspicácia Cósmica
    expect(stdRunes.summonerSpells).toEqual(['Incendiar', 'Golpear']);

    // 2. Contra muito CC -> Limiar da Noite 2º + Caça Suprema + Precisão (Golpe de Misericórdia + Triunfo) | Full build: Axioma
    const ccEnemies = profileOf(['Jayce', 'Graves', 'Lissandra', 'Jinx', 'Morgana']);
    const ccBuild = buildItemRecommendation('blue', ccEnemies, catalog);
    const ccRunes = buildRuneRecommendation('blue', catalog, ccEnemies);
    expect(ccBuild.variantKey).toBe('blue_cc');
    expect(ccBuild.core.map((i) => i.id)).toEqual(['3142', '3814', '3036', '2517', '3026']);
    expect(ccBuild.fullBuildBootReplacement?.id).toBe('6696');
    expect(ccRunes.primaryRunes.map((r) => r.id)).toEqual([8112, 8143, 8140, 8106]); // Caça Suprema
    expect(ccRunes.secondaryTreeId).toBe(8000); // Precisão
    expect(ccRunes.secondaryRunes.map((r) => r.id)).toEqual([8014, 9111]); // Golpe de Misericórdia, Triunfo

    // 3. Contra muitos escudos + muita cura -> Presa da Serpente 2º + Lembrete Mortal 3º + Caça Suprema + Precisão
    const shieldHealEnemies = profileOf(['Aatrox', 'Viego', 'Orianna', 'Jinx', 'Lulu']);
    const shBuild = buildItemRecommendation('blue', shieldHealEnemies, catalog);
    const shRunes = buildRuneRecommendation('blue', catalog, shieldHealEnemies);
    expect(shBuild.variantKey).toBe('blue_shields');
    expect(shBuild.core.map((i) => i.id)).toEqual(['3142', '6695', '3033', '2517', '3026']); // Presa da Serpente + Lembrete Mortal
    expect(shBuild.fullBuildBootReplacement?.id).toBe('6696');
    expect(shRunes.primaryRunes.map((r) => r.id)).toEqual([8112, 8143, 8140, 8106]);
    expect(shRunes.secondaryRunes.map((r) => r.id)).toEqual([8014, 9111]);
  });

  it('quando uma runa é removida em um patch futuro, NÃO substitui silenciosamente nem renderiza imagem velha', () => {
    // Simula patch 16.24.1 onde Conquistador (8010) foi removido do catálogo
    const catalogWithoutConqueror: CatalogSnapshot = {
      ...catalog,
      patch: '16.24.1',
      runeTrees: catalog.runeTrees.map((tree) => ({
        ...tree,
        slots: tree.slots.map((slot) => ({
          runes: slot.runes.filter((r) => r.id !== 8010),
        })),
      })),
    };

    const report = validateRecommendationsAgainstCatalog(catalogWithoutConqueror);
    expect(report.validRecommendations).toBe(false);
    expect(report.missingRuneIds).toContain(8010);

    const redRunes = buildRuneRecommendation('red', catalogWithoutConqueror);
    expect(redRunes.hasInvalidRunes).toBe(true);
    expect(redRunes.revisionNotice).toContain('Revisão necessária');

    const keystone = redRunes.primaryRunes[0];
    expect(keystone.id).toBe(8010);
    expect(keystone.validInCatalog).toBe(false);
    expect(keystone.revisionStatus).toBe('needs_review');
    expect(keystone.icon).toBeNull(); // Nunca reaproveita imagem antiga!
    expect(keystone.name).toContain('Revisão necessária');
  });

  it('quando um item é inválido para Summoner\'s Rift ou removido, marca revisão necessária sem substituição silenciosa', () => {
    const catalogBadEclipse: CatalogSnapshot = {
      ...catalog,
      items: {
        ...catalog.items,
        // Simula Eclipse restrito a outro mapa (maps11=false)
        '6692': { ...catalog.items['6692'], maps11: false },
      },
    };
    delete catalogBadEclipse.items['3071']; // Cutelo Negro removido

    const enemyProfiles = ['Ornn', 'Sejuani']
      .map((id) => getChampionTacticalProfile(id, catalogBadEclipse))
      .filter((p): p is NonNullable<typeof p> => Boolean(p));

    const build = buildItemRecommendation('red', enemyProfiles, catalogBadEclipse);
    expect(build.hasInvalidItems).toBe(true);

    const eclipse = build.core.find((c) => c.id === '6692');
    const cleaver = build.core.find((c) => c.id === '3071');
    expect(eclipse?.availableInCatalog).toBe(false);
    expect(eclipse?.icon).toBeNull();
    expect(eclipse?.revisionStatus).toBe('needs_review');
    expect(cleaver?.availableInCatalog).toBe(false);
    expect(cleaver?.icon).toBeNull();
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

  it('ícone indisponível e abertura offline: nunca mistura gerações de patch e preserva última versão válida', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kayn-asset-test-'));
    const cacheRoot = path.join(tmpDir, 'cache');
    const bundledRoot = path.join(tmpDir, 'bundled');

    try {
      // Coloca um ícone apenas na geração 16.23.1
      const oldRunePath = path.join(
        bundledRoot,
        '16.23.1',
        'img',
        'perk-images',
        'Styles',
        'Precision',
        'Conqueror',
        'Conqueror.png',
      );
      fs.mkdirSync(path.dirname(oldRunePath), { recursive: true });
      fs.writeFileSync(oldRunePath, Buffer.from([0x89, 0x50, 0x4e, 0x47]));

      const offlineAssets = new AssetCacheService({
        cacheRoot,
        bundledRoot,
        allowNetwork: false,
      });

      // Abre offline na geração 16.23.1 -> encontra o ícone em cache/bundle
      const okReq = parseAssetUrl(
        'kayn-asset://ddragon/16.23.1/img/perk-images/Styles/Precision/Conqueror/Conqueror.png',
      );
      expect(okReq).not.toBeNull();
      const found = await offlineAssets.resolveAssetBytes(okReq!);
      expect(found?.fromCache).toBe(true);

      // Na geração 16.24.1 offline sem arquivo novo -> retorna null (placeholder neutro), NUNCA devolve arquivo da 16.23.1!
      const nextGenReq = parseAssetUrl(
        'kayn-asset://ddragon/16.24.1/img/perk-images/Styles/Precision/Conqueror/Conqueror.png',
      );
      const notMixed = await offlineAssets.resolveAssetBytes(nextGenReq!);
      expect(notMixed).toBeNull();

      // Path traversal rejeitado
      expect(parseAssetUrl('kayn-asset://ddragon/16.23.1/item/../../secret.png')).toBeNull();

      // DdragonCatalogService preserva a versão válida quando rede falha
      const failingFetch: typeof fetch = async () => {
        throw new Error('Sem conexão de rede');
      };
      const service = new DdragonCatalogService(path.join(tmpDir, 'ddragon-cache.json'), {
        assetCache: offlineAssets,
        fetchImpl: failingFetch,
      });
      expect(service.getCatalog().patch).toBe(catalog.patch);
      expect(service.getStatus().sourceMode).toBe('bundled_offline');

      const refreshRes = await service.refreshFromNetwork();
      expect(refreshRes.catalog.patch).toBe(catalog.patch);
      expect(refreshRes.status.lastError).toContain('Mantendo versão válida');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
