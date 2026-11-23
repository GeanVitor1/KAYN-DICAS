import type {
  CatalogSnapshot,
  DraftSide,
  ReviewEvent,
  ReviewMatch,
  ReviewMatchStats,
} from '../shared/types';
import { evaluateMatchPlanComparison } from './lcuMatchParser';
import { mapLiveClientDataToStatus } from './liveLolParser';

interface MinuteSample {
  minute: number;
  cs: number;
  gold: number;
  level: number;
  hpPercent: number;
  kills: number;
  deaths: number;
  assists: number;
}

interface RawLiveEvent {
  EventID?: number;
  EventName?: string;
  EventTime?: number;
  KillerName?: string;
  VictimName?: string;
  Assisters?: string[];
  Result?: string;
  TurretKilled?: string;
}

export class LiveMatchRecorder {
  private active = false;
  private lastGameTimeSeconds = 0;
  private lastAllies: DraftSide | null = null;
  private lastEnemies: DraftSide | null = null;
  private playerChampionId = 'Kayn';
  private playerChampionName = 'Kayn';
  private playerTeam: 'ORDER' | 'CHAOS' = 'ORDER';
  private localPlayerIdentifiers = new Set<string>();
  private allyIdentifiers = new Set<string>();
  private enemyIdentifiers = new Set<string>();
  private championByPlayerIdent = new Map<string, string>();
  private lastKills = 0;
  private lastDeaths = 0;
  private lastAssists = 0;
  private lastTeamKills = 0;
  private lastTotalCs = 0;
  private lastLevel = 1;
  private lastCurrentGold = 0;
  private lastItems: Array<{ itemId: string; name: string }> = [];
  private lastObjectives = {
    allyDragons: 0,
    enemyDragons: 0,
    allyGrubs: 0,
    enemyGrubs: 0,
    allyHeralds: 0,
    enemyHeralds: 0,
    allyBarons: 0,
    enemyBarons: 0,
  };
  private minuteSamples = new Map<number, MinuteSample>();
  private hpBySecondWindow = new Map<number, number>();
  private lastRawEvents: RawLiveEvent[] = [];
  private gameEndResult: 'win' | 'loss' | 'unknown' = 'unknown';
  private finalizedCurrentMatch = false;

  reset(): void {
    this.active = false;
    this.lastGameTimeSeconds = 0;
    this.lastAllies = null;
    this.lastEnemies = null;
    this.playerChampionId = 'Kayn';
    this.playerChampionName = 'Kayn';
    this.playerTeam = 'ORDER';
    this.localPlayerIdentifiers.clear();
    this.allyIdentifiers.clear();
    this.enemyIdentifiers.clear();
    this.championByPlayerIdent.clear();
    this.lastKills = 0;
    this.lastDeaths = 0;
    this.lastAssists = 0;
    this.lastTeamKills = 0;
    this.lastTotalCs = 0;
    this.lastLevel = 1;
    this.lastCurrentGold = 0;
    this.lastItems = [];
    this.lastObjectives = {
      allyDragons: 0,
      enemyDragons: 0,
      allyGrubs: 0,
      enemyGrubs: 0,
      allyHeralds: 0,
      enemyHeralds: 0,
      allyBarons: 0,
      enemyBarons: 0,
    };
    this.minuteSamples.clear();
    this.hpBySecondWindow.clear();
    this.lastRawEvents = [];
    this.gameEndResult = 'unknown';
    this.finalizedCurrentMatch = false;
  }

  isRecording(): boolean {
    return this.active && !this.finalizedCurrentMatch;
  }

  getLastGameTimeSeconds(): number {
    return this.lastGameTimeSeconds;
  }

