import type {
  BuildItemRef,
  BuildRecommendation,
  CatalogSnapshot,
  ChampionTacticalProfile,
  KaynFormChoice,
  RuneEntryRef,
  RuneRecommendation,
  SituationalBuildCategory,
} from '../shared/types';

export const BUILD_DATA_META = {
  buildVersion: '2026.11-kayn-16.23.1-v1',
  validatedPatch: '16.23.1',
  source: 'Recomendações curadas para Kayn Jungle (Summoner\'s Rift, IDs conferidos no Data Dragon 16.23.1 pt_BR)',
  updatedAt: '2026-11-18',
} as const;

export interface StaticRuneBlueprint {
  formLabel: string;
  primaryTreeId: number;
  primaryRuneIds: number[];
  secondaryTreeId: number;
  secondaryRuneIds: number[];
  statShards: string[];
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
    statShards: ['+9 Força Adaptativa', '+9 Força Adaptativa', '+65 Vida (ou +10-180 escalável)'],
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
    statShards: ['+9 Força Adaptativa', '+9 Força Adaptativa', '+65 Vida (ou +10-180 escalável)'],
    whyFormDiffers:
      'Rhaast quer prolongar trocas e curar com dano de habilidades. Conquistador empilha AD + cura contínua, Triunfo sustenta resets em 2v2/teamfight, Lenda: Aceleração acelera rotações de Q/W e Até a Morte aumenta cura e dano em vida baixa. Dominação de runa principal deixa Rhaast sem fôlego após a primeira rotação.',
    alternativeNote:
      'Contra muito poke/CC onde queira mais resistência no mid game: Determinação secundária com Condicionamento (8429) + Revitalizar (8453).',
  },
  open: {
    formLabel: 'Decisão em Aberto — Runas Flexíveis até Definir no Lobby',
    primaryTreeId: 8000, // Precisão (segura bem os dois planos se o draft ainda está aberto)
    primaryRuneIds: [8010, 9111, 9105, 8014], // Conquistador, Triunfo, Lenda: Aceleração, Golpe de Misericórdia
    secondaryTreeId: 8300, // Inspiração
    secondaryRuneIds: [8304, 8347],
    statShards: ['+9 Força Adaptativa', '+9 Força Adaptativa', '+65 Vida'],
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
    { id: '6697', reason: 'Húbris: ótimo 1º item quando abre vantagem cedo e acumula estátua em abates.' },
    { id: '3142', reason: 'Lâmina Fantasma de Youmuu: ativa de velocidade para achar ângulos sem gastar E à toa.' },
    { id: '6696', reason: 'Arco do Axioma: acelera o R entre picks e garante presença em lutas seguidas.' },
  ],
  alternativeCoreHint: {
    id: '6698', // Hidra Profana
    reason: 'Hidra Profana: acelera limpeza de selva/waves e soma burst ativo no combo.',
  },
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
    { id: '3161', reason: 'Lança de Shojin: amplifica dano de habilidades (Q/W/R) e reduz recargas em luta longa.' },
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
    BLUE_BUILD_BLUEPRINT.alternativeCoreHint.id,
    RED_BUILD_BLUEPRINT.junglePet.id,
    OPEN_BUILD_BLUEPRINT.junglePet.id,
    // Situacionais
    '6699', // Cicloespada Voltaica
    '6698', // Hidra Profana
    '6694', // Rancor de Serylda
    '3814', // Limiar da Noite
    '6695', // Presa da Serpente
    '3004', // Manamune
    '6610', // Céu Dividido
    '6333', // Dança da Morte
    '3053', // Sinal de Sterak
    '3156', // Mandíbula de Malmortius
    '3065', // Semblante Espiritual
    '3026', // Anjo Guardião
    '3742', // Couraça do Defunto
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

function resolveRuneName(catalog: CatalogSnapshot, runeId: number): string {
  for (const tree of catalog.runeTrees) {
    if (tree.id === runeId) return tree.name;
    for (const slot of tree.slots) {
      for (const r of slot.runes) {
        if (r.id === runeId) return r.name;
      }
    }
  }
  return `Runa #${runeId} (não validada no catálogo)`;
}

