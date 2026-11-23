import type {
  BlueBuildVariantKey,
  BuildItemRef,
  BuildRecommendation,
  CatalogSnapshot,
  CatalogStatShard,
  ChampionTacticalProfile,
  KaynFormChoice,
  RuneEntryRef,
  RuneRecommendation,
  SituationalBuildCategory,
  StatShardRef,
} from '../shared/types';

export const BUILD_DATA_META = {
  buildVersion: '2026.11-kayn-16.23.1-karasmai-v5',
  validatedPatch: '16.23.1',
  source:
    "Kayn Azul (KarasMaii 26.23) + Rhaast Bruiser completo (5 itens + 1 bota certeira por AD/AP/CC); IDs e ícones conferidos no Data Dragon BR 16.23.1 pt_BR",
  updatedAt: '2026-11-23',
} as const;

export const DEFAULT_STAT_SHARD_FALLBACKS: Record<number, CatalogStatShard> = {
  5008: {
    id: 5008,
    key: 'AdaptiveForce',
    name: '+9 de Força Adaptativa',
    shortLabel: 'Força Adaptativa',
    row: 'offense',
  },
  5005: {
    id: 5005,
    key: 'AttackSpeed',
    name: '+10% de Velocidade de Ataque',
    shortLabel: 'Vel. de Ataque',
    row: 'offense',
  },
  5007: {
    id: 5007,
    key: 'AbilityHaste',
    name: '+8 de Aceleração de Habilidade',
    shortLabel: 'Aceleração',
    row: 'offense',
  },
  5010: {
    id: 5010,
    key: 'MoveSpeed',
    name: '+2% de Velocidade de Movimento',
    shortLabel: 'Vel. Movimento',
    row: 'flex',
  },
  5001: {
    id: 5001,
    key: 'HealthScaling',
    name: '+10–180 de Vida (por nível)',
    shortLabel: 'Vida Escalável',
    row: 'defense',
  },
  5011: {
    id: 5011,
    key: 'HealthFlat',
    name: '+65 de Vida Base',
    shortLabel: 'Vida Base',
    row: 'defense',
  },
  5013: {
    id: 5013,
    key: 'Tenacity',
    name: '+10% de Tenacidade e Resistência a Lentidão',
    shortLabel: 'Tenacidade',
    row: 'defense',
  },
};

export interface StaticRuneBlueprint {
  formLabel: string;
  variantLabel?: string;
  primaryTreeId: number;
  primaryRuneIds: [number, number, number, number];
  secondaryTreeId: number;
  secondaryRuneIds: [number, number];
  statShardIds: [number, number, number];
  summonerSpells: string[];
  summonerSpellsNote: string;
  whyFormDiffers: string;
  alternativeNote: string;
}

export const BLUE_RUNE_VARIANTS: Record<BlueBuildVariantKey, StaticRuneBlueprint> = {
  blue_standard: {
    formLabel: 'Kayn Azul — Eletrocutar (Padrão · Karasmai 26.23)',
    variantLabel: 'Padrão · Karasmai 26.23',
    primaryTreeId: 8100, // Dominação
    primaryRuneIds: [8112, 8143, 8140, 8135], // Eletrocutar, Impacto Repentino, Lembranças Aterrorizantes, Caçador de Tesouros
    secondaryTreeId: 8300, // Inspiração
    secondaryRuneIds: [8321, 8347], // Reembolso, Perspicácia Cósmica
    statShardIds: [5008, 5008, 5011], // Força Adaptativa, Força Adaptativa, Vida Base (+65)
    summonerSpells: ['Incendiar', 'Golpear'],
    summonerSpellsNote:
      'KarasMaii (26.23): Incendiar + Golpear + R ativa Eletrocutar com consistência e garante abates cedo.',
    whyFormDiffers:
      'Guia KarasMaii (Patch 26.23): após os nerfs em Quebra-Bastião e Cicloespada Voltaica, Eletrocutar entrega burst imediato mais confiável que Colheita Sombria ou Avanço da Tempestade. Sem excesso de CC ou escudos inimigos, Caçador de Tesouros + Reembolso + Perspicácia Cósmica aceleram Youmuu e o snowball do mid game.',
    alternativeNote:
      'Contra times com muito CC ou muitos escudos, KarasMaii troca Caçador de Tesouros por Caça Suprema (8106) e a árvore secundária para Precisão: Golpe de Misericórdia (8014) + Triunfo (9111).',
  },
  blue_cc: {
    formLabel: 'Kayn Azul — Eletrocutar (Contra muito CC · Karasmai 26.23)',
    variantLabel: 'Contra muito CC · Karasmai 26.23',
    primaryTreeId: 8100, // Dominação
    primaryRuneIds: [8112, 8143, 8140, 8106], // Eletrocutar, Impacto Repentino, Lembranças Aterrorizantes, Caça Suprema
    secondaryTreeId: 8000, // Precisão
    secondaryRuneIds: [8014, 9111], // Golpe de Misericórdia, Triunfo
    statShardIds: [5008, 5008, 5011], // Força Adaptativa, Força Adaptativa, Vida Base (+65)
    summonerSpells: ['Incendiar', 'Golpear'],
    summonerSpellsNote:
      'KarasMaii (26.23): Incendiar + Golpear + R ativa Eletrocutar e coloca o alvo na faixa de Golpe de Misericórdia para finalizar.',
    whyFormDiffers:
      'Guia KarasMaii (Patch 26.23) contra composições com muito CC: Eletrocutar + Incendiar/Golpear garante burst imediato, Caça Suprema reduz a recarga do R para desviar de controles e Golpe de Misericórdia + Triunfo finalizam o alvo e sustentam a saída.',
    alternativeNote:
      'Sem excesso de CC nem escudos inimigos, prefira Caçador de Tesouros (8135) + Inspiração com Reembolso (8321) e Perspicácia Cósmica (8347) para acelerar o ouro da build.',
  },
  blue_shields: {
    formLabel: 'Kayn Azul — Eletrocutar (Contra muitos escudos · Karasmai 26.23)',
    variantLabel: 'Contra escudos · Karasmai 26.23',
    primaryTreeId: 8100, // Dominação
    primaryRuneIds: [8112, 8143, 8140, 8106], // Eletrocutar, Impacto Repentino, Lembranças Aterrorizantes, Caça Suprema
    secondaryTreeId: 8000, // Precisão
    secondaryRuneIds: [8014, 9111], // Golpe de Misericórdia, Triunfo
    statShardIds: [5008, 5008, 5011], // Força Adaptativa, Força Adaptativa, Vida Base (+65)
    summonerSpells: ['Incendiar', 'Golpear'],
    summonerSpellsNote:
      'KarasMaii (26.23): Incendiar + Golpear + R ativa Eletrocutar e coloca o alvo na faixa de Golpe de Misericórdia mesmo contra escudos.',
    whyFormDiffers:
      'Guia KarasMaii (Patch 26.23) contra muitos escudos: combinado com Presa da Serpente como 2º item, Eletrocutar + Caça Suprema + Golpe de Misericórdia + Triunfo garantem execução consistente sobre carries protegidos por encantadores.',
    alternativeNote:
      'Se o draft inimigo não tiver excesso de escudos nem muito CC, troque para Caçador de Tesouros (8135) + Reembolso (8321) + Perspicácia Cósmica (8347).',
  },
};