  /**
   * Alimenta um snapshot oficial da Live Client Data API (`allgamedata`).
   * Retorna `gameEndedNow = true` quando o evento oficial `GameEnd` é detectado.
   */
  ingestLivePayload(
    rawData: unknown,
    catalog: CatalogSnapshot,
  ): { gameEndedNow: boolean } {
    if (!rawData || typeof rawData !== 'object') {
      return { gameEndedNow: false };
    }
    const mapped = mapLiveClientDataToStatus(rawData, catalog);
    if (!mapped) {
      return { gameEndedNow: false };
    }

    const data = rawData as Record<string, unknown>;
    const gameTime = mapped.liveMatch.gameTimeSeconds;

    // Detecta nova partida caso o relógio tenha reiniciado (ex.: usuário iniciou outro jogo)
    if (this.active && gameTime + 30 < this.lastGameTimeSeconds) {
      this.reset();
    }

    if (!this.active) {
      this.active = true;
      this.finalizedCurrentMatch = false;
    }

    this.lastGameTimeSeconds = Math.max(this.lastGameTimeSeconds, gameTime);
    this.lastAllies = mapped.liveDraft.allies;
    this.lastEnemies = mapped.liveDraft.enemies;
    this.playerChampionId = mapped.liveMatch.playerChampionId ?? 'Kayn';
    this.playerChampionName = mapped.liveMatch.playerChampionName;
    this.playerTeam = mapped.liveMatch.playerTeam;
    this.lastKills = mapped.liveMatch.kills;
    this.lastDeaths = mapped.liveMatch.deaths;
    this.lastAssists = mapped.liveMatch.assists;
    this.lastTotalCs = mapped.liveMatch.totalCreepScore;
    this.lastLevel = mapped.liveMatch.level;
    this.lastCurrentGold = mapped.liveMatch.currentGold;
    this.lastItems = mapped.liveMatch.ownedItems.map((it) => ({
      itemId: it.itemId,
      name: it.name,
    }));
    this.lastObjectives = { ...mapped.liveMatch.objectivesTaken };

    const hpPct =
      mapped.liveMatch.maxHealth > 0
        ? Math.max(0, Math.min(100, Math.round((mapped.liveMatch.currentHealth / mapped.liveMatch.maxHealth) * 100)))
        : 100;

    // Guarda amostra de HP em buckets de 5s para saber se o jogador entrou com vida baixa antes de morrer
    const secBucket = Math.floor(gameTime / 5) * 5;
    if (hpPct > 0) {
      this.hpBySecondWindow.set(secBucket, hpPct);
    }

    const minuteBucket = Math.floor(gameTime / 60);
    this.minuteSamples.set(minuteBucket, {
      minute: minuteBucket,
      cs: mapped.liveMatch.totalCreepScore,
      gold: mapped.liveMatch.currentGold,
      level: mapped.liveMatch.level,
      hpPercent: hpPct,
      kills: mapped.liveMatch.kills,
      deaths: mapped.liveMatch.deaths,
      assists: mapped.liveMatch.assists,
    });

    // Mapear identificadores em memória (nunca persistidos) para atribuir eventos corretamente
    const activePlayer = (data.activePlayer ?? {}) as Record<string, unknown>;
    const allPlayers = Array.isArray(data.allPlayers)
      ? (data.allPlayers as Array<Record<string, unknown>>)
      : [];

    const addIdent = (set: Set<string>, val: unknown, champName?: string) => {
      if (typeof val === 'string' && val.trim()) {
        const clean = val.trim().toLowerCase();
        set.add(clean);
        const beforeHash = clean.split('#')[0]?.trim();
        if (beforeHash) set.add(beforeHash);
        if (champName) {
          this.championByPlayerIdent.set(clean, champName);
          if (beforeHash) this.championByPlayerIdent.set(beforeHash, champName);
        }
      }
    };

    addIdent(this.localPlayerIdentifiers, activePlayer.riotId, this.playerChampionName);
    addIdent(this.localPlayerIdentifiers, activePlayer.riotIdGameName, this.playerChampionName);
    addIdent(this.localPlayerIdentifiers, activePlayer.summonerName, this.playerChampionName);

    let teamKills = 0;
    for (const p of allPlayers) {
      const pTeam = p.team === 'CHAOS' ? 'CHAOS' : 'ORDER';
      const champName = String(p.championName ?? '');
      const targetSet = pTeam === this.playerTeam ? this.allyIdentifiers : this.enemyIdentifiers;
      addIdent(targetSet, p.riotId, champName);
      addIdent(targetSet, p.riotIdGameName, champName);
      addIdent(targetSet, p.summonerName, champName);

      if (pTeam === this.playerTeam) {
        const sc = (p.scores ?? {}) as Record<string, unknown>;
        teamKills += Number(sc.kills ?? 0);
      }
    }
    this.lastTeamKills = teamKills;

    const eventsObj = (data.events ?? {}) as Record<string, unknown>;
    const rawEvents = Array.isArray(eventsObj.Events)
      ? (eventsObj.Events as RawLiveEvent[])
      : [];
    if (rawEvents.length > 0) {
      this.lastRawEvents = rawEvents;
    }

    const endEv = rawEvents.find((e) => e.EventName === 'GameEnd');
    if (endEv && !this.finalizedCurrentMatch) {
      const resStr = String(endEv.Result ?? '').toLowerCase();
      if (resStr === 'win') this.gameEndResult = 'win';
      else if (resStr === 'lose' || resStr === 'loss') this.gameEndResult = 'loss';
      return { gameEndedNow: true };
    }

    return { gameEndedNow: false };
  }

