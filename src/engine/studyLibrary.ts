import type {
  FrozenMicroComboCard,
  StudyCreator,
  StudyKaynForm,
  StudyLesson,
  StudyTopic,
} from '../shared/types';

export const STUDY_LIBRARY_META = {
  version: '2026.11-phase2-v1',
  updatedAt: '2026-11-18',
  verifiedChannels: {
    caiozera: 'https://www.youtube.com/@caiozerinha',
    karasmaiMain: 'https://www.youtube.com/@karasmailol',
    karasmaiSecondary: 'https://www.youtube.com/@karasmaikayn',
  },
} as const;

export const MAX_FAVORITE_MICRO_CARDS = 3;

export function parseTimestampToSeconds(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (/^\d+$/.test(trimmed)) {
    const val = Number(trimmed);
    return Number.isFinite(val) && val >= 0 ? val : null;
  }
  const parts = trimmed.split(':').map((p) => p.trim());
  if (parts.length < 2 || parts.length > 3 || parts.some((p) => !/^\d+$/.test(p))) {
    return null;
  }
  if (parts.length === 2) {
    const [m, s] = parts.map(Number);
    if (s >= 60) return null;
    return m * 60 + s;
  }
  const [h, m, s] = parts.map(Number);
  if (m >= 60 || s >= 60) return null;
  return h * 3600 + m * 60 + s;
}

export function formatSecondsToTimestamp(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) return 'N/D';
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export function buildTimestampedYouTubeUrl(
  baseUrl: string,
  seconds: number | null,
): string {
  try {
    const u = new URL(baseUrl);
    if (seconds !== null && Number.isFinite(seconds) && seconds >= 0) {
      u.searchParams.set('t', `${Math.floor(seconds)}s`);
    }
    return u.toString();
  } catch {
    return baseUrl;
  }
}