export const RUNE_BLUEPRINTS: Record<'blue' | 'red' | 'open', StaticRuneBlueprint> = {
  blue: BLUE_RUNE_VARIANTS.blue_standard,
  red: {
    formLabel: 'Rhaast — Luta Longa e Cura (Bruiser)',
    variantLabel: 'Bruiser · Luta Longa',
    primaryTreeId: 8000, // Precisão
    primaryRuneIds: [8010, 9111, 9105, 8299], // Conquistador, Triunfo, Lenda: Aceleração, Até a Morte
    secondaryTreeId: 8300, // Inspiração
    secondaryRuneIds: [8304, 8347], // Calçados Mágicos, Perspicácia Cósmica
    statShardIds: [5008, 5008, 5001], // Força Adaptativa, Força Adaptativa, Vida Escalável
    summonerSpells: ['Flash', 'Golpear'],
    summonerSpellsNote:
      'Flash + Golpear mantém alcance para W-Flash e reposicionamento em teamfights de Rhaast Bruiser.',
    whyFormDiffers:
      'Rhaast quer prolongar trocas e curar com dano de habilidades (KarasMaii reforçou no patch 26.23 que segue jogando Rhaast Bruiser puro). Conquistador empilha AD + cura contínua, Triunfo sustenta resets em 2v2/teamfight, Lenda: Aceleração acelera rotações de Q/W e Até a Morte aumenta cura e dano em vida baixa.',
    alternativeNote:
      'Contra muito poke/CC onde queira mais resistência no mid game: Determinação secundária com Condicionamento (8429) + Revitalizar (8453).',
  },
  open: {
    formLabel: 'Indefinido — Página Segura até Definir no Lobby',
    variantLabel: 'Flexível até fechar draft',
    primaryTreeId: 8000, // Precisão (segura bem os dois planos se o draft ainda está aberto)
    primaryRuneIds: [8010, 9111, 9105, 8014], // Conquistador, Triunfo, Lenda: Aceleração, Golpe de Misericórdia
    secondaryTreeId: 8300, // Inspiração
    secondaryRuneIds: [8304, 8347],
    statShardIds: [5008, 5008, 5011],
    summonerSpells: ['Flash', 'Golpear'],
    summonerSpellsNote:
      'Mantenha Flash + Golpear enquanto o draft estiver aberto; se confirmar Kayn Azul no lobby, considere Incendiar + Golpear (guia KarasMaii 26.23).',
    whyFormDiffers:
      'Com a forma ainda aberta ou draft incompleto, Conquistador é a página mais segura porque Rhaast funciona perfeitamente com ela e o Azul ainda aproveita AD acumulado em escaramuças, enquanto Eletrocutar reduz o fôlego de um Rhaast Bruiser forçado.',
    alternativeNote:
      'Assim que os últimos picks inimigos fecharem: 3+ alvos frágeis sem peel pesado -> mude para Dominação (Eletrocutar + Incendiar/Golpear, guia KarasMaii 26.23). 2+ frontline/peel duro -> mantenha Conquistador e troque Golpe de Misericórdia por Até a Morte (8299).',
  },
};

export function getAllRuneBlueprints(): StaticRuneBlueprint[] {
  return [
    ...Object.values(BLUE_RUNE_VARIANTS),
    RUNE_BLUEPRINTS.red,
    RUNE_BLUEPRINTS.open,
  ];
}

export function computeEnemyShieldScore(
  enemyProfiles: ChampionTacticalProfile[],
): number {
  return enemyProfiles.reduce(
    (sum, p) => sum + (p.shieldScore ?? (p.heavyShields ? 1 : 0)),
    0,
  );
}

export function hasHighShieldThreat(
  enemyProfiles: ChampionTacticalProfile[],
): boolean {
  return computeEnemyShieldScore(enemyProfiles) >= 2;
}

export function selectBlueKaynVariant(
  enemyProfiles: ChampionTacticalProfile[],
): BlueBuildVariantKey {
  const hardCcCount = enemyProfiles.filter((p) => p.ccScore >= 3).length;
  const highCcCount = enemyProfiles.filter((p) => p.ccScore >= 2).length;
  const totalCcScore = enemyProfiles.reduce((acc, p) => acc + p.ccScore, 0);

  // Qualquer gerador massivo de escudos (shieldScore >= 2: Shen, Sett, Mordekaiser, Tahm Kench, Ivern, Karma, Janna, Seraphine, Sona, Lulu, Milio, Taric, Yuumi)
  // ou 2+ campeões com escudos relevantes (ex.: Riven + Yasuo, Lee Sin + Orianna, Ambessa + Kai'Sa) já ativam Presa da Serpente!
  const hasShieldPriority = hasHighShieldThreat(enemyProfiles);
  const hasLotsOfCc =
    highCcCount >= 3 || totalCcScore >= 8 || (hardCcCount >= 1 && highCcCount >= 2);

  if (hasShieldPriority && !(hardCcCount >= 2 || totalCcScore >= 9)) {
    return 'blue_shields';
  }
  if (hasLotsOfCc) {
    return 'blue_cc';
  }
  return 'blue_standard';
}

export interface EnemyDamageAndCcSummary {
  adScore: number;
  apScore: number;
  aaThreatCount: number;
  hardCcCount: number;
  highCcCount: number;
  totalCcScore: number;
  adNames: string[];
  apNames: string[];
  ccNames: string[];
}

