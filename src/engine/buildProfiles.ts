import type {
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
  buildVersion: '2026.11-kayn-16.23.1-v3',
  validatedPatch: '16.23.1',
  source:
    "Recomendações revisadas para Kayn Jungle (Summoner's Rift, IDs e ícones conferidos no Data Dragon BR 16.23.1 pt_BR)",
  updatedAt: '2026-11-19',
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
  primaryTreeId: number;
  primaryRuneIds: [number, number, number, number];
  secondaryTreeId: number;
  secondaryRuneIds: [number, number];
  statShardIds: [number, number, number];
  whyFormDiffers: string;
  alternativeNote: string;
}

export const RUNE_BLUEPRINTS: Record<'blue' | 'red' | 'open', StaticRuneBlueprint> = {
  blue: {
    formLabel: 'Kayn Azul — Explosão e Reset',
    primaryTreeId: 8100, // Dominação
    primaryRuneIds: [8128, 8143, 8140, 8135], // Colheita Sombria, Impacto Repentino, Lembranças Aterrorizantes, Caçador de Tesouros
    secondaryTreeId: 8300, // Inspiração
    secondaryRuneIds: [8304, 8347], // Calçados Mágicos, Perspicácia Cósmica
    statShardIds: [5008, 5008, 5011], // Força Adaptativa, Força Adaptativa, Vida Base
    whyFormDiffers:
      'Azul joga por burst curto em alvos frágeis e ritmo de mapa. Colheita Sombria + Impacto Repentino somam dano imediato ao sair da parede com E/Q, enquanto Inspiração economiza 300g da bota e reduz o tempo de Flash/Golpear. Conquistador perde valor aqui porque lutas do Azul duram 1-3 segundos.',
    alternativeNote:
      'Se optar por Feitiçaria secundária em jogos de muita rotação: Arcanista do Axioma (8224) + Transcendência (8210). Se o plano virar Rhaast no lobby, troque para Precisão (Conquistador).',
  },
  red: {
    formLabel: 'Rhaast — Luta Longa e Cura',
    primaryTreeId: 8000, // Precisão
    primaryRuneIds: [8010, 9111, 9105, 8299], // Conquistador, Triunfo, Lenda: Aceleração, Até a Morte
    secondaryTreeId: 8300, // Inspiração
    secondaryRuneIds: [8304, 8347], // Calçados Mágicos, Perspicácia Cósmica
    statShardIds: [5008, 5008, 5001], // Força Adaptativa, Força Adaptativa, Vida Escalável
    whyFormDiffers:
      'Rhaast quer prolongar trocas e curar com dano de habilidades. Conquistador empilha AD + cura contínua, Triunfo sustenta resets em 2v2/teamfight, Lenda: Aceleração acelera rotações de Q/W e Até a Morte aumenta cura e dano em vida baixa. Dominação de runa principal deixa Rhaast sem fôlego após a primeira rotação.',
    alternativeNote:
      'Contra muito poke/CC onde queira mais resistência no mid game: Determinação secundária com Condicionamento (8429) + Revitalizar (8453).',
  },
  open: {
    formLabel: 'Indefinido — Página Segura até Definir no Lobby',
    primaryTreeId: 8000, // Precisão (segura bem os dois planos se o draft ainda está aberto)
    primaryRuneIds: [8010, 9111, 9105, 8014], // Conquistador, Triunfo, Lenda: Aceleração, Golpe de Misericórdia
    secondaryTreeId: 8300, // Inspiração
    secondaryRuneIds: [8304, 8347],
    statShardIds: [5008, 5008, 5011],
    whyFormDiffers:
      'Com a forma ainda aberta ou draft incompleto, Conquistador é a página mais segura porque Rhaast funciona perfeitamente com ela e o Azul ainda aproveita AD acumulado em escaramuças, enquanto Colheita Sombria trava muito o potencial de um Rhaast forçado.',
    alternativeNote:
      'Assim que os últimos picks inimigos fecharem: 3+ alvos frágeis sem peel pesado -> mude para Dominação (Colheita Sombria). 2+ frontline/peel duro -> mantenha Conquistador e troque Golpe de Misericórdia por Até a Morte (8299).',
  },
};

export interface BuildBlueprintItem {
  id: string;
  reason: string;
}