export const CURATED_STUDY_LESSONS: StudyLesson[] = [
  // =====================================================================
  // CAIOZERALOL (@caiozerinha) — ANÁLISE VISUAL (sem legenda no YouTube)
  // =====================================================================
  {
    id: 'caiozera-macro-bot-abort-river',
    title: 'Quando pular a Bot empurrada e virar o 3v3 no rio',
    creator: 'caiozera',
    creatorDisplayName: 'CaiozeraLoL',
    attributionLabel: 'Observado no CaiozeraLoL',
    topic: 'macro',
    form: 'base',
    verificationStatus: 'visual_only',
    speechVerified: false,
    isHistoricalReference: false,
    patch: 'Desconhecido (Season 16, Ago/2026)',
    videoUrl: 'https://www.youtube.com/watch?v=ubwHhx3DdZA',
    videoTitle: 'LIVE TESTE CHALLENGER RANK 1 GLOBAL KAYN 2450PDL S9 S10 S12 S13 S14 S15 S16',
    channelName: 'caíozera (@caiozerinha)',
    channelUrl: 'https://www.youtube.com/@caiozerinha',
    contextStartSeconds: 235,
    playMomentSeconds: 253,
    timestampDisplay: '03:55 (contexto) → 04:13 (jogada)',
    gameClockDisplay: '02:43 → 03:31 de partida',
    shortSummaryPt:
      'Vendo Sivir + Karma empurradas até a torre inimiga da Bot, Caiozera não força gank nem dive sem wave: entra direto no rio aos 03:01, acha o Hecarim no Aronguejo e usa a prioridade de Bot + Mid para garantir Double Kill e reset limpo.',
    evidenceNote:
      'Análise visual (HUD e minimapa visível no VOD). Vídeo sem legendas/transcrição disponíveis no YouTube — fala não verificada.',
    linkedTrainingScenarioId: 'train-lesson-caiozera-bot-river',
    macro: {
      beforePlayContext:
        'Aos 02:43–03:01 da partida, Kayn Base (nível 3→4, 20 CS) termina Gromp e Azul no lado inferior enquanto o minimapa mostra Sivir e Karma empurrando a wave até a torre T1 Bot adversária (Xayah + Milio).',
      visibleRiskOrOpportunity:
        'Forçar gank direto na Bot tinha pouco espaço (inimigos sob a torre). Em contrapartida, justamente porque Bot e Mid aliados tinham pressão primeiro, Hecarim ficaria isolado se disputasse o Aronguejo inferior às 03:01–03:30.',
      actionAndAlternative:
        'Abandonou a ideia de passar na lane da Bot, entrou no rio às 03:01 pingando "a caminho" sobre o Hecarim, lutou o 3v3 com rotação da Bot/Mid e saiu 2/0/0 (1613g) para resetar de Punhal Serrilhado + Lente. A alternativa ruim seria perder tempo rondando a moita da Bot esperando Xayah sair da torre.',
      whatWouldChangeDecision:
        'Se Sivir/Karma estivessem com vida baixa presas sob a própria torre (sem prioridade) ou Orianna sem pressão no Mid, entrar no rio contra Hecarim viraria armadilha 2v3/3v3 e pediria apenas finalizar campos e resetar.',
      howToApply:
        'Quando sua Bot estiver empurrada na torre inimiga no primeiro clear, NÃO tente forçar gank atrás de orbe azul: use a prioridade deles para checar Aronguejo/rio ou invadir um campo e saia com vantagem garantida.',
      worksWhen:
        'Sua Bot e/ou Mid têm prioridade real de wave e vida para chegar antes no rio contra o caçador inimigo.',
      chooseDifferentWhen:
        'Sua Bot está com pouca vida ou presa sob pressão sem flash/setup — nesse caso não conteste o rio nem force gank; gire para o lado oposto ou resete.',
      sessionDrillOrQuestion:
        'Na sua próxima partida, aos 3:15 antes de sair do último campo da Bot, responda em voz mental: "Minha Bot tem espaço para gank ou tem prioridade para jogar no rio comigo?"',
    },
  },
  {
    id: 'caiozera-macro-post-dragon-bot',
    title: 'Após Dragão: recuperar HP nos Kruges vs limite do flanco na Bot',
    creator: 'caiozera',
    creatorDisplayName: 'CaiozeraLoL',
    attributionLabel: 'Observado no CaiozeraLoL',
    topic: 'macro',
    form: 'base',
    verificationStatus: 'visual_only',
    speechVerified: false,
    isHistoricalReference: false,
    patch: 'Desconhecido (Season 16, Ago/2026)',
    videoUrl: 'https://www.youtube.com/watch?v=ubwHhx3DdZA',
    videoTitle: 'LIVE TESTE CHALLENGER RANK 1 GLOBAL KAYN 2450PDL S9 S10 S12 S13 S14 S15 S16',
    channelName: 'caíozera (@caiozerinha)',
    channelUrl: 'https://www.youtube.com/@caiozerinha',
    contextStartSeconds: 424,
    playMomentSeconds: 444,
    timestampDisplay: '07:04 (contexto) → 07:24 (jogada)',
    gameClockDisplay: '05:52 → 06:27 de partida',
    shortSummaryPt:
      'Depois de garantir o Dragão com pouca vida (405/1004 HP) e perder a Karma, Caiozera evita voltar cego no rio, limpa Kruges inimigos para pegar nível 6 e curar até 904 HP — porém o flanco seguinte atrás da T1 Bot contra Xayah custa a morte (2/1/0).',
    evidenceNote:
      'Análise visual (HUD e minimapa). Vídeo sem legendas — fala não verificada; autoria do crédito exato da 7ª kill da equipe entre 06:22 e 06:27 incerta pelo salto de 5s.',
    macro: {
      beforePlayContext:
        'Aos 05:52–06:12 de jogo, Kayn (2/0/0, 40 CS) e Karma fazem Dragão da Montanha; Hecarim e Milio contestam e eliminam Karma às 06:12 enquanto Kayn fica com ~40% de vida (405/1004 HP).',
      visibleRiskOrOpportunity:
        'Reentrar direto no rio com 40% de vida e nível 5 daria abate grátis para Hecarim. Porém, os Kruges inimigos atrás da T1 Bot davam XP para nível 6 + cura do E/smite/pet.',
      actionAndAlternative:
        'Recuou do rio para invadir os Kruges inimigos, subiu ao nível 6 (904/1102 HP) às 06:17 e tentou flanquear Xayah (~40% HP) por trás da T1 Bot — onde acabou morrendo às 06:27 após gastar Q/W/E/R. A alternativa conservadora aos 06:17 seria apenas roubar os Kruges e resetar com 2/0/0 e vantagem de nível.',
      whatWouldChangeDecision:
        'Contra Xayah (que tem R/enraizamento para segurar perto da torre) ou sem aliados por perto para absorver torre/CC, o lucro seguro já estava garantido ao roubar os Kruges e pegar nível 6.',
      howToApply:
        'Separe as duas decisões: recuperar recursos em um campo antes de lutar é excelente; mas depois de roubar campo inimigo atrás da torre, só flanqueie a Bot se não depender de dive longo ou erro grave do ADC adversário.',
      worksWhen:
        'Você precisa estabilizar HP/nível 6 antes de decidir entre sair do lado inimigo ou punir um alvo realmente sem fuga.',
      chooseDifferentWhen:
        'O alvo tem R defensivo/torre perto (como Xayah) e aliados aliados não estão em alcance de acompanhar — embolse o campo roubado e resete.',
      sessionDrillOrQuestion:
        'Depois de roubar um campo na selva inimiga, pergunte: "Já venci a troca pelo campo ou vou arriscar entregar minha recompensa na torre da Bot?"',
    },
  },
  {
    id: 'caiozera-micro-rhaast-e-wall-pivot',
    title: 'E na parede para reposicionar e redirecionar quando Ezreal usa E',
    creator: 'caiozera',
    creatorDisplayName: 'CaiozeraLoL',
    attributionLabel: 'Observado no CaiozeraLoL',
    topic: 'micro',
    form: 'red',
    verificationStatus: 'visual_only',
    speechVerified: false,
    isHistoricalReference: false,
    patch: 'Desconhecido (Nov/2026)',
    videoUrl: 'https://www.youtube.com/watch?v=Uvc3QAgK-4w',
    videoTitle: 'esse E na parede.... 😝 #kayn #challengerkayn',
    channelName: 'caíozera (@caiozerinha)',
    channelUrl: 'https://www.youtube.com/@caiozerinha',
    contextStartSeconds: 3,
    playMomentSeconds: 4,
    timestampDisplay: '00:03 (contexto) → 00:04–00:17 (sequência)',
    gameClockDisplay: 'Clipe curto (Rhaast nível 10)',
    shortSummaryPt:
      'Com R em recarga, Rhaast usa E na parede grossa (0:04) para fugir da R da Nami/Azir mantendo Q e W carregados; quando Ezreal gasta E para o rio, ele não persegue o dash e vira W → Q nos alvos alcançáveis.',
    evidenceNote:
      'Análise visual quadro a quadro por cooldowns do HUD. Sem legendas no clipe. Nota honesta: aos 0:15 aparece "Kayn está invencível!" enquanto Janna canaliza R (origem exata da invulnerabilidade não confirmada no placar).',
    micro: {
      situation:
        'Escaramuça em terreno fechado com múltiplas ameaças (Azir, Nami R, Ezreal) e seu R ainda indisponível.',
      steps: [
        { key: 'E', label: 'Parede grossa (cura + desvio)', note: '0:04' },
        { key: 'W', label: 'Após Ezreal gastar E', note: '0:09' },
        { key: 'Q', label: 'Fecha dano e cura', note: '0:11' },
        { key: 'Q', label: '2º ciclo na Nami', note: '0:15' },
        { key: 'E', label: 'Saída pela parede', note: '0:17' },
      ],
      prerequisite: 'Terreno grosso ao lado para andar com E sem tomar o CC principal (R da Nami) antes de definir o alvo.',
      heldAbility: 'Q e W (segurados durante o E na parede)',
      heldAbilityReason:
        'Mantendo Q e W disponíveis dentro da parede (0:06), ele observa quem gastou mobilidade primeiro e não joga W no vazio enquanto Ezreal escapa.',
      targetDodgesOrDashes:
        'Se o carry usar dash/blink para longe da parede (Ezreal E aos 0:06), NÃO gaste Q atrás dele para morrer exposto; mude o alvo de W → Q para quem está no corredor.',
      commonMistake:
        'Sair da parede imediatamente com Q em cima da onda da Nami ou perseguir o dash do ADC desperdiçando o ângulo seguro.',
      practiceModeDrill:
        'No Modo Treino, coloque 2 bonecos perto da parede das Acuaminas: entre na parede com E, conte 1.5s observando o ângulo, saia com W → Q no boneco próximo e saia pelo outro lado com o próximo E.',
      patchCompatibility: 'not_verified',
    },
  },
  {
    id: 'caiozera-micro-base-rhaast-tower-reset',
    title: 'Segurar W e R após stun, entrar por trás e resetar torre com R',
    creator: 'caiozera',
    creatorDisplayName: 'CaiozeraLoL',
    attributionLabel: 'Observado no CaiozeraLoL',
    topic: 'micro',
    form: 'red',
    verificationStatus: 'visual_only',
    speechVerified: false,
    isHistoricalReference: false,
    patch: 'Desconhecido (Nov/2026)',
    videoUrl: 'https://www.youtube.com/watch?v=T6C2o604IY4',
    videoTitle: 'pra n dizer q so tem bluekayn #kayn #leagueoflegends',
    channelName: 'caíozera (@caiozerinha)',
    channelUrl: 'https://www.youtube.com/@caiozerinha',
    contextStartSeconds: 7,
    playMomentSeconds: 11,
    timestampDisplay: '00:07 (stun Syndra) → 00:11–00:17 (dive e saída)',
    gameClockDisplay: 'Clipe curto (Kayn Base → libera Rhaast aos 0:19)',
    shortSummaryPt:
      'Mesmo tomando o E da Syndra (0:07), não entra em pânico gastando W/R cedo: contorna pelo muro esquerdo do Mid com E, entra com Q → R para largar o aggro da torre e colar na Syndra, finalizando com W/Q antes de virar no Jax.',
    evidenceNote:
      'Análise visual via HUD de recargas. Sem legendas no clipe. A ordem exata sub-segundo entre W e o 2º Q (entre 0:14 e 0:17) é incerta porque ambos entraram em recarga na mesma janela de 3s.',
    micro: {
      situation:
        'Alvo imóvel (mago) recuando para baixo da torre T1 do Mid após gastar a ferramenta principal de afastamento.',
      steps: [
        { key: 'E', label: 'Contorna pelo muro esquerdo', note: '0:11' },
        { key: 'Q', label: 'Marca alvo sob torre', note: '0:13' },
        { key: 'R', label: 'Tira aggro da torre e cola', note: '0:14–0:15' },
        { key: 'W', label: 'Acerta na saída do R', uncertain: true, note: '0:15–0:17 (ordem W/Q incerta)' },
        { key: 'Q', label: 'Finaliza + vira no Jax', uncertain: true, note: '0:16–0:17' },
      ],
      sequenceUncertaintyNote:
        'A ordem entre [W] e o segundo [Q] logo após sair do R (0:15–0:17) foi inferida pelas recargas visíveis às 0:17 e está marcada como incerta.',
      prerequisite:
        'Inimigo já sem sua habilidade de empurrão/stun (Syndra E gasto aos 0:07) e parede lateral livre para entrar por trás da torre.',
      heldAbility: 'W e R durante o início da troca',
      heldAbilityReason:
        'Entrar de Q primeiro garante a marca para o R e força o inimigo a andar para torre enquanto você ainda guarda o W para a saída garantida do R (quando o alvo não tem mais reação).',
      targetDodgesOrDashes:
        'Se o alvo usar Flash antes do R, você acompanha pelo R dentro dele; se usar Flash após você sair do R, já terá o W pronto para desacelerar ou o Q para recuar.',
      commonMistake:
        'Gastar W no limite de alcance antes de entrar na parede: se errar, fica sem controle após sair do R e toma mais tiros da torre.',
      practiceModeDrill:
        'No Modo Treino com torre ativada: entre pela parede lateral do Mid com E, dê Q no boneco atrás da torre, aperte R imediatamente para resetar o aggro e execute W → Q assim que sair.',
      patchCompatibility: 'not_verified',
    },
  },

  // =====================================================================
  // KARASMAI (@karasmailol) — VERIFICADO POR LEGENDA OFICIAL + VISUAL
  // =====================================================================
  {
    id: 'karasmai-macro-skip-mid-pivot-top',
    title: 'Abandonar Mid após reset e pular Gromp para fechar forma antes do Dragão',
    creator: 'karasmai',
    creatorDisplayName: 'Karasmai',
    attributionLabel: 'Observado no Karasmai',
    topic: 'macro',
    form: 'base',
    verificationStatus: 'verified_transcript_and_visual',
    speechVerified: true,
    isHistoricalReference: false,
    patch: 'Desconhecido (Season 16, Ago/2026)',
    videoUrl: 'https://www.youtube.com/watch?v=atmtJVYbJyI',
    videoTitle: 'Another 1v9 In Challenger (Learn How To Solo Carry On Kayn)',
    channelName: 'Karasmai (@karasmailol)',
    channelUrl: 'https://www.youtube.com/@karasmailol',
    contextStartSeconds: 637,
    playMomentSeconds: 673,
    timestampDisplay: '10:37 (contexto) → 11:13 (pivô Top) → 11:59 (forma)',
    gameClockDisplay: '10:29 → 12:00 de partida',
    shortSummaryPt:
      'Ao ver que o Mid inimigo já havia resetado, Karasmai não força tempo morto no Mid nem volta cego: pula seu próprio Gromp para fazer uma troca curta no Top (Fiora) sem gastar Flash, completando Kayn Azul 10 segundos antes do Dragão.',
    evidenceNote:
      'Verificado via transcrição oficial em inglês do YouTube ("Mostrar transcrição") + inspeção visual do HUD (HP, ouro, CS, recargas e timer do Dragão).',
    linkedTrainingScenarioId: 'train-lesson-karasmai-pivot-form',
    macro: {
      beforePlayContext:
        'Aos 10:29–10:59 de jogo, Kayn Base nível 8 (1/0/1, 89 CS, 1212g, Flash e R prontos) sai da selva superior inimiga e ajuda Aurelion Sol a empurrar (shove) a wave do Mid, percebendo que Yone já resetou.',
      visibleRiskOrOpportunity:
        'Com Yone na base, esperar no Mid seria desperdício. Por outro lado, o Dragão nasce em ~1 minuto (12:10) e a barra do Kayn Azul está quase cheia; Fiora (0/3/1) está visível no Top.',
      actionAndAlternative:
        'Abandona o Mid imediatamente (10:58), pula seu próprio Gromp (11:13), gasta E → Q/W na Fiora sem gastar Flash nem precisar da kill (11:43), completa Kayn Azul e reseta com a forma pronta 10s antes do Dragão. Alternativa: limpar Gromp e ir ao Dragão ainda de Kayn Base.',
      whatWouldChangeDecision:
        'Se a barra de orbes estivesse longe (< 60%) ou Fiora estivesse forte com jungler inimigo perto (Zyra), pular o Gromp não fecharia a forma antes do Dragão e limpar os campos seria melhor.',
      howToApply:
        'Não fique preso à primeira rota que pensou: se o alvo resetou (Mid ou Bot), aborte em 2 segundos e redirecione para onde há retorno real de forma ou objetivo antes do respawn seguinte.',
      worksWhen:
        'Falta apenas uma troca curta para liberar a forma antes de um objetivo importante e você não precisa queimar Flash nem arriscar morte.',
      chooseDifferentWhen:
        'O alvo inimigo tem vantagem de 1v2, você está com pouca vida ou faltam muitos orbes para completar a transformação.',
      sessionDrillOrQuestion:
        'Quando chegar perto de uma lane e o inimigo recuar/resetar, quanto tempo você leva para pivotar para campo, objetivo ou outra rota em vez de esperar?',
    },
    karasmaiPt: {
      whatHeDid:
        'Empurrou Mid com Aurelion Sol (10:58), confirmou que Yone deu reset, pulou o Gromp aliado (11:13), usou E + troca curta de Q/W na Fiora no Top sem gastar Flash (11:43) e completou Kayn Azul aos 12:00 de jogo com Dragão nascendo em 10s.',
      whatHeExplained:
        'Ele resume em voz alta aos 11:13–11:59 que pular o Gromp economiza o Flash no Top, e explica: "a verdade é que eu nem precisava matar ela ali; só preciso pegar a forma antes do Dragão — agora se eles contestarem, eu dou one-shot na Zyra". Também reforçou antes (2:09 e 7:47–8:48) a matemática simples de campos (3 campos vs 2) e pegar 1–2 hits por orbe sem morrer.',
      howToTrain:
        'No seu próximo jogo perto dos 10–11 minutos com a barra quase cheia, calcule o timer do Dragão: se uma troca rápida e segura (guardando o Flash!) fechar a forma antes do objetivo, priorize o pico de transformação.',
      englishTerms: [
        { term: 'Shove', meaningPt: 'Empurrar a wave rapidamente até a torre adversária.' },
        { term: 'Skip camp', meaningPt: 'Pular um campo momentaneamente para aproveitar janela curta no mapa.' },
        { term: 'One-shot', meaningPt: 'Abater um alvo frágil em uma única rotação de habilidades.' },
        { term: 'Hover', meaningPt: 'Ficar próximo a uma lane fora de visão para cobrir ou responder à luta.' },
      ],
    },
  },
  {
    id: 'karasmai-micro-blue-dragon-save-flash',
    title: 'Esperar o CC do time no Dragão e executar flanco de Azul sem gastar Flash',
    creator: 'karasmai',
    creatorDisplayName: 'Karasmai',
    attributionLabel: 'Observado no Karasmai',
    topic: 'micro',
    form: 'blue',
    verificationStatus: 'verified_transcript_and_visual',
    speechVerified: true,
    isHistoricalReference: false,
    patch: 'Desconhecido (Season 16, Ago/2026)',
    videoUrl: 'https://www.youtube.com/watch?v=atmtJVYbJyI',
    videoTitle: 'Another 1v9 In Challenger (Learn How To Solo Carry On Kayn)',
    channelName: 'Karasmai (@karasmailol)',
    channelUrl: 'https://www.youtube.com/@karasmailol',
    contextStartSeconds: 736,
    playMomentSeconds: 745,
    timestampDisplay: '12:16 (aproximação) → 12:25–12:28 (combo)',
    gameClockDisplay: '12:20 → 12:29 de partida',
    shortSummaryPt:
      'Como Kayn Azul no Dragão, Karasmai espera o controle de área de Aurelion Sol + Neeko acertar os alvos no rio (12:26), entra pelo flanco com E e finaliza usando R sem gastar o Flash.',
    evidenceNote:
      'Verificado via transcrição oficial em inglês + HUD visual. A ordem exata sub-segundo entre W e Q dentro do intervalo de 3s (12:26–12:29) antes do R está marcada como incerta.',
    micro: {
      situation:
        'Luta de objetivo (Dragão) com time aliado fornecendo iniciação em área e alvos frágeis expostos no rio.',
      steps: [
        { key: 'E', label: 'Flanco pela parede do pit', note: '12:23–12:26' },
        { key: 'W', label: 'Após stun aliado', uncertain: true, note: '12:26–12:29 (ordem W/Q incerta)' },
        { key: 'Q', label: 'Explosão no carry', uncertain: true, note: '12:26–12:29' },
        { key: 'R', label: 'Fecha abate e ganha tempo', note: '12:29 (100s CD) | Flash guardado' },
      ],
      sequenceUncertaintyNote:
        'Aos 12:29 Q (4s), W (7s), E (7s) e R (100s) entraram em recarga dentro da janela de 3s; a ordem interna exata entre W e Q antes do R é incerta nos quadros inspecionados.',
      prerequisite:
        'Deixar a linha de frente/suporte aliado puxar a primeira reação inimiga (Aurelion Sol R + Neeko R às 12:26) antes de expor o Kayn Azul.',
      heldAbility: 'Flash (D) e o próprio timing de entrada',
      heldAbilityReason:
        'A velocidade do E de Kayn Azul + alcance do W já alcançam alvos atordoados — guardar o Flash preserva ferramenta ofensiva/defensiva para a luta seguinte.',
      targetDodgesOrDashes:
        'Se o alvo usar Flash antes do W, cancele a perseguição profunda com o próprio R (se já marcou) ou recue pela parede sem gastar seu Flash à toa.',
      commonMistake:
        'Ser o primeiro a entrar de cara no rio antes do engage do time e tomar foco ou queimar Flash sem necessidade.',
      practiceModeDrill:
        'No Modo Treino, pratique entrar pela parede lateral do fosso do Dragão com E, aplicar W → Q → R no boneco do rio e sair andando sem apertar D/F (Flash).',
      patchCompatibility: 'not_verified',
    },
    karasmaiPt: {
      whatHeDid:
        'Com Kayn Azul recém-transformado e vida cheia, flanqueou o Dragão pela selva inferior (12:20–12:23), aguardou Aurelion Sol + Neeko acertarem as ultimates às 12:26 e executou o combo mantendo o Flash intacto às 12:29.',
      whatHeExplained:
        'Na legenda (12:16–12:25), ele acompanha o HP do Dragão e o ângulo no rio e confirma: "Eu nem preciso de Flash. Guardo meu Flash. Esse jogo acabou."',
      howToTrain:
        'Antes de cada luta de objetivo de Kayn Azul, imponha a regra: "Só gasto Flash se for para garantir o abate decisivo ou escapar de morte certa — nunca para entrar primeiro sem engage do time".',
      englishTerms: [
        { term: 'Flank', meaningPt: 'Entrar por ângulo lateral ou pelas paredes atrás da linha de frente inimiga.' },
      ],
    },
  },
  {
    id: 'karasmai-micro-rhaast-historical-s13',
    title: 'Rhaast em escaramuça: E → Q para colar, guardar W e fechar com R',
    creator: 'karasmai',
    creatorDisplayName: 'Karasmai',
    attributionLabel: 'Observado no Karasmai',
    topic: 'micro',
    form: 'red',
    verificationStatus: 'verified_transcript_and_visual',
    speechVerified: true,
    isHistoricalReference: true,
    patch: 'Season 13 (Referência histórica — Nov/2023)',
    videoUrl: 'https://www.youtube.com/watch?v=xvKz5kMPUUs',
    videoTitle: 'This is what a PERFECT Red AND Blue Kayn Game look like (IN CHALLENGER)',
    channelName: 'Karasmai (@karasmailol)',
    channelUrl: 'https://www.youtube.com/@karasmailol',
    contextStartSeconds: 674,
    playMomentSeconds: 679,
    timestampDisplay: '11:14 (entrada) → 11:19–11:29 (sequência)',
    gameClockDisplay: '13:38 → 13:53 de partida (Season 13)',
    shortSummaryPt:
      'Referência histórica de Rhaast: entra na selva inimiga com E → Q (11:19), aplica W no meio da troca (11:24) e segura R + Golpear para o final da luta (11:29), saindo com Double Kill em Gragas e Brand.',
    evidenceNote:
      'Verificado via transcrição oficial + inspeção de recargas no HUD (E→Q→W→R→Smite). Referência histórica da Season 13 (Nov/2023) — itens da época como Hemodrenário não se aplicam ao patch atual.',
    micro: {
      situation:
        'Luta prolongada 1v2/2v2 em selva fechada (Rhaast à frente, Flash já em recarga de 137s).',
      steps: [
        { key: 'E', label: 'Passa parede da selva Bot', note: '11:19' },
        { key: 'Q', label: 'Aproxima e aplica dano % HP', note: '11:19' },
        { key: 'W', label: 'Arremesso no meio da luta', note: '11:24' },
        { key: 'R', label: 'Sustain + espera cooldown de Q', note: '11:29' },
        { key: 'Smite', label: 'Dano final + cura/lentidão', note: '11:29' },
      ],
      sequenceUncertaintyNote:
        'Sequência principal E → Q → W → R verificada no HUD. O encaixe exato de ataques básicos e ativa de item antigo (Hemodrenário, 2023) entre Q e W é incerto e não aplicável hoje.',
      prerequisite: 'Ter visão/leitura de quem está próximo na selva e aceitar luta estendida de Rhaast (nunca fazer isso de Kayn Base atrás).',
      heldAbility: 'W e R na abertura da troca',
      heldAbilityReason:
        'Abrir com E → Q aproxima primeiro; segurar W evita errar de longe e guardar R para depois que você já recebeu dano maximiza a cura do Darkin enquanto o Q volta.',
      targetDodgesOrDashes:
        'Se o alvo usar dash (como E do Gragas) para evitar o Q inicial, o W guardado pune a nova posição logo em seguida.',
      commonMistake:
        'Gastar R com 95% de vida só por instinto e sair da ultimate sem os cooldowns de Q/W prontos para virar o 1v2.',
      practiceModeDrill:
        'No Modo Treino com Rhaast, execute devagar: E na parede → Q → 1 ataque básico → W (levantando o alvo) → R para esperar o Q voltar → Q na saída. (Use apenas itens atuais do patch 16.23.1.)',
      patchCompatibility: 'historical_reference',
    },
    karasmaiPt: {
      whatHeDid:
        'De Rhaast nível 9→10 (4/0/0→6/0/0), entrou na selva inferior inimiga com E → Q no Gragas (11:19), encaixou W (11:24) e fechou R + Smite saindo com Double Kill em Gragas e Brand (11:29).',
      whatHeExplained:
        'Comentou na legenda (11:07–11:38) que estar muito à frente permite ignorar a ameaça direta do caçador inimigo atrasado e continuar caçando o alvo seguinte saudável na selva.',
      howToTrain:
        'Use esta luta apenas para treinar a paciência de guardar o W e o R no Rhaast — ignore os itens mostrados no vídeo por ser uma partida antiga da Season 13.',
      englishTerms: [
        { term: 'Ahead', meaningPt: 'Estar à frente em nível/ouro, podendo contestar espaços que normalmente seriam arriscados.' },
      ],
    },
  },
  {
    id: 'karasmai-micro-blue-base-wall-historical-s13',
    title: 'Kayn Azul: entrar e sair pela parede da base direto para campos inimigos',
    creator: 'karasmai',
    creatorDisplayName: 'Karasmai',
    attributionLabel: 'Observado no Karasmai',
    topic: 'micro',
    form: 'blue',
    verificationStatus: 'verified_transcript_and_visual',
    speechVerified: true,
    isHistoricalReference: true,
    patch: 'Season 13 (Referência histórica — Nov/2023)',
    videoUrl: 'https://www.youtube.com/watch?v=xvKz5kMPUUs',
    videoTitle: 'This is what a PERFECT Red AND Blue Kayn Game look like (IN CHALLENGER)',
    channelName: 'Karasmai (@karasmailol)',
    channelUrl: 'https://www.youtube.com/@karasmailol',
    contextStartSeconds: 2178,
    playMomentSeconds: 2188,
    timestampDisplay: '36:18 (entrada pela parede) → 36:28 (abate) → 36:33 (saída)',
    gameClockDisplay: '20:00 → 20:08 de partida (Season 13)',
    shortSummaryPt:
      'Referência histórica de Kayn Azul para comparar com Rhaast: atravessa a parede da base inimiga com E para cortar Gangplank no Top e sai de volta pela parede com o E seguinte direto para os Kruges inimigos.',
    evidenceNote:
      'Verificado via transcrição oficial + HUD visual. A ordem exata entre W, Q e R dentro do intervalo 20:00–20:05 está marcada como incerta. Vídeo de 2023 — confira builds atuais na aba Draft.',
    micro: {
      situation:
        'Alvo empurrando ou defendendo rota lateral perto da base inimiga (pickoff rápido sem ficar para luta 5v5).',
      steps: [
        { key: 'E', label: 'Atravessa parede da base', note: '36:18 (20:00 jogo)' },
        { key: 'W', label: 'Slow/dano à distância', uncertain: true, note: '20:00–20:05 (ordem W/Q/R incerta)' },
        { key: 'Q', label: 'Combo curto', uncertain: true, note: '20:00–20:05' },
        { key: 'R', label: 'Espera E voltar / finaliza', uncertain: true, note: '20:00–20:05' },
        { key: 'E', label: 'Sai pela parede para Kruges', note: '36:33 (20:08 jogo)' },
      ],
      sequenceUncertaintyNote:
        'Entre 20:00 e 20:05 Q, W e R entraram em recarga juntos; a ordem interna exata de W/Q/R após o 1º E não foi resolvida quadro a quadro e aparece marcada como incerta.',
      prerequisite:
        'Forma Azul ativa (E com tempo de recarga curto e velocidade extra) e consciência de quantos inimigos estão na base antes de cruzar o muro.',
      heldAbility: 'Segundo E / ângulo de saída pela parede',
      heldAbilityReason:
        'Ao contrário do Rhaast (que fica na luta curando com Q/W), o Kayn Azul usa R para comprar os segundos até o próximo E e sair de volta pela parede para roubar campo.',
      targetDodgesOrDashes:
        'Se o alvo usar Flash/barril de velocidade para dentro da fonte, aborte a saída no E e recolha os campos da selva inimiga em vez de se suicidar na base.',
      commonMistake:
        'Sair do R andando em linha reta para dentro do time inimigo em vez de usar o E imediatamente na parede mais próxima.',
      practiceModeDrill:
        'No Modo Treino com Kayn Azul + Botas Ionianas: atravesse a parede da base no Top com E, faça W → Q → R no boneco, e saia pela mesma parede com o próximo E em direção aos Kruges.',
      patchCompatibility: 'historical_reference',
    },
    karasmaiPt: {
      whatHeDid:
        'Aos 20:00 de jogo, cruzou a parede da base adversária com E para cortar Gangplank no Top, participou do abate com Orianna (20:05) e aos 20:08 já pulou o muro de volta com outro E para farmar os Kruges inimigos.',
      whatHeExplained:
        'Na legenda (36:13–36:21), ele compara diretamente com outros caçadores: enquanto outros junglers só entram pela rota, o Kayn Azul usa os ângulos de parede para cortar a fuga e sair com segurança.',
      howToTrain:
        'Compare este cartão com o cartão de Rhaast do mesmo vídeo: no Azul, você nunca "mora" na luta — entra da parede, despeja 1 rotação + R e sai pela parede para pegar campo/pressão.',
      englishTerms: [
        { term: 'Cut off', meaningPt: 'Cortar o caminho de fuga do adversário antes que ele alcance torre ou base.' },
      ],
    },
  },

  // =====================================================================
  // EXERCÍCIOS DE MODO TREINO (sem atribuição a criador — 16.23.1)
  // =====================================================================
  {
    id: 'drill-blue-w-motion',
    title: 'Kayn Azul: W sem parar de andar + saída pelo E',
    creator: 'training_drill',
    creatorDisplayName: 'Exercício de Treino',
    attributionLabel: 'Exercício de treino',
    topic: 'micro',
    form: 'blue',
    verificationStatus: 'generic_drill',
    speechVerified: false,
    isHistoricalReference: false,
    patch: '16.23.1',
    videoUrl: 'https://wiki.leagueoflegends.com/en-us/Kayn',
    videoTitle: 'Mecânica base da forma Assassino das Sombras (sem atribuição a criador)',
    channelName: 'Modo Treino (LoL)',
    channelUrl: 'https://wiki.leagueoflegends.com/en-us/Kayn',
    contextStartSeconds: null,
    playMomentSeconds: null,
    timestampDisplay: 'Exercício offline (Modo Treino)',
    gameClockDisplay: '5 min antes da fila',
    shortSummaryPt:
      'Exercício essencial exclusivo do Kayn Azul: a sombra lança o W enquanto seu corpo continua andando — pratique encaixar W em movimento dentro da parede e entrar só se acertar.',
    evidenceNote:
      'Exercício genérico de mecânica oficial do campeão (sem atribuição a streamer). Compatível com o patch 16.23.1.',
    micro: {
      situation:
        'Qualquer aproximação de Kayn Azul pelo muro contra alvos com dash ou reação rápida.',
      steps: [
        { key: 'E', label: 'Corre dentro da parede' },
        { key: 'W', label: 'Lança sem parar de mover' },
        { key: 'Q', label: 'Entra só se W conectar' },
        { key: 'R', label: 'Finaliza ou desvia de CC' },
      ],
      prerequisite: 'Forma Azul desbloqueada (W ganha alcance e remove o travamento de animação).',
      heldAbility: 'Q (para entrada ou fuga)',
      heldAbilityReason:
        'Como o W do Azul não trava seu movimento, se você errar o W de dentro da parede ainda tem Q e o resto do E para sair vivo sem se entregar.',
      targetDodgesOrDashes:
        'Se o alvo desviar do W com dash, continue andando na parede com E até o próximo campo — você não gastou Q para dentro dele.',
      commonMistake:
        'Apertar Q junto com W por memória muscular do Rhaast e se jogar em cima do CC mesmo quando o W errou.',
      practiceModeDrill:
        'No Modo Treino com Kayn Azul (sem CD): coloque 2 bonecos atrás do muro das Acuaminas e do Dragão; dê E na parede, lance W andando sem sair da parede e só aperte Q quando tiver certeza que o W acertaria.',
      patchCompatibility: 'verified_16_23_1',
    },
  },
  {
    id: 'drill-q-wall-cancel',
    title: 'Cancelamento da animação do Q na parede curta (clear e 1v1)',
    creator: 'training_drill',
    creatorDisplayName: 'Exercício de Treino',
    attributionLabel: 'Exercício de treino',
    topic: 'micro',
    form: 'both',
    verificationStatus: 'generic_drill',
    speechVerified: false,
    isHistoricalReference: false,
    patch: '16.23.1',
    videoUrl: 'https://wiki.leagueoflegends.com/en-us/Kayn',
    videoTitle: 'Cancelamento básico de dash do Q em terreno (sem atribuição a criador)',
    channelName: 'Modo Treino (LoL)',
    channelUrl: 'https://wiki.leagueoflegends.com/en-us/Kayn',
    contextStartSeconds: null,
    playMomentSeconds: null,
    timestampDisplay: 'Exercício offline (Modo Treino)',
    gameClockDisplay: 'Clear inicial / escaramuça',
    shortSummaryPt:
      'Direcionar o dash do Q contra uma parede grossa o suficiente para não atravessar cancela o deslocamento e aplica os dois hits (dash + giro) instantaneamente, acelerando o clear e trocas corpo a corpo.',
    evidenceNote:
      'Exercício genérico de mecânica (sem atribuição a criador). Funciona em Kayn Base, Rhaast e Kayn Azul no patch 16.23.1.',
    micro: {
      situation:
        'Limpando Azul, Gromp, Lobos ou duelando corpo a corpo colado em uma parede.',
      steps: [
        { key: 'AA', label: 'Ataque básico inicial' },
        { key: 'Q', label: 'Mira contra parede que não atravessa' },
        { key: 'AA', label: 'Ataque imediato pós-giro' },
      ],
      prerequisite: 'Estar colado no alvo e com uma parede mais espessa que o alcance curto do Q às costas do alvo.',
      heldAbility: 'E (para atravessar se precisar fugir)',
      heldAbilityReason:
        'O Q não atravessa paredes grossas como a parede externa do Azul ou pedra atrás das Acuaminas, entregando DPS máximo sem gastar E.',
      targetDodgesOrDashes:
        'Não mire o Q na direção errada em parede fina (como parede do fosso do Dragão/Barão), senão você atravessa e fica fora de alcance do giro.',
      commonMistake:
        'Mirar o Q em direção aberta e deslizar para longe do campo/inimigo perdendo tempo de ataque básico.',
      practiceModeDrill:
        'No Modo Treino nível 1, faça o 1º clear completo usando Q contra as paredes de Lobos, Azul e Kruges até fechar 6 campos abaixo de 3:15.',
      patchCompatibility: 'verified_16_23_1',
    },
  },

  // =====================================================================
  // FONTES PENDENTES DE CURADORIA (NÃO APARECEM NAS RECOMENDAÇÕES PRONTAS)
  // =====================================================================
  {
    id: 'caiozera-pending-stepz',
    title: '[PENDENTE] Flanco no Mid de Kayn Azul (vídeo editado sem minimapa)',
    creator: 'caiozera',
    creatorDisplayName: 'CaiozeraLoL',
    attributionLabel: 'Fonte pendente',
    topic: 'micro',
    form: 'blue',
    verificationStatus: 'pending_curation',
    speechVerified: false,
    isHistoricalReference: false,
    patch: 'Desconhecido (Out/2026)',
    videoUrl: 'https://www.youtube.com/watch?v=n8qus6o_FIs',
    videoTitle: 'AMASSEI O JUNGLER DA REDCANIDS STEPZ E DEPOIS DISSO KAYN VIROU PERMABAN DELE 🤣🤣🤣🤣',
    channelName: 'caíozera (@caiozerinha)',
    channelUrl: 'https://www.youtube.com/@caiozerinha',
    contextStartSeconds: 263,
    playMomentSeconds: 268,
    timestampDisplay: '04:23 (entrada E) → 04:33 (abate)',
    gameClockDisplay: '14:46 → 14:57 (cortes no vídeo)',
    shortSummaryPt:
      'Fonte pendente: há um flanco real de Kayn Azul aos 04:23–04:33 entrando na parede Mid/Acuaminas com E e guardando Q/W/R, mas a webcam cobre o minimapa e a edição corta o contexto e a ordem exata sub-segundo.',
    evidenceNote:
      'Marcado como pendente de curadoria: precisa conferir quadro a quadro entre 04:28 e 04:33 ou achar o VOD sem cortes antes de virar cartão pronto.',
  },
  {
    id: 'karasmai-pending-blue-clear',
    title: '[PENDENTE] Blue Kayn Clear Well and Dominate Mid Game (Mar/2026)',
    creator: 'karasmai',
    creatorDisplayName: 'Karasmai',
    attributionLabel: 'Fonte pendente',
    topic: 'macro',
    form: 'blue',
    verificationStatus: 'pending_curation',
    speechVerified: false,
    isHistoricalReference: false,
    patch: 'Desconhecido (Mar/2026)',
    videoUrl: 'https://www.youtube.com/watch?v=orCY9yS253I',
    videoTitle: 'Blue Kayn Clear Well and Dominate Mid Game - League of Legends',
    channelName: 'Karasmai Kayn (@karasmaikayn)',
    channelUrl: 'https://www.youtube.com/@karasmaikayn',
    contextStartSeconds: null,
    playMomentSeconds: null,
    timestampDisplay: 'A assistir e marcar timestamp',
    gameClockDisplay: 'Pendente',
    shortSummaryPt:
      'Vídeo confirmado no canal secundário oficial Karasmai Kayn (Mar/2026). Cadastrado como fonte pendente até que transcrição e timestamps reais sejam inspecionados.',
    evidenceNote:
      'Apenas título/canal confirmados no RSS oficial. Fica fora das lições prontas até inspeção de legenda e gameplay.',
  },
  {
    id: 'karasmai-pending-blue-combos',
    title: '[PENDENTE] CHALLENGER COMBOS WITH BLUE INSANE KDA (Jan/2026)',
    creator: 'karasmai',
    creatorDisplayName: 'Karasmai',
    attributionLabel: 'Fonte pendente',
    topic: 'micro',
    form: 'blue',
    verificationStatus: 'pending_curation',
    speechVerified: false,
    isHistoricalReference: false,
    patch: 'Desconhecido (Jan/2026)',
    videoUrl: 'https://www.youtube.com/watch?v=99FRISi0Y5g',
    videoTitle: 'CHALLENGER COMBOS WITH BLUE INSANE KDA',
    channelName: 'Karasmai Kayn (@karasmaikayn)',
    channelUrl: 'https://www.youtube.com/@karasmaikayn',
    contextStartSeconds: null,
    playMomentSeconds: null,
    timestampDisplay: 'A assistir e marcar timestamp',
    gameClockDisplay: 'Pendente',
    shortSummaryPt:
      'Vídeo confirmado no canal secundário oficial Karasmai Kayn (Jan/2026). Pendente de conferência quadro a quadro dos combos e habilidades guardadas.',
    evidenceNote:
      'Apenas título/canal confirmados no RSS oficial. Fica fora das recomendações prontas até curadoria.',
  },
];