export function summarizeEnemyDamageAndCc(
  enemyProfiles: ChampionTacticalProfile[],
  catalog: CatalogSnapshot,
): EnemyDamageAndCcSummary {
  let adScore = 0;
  let apScore = 0;
  let aaThreatCount = 0;
  let hardCcCount = 0;
  let highCcCount = 0;
  let totalCcScore = 0;
  const adNames: string[] = [];
  const apNames: string[] = [];
  const ccNames: string[] = [];

  for (const p of enemyProfiles) {
    const name = catalog.champions[p.championId]?.name ?? p.championId;
    if (p.damageType === 'ad') {
      adScore += 1;
      adNames.push(name);
    } else if (p.damageType === 'ap') {
      apScore += 1;
      apNames.push(name);
    } else {
      adScore += 0.5;
      apScore += 0.5;
    }
    if (p.isAutoAttackThreat) aaThreatCount += 1;
    if (p.ccScore >= 3) hardCcCount += 1;
    if (p.ccScore >= 2) {
      highCcCount += 1;
      ccNames.push(name);
    }
    totalCcScore += p.ccScore;
  }

  return {
    adScore,
    apScore,
    aaThreatCount,
    hardCcCount,
    highCcCount,
    totalCcScore,
    adNames,
    apNames,
    ccNames,
  };
}

export function selectOptimalRedBoot(
  enemyProfiles: ChampionTacticalProfile[],
  catalog: CatalogSnapshot,
): { item: BuildBlueprintItem; note: string } {
  if (enemyProfiles.length === 0) {
    return {
      item: {
        id: '3047',
        reason:
          'Botas Galvanizadas de Aço (Tabi): padrão seguro de Rhaast — preencha os inimigos para ajustar automaticamente entre Aço (AD), Mercúrio (CC/AP) e Ionianas.',
      },
      note: 'Preencha os inimigos no draft para escolher a bota exata (Aço vs Mercúrio vs Ionianas).',
    };
  }

  const dmg = summarizeEnemyDamageAndCc(enemyProfiles, catalog);
  const mercScore = dmg.hardCcCount * 2.2 + dmg.highCcCount * 0.9 + dmg.apScore * 1.4;
  const steelcapsScore = dmg.adScore * 1.5 + dmg.aaThreatCount * 1.2;

  // Pouco CC duro e dano equilibrado (sem excesso de AD nem de AP) -> Botas Ionianas
  if (
    dmg.hardCcCount === 0 &&
    dmg.highCcCount <= 1 &&
    dmg.totalCcScore <= 3 &&
    dmg.adScore < 3 &&
    dmg.apScore < 3
  ) {
    const reason = `Botas Ionianas: pouco CC inimigo (${dmg.totalCcScore} pts) e dano misto — acelera rotações de Q/W e Golpear.`;
    return { item: { id: '3158', reason }, note: reason };
  }

  // Muito CC ou muito dano mágico vencendo o peso físico -> Passos de Mercúrio
  if (mercScore >= steelcapsScore && (dmg.highCcCount >= 2 || dmg.apScore >= 2.5)) {
    const ccDetail =
      dmg.ccNames.length > 0 ? ` (${dmg.ccNames.slice(0, 3).join(', ')})` : '';
    const reason = `Passos de Mercúrio: ${dmg.highCcCount} fonte(s) de CC forte${ccDetail} e ${Math.round(dmg.apScore)} fonte(s) de dano mágico.`;
    return { item: { id: '3111', reason }, note: reason };
  }

  // Maioria AD / ameaças de ataque básico -> Botas Galvanizadas de Aço (Tabi Ninja)
  const adDetail =
    dmg.adNames.length > 0 ? ` (${dmg.adNames.slice(0, 3).join(', ')})` : '';
  const aaDetail =
    dmg.aaThreatCount > 0 ? ` · ${dmg.aaThreatCount} dependente(s) de ataque básico` : '';
  const reason = `Botas Galvanizadas de Aço (Tabi): ${Math.round(dmg.adScore)} fonte(s) de dano físico${adDetail}${aaDetail}.`;
  return { item: { id: '3047', reason }, note: reason };
}

export function buildAdaptiveRedCore(
  enemyProfiles: ChampionTacticalProfile[],
  catalog: CatalogSnapshot,
): BuildBlueprintItem[] {
  const dmg = summarizeEnemyDamageAndCc(enemyProfiles, catalog);
  const frontlineCount = enemyProfiles.filter((p) => p.isFrontline).length;
  const heavyHealingCount = enemyProfiles.filter((p) => p.heavyHealing).length;
  const needsAntiHeal =
    heavyHealingCount >= 2 || (heavyHealingCount >= 1 && frontlineCount >= 1);
  const healNames = enemyProfiles
    .filter((p) => p.heavyHealing)
    .map((p) => catalog.champions[p.championId]?.name ?? p.championId);

  const items: BuildBlueprintItem[] = [
    {
      id: '6692',
      reason: '1º item: Eclipse entrega pico forte de duelo, escudo curto e pressão no mid game.',
    },
    {
      id: '3071',
      reason: '2º item: Cutelo Negro dá vida, aceleração e quebra até 30% de armadura em área no Q.',
    },
  ];

  const picked = new Set<string>(items.map((i) => i.id));
  const addItem = (id: string, reason: string) => {
    if (picked.has(id) || items.length >= 5) return;
    // Evita conflito da passiva única Salva-Vidas (Sinal de Sterak 3053 vs Mandíbula de Malmortius 3156)
    if ((id === '3053' && picked.has('3156')) || (id === '3156' && picked.has('3053'))) {
      return;
    }
    picked.add(id);
    items.push({ id, reason });
  };

  const heavyAp = dmg.apScore >= 3 || (dmg.apScore >= 2.5 && dmg.adScore <= 1.5);
  const heavyAd = dmg.adScore >= 3 || (dmg.adScore >= 2.5 && dmg.apScore <= 1.5);

  // 3º item: defesa principal alinhada ao tipo de dano dominante do inimigo
  if (heavyAp) {
    addItem(
      '3065',
      `3º item contra time pesado em AP (${Math.round(dmg.apScore)} fontes): Semblante Espiritual dá RM e amplifica toda a cura do Rhaast.`,
    );
  } else {
    addItem(
      '6333',
      '3º item: Dança da Morte segura burst físico e transforma teamfights com cura em abates.',
    );
  }

  // 4º item: corta-cura se necessário, senão MR (se AP relevante) ou Sterak (contra burst/CC)
  if (needsAntiHeal) {
    const healTag = healNames.length > 0 ? ` (${healNames.slice(0, 3).join(', ')})` : '';
    if (heavyAd) {
      addItem(
        '3075',
        `Contra cura forte${healTag} e time pesado em AD: Armadura de Espinhos corta cura e pune ataques básicos.`,
      );
    } else {
      addItem(
        '6609',
        `Contra cura forte${healTag}: Serrespada Quimiopunk aplica Feridas Dolorosas com vida e aceleração.`,
      );
    }
  }

  if (dmg.apScore >= 2 && !picked.has('3065')) {
    addItem(
      '3065',
      `Contra ${Math.round(dmg.apScore)} fonte(s) de AP: Semblante Espiritual dá RM e turbina a cura das habilidades do Rhaast.`,
    );
  }

  if (dmg.adScore >= 2 && !picked.has('6333')) {
    addItem(
      '6333',
      `Contra ${Math.round(dmg.adScore)} fonte(s) de AD: Dança da Morte absorve burst físico e prolonga a luta.`,
    );
  }

  // 5º item / preenchimento até completar os 5 itens lendários
  if (dmg.apScore >= 3.5 && !picked.has('3053')) {
    addItem(
      '3156',
      'Contra composição quase 100% mágica: Mandíbula de Malmortius entrega escudo anti-AP e omnivamp.',
    );
  }

  addItem(
    '3053',
    'Sinal de Sterak: escudo anti-burst + tenacidade para segurar lutas 5v5 de objetivo.',
  );

  if (frontlineCount >= 2) {
    addItem(
      '3161',
      `Contra ${frontlineCount} frontlines inimigas: Lança de Shojin amplifica dano de Q/W/R e acelera rotações em lutas longas.`,
    );
  }

  addItem(
    '3065',
    'Semblante Espiritual: fechamento defensivo que potencializa a cura natural do Rhaast e de Eclipse/Conquistador.',
  );
  addItem(
    '3026',
    'Anjo Guardião: segunda vida nas lutas decisivas de Barão e Dragão Ancião.',
  );

  return items;
}