  private isLocalName(name?: string): boolean {
    if (!name) return false;
    const lower = name.trim().toLowerCase();
    const beforeHash = lower.split('#')[0]?.trim() ?? '';
    return this.localPlayerIdentifiers.has(lower) || this.localPlayerIdentifiers.has(beforeHash);
  }

  private isAllyName(name?: string): boolean {
    if (!name) return false;
    const lower = name.trim().toLowerCase();
    const beforeHash = lower.split('#')[0]?.trim() ?? '';
    return (
      this.isLocalName(name) ||
      this.allyIdentifiers.has(lower) ||
      this.allyIdentifiers.has(beforeHash)
    );
  }

  private lookupChampion(name?: string): string | null {
    if (!name) return null;
    const lower = name.trim().toLowerCase();
    return (
      this.championByPlayerIdent.get(lower) ??
      this.championByPlayerIdent.get(lower.split('#')[0]?.trim() ?? '') ??
      null
    );
  }

  private lookupHpBeforeEvent(eventTimeSeconds: number): number | null {
    // Procura última amostra de HP entre 5s e 25s antes da morte/jogada
    const targetSec = Math.floor(eventTimeSeconds / 5) * 5;
    for (let offset = 10; offset <= 25; offset += 5) {
      const val = this.hpBySecondWindow.get(targetSec - offset);
      if (typeof val === 'number' && val > 0) return val;
    }
    return null;
  }