export function getAllStudyLessons(customLessons: StudyLesson[]): StudyLesson[] {
  return [...CURATED_STUDY_LESSONS, ...customLessons];
}

const CREATOR_PRIORITY: Record<StudyCreator, number> = {
  caiozera: 0,
  karasmai: 1,
  training_drill: 2,
};

export interface StudyFilterCriteria {
  creator: 'all' | StudyCreator;
  topic: 'all' | StudyTopic;
  form: 'all' | StudyKaynForm;
  includePending: boolean;
}

export function filterStudyLessons(
  lessons: StudyLesson[],
  criteria: StudyFilterCriteria,
): StudyLesson[] {
  return lessons
    .filter((lesson) => {
      if (!criteria.includePending && lesson.verificationStatus === 'pending_curation') {
        return false;
      }
      if (criteria.includePending && lesson.verificationStatus !== 'pending_curation') {
        return false;
      }
      if (criteria.creator !== 'all' && lesson.creator !== criteria.creator) {
        return false;
      }
      if (criteria.topic !== 'all' && lesson.topic !== criteria.topic) {
        return false;
      }
      if (criteria.form !== 'all') {
        if (lesson.form !== criteria.form && lesson.form !== 'both') {
          return false;
        }
      }
      return true;
    })
    .sort((a, b) => {
      const ca = CREATOR_PRIORITY[a.creator] ?? 9;
      const cb = CREATOR_PRIORITY[b.creator] ?? 9;
      if (ca !== cb) return ca - cb;
      if (a.topic !== b.topic) return a.topic === 'macro' ? -1 : 1;
      return 0;
    });
}