export interface BuildBlueprintItem {
  id: string;
  reason: string;
}

const BLUE_TIER1_BOOTS_ITEM: BuildBlueprintItem = {
  id: '1001', // Botas (Tier 1)
  reason:
    'KarasMaii (26.23): fique apenas com Botas Tier 1 (300g) após Youmuu — nunca evolua para Tier 2. Venda no full build para fechar o 6º item.',
};

export const BLUE_BUILD_VARIANTS: Record<
  BlueBuildVariantKey,
  {
    variantLabel: string;
    junglePet: BuildBlueprintItem;
    boots: BuildBlueprintItem[];
    bootsNote: string;
    secondItem: BuildBlueprintItem;
    fullBuildBootReplacement: BuildBlueprintItem;
  }
> = {
  blue_standard: {
    variantLabel: 'Padrão (sem muito CC/escudos) · Karasmai 26.23',
    junglePet: {
      id: '1102', // Cria de Andabrisas
      reason: 'Velocidade de movimento nos arbustos/rio acelera ângulos de flanco pelo E.',
    },
    boots: [BLUE_TIER1_BOOTS_ITEM],
    bootsNote: 'Apenas Botas Tier 1 (300g) — com Youmuu não evolua para Tier 2; venda no full build para Limiar da Noite.',
    secondItem: {
      id: '6696', // Arco do Axioma
      reason: '2º item sem excesso de CC/escudos (KarasMaii 26.23): reduz recarga do R em abates e acelera o snowball.',
    },
    fullBuildBootReplacement: {
      id: '3814', // Limiar da Noite
      reason: 'No full build, venda as Botas Tier 1 e compre Limiar da Noite para entrar com escudo de feitiço no late game.',
    },
  },
  blue_cc: {
    variantLabel: 'Contra muito CC · Karasmai 26.23',
    junglePet: {
      id: '1102', // Cria de Andabrisas
      reason: 'Velocidade de movimento nos arbustos/rio acelera ângulos de flanco pelo E.',
    },
    boots: [BLUE_TIER1_BOOTS_ITEM],
    bootsNote: 'Apenas Botas Tier 1 (300g) — com Youmuu não evolua para Tier 2; venda no full build para Arco do Axioma.',
    secondItem: {
      id: '3814', // Limiar da Noite
      reason: '2º item contra muito CC (KarasMaii 26.23): escudo de feitiço protege a entrada pela parede sem tomar controle seco.',
    },
    fullBuildBootReplacement: {
      id: '6696', // Arco do Axioma
      reason: 'No full build, venda as Botas Tier 1 e compre Arco do Axioma para multiplicar resets de R nas lutas finais.',
    },
  },
  blue_shields: {
    variantLabel: 'Contra muitos escudos · Karasmai 26.23',
    junglePet: {
      id: '1102', // Cria de Andabrisas
      reason: 'Velocidade de movimento nos arbustos/rio acelera ângulos de flanco pelo E.',
    },
    boots: [BLUE_TIER1_BOOTS_ITEM],
    bootsNote: 'Apenas Botas Tier 1 (300g) — com Youmuu não evolua para Tier 2; venda no full build para Arco do Axioma.',
    secondItem: {
      id: '6695', // Presa da Serpente
      reason: '2º item contra muitos escudos (KarasMaii 26.23): corta escudos pela metade com custo baixo (2500g) para garantir o burst.',
    },
    fullBuildBootReplacement: {
      id: '6696', // Arco do Axioma
      reason: 'No full build, venda as Botas Tier 1 e compre Arco do Axioma para multiplicar resets de R nas lutas finais.',
    },
  },
};

export const BLUE_BUILD_BLUEPRINT = {
  junglePet: BLUE_BUILD_VARIANTS.blue_standard.junglePet,
  boots: BLUE_BUILD_VARIANTS.blue_standard.boots,
  core: [
    {
      id: '3142',
      reason:
        '1º item (KarasMaii 26.23): Lâmina Fantasma de Youmuu entrega letalidade e velocidade de movimento suficientes para dispensar Botas Tier 2.',
    },
    BLUE_BUILD_VARIANTS.blue_standard.secondItem,
    {
      id: '3036',
      reason:
        '3º item (KarasMaii 26.23): Lembranças do Lorde Dominik para penetração % de armadura (troque por Lembrete Mortal 3033 contra muita cura).',
    },
    {
      id: '2517',
      reason:
        '4º item (KarasMaii 26.23): Fome Eterna (Endless Hunger) entrega muita aceleração de habilidade no mid-late game para fechar partidas.',
    },
    {
      id: '3026',
      reason:
        '5º item (KarasMaii 26.23): Anjo Guardião segura o mergulho final nos carregadores em lutas de objetivo.',
    },
  ] as BuildBlueprintItem[],
};

