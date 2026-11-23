import {
  mapLcuSessionToLiveDraft,
  mapLiveClientDataToStatus,
} from '../engine/liveLolParser';
import { LiveMatchRecorder } from '../engine/liveMatchRecorder';
import type { CatalogSnapshot, LiveLolStatus, ReviewMatch } from '../shared/types';
import { buildLcuAuthHeader, readActiveLockfile, requestLocalhostJson } from './lcuClient';

export class LolLiveMonitorService {
  private readonly getCatalog: () => CatalogSnapshot;
  private readonly getPreferBlueAsTiebreaker: () => boolean;
  private readonly onChange: (status: LiveLolStatus) => void;
  private readonly onMatchFinished?: (review: ReviewMatch) => void;
  private readonly recorder = new LiveMatchRecorder();
  private enabled: boolean;
  private timer: NodeJS.Timeout | null = null;
  private polling = false;
  private lastFingerprint = '';
  private status: LiveLolStatus;

  constructor(options: {
    getCatalog: () => CatalogSnapshot;
    getPreferBlueAsTiebreaker?: () => boolean;
    onChange: (status: LiveLolStatus) => void;
    onMatchFinished?: (review: ReviewMatch) => void;
    enabled: boolean;
  }) {
    this.getCatalog = options.getCatalog;
    this.getPreferBlueAsTiebreaker = options.getPreferBlueAsTiebreaker ?? (() => true);
    this.onChange = options.onChange;
    this.onMatchFinished = options.onMatchFinished;
    this.enabled = options.enabled;
    this.status = {
      phase: 'disconnected',
      enabled: options.enabled,
      lastUpdatedAt: null,
      sourceLabel: options.enabled
        ? 'Aguardando League of Legends (Seleção ou Partida)'
        : 'Sincronização automática com o LoL desativada',
      liveDraft: null,
      liveMatch: null,
    };
  }

  getStatus(): LiveLolStatus {
    return this.status;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.stop();
      this.recorder.reset();
      this.emitIfChanged({
        phase: 'disconnected',
        enabled: false,
        lastUpdatedAt: new Date().toISOString(),
        sourceLabel: 'Sincronização automática com o LoL desativada',
        liveDraft: null,
        liveMatch: null,
      });
    } else {
      this.start();
    }
  }

  start(): void {
    if (!this.enabled) return;
    if (this.timer) return;
    void this.pollNow();
    this.timer = setInterval(() => {
      void this.pollNow();
    }, 2000);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private emitIfChanged(next: LiveLolStatus): void {
    const fingerprint = JSON.stringify({
      phase: next.phase,
      enabled: next.enabled,
      liveDraft: next.liveDraft,
      liveMatch: next.liveMatch,
    });
    this.status = next;
    if (fingerprint !== this.lastFingerprint) {
      this.lastFingerprint = fingerprint;
      this.onChange(next);
    }
  }

  private flushRecordedMatchIfReady(catalog: CatalogSnapshot): void {
    if (!this.recorder.isRecording()) return;
    const review = this.recorder.finalizeMatch(catalog, {
      minDurationSeconds: 120,
      preferBlueAsTiebreaker: this.getPreferBlueAsTiebreaker(),
    });
    if (review && this.onMatchFinished) {
      this.onMatchFinished(review);
    }
  }

  async pollNow(): Promise<LiveLolStatus> {
    if (!this.enabled) {
      return this.status;
    }
    if (this.polling) {
      return this.status;
    }
    this.polling = true;

    try {
      const catalog = this.getCatalog();
      const nowIso = new Date().toISOString();

      // 1. Verificar primeiro se há partida ativa (Riot Live Client Data API — 127.0.0.1:2999)
      const liveGameRes = await requestLocalhostJson({
        port: 2999,
        urlPath: '/liveclientdata/allgamedata',
        timeoutMs: 1100,
      });

      if (liveGameRes.ok && liveGameRes.data) {
        const mapped = mapLiveClientDataToStatus(liveGameRes.data, catalog);
        if (mapped) {
          const { gameEndedNow } = this.recorder.ingestLivePayload(liveGameRes.data, catalog);
          this.emitIfChanged({
            phase: 'in_game',
            enabled: true,
            lastUpdatedAt: nowIso,
            sourceLabel: 'Partida ao vivo (Riot Live Client Data · gravando revisão)',
            liveDraft: mapped.liveDraft,
            liveMatch: mapped.liveMatch,
          });
          if (gameEndedNow) {
            this.flushRecordedMatchIfReady(catalog);
          }
          return this.status;
        }
      }

      // Saiu de uma partida ativa -> finalizar e salvar a revisão gravada automaticamente
      if (this.recorder.isRecording()) {
        this.flushRecordedMatchIfReady(catalog);
        this.recorder.reset();
      }

      // 2. Caso não esteja em partida, verificar Seleção de Campeões via LCU oficial local
      const lockfile = readActiveLockfile();
      if (lockfile) {
        const auth = buildLcuAuthHeader(lockfile);
        const champSelectRes = await requestLocalhostJson({
          port: lockfile.port,
          urlPath: '/lol-champ-select/v1/session',
          authHeader: auth,
          timeoutMs: 1100,
        });

        if (champSelectRes.ok && champSelectRes.data) {
          const liveDraft = mapLcuSessionToLiveDraft(champSelectRes.data, catalog);
          if (liveDraft) {
            this.emitIfChanged({
              phase: 'champ_select',
              enabled: true,
              lastUpdatedAt: nowIso,
              sourceLabel: 'Seleção de Campeões ao vivo (LCU local)',
              liveDraft,
              liveMatch: null,
            });
            return this.status;
          }
        }

        if (champSelectRes.status === 404 || champSelectRes.status === 200) {
          this.emitIfChanged({
            phase: 'client_idle',
            enabled: true,
            lastUpdatedAt: nowIso,
            sourceLabel: 'Cliente do LoL aberto (aguardando Seleção ou Partida)',
            liveDraft: null,
            liveMatch: null,
          });
          return this.status;
        }
      }

      this.emitIfChanged({
        phase: 'disconnected',
        enabled: true,
        lastUpdatedAt: nowIso,
        sourceLabel: 'Aguardando League of Legends abrir',
        liveDraft: null,
        liveMatch: null,
      });
      return this.status;
    } finally {
      this.polling = false;
    }
  }
}