export const BLUE_BUILD_BLUEPRINT = {
  junglePet: {
    id: '1102', // Cria de Andabrisas
    reason: 'Velocidade de movimento nos arbustos/rio acelera ângulos de flanco pelo E.',
  },
  boots: [
    { id: '3158', reason: 'Padrão: aceleração para Q/E/R e Feitiços de Invocador mais frequentes.' },
    { id: '3009', reason: 'Alternativa de tempo de mapa quando precisa cruzar o mapa muito rápido.' },
  ],
  core: [
    { id: '6697', reason: 'Húbris: 1º item forte para snowball e empilhar AD em abates cedo.' },
    { id: '3142', reason: 'Lâmina Fantasma de Youmuu: velocidade de movimento e letalidade para achar ângulos sem queimar E.' },
    { id: '6696', reason: 'Arco do Axioma: reduz recarga do R em abates e mantém pressão em lutas seguidas.' },
  ],
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
    { id: '3158', reason: 'Ionianas mantém flexibilidade entre Azul e Rhaast nos primeiros resets.' },
  ],
  core: [
    { id: '3134', reason: 'Punhal Serrilhado ou componentes de AD/Aceleração até confirmar a forma antes de fechar o 1º item.' },
    { id: '6692', reason: 'Eclipse funciona bem se precisar virar Rhaast e ainda entrega pico decente cedo.' },
    { id: '3142', reason: 'Lâmina Fantasma de Youmuu se os alvos frágeis ficarem expostos e confirmar Azul.' },
  ],
};

export function collectBlueprintItemIds(): string[] {
  const ids = new Set<string>([
    BLUE_BUILD_BLUEPRINT.junglePet.id,
    RED_BUILD_BLUEPRINT.junglePet.id,
    OPEN_BUILD_BLUEPRINT.junglePet.id,
    // Situacionais (separados por forma)
    '6699', // Cicloespada Voltaica (Azul)
    '6694', // Rancor de Serylda (Azul)
    '3814', // Limiar da Noite (Azul)
    '6695', // Presa da Serpente (Azul / Rhaast contra escudos)
    '3004', // Manamune (Azul em jogos de escala)
    '3161', // Lança de Shojin (Rhaast)
    '6610', // Céu Dividido (Rhaast)
    '6333', // Dança da Morte (Rhaast)
    '3053', // Sinal de Sterak (Rhaast)
    '3156', // Mandíbula de Malmortius (Rhaast)
    '3065', // Semblante Espiritual (Rhaast)
    '3026', // Anjo Guardião
    '3075', // Armadura de Espinhos (Rhaast)
    '3123', // Chamado do Carrasco
    '6609', // Serrespada Quimiopunk
  ]);
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
  for (const bp of Object.values(RUNE_BLUEPRINTS)) {
    ids.add(bp.primaryTreeId);
    ids.add(bp.secondaryTreeId);
    bp.primaryRuneIds.forEach((id) => ids.add(id));
    bp.secondaryRuneIds.forEach((id) => ids.add(id));
  }
  return Array.from(ids);
}