export const RED_BUILD_BLUEPRINT = {
  junglePet: {
    id: '1103', // Broto de Esmagamusgo
    reason: 'Escudo e tenacidade em lutas prolongadas dentro da frontline inimiga.',
  },
  boots: [
    { id: '3047', reason: 'Botas Galvanizadas de Aço contra 2+ fontes fortes de dano físico/ataque básico.' },
    { id: '3111', reason: 'Passos de Mercúrio contra alto controle de grupo ou dano mágico forte.' },
    { id: '3158', reason: 'Botas Ionianas quando o inimigo tem pouco CC duro e você quer mais Q/W.' },
  ],
  core: [
    { id: '6692', reason: 'Eclipse: pico forte de 1º item para duelo, escudo curto e pressão no mid game.' },
    { id: '3071', reason: 'Cutelo Negro: vida, aceleração e redução de armadura em área no Q para o time todo.' },
    { id: '6333', reason: 'Dança da Morte: segura burst físico e transforma teamfights com cura em abates.' },
  ],
};

export const OPEN_BUILD_BLUEPRINT = {
  junglePet: {
    id: '1101', // Filhote de Garrabrasa
    reason: 'Opção neutra de duelo enquanto a forma ainda está em aberto no draft.',
  },
  boots: [
    { id: '1001', reason: 'Segure Botas Tier 1 até confirmar a forma: de Azul não evolua para Tier 2; de Rhaast feche Aço/Mercúrio.' },
    { id: '3158', reason: 'Ionianas como opção alternativa se virar Rhaast contra pouco CC.' },
  ],
  core: [
    { id: '3134', reason: 'Punhal Serrilhado ou componentes de AD/Aceleração até confirmar a forma antes de fechar o 1º item.' },
    { id: '6692', reason: 'Eclipse funciona bem se precisar virar Rhaast Bruiser.' },
    { id: '3142', reason: 'Lâmina Fantasma de Youmuu se os alvos frágeis ficarem expostos e confirmar Kayn Azul (guia KarasMaii 26.23).' },
  ],
};

export function collectBlueprintItemIds(): string[] {
  const ids = new Set<string>([
    BLUE_BUILD_BLUEPRINT.junglePet.id,
    RED_BUILD_BLUEPRINT.junglePet.id,
    OPEN_BUILD_BLUEPRINT.junglePet.id,
    // Itens do guia KarasMaii 26.23 (todas as variantes do Kayn Azul)
    '1001', // Botas Tier 1
    '3142', // Lâmina Fantasma de Youmuu
    '3814', // Limiar da Noite
    '6695', // Presa da Serpente
    '6696', // Arco do Axioma
    '3036', // Lembranças do Lorde Dominik
    '3033', // Lembrete Mortal
    '2517', // Fome Eterna (Endless Hunger)
    '3026', // Anjo Guardião
    // Situacionais adicionais (separados por forma)
    '6694', // Rancor de Serylda (alternativa de slow/haste no Azul)
    '6697', // Húbris (alternativa de snowball no Azul)
    '3161', // Lança de Shojin (Rhaast)
    '6610', // Céu Dividido (Rhaast)
    '6333', // Dança da Morte (Rhaast)
    '3053', // Sinal de Sterak (Rhaast)
    '3156', // Mandíbula de Malmortius (Rhaast)
    '3065', // Semblante Espiritual (Rhaast)
    '3075', // Armadura de Espinhos (Rhaast)
    '3123', // Chamado do Carrasco
    '6609', // Serrespada Quimiopunk
  ]);
  for (const variant of Object.values(BLUE_BUILD_VARIANTS)) {
    ids.add(variant.junglePet.id);
    variant.boots.forEach((b) => ids.add(b.id));
    ids.add(variant.secondItem.id);
    ids.add(variant.fullBuildBootReplacement.id);
  }
  for (const b of [
    ...BLUE_BUILD_BLUEPRINT.boots,
    ...BLUE_BUILD_BLUEPRINT.core,
    ...RED_BUILD_BLUEPRINT.boots,
    ...RED_BUILD_BLUEPRINT.core,
    ...OPEN_BUILD_BLUEPRINT.boots,
    ...OPEN_BUILD_BLUEPRINT.core,
  ]) {
    ids.add(b.id);
  }
  return Array.from(ids);
}

export function collectBlueprintRuneIds(): number[] {
  const ids = new Set<number>();
  for (const bp of getAllRuneBlueprints()) {
    ids.add(bp.primaryTreeId);
    ids.add(bp.secondaryTreeId);
    bp.primaryRuneIds.forEach((id) => ids.add(id));
    bp.secondaryRuneIds.forEach((id) => ids.add(id));
  }
  return Array.from(ids);
}

export function collectBlueprintStatShardIds(): number[] {
  const ids = new Set<number>();
  for (const bp of getAllRuneBlueprints()) {
    bp.statShardIds.forEach((id) => ids.add(id));
  }
  return Array.from(ids);
}

function resolveTree(catalog: CatalogSnapshot, treeId: number) {
  return catalog.runeTrees.find((t) => t.id === treeId) ?? null;
}

function resolvePrimaryRuneEntry(
  catalog: CatalogSnapshot,
  treeId: number,
  runeId: number,
  expectedSlotIndex: number,
): RuneEntryRef {
  const tree = resolveTree(catalog, treeId);
  const slot = tree?.slots?.[expectedSlotIndex];
  const found = slot?.runes?.find((r) => r.id === runeId);
  if (!found) {
    return {
      id: runeId,
      name: `Revisão necessária (runa #${runeId})`,
      icon: null,
      slotIndex: expectedSlotIndex,
      validInCatalog: false,
      revisionStatus: 'needs_review',
    };
  }
  return {
    id: found.id,
    name: found.name,
    icon: found.icon || null,
    slotIndex: expectedSlotIndex,
    validInCatalog: true,
    revisionStatus: 'valid',
  };
}

function resolveSecondaryRuneEntries(
  catalog: CatalogSnapshot,
  treeId: number,
  runeIds: [number, number],
): RuneEntryRef[] {
  const tree = resolveTree(catalog, treeId);
  const usedSlots = new Set<number>();

  return runeIds.map((runeId) => {
    if (!tree) {
      return {
        id: runeId,
        name: `Revisão necessária (runa #${runeId})`,
        icon: null,
        slotIndex: -1,
        validInCatalog: false,
        revisionStatus: 'needs_review',
      };
    }

    for (let slotIndex = 1; slotIndex < tree.slots.length; slotIndex += 1) {
      const found = tree.slots[slotIndex]?.runes?.find((r) => r.id === runeId);
      if (found) {
        if (usedSlots.has(slotIndex)) {
          return {
            id: runeId,
            name: `Revisão necessária (slot repetido #${runeId})`,
            icon: null,
            slotIndex,
            validInCatalog: false,
            revisionStatus: 'needs_review',
          };
        }
        usedSlots.add(slotIndex);
        return {
          id: found.id,
          name: found.name,
          icon: found.icon || null,
          slotIndex,
          validInCatalog: true,
          revisionStatus: 'valid',
        };
      }
    }

    return {
      id: runeId,
      name: `Revisão necessária (runa #${runeId})`,
      icon: null,
      slotIndex: -1,
      validInCatalog: false,
      revisionStatus: 'needs_review',
    };
  });
}

