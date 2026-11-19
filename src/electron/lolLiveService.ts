import fs from 'node:fs';
import https from 'node:https';
import path from 'node:path';
import {
  mapLcuSessionToLiveDraft,
  mapLiveClientDataToStatus,
  parseLockfileContent,
  type ParsedLockfile,
} from '../engine/liveLolParser';
import type { CatalogSnapshot, LiveLolStatus } from '../shared/types';

function requestLocalhostJson(options: {
  port: number;
  urlPath: string;
  authHeader?: string;
  timeoutMs?: number;
}): Promise<{ ok: boolean; status: number; data?: unknown }> {
  return new Promise((resolve) => {
    const req = https.request(
      {
        hostname: '127.0.0.1',
        port: options.port,
        path: options.urlPath,
        method: 'GET',
        // Certificado autoassinado oficial do cliente local da Riot (estritamente loopback 127.0.0.1)
        rejectUnauthorized: false,
        timeout: options.timeoutMs ?? 1200,
        headers: options.authHeader
          ? { Authorization: options.authHeader, Accept: 'application/json' }
          : { Accept: 'application/json' },
      },
      (res) => {
        const status = res.statusCode ?? 0;
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => {
          if (status < 200 || status >= 300) {
            resolve({ ok: false, status });
            return;
          }
          try {
            const text = Buffer.concat(chunks).toString('utf-8');
            resolve({ ok: true, status, data: JSON.parse(text) });
          } catch {
            resolve({ ok: false, status });
          }
        });
      },
    );

    req.on('timeout', () => {
      req.destroy();
      resolve({ ok: false, status: 0 });
    });
    req.on('error', () => {
      resolve({ ok: false, status: 0 });
    });
    req.end();
  });
}

function discoverCandidateLockfilePaths(): string[] {
  const candidates = new Set<string>([
    'C:\\Riot Games\\League of Legends\\lockfile',
    'D:\\Riot Games\\League of Legends\\lockfile',
    'E:\\Riot Games\\League of Legends\\lockfile',
  ]);

  // 1. Metadata oficial da instalação do League of Legends no Windows
  const productYaml =
    'C:\\ProgramData\\Riot Games\\Metadata\\league_of_legends.live\\league_of_legends.live.product_settings.yaml';
  try {
    if (fs.existsSync(productYaml)) {
      const content = fs.readFileSync(productYaml, 'utf-8');
      const match = content.match(/product_install_full_path:\s*"?([^"\r\n]+)"?/);
      if (match?.[1]) {
        const cleanDir = match[1].trim().replace(/\//g, path.sep);
        candidates.add(path.join(cleanDir, 'lockfile'));
      }
    }
  } catch {
    // Ignora se sem acesso
  }

  // 2. RiotClientInstalls.json (caso instalado em outro drive)
  const riotInstallsJson = 'C:\\ProgramData\\Riot Games\\RiotClientInstalls.json';
  try {
    if (fs.existsSync(riotInstallsJson)) {
      const parsed = JSON.parse(fs.readFileSync(riotInstallsJson, 'utf-8')) as Record<string, unknown>;
      for (const val of Object.values(parsed)) {
        if (typeof val === 'string' && val.toLowerCase().includes('riot games')) {
          const idx = val.toLowerCase().indexOf('riot games');
          const riotRoot = val.slice(0, idx + 'Riot Games'.length);
          candidates.add(path.join(riotRoot, 'League of Legends', 'lockfile'));
        }
      }
    }
  } catch {
    // Ignora se não existir ou formato diferente
  }

  return Array.from(candidates);
}

function readActiveLockfile(): ParsedLockfile | null {
  for (const filePath of discoverCandidateLockfilePaths()) {
    try {
      if (!fs.existsSync(filePath)) continue;
      const content = fs.readFileSync(filePath, 'utf-8');
      const parsed = parseLockfileContent(content);
      if (parsed) return parsed;
    } catch {
      // Lockfile pode estar bloqueado momentaneamente ou inacessível
    }
  }
  return null;
}

export class LolLiveMonitorService {
  private readonly getCatalog: () => CatalogSnapshot;
  private readonly onChange: (status: LiveLolStatus) => void;
  private enabled: boolean;
  private timer: NodeJS.Timeout | null = null;
  private polling = false;
  private lastFingerprint = '';
  private status: LiveLolStatus;

  constructor(options: {
    getCatalog: () => CatalogSnapshot;
    onChange: (status: LiveLolStatus) => void;
    enabled: boolean;
  }) {
    this.getCatalog = options.getCatalog;
    this.onChange = options.onChange;
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
          this.emitIfChanged({
            phase: 'in_game',
            enabled: true,
            lastUpdatedAt: nowIso,
            sourceLabel: 'Partida ao vivo (Riot Live Client Data)',
            liveDraft: mapped.liveDraft,
            liveMatch: mapped.liveMatch,
          });
          return this.status;
        }
      }

      // 2. Caso não esteja em partida, verificar Seleção de Campeões via LCU oficial local
      const lockfile = readActiveLockfile();
      if (lockfile) {
        const auth = `Basic ${Buffer.from(`riot:${lockfile.password}`).toString('base64')}`;
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
