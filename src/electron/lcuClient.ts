import fs from 'node:fs';
import https from 'node:https';
import path from 'node:path';
import { parseLockfileContent, type ParsedLockfile } from '../engine/liveLolParser';

export function requestLocalhostJson(options: {
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
        timeout: options.timeoutMs ?? 2000,
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

export function discoverCandidateLockfilePaths(): string[] {
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
      const parsed = JSON.parse(fs.readFileSync(riotInstallsJson, 'utf-8')) as Record<
        string,
        unknown
      >;
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

export function readActiveLockfile(): ParsedLockfile | null {
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

export function buildLcuAuthHeader(lockfile: ParsedLockfile): string {
  return `Basic ${Buffer.from(`riot:${lockfile.password}`).toString('base64')}`;
}