function resolveStatShardEntry(
  catalog: CatalogSnapshot,
  shardId: number,
  rowIndex: number,
): StatShardRef {
  const expectedRow: StatShardRef['row'] =
    rowIndex === 0 ? 'offense' : rowIndex === 1 ? 'flex' : 'defense';

  const catalogShard = catalog.statShards?.find((s) => s.id === shardId);
  if (catalogShard) {
    return {
      id: catalogShard.id,
      name: catalogShard.name,
      shortLabel: catalogShard.shortLabel,
      row: expectedRow,
      icon: catalogShard.icon || null,
      validInCatalog: true,
    };
  }

  const fallback = DEFAULT_STAT_SHARD_FALLBACKS[shardId];
  if (fallback) {
    return {
      id: fallback.id,
      name: fallback.name,
      shortLabel: fallback.shortLabel,
      row: expectedRow,
      icon: null,
      validInCatalog: !catalog.statShards,
    };
  }

  return {
    id: shardId,
    name: `Revisão necessária (fragmento #${shardId})`,
    shortLabel: 'Revisão',
    row: expectedRow,
    icon: null,
    validInCatalog: false,
  };
}

export function buildRuneRecommendation(
  form: KaynFormChoice,
  catalog: CatalogSnapshot,
  enemyProfiles: ChampionTacticalProfile[] = [],
): RuneRecommendation {
  const variantKey: BlueBuildVariantKey | 'red' | 'open' =
    form === 'blue' ? selectBlueKaynVariant(enemyProfiles) : form;

  const bp =
    form === 'blue'
      ? BLUE_RUNE_VARIANTS[variantKey as BlueBuildVariantKey]
      : RUNE_BLUEPRINTS[form];

  const primaryTree = resolveTree(catalog, bp.primaryTreeId);
  const secondaryTree = resolveTree(catalog, bp.secondaryTreeId);

  const primaryRunes = bp.primaryRuneIds.map((id, idx) =>
    resolvePrimaryRuneEntry(catalog, bp.primaryTreeId, id, idx),
  );
  const secondaryRunes = resolveSecondaryRuneEntries(
    catalog,
    bp.secondaryTreeId,
    bp.secondaryRuneIds,
  );
  const statShardRefs = bp.statShardIds.map((id, idx) =>
    resolveStatShardEntry(catalog, id, idx),
  );

  const hasInvalidRunes =
    !primaryTree ||
    !secondaryTree ||
    primaryRunes.some((r) => !r.validInCatalog) ||
    secondaryRunes.some((r) => !r.validInCatalog) ||
    statShardRefs.some((s) => !s.validInCatalog);

  const patchMismatchNote =
    catalog.patch !== BUILD_DATA_META.validatedPatch
      ? ` Atenção: recomendações revisadas para o patch ${BUILD_DATA_META.validatedPatch}, enquanto o catálogo ativo está no ${catalog.patch}.`
      : '';

  const revisionNotice = hasInvalidRunes
    ? `Revisão necessária: uma ou mais runas desta página não existem no catálogo ativo (${catalog.patch}) e não foram substituídas silenciosamente.`
    : undefined;

  return {
    formLabel: bp.formLabel,
    variantKey,
    variantLabel: bp.variantLabel,
    summonerSpells: [...bp.summonerSpells],
    summonerSpellsNote: bp.summonerSpellsNote,
    primaryTreeId: bp.primaryTreeId,
    primaryTreeName: primaryTree?.name ?? `Revisão necessária (árvore #${bp.primaryTreeId})`,
    primaryTreeIcon: primaryTree?.icon || null,
    primaryRunes,
    secondaryTreeId: bp.secondaryTreeId,
    secondaryTreeName: secondaryTree?.name ?? `Revisão necessária (árvore #${bp.secondaryTreeId})`,
    secondaryTreeIcon: secondaryTree?.icon || null,
    secondaryRunes,
    statShards: statShardRefs.map((s) => s.name),
    statShardRefs,
    statShardsNote: `Fragmentos revisados para o patch ${BUILD_DATA_META.validatedPatch}.${patchMismatchNote}`,
    whyFormDiffers: bp.whyFormDiffers,
    alternativeNote: bp.alternativeNote,
    validatedPatch: BUILD_DATA_META.validatedPatch,
    hasInvalidRunes,
    revisionNotice,
  };
}

function resolveItemRef(
  catalog: CatalogSnapshot,
  id: string,
  reason: string,
): BuildItemRef {
  const item = catalog.items[id];
  if (!item || !item.maps11 || !item.purchasable) {
    return {
      id,
      name: `Revisão necessária (item #${id})`,
      gold: 0,
      reason: `Item #${id} indisponível ou removido do Summoner's Rift no patch ${catalog.patch}.`,
      availableInCatalog: false,
      icon: null,
      revisionStatus: 'needs_review',
    };
  }
  return {
    id: item.id,
    name: item.name,
    gold: item.gold,
    reason,
    availableInCatalog: true,
    icon: item.imageFull || `${item.id}.png`,
    revisionStatus: 'valid',
  };
}