export function toggleFavoriteMicroId(
  currentIds: string[],
  lessonId: string,
  allLessons: StudyLesson[],
): { ids: string[]; warning?: string } {
  const target = allLessons.find((l) => l.id === lessonId);
  if (!target || target.topic !== 'micro' || !target.micro) {
    return { ids: currentIds, warning: 'Apenas cartões de micro podem ser fixados.' };
  }
  if (target.verificationStatus === 'pending_curation') {
    return {
      ids: currentIds,
      warning: 'Fontes pendentes de curadoria não podem ser fixadas no cartão pré-jogo.',
    };
  }

  if (currentIds.includes(lessonId)) {
    return { ids: currentIds.filter((id) => id !== lessonId) };
  }

  if (currentIds.length >= MAX_FAVORITE_MICRO_CARDS) {
    return {
      ids: currentIds,
      warning: `Limite de ${MAX_FAVORITE_MICRO_CARDS} cartões favoritos atingido. Remova um antes de adicionar outro.`,
    };
  }

  return { ids: [...currentIds, lessonId] };
}

export function buildFrozenMicroCards(
  favoriteIds: string[],
  allLessons: StudyLesson[],
): FrozenMicroComboCard[] {
  const result: FrozenMicroComboCard[] = [];
  for (const id of favoriteIds.slice(0, MAX_FAVORITE_MICRO_CARDS)) {
    const lesson = allLessons.find(
      (l) =>
        l.id === id &&
        l.topic === 'micro' &&
        l.micro &&
        l.verificationStatus !== 'pending_curation',
    );
    if (!lesson || !lesson.micro) continue;
    result.push({
      lessonId: lesson.id,
      title: lesson.title,
      attributionLabel: lesson.attributionLabel,
      form: lesson.form,
      steps: lesson.micro.steps,
      conditionToUse: lesson.micro.situation,
      heldAbilityHint: `${lesson.micro.heldAbility}: ${lesson.micro.heldAbilityReason}`,
      patchCompatibility: lesson.micro.patchCompatibility,
    });
  }
  return result;
}