  /**
   * Finaliza a captura da partida atual e devolve um `ReviewMatch` completo.
   * Retorna `null` se a partida foi curta demais (< 120s, ex.: remake ou teste rápido).
   */
  finalizeMatch(
    catalog: CatalogSnapshot,
    options?: { minDurationSeconds?: number; preferBlueAsTiebreaker?: boolean },
  ): ReviewMatch | null {
    const minDuration = options?.minDurationSeconds ?? 120;
    if (!this.active || this.finalizedCurrentMatch || this.lastGameTimeSeconds < minDuration) {
      return null;
    }
    this.finalizedCurrentMatch = true;

    const durationSeconds = Math.max(1, this.lastGameTimeSeconds);
    const durationMinutes = Math.max(1, durationSeconds / 60);
    const events: ReviewEvent[] = [];
    let seq = 1;
    let deathsBefore14 = 0;
    let killsAssistsBefore14 = 0;

    for (const ev of this.lastRawEvents) {
      const evName = String(ev.EventName ?? '');
      const evSec = Math.max(0, Number(ev.EventTime ?? 0));
      const minute = Math.max(1, Math.round((evSec / 60) * 10) / 10);

      if (evName === 'ChampionKill') {
        const iKilled = this.isLocalName(ev.KillerName);
        const iDied = this.isLocalName(ev.VictimName);
        const assisters = Array.isArray(ev.Assisters) ? ev.Assisters : [];
        const iAssisted = assisters.some((a) => this.isLocalName(a));
        if (!iKilled && !iDied && !iAssisted) continue;

        if (iDied && minute <= 14) deathsBefore14 += 1;
        if ((iKilled || iAssisted) && minute <= 14) killsAssistsBefore14 += 1;

        // Verifica se inimigos pegaram objetivo épico ou torre nos próximos 75s
        const enemyObj = this.lastRawEvents.find((other) => {
          const oSec = Number(other.EventTime ?? 0);
          if (oSec < evSec || oSec > evSec + 75) return false;
          const oName = String(other.EventName ?? '');
          if (
            (oName === 'DragonKill' ||
              oName === 'HeraldKill' ||
              oName === 'HordeKill' ||
              oName === 'BaronKill') &&
            !this.isAllyName(other.KillerName)
          ) {
            return true;
          }
          return false;
        });

        const enemyTurret = this.lastRawEvents.find((other) => {
          const oSec = Number(other.EventTime ?? 0);
          if (oSec < evSec || oSec > evSec + 65) return false;
          return other.EventName === 'TurretKilled' && !this.isAllyName(other.KillerName);
        });

        let enemyResponseText =
          'Sem objetivo épico/torre inimiga nos 75s seguintes; importe pelo LCU se quiser posição exata no mapa.';
        let enemyResponseCertainty: 'confirmed' | 'hypothesis' = 'hypothesis';

        if (enemyObj) {
          const delay = Math.round(Number(enemyObj.EventTime ?? evSec) - evSec);
          const objPt =
            enemyObj.EventName === 'DragonKill'
              ? 'Dragão'
              : enemyObj.EventName === 'BaronKill'
                ? 'Barão'
                : enemyObj.EventName === 'HeraldKill'
                  ? 'Arauto'
                  : 'Vastilarvas';
          enemyResponseText = `Inimigo garantiu ${objPt} ${delay}s após esse lance.`;
          enemyResponseCertainty = 'confirmed';
        } else if (enemyTurret && iDied) {
          const delay = Math.round(Number(enemyTurret.EventTime ?? evSec) - evSec);
          enemyResponseText = `Inimigo derrubou torre aliada ${delay}s após sua morte.`;
          enemyResponseCertainty = 'confirmed';
        }

        const hpBefore = this.lookupHpBeforeEvent(evSec);

        if (iDied) {
          const killerChamp = this.lookupChampion(ev.KillerName) ?? 'adversário';
          const enemyCount = 1 + assisters.length;
          events.push({
            id: `live-ev-${seq++}`,
            minute,
            type: 'death',
            lane: 'river',
            allyPrio: 'unknown',
            estimatedEnemyJungler: 'unknown',
            kaynHpPercent: hpBefore,
            resourcesReady: null,
            timeSpentSeconds: null,
            outcome: 'died',
            whatHappenedAfter:
              enemyCount === 1
                ? `Morte solo (1v1) para ${killerChamp} (gravado ao vivo).`
                : `Abatido por ${killerChamp} + ${enemyCount - 1} inimigo(s) (gravado ao vivo).`,
            enemyResponseText,
            enemyResponseCertainty,
            executionNote:
              hpBefore !== null && hpBefore < 55
                ? `Estava com ~${hpBefore}% de vida antes da morte — cuidado ao disputar sem resetar.`
                : 'Gravado automaticamente ao vivo. Edite a rota/wave se quiser aprofundar no replay.',
            decisionContextSource: 'live_captured',
          });
        } else {
          const victimChamp = this.lookupChampion(ev.VictimName) ?? 'inimigo';
          events.push({
            id: `live-ev-${seq++}`,
            minute,
            type: 'gank',
            lane: 'river',
            allyPrio: 'unknown',
            estimatedEnemyJungler: 'unknown',
            kaynHpPercent: hpBefore,
            resourcesReady: null,
            timeSpentSeconds: null,
            outcome: iKilled ? 'kill' : 'assist',
            whatHappenedAfter: iKilled
              ? `Abate confirmado em ${victimChamp}.`
              : `Assistência confirmada em ${victimChamp}.`,
            enemyResponseText,
            enemyResponseCertainty,
            executionNote: '',
            decisionContextSource: 'live_captured',
          });
        }
      } else if (
        (evName === 'DragonKill' ||
          evName === 'HeraldKill' ||
          evName === 'HordeKill' ||
          evName === 'BaronKill') &&
        this.isAllyName(ev.KillerName)
      ) {
        const objPt =
          evName === 'DragonKill'
            ? 'Dragão'
            : evName === 'BaronKill'
              ? 'Barão Na’Shor'
              : evName === 'HeraldKill'
                ? 'Arauto do Vale'
                : 'Vastilarvas';
        events.push({
          id: `live-ev-${seq++}`,
          minute,
          type: 'objective',
          lane: 'river',
          allyPrio: 'unknown',
          estimatedEnemyJungler: 'unknown',
          kaynHpPercent: null,
          resourcesReady: null,
          timeSpentSeconds: null,
          outcome: 'completed_objective',
          whatHappenedAfter: `${objPt} garantido pela equipe.`,
          enemyResponseText:
            'Verifique se o jungler adversário respondeu com objetivo ou invasão no lado oposto.',
          enemyResponseCertainty: 'hypothesis',
          executionNote: '',
          decisionContextSource: 'live_captured',
        });
      }
    }

    // Benchmarks @10, @15 e janela sem farm a partir das amostras por minuto
    const sortedSamples = Array.from(this.minuteSamples.values()).sort(
      (a, b) => a.minute - b.minute,
    );
    const csAt10 = this.minuteSamples.get(10)?.cs ?? null;
    const csAt15 = this.minuteSamples.get(15)?.cs ?? null;

    let longestDry = 0;
    let longestRange: string | null = null;
    let curDry = 0;
    let curStart = 0;
    for (let i = 1; i < sortedSamples.length; i += 1) {
      const prev = sortedSamples[i - 1];
      const cur = sortedSamples[i];
      if (cur.minute - prev.minute !== 1 || cur.minute < 4 || cur.minute > 26) {
        curDry = 0;
        continue;
      }
      if (cur.cs - prev.cs <= 3) {
        if (curDry === 0) curStart = prev.minute;
        curDry += 1;
        if (curDry > longestDry) {
          longestDry = curDry;
          longestRange = `Min ${curStart}–${cur.minute}`;
        }
      } else {
        curDry = 0;
      }
    }

    const allies = this.lastAllies ?? {
      top: null,
      jungle: this.playerChampionId,
      mid: null,
      bot: null,
      support: null,
    };
    const enemies = this.lastEnemies ?? {
      top: null,
      jungle: null,
      mid: null,
      bot: null,
      support: null,
    };

    const { recommendedForm, planComparison } = evaluateMatchPlanComparison({
      allies,
      enemies,
      ownedItemIds: this.lastItems.map((i) => i.itemId),
      catalog,
      preferBlueAsTiebreaker: options?.preferBlueAsTiebreaker,
    });

    const csPerMin = Math.round((this.lastTotalCs / durationMinutes) * 10) / 10;
    const kp =
      this.lastTeamKills > 0
        ? Math.min(100, Math.round(((this.lastKills + this.lastAssists) / this.lastTeamKills) * 100))
        : null;
    // Estimativa conservadora de ouro gasto + ouro na mão (se não houver LCU)
    const estimatedItemsGold = this.lastItems.reduce(
      (sum, it) => sum + (catalog.items[it.itemId]?.gold ?? 0),
      0,
    );
    const approxGoldEarned = estimatedItemsGold + this.lastCurrentGold;
    const resultLabel =
      this.gameEndResult === 'win'
        ? 'Vitória'
        : this.gameEndResult === 'loss'
          ? 'Derrota'
          : 'Partida';

    const matchStats: ReviewMatchStats = {
      capturedAt: new Date().toISOString(),
      captureSource: 'live_auto',
      result: this.gameEndResult,
      durationSeconds,
      queueLabel: 'Ao vivo',
      championId: this.playerChampionId,
      championName: this.playerChampionName,
      kills: this.lastKills,
      deaths: this.lastDeaths,
      assists: this.lastAssists,
      teamKills: this.lastTeamKills,
      killParticipationPct: kp,
      totalCs: this.lastTotalCs,
      csPerMin,
      goldEarned: approxGoldEarned,
      goldPerMin: Math.round(approxGoldEarned / durationMinutes),
      level: this.lastLevel,
      itemsBuilt: this.lastItems,
      allies,
      enemies,
      recommendedFormFromDraft: recommendedForm,
      objectives: { ...this.lastObjectives },
      earlyBenchmarks: {
        csAt10,
        csAt15,
        deathsBefore14,
        killsAssistsBefore14,
        longestFarmDrySpellMinutes: longestDry >= 3 ? longestDry : null,
        longestFarmDrySpellRange: longestDry >= 3 ? longestRange : null,
      },
      planComparison,
    };

    const stamp = Date.now();
    return {
      id: `review-live-${stamp}`,
      title: `${resultLabel} · ${this.playerChampionName} ${this.lastKills}/${this.lastDeaths}/${this.lastAssists} (${Math.round(durationMinutes)}m · Auto)`,
      isExampleDemo: false,
      sourceLabel: 'Gravada automaticamente ao fim da partida (Live Client Data)',
      patch: catalog.patch,
      rankContext: 'Solo/Duo BR',
      matchId: `LIVE_${stamp}`,
      plannedForm: recommendedForm === 'red' ? 'red' : 'blue',
      actualFormMinute: null,
      actualFormChosen: null,
      events,
      playerSummaryNote:
        'Gravada automaticamente ao encerrar a partida. A Live Client Data API registra abates, mortes, HP, CS por minuto e objetivos; se o cliente do LoL estiver aberto, o app tenta enriquecer automaticamente com as coordenadas exatas do mapa.',
      matchStats,
    };
  }
}