export function buildRuneRecommendation(
  form: KaynFormChoice,
  catalog: CatalogSnapshot,
): RuneRecommendation {
  const bp = RUNE_BLUEPRINTS[form];
  const mapEntry = (id: number): RuneEntryRef => ({
    id,
    name: resolveRuneName(catalog, id),
  });

  const patchMismatchNote =
    catalog.patch !== BUILD_DATA_META.validatedPatch
      ? ` Atenção: recomendações validadas para o patch ${BUILD_DATA_META.validatedPatch}, enquanto o catálogo ativo está no ${catalog.patch}.`
      : '';

  return {
    formLabel: bp.formLabel,
    primaryTreeId: bp.primaryTreeId,
    primaryTreeName: resolveRuneName(catalog, bp.primaryTreeId),
    primaryRunes: bp.primaryRuneIds.map(mapEntry),
    secondaryTreeId: bp.secondaryTreeId,
    secondaryTreeName: resolveRuneName(catalog, bp.secondaryTreeId),
    secondaryRunes: bp.secondaryRuneIds.map(mapEntry),
    statShards: bp.statShards,
    statShardsNote: `Fragmentos padrão para o patch ${BUILD_DATA_META.validatedPatch} (não fornecidos pelo runesReforged.json do Data Dragon).${patchMismatchNote}`,
    whyFormDiffers: bp.whyFormDiffers,
    alternativeNote: bp.alternativeNote,
    validatedPatch: BUILD_DATA_META.validatedPatch,
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
      name: `Item #${id} (indisponível/não validado em SR)`,
      gold: 0,
      reason,
      availableInCatalog: false,
    };
  }
  return {
    id: item.id,
    name: item.name,
    gold: item.gold,
    reason,
    availableInCatalog: true,
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
      key: 'alvo_fragil',
      label: 'Alvo frágil / Pickoff rápido',
      activeInDraft: form === 'blue' || squishyCount >= 3,
      triggerReason:
        squishyCount >= 3
          ? `${squishyCount} alvos frágeis detectados na composição inimiga.`
          : 'Use se precisar explodir um carregador específico fora de posição.',
      items: [
        resolveItemRef(catalog, '6698', 'Hidra Profana: acelera clear e adiciona burst ativo no combo.'),
        resolveItemRef(catalog, '6699', 'Cicloespada Voltaica: slow pesado no primeiro ataque para garantir W.'),
        resolveItemRef(catalog, '3004', 'Manamune: opção de escala para spam de W/Q em jogos mais lentos.'),
      ],
    },
    {
      key: 'frontline_inimiga',
      label: 'Frontline inimiga / Luta longa',
      activeInDraft: form === 'red' || frontlineCount >= 2,
      triggerReason:
        frontlineCount >= 2
          ? `${frontlineCount} campeões de linha de frente no time inimigo.`
          : 'Para estender trocas contra lutadores e tanques.',
      items: [
        resolveItemRef(catalog, '3071', 'Cutelo Negro: reduz armadura da frontline e entrega vida + aceleração.'),
        resolveItemRef(catalog, '6610', 'Céu Dividido: sustentação imediata ao trocar alvo no meio da luta.'),
        resolveItemRef(catalog, '3161', 'Lança de Shojin: fortalece Q/W em rotações contínuas.'),
      ],
    },
    {
      key: 'sobrevivencia',
      label: 'Necessidade de sobreviver / CC / Burst',
      activeInDraft: highCcCount >= 2 || enemyProfiles.some((p) => p.fightStyle === 'short_burst'),
      triggerReason:
        highCcCount >= 2
          ? `${highCcCount} campeões inimigos com controle de grupo relevante.`
          : 'Segura pickoff inimigo antes da entrada ou após sair do R.',
      items:
        form === 'blue'
          ? [
              resolveItemRef(catalog, '3814', 'Limiar da Noite: escudo de feitiço para não tomar CC seco ao entrar na parede.'),
              resolveItemRef(catalog, '3026', 'Anjo Guardião: segunda vida quando você é o único assassino fechando lutas.'),
            ]
          : [
              resolveItemRef(catalog, '6333', 'Dança da Morte: segura burst físico e limpa sangramento em abates.'),
              resolveItemRef(catalog, '3053', 'Sinal de Sterak: escudo anti-burst + tenacidade em lutas 5v5.'),
              resolveItemRef(catalog, '3156', 'Mandíbula de Malmortius: contra duplo dano mágico / burst AP.'),
              resolveItemRef(catalog, '3065', 'Semblante Espiritual: amplifica cura do Rhaast e MR contra magos.'),
            ],
    },
    {
      key: 'armadura_adversaria',
      label: 'Armadura adversária',
      activeInDraft: heavyArmorCount >= 1 || frontlineCount >= 2,
      triggerReason:
        armorChampions.length > 0
          ? `Alvos propensos a acumular armadura: ${armorChampions.join(', ')}.`
          : 'Quando inimigos compram Botas de Aço / Armadura cedo.',
      items:
        form === 'blue'
          ? [resolveItemRef(catalog, '6694', 'Rancor de Serylda: penetração % de armadura + aceleração + slow em alvos baixos.')]
          : [resolveItemRef(catalog, '3071', 'Cutelo Negro: quebra até 30% da armadura para o seu ADC também bater.')],
    },
    {
      key: 'excesso_cura',
      label: 'Excesso de cura inimiga',
      activeInDraft: heavyHealingCount >= 2 || (heavyHealingCount >= 1 && frontlineCount >= 1),
      triggerReason:
        healChampions.length > 0
          ? `Cura forte detectada em: ${healChampions.join(', ')}.`
          : 'Quando houver cura elevada por campeões ou itens.',
      items: [
        resolveItemRef(catalog, '3123', 'Chamado do Carrasco (800g): segure só o componente cedo e feche depois.'),
        resolveItemRef(catalog, '6609', 'Serrespada Quimiopunk: fechamento final com vida e aceleração.'),
      ],
    },
    {
      key: 'excesso_escudos',
      label: 'Excesso de escudos inimigos',
      activeInDraft: heavyShieldCount >= 2,
      triggerReason:
        shieldChampions.length > 0
          ? `Escudos relevantes detectados em: ${shieldChampions.join(', ')}.`
          : 'Contra encantadores + carries com Barreira/Arco-escudo.',
      items: [
        resolveItemRef(catalog, '6695', 'Presa da Serpente: corta escudos pela metade com custo baixo (2500g) — ótima no Azul e viável no Rhaast.'),
      ],
    },
  ];

  const patchWarning =
    catalog.patch !== BUILD_DATA_META.validatedPatch
      ? `Catálogo está no patch ${catalog.patch}, mas os perfis de build foram validados no patch ${BUILD_DATA_META.validatedPatch}. Confira se nenhum item foi alterado.`
      : undefined;

  return {
    form,
    junglePet: resolveItemRef(catalog, blueprint.junglePet.id, blueprint.junglePet.reason),
    boots: blueprint.boots.map((b) => resolveItemRef(catalog, b.id, b.reason)),
    core: blueprint.core.map((c) => resolveItemRef(catalog, c.id, c.reason)),
    situational,
    validatedPatch: BUILD_DATA_META.validatedPatch,
    patchWarning,
  };
}