export function createManualPendingLesson(input: {
  title: string;
  creator: StudyCreator;
  topic: StudyTopic;
  form: StudyKaynForm;
  videoUrl: string;
  timestampInput: string;
  note: string;
}): { ok: boolean; lesson?: StudyLesson; error?: string } {
  const title = input.title.trim();
  if (!title) {
    return { ok: false, error: 'Informe um título curto para a lição/vídeo.' };
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(input.videoUrl.trim());
    if (parsedUrl.protocol !== 'https:') {
      return { ok: false, error: 'A URL do vídeo deve começar com https://' };
    }
  } catch {
    return { ok: false, error: 'URL inválida. Informe o link completo do YouTube ou Twitch.' };
  }

  const seconds = parseTimestampToSeconds(input.timestampInput);
  if (input.timestampInput.trim() && seconds === null) {
    return {
      ok: false,
      error: 'Timestamp inválido. Use formato MM:SS (ex.: 04:23), HH:MM:SS ou segundos.',
    };
  }

  const creatorNames: Record<StudyCreator, string> = {
    caiozera: 'CaiozeraLoL',
    karasmai: 'Karasmai',
    training_drill: 'Exercício de Treino',
  };

  const lesson: StudyLesson = {
    id: `custom-pending-${Date.now()}`,
    title: title.startsWith('[PENDENTE]') ? title : `[PENDENTE] ${title}`,
    creator: input.creator,
    creatorDisplayName: creatorNames[input.creator],
    attributionLabel: 'Fonte pendente',
    topic: input.topic,
    form: input.form,
    verificationStatus: 'pending_curation',
    speechVerified: false,
    isHistoricalReference: false,
    patch: 'Desconhecido (cadastro manual)',
    videoUrl: parsedUrl.toString(),
    videoTitle: title,
    channelName: creatorNames[input.creator],
    channelUrl: parsedUrl.origin,
    contextStartSeconds: seconds,
    playMomentSeconds: seconds,
    timestampDisplay: seconds !== null ? formatSecondsToTimestamp(seconds) : 'Sem timestamp',
    gameClockDisplay: 'Anotação manual pendente',
    shortSummaryPt:
      input.note.trim() ||
      'Fonte cadastrada manualmente para assistir e validar contexto/sequência antes de promover.',
    evidenceNote:
      'Cadastrado manualmente pelo usuário — mantido fora das recomendações prontas enquanto estiver pendente.',
    isCustom: true,
  };

  return { ok: true, lesson };
}