export function collectBlueprintStatShardIds(): number[] {
  const ids = new Set<number>();
  for (const bp of Object.values(RUNE_BLUEPRINTS)) {
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
      icon: null, // Sem ícone oficial confirmado no catálogo ativo -> fallback neutro com nome
      validInCatalog: !catalog.statShards, // Se catálogo antigo não listava statShards, usa fallback neutro
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
): RuneRecommendation {
  const bp = RUNE_BLUEPRINTS[form];
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
  const blueprint =
    form === 'blue'
      ? BLUE_BUILD_BLUEPRINT
      : form === 'red'
        ? RED_BUILD_BLUEPRINT
        : OPEN_BUILD_BLUEPRINT;

  const squishyCount = enemyProfiles.filter((p) => p.isSquishyTarget).length;
  const frontlineCount = enemyProfiles.filter((p) => p.isFrontline).length;
  const heavyArmorCount = enemyProfiles.filter((p) => p.heavyArmorUser).length;
  const heavyHealingCount = enemyProfiles.filter((p) => p.heavyHealing).length;
  const heavyShieldCount = enemyProfiles.filter((p) => p.heavyShields).length;
  const highCcCount = enemyProfiles.filter((p) => p.ccScore >= 2).length;

  const healChampions = enemyProfiles
    .filter((p) => p.heavyHealing)
    .map((p) => catalog.champions[p.championId]?.name ?? p.championId);
  const shieldChampions = enemyProfiles
    .filter((p) => p.heavyShields)
    .map((p) => catalog.champions[p.championId]?.name ?? p.championId);
  const armorChampions = enemyProfiles
    .filter((p) => p.heavyArmorUser || p.isFrontline)
    .map((p) => catalog.champions[p.championId]?.name ?? p.championId);

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
          ? [resolveItemRef(catalog, '6694', 'Rancor de Serylda: penetração % de armadura + aceleração + slow em alvos baixos.')]
          : [resolveItemRef(catalog, '3071', 'Cutelo Negro: quebra até 30% da armadura para o seu ADC também bater.')],
    },
    {
      key: 'sobrevivencia',
      label: 'Sobrevivência / CC / Burst',
      shortCondition: 'Contra muito CC ou burst',
      activeInDraft: highCcCount >= 2 || enemyProfiles.some((p) => p.fightStyle === 'short_burst'),
      triggerReason:
        highCcCount >= 2
          ? `${highCcCount} inimigos com controle de grupo forte.`
          : 'Segura pickoff inimigo antes da entrada ou após sair do R.',
      items:
        form === 'blue'
          ? [
              resolveItemRef(catalog, '3814', 'Limiar da Noite: escudo de feitiço para não tomar CC seco ao entrar na parede.'),
              resolveItemRef(catalog, '3026', 'Anjo Guardião: segunda vida quando você é o único assassino fechando lutas.'),
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
      shortCondition: 'Contra muitos escudos',
      activeInDraft: heavyShieldCount >= 2,
      triggerReason:
        shieldChampions.length > 0
          ? `Escudos relevantes em: ${shieldChampions.join(', ')}.`
          : 'Contra encantadores e carries com muito escudo.',
      items: [
        resolveItemRef(catalog, '6695', 'Presa da Serpente: corta escudos pela metade com custo baixo — excelente no Azul e viável no Rhaast.'),
      ],
    },
    {
      key: 'excesso_cura',
      label: 'Excesso de cura inimiga',
      shortCondition: 'Contra muita cura',
      activeInDraft: heavyHealingCount >= 2 || (heavyHealingCount >= 1 && frontlineCount >= 1),
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
              resolveItemRef(catalog, '3123', 'Chamado do Carrasco (800g): segure só o componente se ninguém do time fizer corta-cura.'),
              resolveItemRef(catalog, '6609', 'Serrespada Quimiopunk: fechamento final se precisar manter corta-cura.'),
            ],
    },
    ...(form !== 'red'
      ? [
          {
            key: 'alvo_fragil' as const,
            label: 'Pickoff / Carries com mobilidade',
            shortCondition: 'Para garantir pickoff',
            activeInDraft: form === 'blue' && squishyCount >= 3,
            triggerReason:
              squishyCount >= 3
                ? `${squishyCount} alvos frágeis na composição inimiga.`
                : 'Para prender carries móveis com slow e ampliar dano de combo.',
            items: [
              resolveItemRef(catalog, '6699', 'Cicloespada Voltaica: energiza no E/Q e aplica slow pesado para garantir o W.'),
              resolveItemRef(catalog, '3004', 'Manamune: opção de escala para spam de W/Q em jogos mais longos.'),
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

  const junglePet = resolveItemRef(catalog, blueprint.junglePet.id, blueprint.junglePet.reason);
  const boots = blueprint.boots.map((b) => resolveItemRef(catalog, b.id, b.reason));
  const core = blueprint.core.map((c) => resolveItemRef(catalog, c.id, c.reason));

  const hasInvalidItems =
    !junglePet.availableInCatalog ||
    boots.some((b) => !b.availableInCatalog) ||
    core.some((c) => !c.availableInCatalog);

  const patchWarning =
    catalog.patch !== BUILD_DATA_META.validatedPatch
      ? `Catálogo está no patch ${catalog.patch}, mas os perfis de build foram revisados no patch ${BUILD_DATA_META.validatedPatch}. Confira se nenhum item foi alterado.`
      : hasInvalidItems
        ? `Revisão necessária: um ou mais itens recomendados não estão disponíveis no Summoner's Rift (${catalog.patch}).`
        : undefined;

  return {
    form,
    junglePet,
    boots,
    core,
    situational,
    validatedPatch: BUILD_DATA_META.validatedPatch,
    hasInvalidItems,
    patchWarning,
  };
}