export function buildItemRecommendation(
  form: KaynFormChoice,
  enemyProfiles: ChampionTacticalProfile[],
  catalog: CatalogSnapshot,
): BuildRecommendation {
  const squishyCount = enemyProfiles.filter((p) => p.isSquishyTarget).length;
  const frontlineCount = enemyProfiles.filter((p) => p.isFrontline).length;
  const heavyArmorCount = enemyProfiles.filter((p) => p.heavyArmorUser).length;
  const heavyHealingCount = enemyProfiles.filter((p) => p.heavyHealing).length;
  const hasShieldPriority = hasHighShieldThreat(enemyProfiles);
  const highCcCount = enemyProfiles.filter((p) => p.ccScore >= 2).length;
  const needsAntiHeal =
    heavyHealingCount >= 2 || (heavyHealingCount >= 1 && frontlineCount >= 1);

  const healChampions = enemyProfiles
    .filter((p) => p.heavyHealing)
    .map((p) => catalog.champions[p.championId]?.name ?? p.championId);
  const shieldChampions = enemyProfiles
    .filter((p) => p.heavyShields)
    .map((p) => catalog.champions[p.championId]?.name ?? p.championId);
  const armorChampions = enemyProfiles
    .filter((p) => p.heavyArmorUser || p.isFrontline)
    .map((p) => catalog.champions[p.championId]?.name ?? p.championId);

  let variantKey: BlueBuildVariantKey | 'red' | 'open';
  let variantLabel: string | undefined;
  let bootsNote: string | undefined;
  let fullBuildBootReplacement: BuildItemRef | undefined;
  let junglePet: BuildItemRef;
  let boots: BuildItemRef[];
  let core: BuildItemRef[];

  if (form === 'blue') {
    const blueVariantKey = selectBlueKaynVariant(enemyProfiles);
    const blueVariant = BLUE_BUILD_VARIANTS[blueVariantKey];
    variantKey = blueVariantKey;
    variantLabel = blueVariant.variantLabel;
    bootsNote = blueVariant.bootsNote;

    const armorPenThirdItem: BuildBlueprintItem = needsAntiHeal
      ? {
          id: '3033',
          reason:
            '3º item contra muita cura (KarasMaii 26.23): Lembrete Mortal combina penetração % de armadura com Feridas Dolorosas no lugar de Lembranças do Lorde Dominik.',
        }
      : {
          id: '3036',
          reason:
            '3º item padrão (KarasMaii 26.23): Lembranças do Lorde Dominik para máxima penetração % de armadura (troque por Lembrete Mortal 3033 se houver muita cura inimiga).',
        };

    // Se o inimigo tiver MUITO CC extremo E também encantador de escudos (ex.: Lissandra + Nautilus + Lulu/Milio),
    // inclui Presa da Serpente dentro da build completa além de Limiar da Noite!
    const blueCoreBlueprint: BuildBlueprintItem[] =
      blueVariantKey === 'blue_cc' && hasShieldPriority
        ? [
            BLUE_BUILD_BLUEPRINT.core[0], // 3142 Youmuu
            blueVariant.secondItem, // 3814 Limiar da Noite
            armorPenThirdItem, // 3036 Lord Dominik | 3033 Lembrete Mortal
            {
              id: '6695',
              reason: `4º item adaptativo contra escudos (${shieldChampions.slice(0, 2).join(', ') || 'encantador'}): Presa da Serpente entra na build mesmo priorizando Limiar da Noite 2º contra o CC.`,
            },
            BLUE_BUILD_BLUEPRINT.core[3], // 2517 Fome Eterna
          ]
        : [
            BLUE_BUILD_BLUEPRINT.core[0], // 3142 Youmuu
            blueVariant.secondItem, // 6696 Axioma | 3814 Limiar da Noite | 6695 Presa da Serpente
            armorPenThirdItem, // 3036 Lord Dominik | 3033 Lembrete Mortal
            BLUE_BUILD_BLUEPRINT.core[3], // 2517 Fome Eterna (Endless Hunger)
            BLUE_BUILD_BLUEPRINT.core[4], // 3026 Anjo Guardião
          ];

    const bootReplacementItem: BuildBlueprintItem =
      blueVariantKey === 'blue_cc' && hasShieldPriority
        ? {
            id: '3026',
            reason:
              'No full build, venda as Botas Tier 1 e feche Anjo Guardião para segurar as lutas finais.',
          }
        : blueVariant.fullBuildBootReplacement;

    junglePet = resolveItemRef(
      catalog,
      blueVariant.junglePet.id,
      blueVariant.junglePet.reason,
    );
    boots = blueVariant.boots.map((b) => resolveItemRef(catalog, b.id, b.reason));
    core = blueCoreBlueprint.map((c) => resolveItemRef(catalog, c.id, c.reason));
    fullBuildBootReplacement = resolveItemRef(
      catalog,
      bootReplacementItem.id,
      bootReplacementItem.reason,
    );
  } else if (form === 'red') {
    variantKey = 'red';
    const optimalBoot = selectOptimalRedBoot(enemyProfiles, catalog);
    const adaptiveRedCore = buildAdaptiveRedCore(enemyProfiles, catalog);
    variantLabel = 'Bruiser · Rhaast (Build completa)';
    bootsNote = optimalBoot.note;
    junglePet = resolveItemRef(
      catalog,
      RED_BUILD_BLUEPRINT.junglePet.id,
      RED_BUILD_BLUEPRINT.junglePet.reason,
    );
    boots = [resolveItemRef(catalog, optimalBoot.item.id, optimalBoot.item.reason)];
    core = adaptiveRedCore.map((c) => resolveItemRef(catalog, c.id, c.reason));
  } else {
    variantKey = 'open';
    const projectedRedBoot = selectOptimalRedBoot(enemyProfiles, catalog);
    const projectedBootName =
      catalog.items[projectedRedBoot.item.id]?.name ?? 'Botas defensivas';
    variantLabel = 'Flexível (aguardando forma)';
    bootsNote = `Segure Botas Tier 1 (300g) até definir a forma: se virar Azul não evolua para Tier 2; se virar Rhaast feche ${projectedBootName}.`;
    junglePet = resolveItemRef(
      catalog,
      OPEN_BUILD_BLUEPRINT.junglePet.id,
      OPEN_BUILD_BLUEPRINT.junglePet.reason,
    );
    boots = [resolveItemRef(catalog, '1001', bootsNote)];
    core = [
      resolveItemRef(
        catalog,
        '3134',
        'Punhal Serrilhado ou componentes de AD/Aceleração até confirmar a forma antes de fechar o 1º item.',
      ),
      resolveItemRef(catalog, '6692', 'Eclipse caso o draft feche em Rhaast Bruiser.'),
      resolveItemRef(
        catalog,
        '3142',
        'Lâmina Fantasma de Youmuu caso confirme Kayn Azul (guia KarasMaii 26.23).',
      ),
      resolveItemRef(catalog, '3071', 'Cutelo Negro como 2º item no plano Rhaast.'),
      resolveItemRef(catalog, '3026', 'Anjo Guardião como fechamento defensivo versátil em ambas as formas.'),
    ];
  }

  const situational: SituationalBuildCategory[] = [
    {
      key: 'armadura_adversaria',
      label: 'Armadura adversária',
      shortCondition: 'Contra armadura',
      activeInDraft: heavyArmorCount >= 1 || frontlineCount >= 2,
      triggerReason:
        armorChampions.length > 0
          ? `Alvos que acumulam armadura: ${armorChampions.join(', ')}.`
          : 'Quando inimigos compram armadura cedo.',
      items:
        form === 'blue'
          ? [
              resolveItemRef(
                catalog,
                needsAntiHeal ? '3033' : '3036',
                needsAntiHeal
                  ? 'Lembrete Mortal: 3º item do guia KarasMaii (26.23) unindo penetração % e corta-cura.'
                  : 'Lembranças do Lorde Dominik: 3º item principal de penetração % no guia KarasMaii (26.23).',
              ),
              resolveItemRef(
                catalog,
                '6694',
                'Rancor de Serylda: alternativa caso queira mais aceleração e slow no W/Q.',
              ),
            ]
          : [
              resolveItemRef(
                catalog,
                '3071',
                'Cutelo Negro: quebra até 30% da armadura para o seu ADC também bater.',
              ),
            ],
    },
    {
      key: 'sobrevivencia',
      label: 'Sobrevivência / CC / Burst',
      shortCondition: 'Contra muito CC ou burst',
      activeInDraft:
        highCcCount >= 2 || enemyProfiles.some((p) => p.fightStyle === 'short_burst'),
      triggerReason:
        highCcCount >= 2
          ? `${highCcCount} inimigos com controle de grupo forte.`
          : 'Segura pickoff inimigo antes da entrada ou após sair do R.',
      items:
        form === 'blue'
          ? [
              resolveItemRef(
                catalog,
                '3814',
                'Limiar da Noite: entra como 2º item contra muito CC ou no lugar das Botas no full build (KarasMaii 26.23).',
              ),
              resolveItemRef(
                catalog,
                '3026',
                'Anjo Guardião: 5º item padrão do guia KarasMaii (26.23) para garantir lutas decisivas.',
              ),
            ]
          : [
              resolveItemRef(catalog, '3065', 'Semblante Espiritual: amplifica cura do Rhaast e MR contra magos.'),
              resolveItemRef(catalog, '3053', 'Sinal de Sterak: escudo anti-burst + tenacidade em lutas 5v5.'),
              resolveItemRef(catalog, '3156', 'Mandíbula de Malmortius: contra duplo dano mágico / burst AP.'),
              resolveItemRef(catalog, '3026', 'Anjo Guardião: seguro extra em lutas decisivas de objetivo.'),
            ],
    },
    {
      key: 'excesso_escudos',
      label: 'Excesso de escudos inimigos',
      shortCondition: 'Contra escudos',
      activeInDraft: hasShieldPriority,
      triggerReason:
        shieldChampions.length > 0
          ? `Escudos relevantes em: ${shieldChampions.join(', ')}.`
          : 'Contra campeões que geram muito escudo (encantadores, tanques/lutadores de escudo ou 2+ fontes).',
      items: [
        resolveItemRef(
          catalog,
          '6695',
          'Presa da Serpente: corta escudos pela metade (2500g) — entra automaticamente na build do Azul contra qualquer gerador massivo de escudo ou 2+ fontes de escudo.',
        ),
      ],
    },
    {
      key: 'excesso_cura',
      label: 'Excesso de cura inimiga',
      shortCondition: 'Contra muita cura',
      activeInDraft: needsAntiHeal,
      triggerReason:
        healChampions.length > 0
          ? `Cura forte em: ${healChampions.join(', ')}.`
          : 'Contra campeões ou itens com muita cura.',
      items:
        form === 'red'
          ? [
              resolveItemRef(catalog, '3123', 'Chamado do Carrasco (800g): segure o componente cedo sem atrasar seu núcleo.'),
              resolveItemRef(catalog, '3075', 'Armadura de Espinhos: corta cura contra times pesados em AD/ataque básico.'),
              resolveItemRef(catalog, '6609', 'Serrespada Quimiopunk: fechamento com vida e aceleração.'),
            ]
          : [
              resolveItemRef(
                catalog,
                '3033',
                'Lembrete Mortal: substitui Lembranças do Lorde Dominik no 3º slot da build KarasMaii (26.23) contra muita cura.',
              ),
              resolveItemRef(
                catalog,
                '3123',
                'Chamado do Carrasco (800g): antecipe o componente se a cura inimiga estiver fora de controle antes do 3º item.',
              ),
            ],
    },
    ...(form !== 'red'
      ? [
          {
            key: 'alvo_fragil' as const,
            label: 'Snowball / Reset de Ultimate',
            shortCondition: 'Snowball / Full build',
            activeInDraft: form === 'blue' && squishyCount >= 3,
            triggerReason:
              squishyCount >= 3
                ? `${squishyCount} alvos frágeis na composição inimiga.`
                : 'Amplifica ritmo de abates e resets de R em lutas curtas.',
            items: [
              resolveItemRef(
                catalog,
                '6696',
                'Arco do Axioma: 2º item no padrão KarasMaii (26.23) ou 6º item no lugar das Botas Tier 1.',
              ),
              resolveItemRef(
                catalog,
                '6697',
                'Húbris: alternativa situacional se estiver muito na frente cedo e quiser empilhar AD bruto.',
              ),
            ],
          },
        ]
      : []),
    ...(form !== 'blue'
      ? [
          {
            key: 'frontline_inimiga' as const,
            label: 'Frontline inimiga / Luta longa',
            shortCondition: 'Contra frontline pesada',
            activeInDraft: form === 'red' && frontlineCount >= 2,
            triggerReason:
              frontlineCount >= 2
                ? `${frontlineCount} campeões de linha de frente no time inimigo.`
                : 'Para estender trocas contra lutadores e tanques.',
            items: [
              resolveItemRef(catalog, '3161', 'Lança de Shojin: amplifica dano de Q/W/R e acelera rotações em lutas longas.'),
              resolveItemRef(catalog, '6610', 'Céu Dividido: sustentação imediata ao trocar alvo dentro da frontline.'),
            ],
          },
        ]
      : []),
  ];

  const hasInvalidItems =
    !junglePet.availableInCatalog ||
    boots.some((b) => !b.availableInCatalog) ||
    core.some((c) => !c.availableInCatalog) ||
    Boolean(fullBuildBootReplacement && !fullBuildBootReplacement.availableInCatalog);

  const patchWarning =
    catalog.patch !== BUILD_DATA_META.validatedPatch
      ? `Catálogo está no patch ${catalog.patch}, mas os perfis de build foram revisados no patch ${BUILD_DATA_META.validatedPatch}. Confira se nenhum item foi alterado.`
      : hasInvalidItems
        ? `Revisão necessária: um ou mais itens recomendados não estão disponíveis no Summoner's Rift (${catalog.patch}).`
        : undefined;

  return {
    form,
    variantKey,
    variantLabel,
    junglePet,
    boots,
    bootsNote,
    fullBuildBootReplacement,
    core,
    situational,
    validatedPatch: BUILD_DATA_META.validatedPatch,
    hasInvalidItems,
    patchWarning,
  };
}
