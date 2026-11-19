import type { OrbType } from '../shared/types';

/**
 * Regras verificadas da passiva do Kayn ("A Foice Darkin" / The Darkin Scythe).
 * Fonte verificada: League of Legends Wiki (wiki.leagueoflegends.com/en-us/Kayn)
 * e Data Dragon pt_BR (patch 16.23.1).
 */
export const KAYN_PASSIVE_MECHANICS = {
  totalPointsToUnlock: 500,
  meleePointsPerHit: 2,
  meleePointsPerTakedown: 6,
  rangedPointsPerHit: 3,
  rangedPointsPerTakedown: 7,
  /** Multiplicador de pontos conforme minuto de jogo (aprox. 3x no início até 10.39x perto dos 13+ min). */
  earlyMinuteMultiplier: 3,
  lateMinuteMultiplier: 10.39,
  /** Se a barra oposta estiver dentro de 8% da liderança ao completar 500 pts, o último tipo atingido vence. */
  tieThresholdPercent: 8,
  /** Tempo de bloqueio da forma oposta após liberar a primeira forma (4 minutos). */
  oppositeFormLockoutSeconds: 240,
  /** Redução de bloqueio por orbe do tipo desejado coletado após desbloquear a outra forma. */
  secondsReducedPerOppositeOrb: 5,
} as const;

/**
 * Exceções reais de classificação corpo a corpo vs à distância para orbes do Kayn
 * que não batem com um corte simples de attackrange.
 */
const ORB_TYPE_OVERRIDES: Record<string, OrbType> = {
  // Contam como corpo a corpo (orbes vermelhos / Rhaast)
  Rakan: 'melee', // range 300, tratado como melee
  Nilah: 'melee', // range 225, tratado como melee
  Irelia: 'melee',
  Viego: 'melee',

  // Contam como à distância (orbes azuis / Assassino das Sombras)
  Lillia: 'ranged', // range 325, tratado como ranged
  Urgot: 'ranged', // range 350, tratado como ranged
  Graves: 'ranged', // range 425, ranged
  Yuumi: 'ranged', // range 425, ranged
  Thresh: 'ranged', // range 450, ranged
  Vladimir: 'ranged',
  Karthus: 'ranged',
  Morgana: 'ranged',
  Ivern: 'ranged',

  // Híbridos / mudança de forma (dropam orbes conforme a forma atual no combate)
  Jayce: 'hybrid',
  Nidalee: 'hybrid',
  Elise: 'hybrid',
  Gnar: 'hybrid',
  Kayle: 'hybrid', // melee até nível 6, ranged a partir do 6
};

export function classifyChampionOrbType(championId: string, attackRange: number): OrbType {
  const override = ORB_TYPE_OVERRIDES[championId];
  if (override) {
    return override;
  }
  return attackRange >= 325 ? 'ranged' : 'melee';
}

export function getOrbMechanicsExplanation(easiestUnlockForm: 'blue' | 'red' | 'even', strongestForm: 'blue' | 'red' | 'even'): string {
  const baseRule =
    'A barra exige 500 pts (3x no início até ~10,39x perto dos 13+ min). Se preencher a forma errada primeiro, a outra fica travada por 4 min (reduzidos em 5s por cada orbe do tipo certo).';
  if (easiestUnlockForm !== 'even' && strongestForm !== 'even' && easiestUnlockForm !== strongestForm) {
    const easyLabel = easiestUnlockForm === 'blue' ? 'Kayn Azul' : 'Rhaast';
    const strongLabel = strongestForm === 'blue' ? 'Kayn Azul' : 'Rhaast';
    return `${baseRule} Atenção: ${easyLabel} tende a encher mais rápido pelas lanes acessíveis, mas ${strongLabel} escala melhor contra a comp inteira. Não force lutas ruins só por orbes antes dos 8 min; aproveite a escala maior no mid game para fechar ${strongLabel} se valer a pena.`;
  }
  return `${baseRule} No early game os orbes valem pouco — nunca sacrifique clear, vida ou tempo de mapa só por 1 ou 2 hits.`;
}
