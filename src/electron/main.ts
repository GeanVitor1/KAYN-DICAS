import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  BrowserWindow,
  app,
  dialog,
  globalShortcut,
  ipcMain,
  protocol,
  screen,
  shell,
} from 'electron';
import { parseAndValidateReviewJson, serializeReviewJson } from '../engine/reviewAnalyzer';
import { IPC_CHANNELS, type AutoReviewCapturedNotice } from '../shared/ipc';
import type {
  AppSettings,
  CardWindowOptions,
  DraftState,
  FrozenPreGameCard,
  PersistedAppState,
  ReviewMatch,
  StudyLesson,
  TrainingScenario,
} from '../shared/types';
import { AssetCacheService, parseAssetUrl } from './assetCacheService';
import { DdragonCatalogService } from './ddragonService';
import {
  fetchLcuRecentMatches,
  importLatestLcuMatch,
  importLcuMatchById,
} from './lcuMatchHistoryService';
import { LolLiveMonitorService } from './lolLiveService';
import {
  fetchAndConvertRiotMatch,
  fetchRecentSoloQueueMatches,
  loadEncryptedRiotApiKey,
  saveEncryptedRiotApiKey,
} from './riotMatchService';
import {
  createDefaultPersistedState,
  readStateFileSafely,
  sanitizePersistedState,
  writeStateFileSafely,
} from './storage';

const IS_SMOKE_TEST = process.argv.includes('--smoke-test');
const CAPTURE_DIR_ARG = process.argv.find((a) => a.startsWith('--capture-screens='));
const CAPTURE_SCREENS_DIR = CAPTURE_DIR_ARG ? CAPTURE_DIR_ARG.slice('--capture-screens='.length) : null;
const UNLOCK_CLICK_THROUGH_SHORTCUT = 'CommandOrControl+Shift+L';
const EXCLUSIVE_FULLSCREEN_NOTE =
  'No Windows, jogos em Tela Cheia Exclusiva assumem o controle direto da GPU e ocultam janelas sobrepostas. Use o League of Legends em "Janela sem Bordas" ou arraste o cartão para um segundo monitor.';

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'kayn-asset',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
]);

let smokeTempDir: string | null = null;
if (IS_SMOKE_TEST || CAPTURE_SCREENS_DIR) {
  smokeTempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kayn-dicas-smoke-'));
  app.setPath('userData', smokeTempDir);
}

let mainWindow: BrowserWindow | null = null;
let cardWindow: BrowserWindow | null = null;
let appState: PersistedAppState;
let catalogService: DdragonCatalogService;
let assetCacheService: AssetCacheService;
let lolLiveService: LolLiveMonitorService;
let stateFilePath: string;
let riotKeyFilePath: string;
let sessionRiotApiKey = '';
let shortcutRegistered = false;
let boundsTimer: NodeJS.Timeout | null = null;

function getRendererEntryUrl(hashRoute: '' | '#/card'): string {
  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    return `${devUrl}${hashRoute}`;
  }
  const indexPath = path.join(__dirname, '../../dist/index.html');
  return `file://${indexPath.replace(/\\/g, '/')}${hashRoute}`;
}

function loadRendererTarget(win: BrowserWindow, hashRoute: '' | '#/card'): Promise<void> {
  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    return win.loadURL(getRendererEntryUrl(hashRoute));
  }
  const indexPath = path.join(__dirname, '../../dist/index.html');
  return win.loadFile(indexPath, hashRoute ? { hash: hashRoute.replace('#', '') } : undefined);
}

function hardenWebContents(win: BrowserWindow): void {
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) {
      void shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  win.webContents.on('will-navigate', (event, targetUrl) => {
    const devUrl = process.env.VITE_DEV_SERVER_URL;
    const isLocalFile = targetUrl.startsWith('file://');
    const isAllowedDev = Boolean(devUrl && targetUrl.startsWith(devUrl));
    if (!isLocalFile && !isAllowedDev) {
      event.preventDefault();
    }
  });
}

function persistState(): void {
  writeStateFileSafely(stateFilePath, appState);
  broadcastState();
}

function broadcastState(): void {
  for (const win of [mainWindow, cardWindow]) {
    if (win && !win.isDestroyed()) {
      win.webContents.send(IPC_CHANNELS.ON_STATE_SYNC, appState);
    }
  }
}

function broadcastCardOptions(): void {
  for (const win of [mainWindow, cardWindow]) {
    if (win && !win.isDestroyed()) {
      win.webContents.send(IPC_CHANNELS.ON_CARD_OPTIONS_SYNC, appState.settings.cardWindow);
    }
  }
}

function broadcastLiveLolStatus(): void {
  if (!lolLiveService) return;
  const status = lolLiveService.getStatus();
  for (const win of [mainWindow, cardWindow]) {
    if (win && !win.isDestroyed()) {
      win.webContents.send(IPC_CHANNELS.ON_LIVE_LOL_SYNC, status);
    }
  }
}

function broadcastAutoReviewCaptured(notice: AutoReviewCapturedNotice): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(IPC_CHANNELS.ON_AUTO_REVIEW_CAPTURED, notice);
  }
}

function upsertReviewAndActivate(review: ReviewMatch, replaceReviewId?: string): void {
  const others = appState.reviews.filter(
    (r) =>
      r.id !== review.id &&
      (!replaceReviewId || r.id !== replaceReviewId) &&
      (!review.matchId || r.matchId !== review.matchId),
  );
  appState = sanitizePersistedState({
    ...appState,
    reviews: [review, ...others],
    activeReviewId: review.id,
  });
  persistState();
}

function handleAutoRecordedMatch(liveReview: ReviewMatch): void {
  if (appState.settings.autoRecordPostGameReview === false) {
    return;
  }

  upsertReviewAndActivate(liveReview);
  broadcastAutoReviewCaptured({
    reviewId: liveReview.id,
    title: liveReview.title,
    source: 'live_auto',
    result: liveReview.matchStats?.result ?? 'unknown',
    capturedAt: new Date().toISOString(),
  });

  // Tenta enriquecer com a timeline completa do LCU local (coordenadas X/Y + diff vs JG inimigo) após o cliente gravar o fim de jogo
  const tryEnrichFromLcu = async (attempt: number): Promise<void> => {
    try {
      const existingIds = new Set(
        appState.reviews.map((r) => r.matchId).filter((id): id is string => Boolean(id)),
      );
      const listRes = await fetchLcuRecentMatches({
        catalog: catalogService.getCatalog(),
        existingMatchIds: existingIds,
      });
      if (!listRes.ok || !listRes.matches || listRes.matches.length === 0) {
        if (attempt < 2) {
          setTimeout(() => void tryEnrichFromLcu(attempt + 1), 4500);
        }
        return;
      }

      const newest = listRes.matches[0];
      const matchEndedMs = newest.gameCreation + newest.gameDurationSeconds * 1000;
      const isFreshMatch = Math.abs(Date.now() - matchEndedMs) <= 10 * 60 * 1000;
      if (!isFreshMatch) {
        if (attempt < 2) {
          setTimeout(() => void tryEnrichFromLcu(attempt + 1), 4500);
        }
        return;
      }

      const imported = await importLcuMatchById({
        gameId: newest.gameId,
        catalog: catalogService.getCatalog(),
        preferBlueAsTiebreaker: appState.settings.preferBlueAsTiebreaker,
      });
      if (imported.ok && imported.review) {
        upsertReviewAndActivate(imported.review, liveReview.id);
        broadcastAutoReviewCaptured({
          reviewId: imported.review.id,
          title: imported.review.title,
          source: 'lcu_enriched',
          result: imported.review.matchStats?.result ?? 'unknown',
          capturedAt: new Date().toISOString(),
        });
      }
    } catch {
      // Mantém a revisão ao vivo já salva sem interromper o usuário
    }
  };

  setTimeout(() => void tryEnrichFromLcu(1), 4000);
}

function computeSafeCardBounds(saved?: CardWindowOptions['bounds']): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  const primary = screen.getPrimaryDisplay().workArea;
  const fallback = {
    x: primary.x + 24,
    y: primary.y + 72,
    width: 316,
    height: 530,
  };

  if (!saved) return fallback;

  const displays = screen.getAllDisplays();
  const visible = displays.some((d) => {
    const wa = d.workArea;
    return (
      saved.x + 80 >= wa.x &&
      saved.x <= wa.x + wa.width - 80 &&
      saved.y + 40 >= wa.y &&
      saved.y <= wa.y + wa.height - 40
    );
  });

  if (!visible) return fallback;
  return saved;
}

function applyCardWindowOptions(win: BrowserWindow, opts: CardWindowOptions): void {
  if (win.isDestroyed()) return;
  win.setAlwaysOnTop(opts.alwaysOnTop, 'screen-saver');
  win.setOpacity(Math.min(1, Math.max(0.35, opts.opacity)));
  try {
    win.setIgnoreMouseEvents(opts.clickThrough, { forward: true });
  } catch {
    // Fallback seguro caso plataforma não suporte forward
    win.setIgnoreMouseEvents(false);
  }
}

function openOrFocusCardWindow(): { ok: boolean; error?: string } {
  try {
    if (cardWindow && !cardWindow.isDestroyed()) {
      applyCardWindowOptions(cardWindow, appState.settings.cardWindow);
      if (cardWindow.isMinimized()) cardWindow.restore();
      cardWindow.show();
      return { ok: true };
    }

    const bounds = computeSafeCardBounds(appState.settings.cardWindow.bounds);
    cardWindow = new BrowserWindow({
      ...bounds,
      minWidth: 272,
      minHeight: 320,
      frame: false,
      resizable: true,
      minimizable: false,
      maximizable: false,
      backgroundColor: '#0B101B',
      title: 'KAYN-DICAS — Cartão Pré-Jogo',
      show: !IS_SMOKE_TEST && !CAPTURE_SCREENS_DIR,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });

    hardenWebContents(cardWindow);
    applyCardWindowOptions(cardWindow, appState.settings.cardWindow);

    const scheduleBoundsSave = () => {
      if (!cardWindow || cardWindow.isDestroyed()) return;
      if (boundsTimer) clearTimeout(boundsTimer);
      boundsTimer = setTimeout(() => {
        if (!cardWindow || cardWindow.isDestroyed()) return;
        const b = cardWindow.getBounds();
        appState = {
          ...appState,
          settings: {
            ...appState.settings,
            cardWindow: {
              ...appState.settings.cardWindow,
              bounds: b,
            },
          },
        };
        persistState();
      }, 250);
    };

    cardWindow.on('move', scheduleBoundsSave);
    cardWindow.on('resize', scheduleBoundsSave);
    cardWindow.on('closed', () => {
      cardWindow = null;
    });

    void loadRendererTarget(cardWindow, '#/card');
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Não foi possível abrir o cartão.',
    };
  }
}

function registerShortcuts(): { registered: boolean; warning?: string } {
  globalShortcut.unregisterAll();
  const accel = appState.settings.cardWindow.toggleShortcut || 'CommandOrControl+Shift+K';

  let registered = false;
  try {
    registered = globalShortcut.register(accel, () => {
      if (cardWindow && !cardWindow.isDestroyed()) {
        if (cardWindow.isVisible()) {
          cardWindow.hide();
        } else {
          cardWindow.show();
          applyCardWindowOptions(cardWindow, appState.settings.cardWindow);
        }
      } else {
        openOrFocusCardWindow();
      }
    });
  } catch {
    registered = false;
  }

  try {
    globalShortcut.register(UNLOCK_CLICK_THROUGH_SHORTCUT, () => {
      if (appState.settings.cardWindow.clickThrough) {
        appState = {
          ...appState,
          settings: {
            ...appState.settings,
            cardWindow: {
              ...appState.settings.cardWindow,
              clickThrough: false,
            },
          },
        };
        if (cardWindow && !cardWindow.isDestroyed()) {
          applyCardWindowOptions(cardWindow, appState.settings.cardWindow);
        }
        persistState();
        broadcastCardOptions();
      }
    });
  } catch {
    // Atalho de emergência pode estar em uso no SO
  }

  shortcutRegistered = registered;
  if (!registered) {
    return {
      registered: false,
      warning: `O atalho "${accel}" já está em uso ou é inválido no sistema. Tente outro atalho (ex.: Ctrl+Alt+K).`,
    };
  }
  return { registered: true };
}

function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1200,
    height: 780,
    minWidth: 940,
    minHeight: 640,
    useContentSize: Boolean(CAPTURE_SCREENS_DIR),
    backgroundColor: '#0B101B',
    title: 'KAYN-DICAS — Kayn Jungle (BR Solo/Duo)',
    autoHideMenuBar: true,
    show: !IS_SMOKE_TEST && !CAPTURE_SCREENS_DIR,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  hardenWebContents(win);
  win.on('closed', () => {
    mainWindow = null;
    if (cardWindow && !cardWindow.isDestroyed()) {
      cardWindow.close();
    }
  });

  void loadRendererTarget(win, '');
  return win;
}

function registerIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.GET_INITIAL_STATE, () => ({
    state: appState,
    catalog: catalogService.getCatalog(),
    catalogStatus: catalogService.getStatus(),
    liveLolStatus: lolLiveService.getStatus(),
    shortcutRegistered,
    cardWindowOpen: Boolean(cardWindow && !cardWindow.isDestroyed() && cardWindow.isVisible()),
    isExclusiveFullscreenCaveat: EXCLUSIVE_FULLSCREEN_NOTE,
  }));

  ipcMain.handle(IPC_CHANNELS.GET_LIVE_LOL_STATUS, () => lolLiveService.getStatus());

  ipcMain.handle(IPC_CHANNELS.POLL_LIVE_LOL_NOW, async () => {
    const next = await lolLiveService.pollNow();
    broadcastLiveLolStatus();
    return next;
  });

  ipcMain.handle(IPC_CHANNELS.UPDATE_CURRENT_DRAFT, (_e, draft: DraftState) => {
    appState = sanitizePersistedState({
      ...appState,
      currentDraft: {
        ...draft,
        updatedAt: new Date().toISOString(),
      },
    });
    persistState();
    return appState;
  });

  ipcMain.handle(IPC_CHANNELS.SAVE_DRAFT, (_e, draft: DraftState) => {
    const clean = { ...draft, updatedAt: new Date().toISOString() };
    const others = appState.savedDrafts.filter((d) => d.id !== clean.id);
    appState = sanitizePersistedState({
      ...appState,
      currentDraft: clean,
      savedDrafts: [clean, ...others],
    });
    persistState();
    return appState;
  });

  ipcMain.handle(IPC_CHANNELS.DELETE_DRAFT, (_e, draftId: string) => {
    appState = sanitizePersistedState({
      ...appState,
      savedDrafts: appState.savedDrafts.filter((d) => d.id !== draftId),
    });
    persistState();
    return appState;
  });

  ipcMain.handle(IPC_CHANNELS.FREEZE_PREGAME_CARD, (_e, card: FrozenPreGameCard) => {
    appState = sanitizePersistedState({
      ...appState,
      frozenCard: card,
    });
    persistState();
    return appState;
  });

  ipcMain.handle(IPC_CHANNELS.OPEN_CARD_WINDOW, () => openOrFocusCardWindow());

  ipcMain.handle(IPC_CHANNELS.CLOSE_CARD_WINDOW, () => {
    if (cardWindow && !cardWindow.isDestroyed()) {
      cardWindow.close();
    }
    return { ok: true };
  });

  ipcMain.handle(IPC_CHANNELS.UPDATE_CARD_OPTIONS, (_e, partial: Partial<CardWindowOptions>) => {
    const prevShortcut = appState.settings.cardWindow.toggleShortcut;
    const merged = sanitizePersistedState({
      ...appState,
      settings: {
        ...appState.settings,
        cardWindow: {
          ...appState.settings.cardWindow,
          ...partial,
        },
      },
    });
    appState = merged;
    let warning: string | undefined;
    if (partial.toggleShortcut && partial.toggleShortcut !== prevShortcut) {
      const reg = registerShortcuts();
      warning = reg.warning;
    }
    if (cardWindow && !cardWindow.isDestroyed()) {
      applyCardWindowOptions(cardWindow, appState.settings.cardWindow);
    }
    persistState();
    broadcastCardOptions();
    return {
      options: appState.settings.cardWindow,
      shortcutRegistered,
      warning,
    };
  });

  ipcMain.handle(IPC_CHANNELS.UPDATE_SETTINGS, (_e, partial: Partial<AppSettings>) => {
    appState = sanitizePersistedState({
      ...appState,
      settings: {
        ...appState.settings,
        ...partial,
        cardWindow: partial.cardWindow
          ? { ...appState.settings.cardWindow, ...partial.cardWindow }
          : appState.settings.cardWindow,
      },
    });
    if (typeof partial.liveLolSyncEnabled === 'boolean' && lolLiveService) {
      lolLiveService.setEnabled(partial.liveLolSyncEnabled);
    }
    persistState();
    return appState;
  });

  ipcMain.handle(IPC_CHANNELS.SAVE_TRAINING_SCENARIO, (_e, scenario: TrainingScenario) => {
    const others = appState.trainingScenarios.filter((s) => s.id !== scenario.id);
    appState = sanitizePersistedState({
      ...appState,
      trainingScenarios: [...others, scenario],
    });
    persistState();
    return appState;
  });

  ipcMain.handle(IPC_CHANNELS.SAVE_REVIEW, (_e, review: ReviewMatch) => {
    const others = appState.reviews.filter((r) => r.id !== review.id);
    appState = sanitizePersistedState({
      ...appState,
      reviews: [review, ...others],
      activeReviewId: review.id,
    });
    persistState();
    return appState;
  });

  ipcMain.handle(IPC_CHANNELS.DELETE_REVIEW, (_e, reviewId: string) => {
    const nextReviews = appState.reviews.filter((r) => r.id !== reviewId);
    appState = sanitizePersistedState({
      ...appState,
      reviews: nextReviews,
      activeReviewId: nextReviews[0]?.id ?? '',
    });
    persistState();
    return appState;
  });

  ipcMain.handle(IPC_CHANNELS.SET_ACTIVE_REVIEW, (_e, reviewId: string) => {
    appState = sanitizePersistedState({
      ...appState,
      activeReviewId: reviewId,
    });
    persistState();
    return appState;
  });

  ipcMain.handle(IPC_CHANNELS.SAVE_CUSTOM_LESSON, (_e, lesson: StudyLesson) => {
    const others = appState.customLessons.filter((l) => l.id !== lesson.id);
    appState = sanitizePersistedState({
      ...appState,
      customLessons: [lesson, ...others],
    });
    persistState();
    return appState;
  });

  ipcMain.handle(IPC_CHANNELS.DELETE_CUSTOM_LESSON, (_e, lessonId: string) => {
    appState = sanitizePersistedState({
      ...appState,
      customLessons: appState.customLessons.filter((l) => l.id !== lessonId),
      favoriteMicroIds: appState.favoriteMicroIds.filter((id) => id !== lessonId),
    });
    persistState();
    return appState;
  });

  ipcMain.handle(IPC_CHANNELS.SET_FAVORITE_MICRO_IDS, (_e, ids: string[]) => {
    appState = sanitizePersistedState({
      ...appState,
      favoriteMicroIds: ids,
    });
    persistState();
    return appState;
  });

  ipcMain.handle(IPC_CHANNELS.SET_PINNED_REMINDER_IDS, (_e, ids: string[]) => {
    appState = sanitizePersistedState({
      ...appState,
      pinnedReminderIds: ids,
    });
    persistState();
    return appState;
  });

  ipcMain.handle(
    IPC_CHANNELS.SAVE_TACTICAL_RULE_NOTE,
    (_e, payload: { ruleId: string; note: string }) => {
      const nextNotes = { ...(appState.tacticalRuleNotes ?? {}) };
      if (payload.note.trim()) {
        nextNotes[payload.ruleId] = payload.note.trim();
      } else {
        delete nextNotes[payload.ruleId];
      }
      appState = sanitizePersistedState({
        ...appState,
        tacticalRuleNotes: nextNotes,
      });
      persistState();
      return appState;
    },
  );

  ipcMain.handle(IPC_CHANNELS.OPEN_EXTERNAL_URL, async (_e, rawUrl: string) => {
    try {
      const parsed = new URL(rawUrl);
      const allowedHosts = new Set([
        'www.youtube.com',
        'youtube.com',
        'youtu.be',
        'www.twitch.tv',
        'twitch.tv',
        'wiki.leagueoflegends.com',
        'x.com',
        'www.x.com',
      ]);
      if (parsed.protocol !== 'https:' || !allowedHosts.has(parsed.hostname.toLowerCase())) {
        return { ok: false, error: 'Host ou protocolo externo não permitido.' };
      }
      await shell.openExternal(parsed.toString());
      return { ok: true };
    } catch {
      return { ok: false, error: 'URL inválida.' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.RESET_DEMO_DATA, () => {
    const defaults = createDefaultPersistedState();
    appState = {
      ...defaults,
      settings: appState.settings,
    };
    persistState();
    return appState;
  });

  ipcMain.handle(IPC_CHANNELS.REFRESH_DDRAGON, async () => catalogService.refreshFromNetwork());

  ipcMain.handle(IPC_CHANNELS.EXPORT_REVIEW_JSON, async (_e, review: ReviewMatch) => {
    const targetWindow = mainWindow ?? BrowserWindow.getFocusedWindow() ?? undefined;
    const res = await dialog.showSaveDialog(targetWindow!, {
      title: 'Exportar revisão KAYN-DICAS (JSON)',
      defaultPath: `${review.id}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (res.canceled || !res.filePath) {
      return { saved: false, canceled: true };
    }
    try {
      fs.writeFileSync(res.filePath, serializeReviewJson(review), 'utf-8');
      return { saved: true, filePath: res.filePath };
    } catch (err) {
      return {
        saved: false,
        error: err instanceof Error ? err.message : 'Erro ao gravar arquivo.',
      };
    }
  });

  ipcMain.handle(IPC_CHANNELS.IMPORT_REVIEW_JSON, async () => {
    const targetWindow = mainWindow ?? BrowserWindow.getFocusedWindow() ?? undefined;
    const res = await dialog.showOpenDialog(targetWindow!, {
      title: 'Importar revisão KAYN-DICAS (JSON)',
      properties: ['openFile'],
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (res.canceled || res.filePaths.length === 0) {
      return { imported: false, canceled: true };
    }
    try {
      const content = fs.readFileSync(res.filePaths[0], 'utf-8');
      const parsed = parseAndValidateReviewJson(content);
      if (!parsed.ok || !parsed.review) {
        return { imported: false, error: parsed.error };
      }
      const others = appState.reviews.filter((r) => r.id !== parsed.review!.id);
      appState = sanitizePersistedState({
        ...appState,
        reviews: [parsed.review, ...others],
        activeReviewId: parsed.review.id,
      });
      persistState();
      return { imported: true, review: parsed.review };
    } catch (err) {
      return {
        imported: false,
        error: err instanceof Error ? err.message : 'Erro ao ler arquivo selecionado.',
      };
    }
  });

  ipcMain.handle(
    IPC_CHANNELS.FETCH_RIOT_MATCHES,
    async (
      _e,
      params: { apiKey: string; gameName: string; tagLine: string; saveKeyEncrypted: boolean },
    ) => {
      let keyToUse = params.apiKey.trim();
      if (!keyToUse) {
        keyToUse = sessionRiotApiKey || loadEncryptedRiotApiKey(riotKeyFilePath) || '';
      } else {
        sessionRiotApiKey = keyToUse;
        if (params.saveKeyEncrypted) {
          saveEncryptedRiotApiKey(riotKeyFilePath, keyToUse);
        }
      }
      return fetchRecentSoloQueueMatches({
        apiKey: keyToUse,
        gameName: params.gameName,
        tagLine: params.tagLine,
      });
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.IMPORT_RIOT_MATCH,
    async (_e, params: { apiKey: string; matchId: string; puuid: string }) => {
      const keyToUse =
        params.apiKey.trim() || sessionRiotApiKey || loadEncryptedRiotApiKey(riotKeyFilePath) || '';
      const res = await fetchAndConvertRiotMatch({
        apiKey: keyToUse,
        matchId: params.matchId,
        puuid: params.puuid,
      });
      if (res.ok && res.review) {
        upsertReviewAndActivate(res.review);
      }
      return res;
    },
  );

  ipcMain.handle(IPC_CHANNELS.FETCH_LCU_MATCHES, async () => {
    const existingIds = new Set(
      appState.reviews.map((r) => r.matchId).filter((id): id is string => Boolean(id)),
    );
    return fetchLcuRecentMatches({
      catalog: catalogService.getCatalog(),
      existingMatchIds: existingIds,
    });
  });

  ipcMain.handle(IPC_CHANNELS.IMPORT_LCU_MATCH, async (_e, gameId: string) => {
    const res = await importLcuMatchById({
      gameId,
      catalog: catalogService.getCatalog(),
      preferBlueAsTiebreaker: appState.settings.preferBlueAsTiebreaker,
    });
    if (res.ok && res.review) {
      upsertReviewAndActivate(res.review);
    }
    return res;
  });

  ipcMain.handle(IPC_CHANNELS.IMPORT_LATEST_LCU_MATCH, async () => {
    const existingIds = new Set(
      appState.reviews.map((r) => r.matchId).filter((id): id is string => Boolean(id)),
    );
    const res = await importLatestLcuMatch({
      catalog: catalogService.getCatalog(),
      existingMatchIds: existingIds,
      preferBlueAsTiebreaker: appState.settings.preferBlueAsTiebreaker,
    });
    if (res.ok && res.review) {
      upsertReviewAndActivate(res.review);
    }
    return res;
  });
}

async function runSmokeTest(): Promise<void> {
  if (!mainWindow) {
    throw new Error('mainWindow não inicializada no smoke test.');
  }

  await new Promise<void>((resolve) => {
    if (mainWindow!.webContents.isLoading()) {
      mainWindow!.webContents.once('did-finish-load', () => resolve());
    } else {
      resolve();
    }
  });

  const mainResult = await mainWindow.webContents.executeJavaScript(`
    (async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const clickBtn = (testId) => {
        const el = document.querySelector('[data-testid="' + testId + '"]');
        if (!el) throw new Error('Elemento não encontrado: ' + testId);
        el.click();
        return el;
      };
      for (let i = 0; i < 40; i++) {
        if (document.querySelector('[data-testid="nav-draft"]')) break;
        await sleep(100);
      }
      if (!document.querySelector('[data-testid="nav-draft"]')) {
        throw new Error('App não hidratou a UI a tempo.');
      }

      // 1. Testar Demos Azul, Rhaast e Equilibrado
      clickBtn('demo-blue');
      await sleep(80);
      const blueForm = document.querySelector('[data-testid="recommended-form-label"]')?.textContent || '';
      if (!blueForm.includes('Azul')) throw new Error('Demo Azul falhou: ' + blueForm);

      clickBtn('demo-red');
      await sleep(80);
      const redForm = document.querySelector('[data-testid="recommended-form-label"]')?.textContent || '';
      if (!redForm.includes('Rhaast')) throw new Error('Demo Rhaast falhou: ' + redForm);

      clickBtn('demo-balanced');
      await sleep(80);

      // 2. Congelar plano pré-jogo e abrir cartão estático
      clickBtn('freeze-card-btn');
      await sleep(150);
      clickBtn('open-card-btn');
      await sleep(300);

      // 3. Navegar para Aprender, testar filtros, favoritos e cadastro manual offline
      clickBtn('nav-learn');
      await sleep(120);
      const learnReadyText = document.querySelector('[data-testid="learn-ready-list"]')?.textContent || '';
      if (!learnReadyText.includes('CaiozeraLoL') || !learnReadyText.includes('Karasmai')) {
        throw new Error('Aba Aprender não carregou lições de CaiozeraLoL e Karasmai.');
      }

      // Testar filtro por criador
      const creatorSel = document.querySelector('[data-testid="filter-creator"]');
      creatorSel.value = 'karasmai';
      creatorSel.dispatchEvent(new Event('change', { bubbles: true }));
      await sleep(80);
      const karasmaiOnlyText = document.querySelector('[data-testid="learn-ready-list"]')?.textContent || '';
      if (karasmaiOnlyText.includes('CaiozeraLoL')) {
        throw new Error('Filtro de criador Karasmai ainda exibiu CaiozeraLoL.');
      }
      creatorSel.value = 'all';
      creatorSel.dispatchEvent(new Event('change', { bubbles: true }));
      await sleep(80);

      // Voltar para Draft e checar se o cartão já recebeu os combos favoritos fixados
      clickBtn('nav-draft');
      await sleep(80);

      // 4. Navegar para Treino via botão "Praticar" da lição, escolher antes de revelar e verificar resultado
      clickBtn('nav-learn');
      await sleep(80);
      clickBtn('practice-btn-caiozera-macro-bot-abort-river');
      await sleep(120);
      // Resposta deve começar oculta até o jogador escolher
      if (document.querySelector('[data-testid="training-preferred-option"]')) {
        throw new Error('Treino exibiu a resposta antes de o jogador escolher uma ação.');
      }
      clickBtn('train-choice-farm_route');
      await sleep(100);
      const trainResult = document.querySelector('[data-testid="training-preferred-option"]')?.textContent || '';
      if (!trainResult) throw new Error('Tela Treino não exibiu resposta após escolha.');

      // 5. Navegar para Revisão e verificar demo de gank ruim na bot
      clickBtn('nav-review');
      await sleep(120);
      const reviewSummary = document.querySelector('[data-testid="review-bot-summary"]')?.textContent || '';
      if (!reviewSummary.includes('3 tentativa')) throw new Error('Tela Revisão não exibiu tentativas na Bot: ' + reviewSummary);

      return { blueForm, redForm, trainResult, reviewSummary };
    })();
  `);

  // Verificar janela do cartão congelada separada (com combos fixados!)
  if (!cardWindow || cardWindow.isDestroyed()) {
    throw new Error('cardWindow não foi aberta durante o smoke test.');
  }
  await new Promise<void>((resolve) => {
    if (cardWindow!.webContents.isLoading()) {
      cardWindow!.webContents.once('did-finish-load', () => resolve());
    } else {
      resolve();
    }
  });
  const cardText = await cardWindow.webContents.executeJavaScript(`
    (async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      for (let i = 0; i < 30; i++) {
        const el = document.querySelector('[data-testid="frozen-card-root"]');
        if (el && el.textContent && el.textContent.includes('Plano pré-jogo') && el.querySelector('[data-testid="card-pinned-micros"]')) {
          return el.textContent;
        }
        await sleep(100);
      }
      throw new Error('Cartão estático não exibiu o plano congelado com os combos fixados.');
    })();
  `);

  console.log('[SMOKE] Sucesso:', JSON.stringify({
    blueForm: mainResult.blueForm,
    redForm: mainResult.redForm,
    cardPreviewLen: cardText.length,
    trainResult: mainResult.trainResult,
  }));

  // 5. Fechar cartão, alterar draft principal para Rhaast (sem recongelar) e reabrir cartão para validar persistência congelada
  cardWindow.close();
  await new Promise((r) => setTimeout(r, 120));
  await mainWindow.webContents.executeJavaScript(`
    (() => {
      document.querySelector('[data-testid="nav-draft"]')?.click();
      setTimeout(() => document.querySelector('[data-testid="demo-red"]')?.click(), 30);
    })();
  `);
  await new Promise((r) => setTimeout(r, 150));
  openOrFocusCardWindow();
  if (!cardWindow || cardWindow.isDestroyed()) {
    throw new Error('cardWindow não reabriu após fechamento.');
  }
  await new Promise<void>((resolve) => {
    if (cardWindow!.webContents.isLoading()) {
      cardWindow!.webContents.once('did-finish-load', () => resolve());
    } else {
      resolve();
    }
  });
  const reopenedText = await cardWindow.webContents.executeJavaScript(`
    (async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      for (let i = 0; i < 30; i++) {
        const el = document.querySelector('[data-testid="frozen-card-root"]');
        if (el && el.textContent && el.textContent.includes('Plano pré-jogo')) {
          return el.textContent;
        }
        await sleep(100);
      }
      return '';
    })();
  `);
  if (!reopenedText.includes('Kayn Azul')) {
    throw new Error('Cartão reaberto não preservou o plano congelado original.');
  }
  console.log('[SMOKE] Reabertura do cartão preservou plano congelado!');
}

async function runCaptureScreens(outputDir: string): Promise<void> {
  if (!mainWindow) throw new Error('mainWindow ausente para captura.');
  fs.mkdirSync(outputDir, { recursive: true });

  await new Promise<void>((resolve) => {
    if (mainWindow!.webContents.isLoading()) {
      mainWindow!.webContents.once('did-finish-load', () => resolve());
    } else {
      resolve();
    }
  });

  const waitRender = async (win: BrowserWindow, ms = 350) => {
    await new Promise((r) => setTimeout(r, ms));
    await win.webContents.executeJavaScript(`
      (async () => {
        const imgs = Array.from(document.querySelectorAll('img'));
        await Promise.all(
          imgs.map((img) =>
            img.complete
              ? Promise.resolve()
              : new Promise((res) => {
                  img.addEventListener('load', res, { once: true });
                  img.addEventListener('error', res, { once: true });
                  setTimeout(res, 1500);
                }),
          ),
        );
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      })();
    `);
  };

  const snap = async (win: BrowserWindow, filename: string) => {
    await waitRender(win, 350);
    const img = await win.webContents.capturePage();
    fs.writeFileSync(path.join(outputDir, filename), img.toPNG());
    console.log(`[CAPTURE] Saved ${filename}`);
  };

  // Aguarda hidratação completa do Draft
  await mainWindow.webContents.executeJavaScript(`
    (async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      for (let i = 0; i < 60; i++) {
        if (document.querySelector('[data-testid="demo-red"]')) break;
        await sleep(100);
      }
    })();
  `);

  // 1. Draft Rhaast (1200x780)
  await mainWindow.webContents.executeJavaScript(`
    (async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      document.querySelector('[data-testid="demo-red"]')?.click();
      for (let i = 0; i < 20; i++) {
        if ((document.querySelector('[data-testid="recommended-form-label"]')?.textContent || '').includes('Rhaast')) break;
        await sleep(50);
      }
    })();
  `);
  await snap(mainWindow, '01-draft-rhaast.png');

  // Congelar Rhaast e abrir cartão flutuante
  await mainWindow.webContents.executeJavaScript(`
    document.querySelector('[data-testid="freeze-card-btn"]')?.click();
  `);
  await new Promise((r) => setTimeout(r, 250));
  openOrFocusCardWindow();
  if (cardWindow && !cardWindow.isDestroyed()) {
    await new Promise<void>((resolve) => {
      if (cardWindow!.webContents.isLoading()) {
        cardWindow!.webContents.once('did-finish-load', () => resolve());
      } else {
        resolve();
      }
    });
    await cardWindow.webContents.executeJavaScript(`
      (async () => {
        const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
        for (let i = 0; i < 30; i++) {
          if (document.querySelector('[data-testid="frozen-card-root"]')) break;
          await sleep(100);
        }
      })();
    `);
    await snap(cardWindow, '06-card-floating-rhaast.png');
    cardWindow.close();
  }

  // 2. Draft Kayn Azul (1200x780)
  await mainWindow.webContents.executeJavaScript(`
    document.querySelector('[data-testid="demo-blue"]')?.click();
  `);
  await snap(mainWindow, '02-draft-blue.png');

  // 3. Aba Aprender (cartões curtos)
  await mainWindow.webContents.executeJavaScript(`
    document.querySelector('[data-testid="nav-learn"]')?.click();
  `);
  await snap(mainWindow, '03-aprender-cards.png');

  // 4. Aba Treino (antes e depois da escolha)
  await mainWindow.webContents.executeJavaScript(`
    document.querySelector('[data-testid="nav-training"]')?.click();
  `);
  await snap(mainWindow, '04a-treino-before-pick.png');

  await mainWindow.webContents.executeJavaScript(`
    document.querySelector('[data-testid="train-choice-farm_route"]')?.click();
  `);
  await snap(mainWindow, '04b-treino-after-pick.png');

  // 5. Aba Revisão (timeline limpa)
  await mainWindow.webContents.executeJavaScript(`
    document.querySelector('[data-testid="nav-review"]')?.click();
  `);
  await snap(mainWindow, '05-revisao-timeline.png');

  // 6. Configurações (Cartão + Dados)
  await mainWindow.webContents.executeJavaScript(`
    document.querySelector('[data-testid="nav-settings"]')?.click();
  `);
  await snap(mainWindow, '07-configuracoes.png');

  await mainWindow.webContents.executeJavaScript(`
    document.querySelector('[data-testid="settings-tab-data"]')?.click();
  `);
  await snap(mainWindow, '07b-configuracoes-dados.png');

  // Verificar imagens quebradas no Draft Azul
  await mainWindow.webContents.executeJavaScript(`
    document.querySelector('[data-testid="nav-draft"]')?.click();
  `);
  await waitRender(mainWindow, 300);
  const imgAudit = await mainWindow.webContents.executeJavaScript(`
    (() => {
      const imgs = Array.from(document.querySelectorAll('img'));
      const broken = imgs.filter((i) => !i.complete || i.naturalWidth === 0).map((i) => i.src);
      return { total: imgs.length, broken };
    })();
  `);
  console.log('[CAPTURE] Image audit on Draft:', JSON.stringify(imgAudit));
}

function registerAssetProtocol(): void {
  protocol.handle('kayn-asset', async (request) => {
    const parsed = parseAssetUrl(request.url);
    if (!parsed) {
      return new Response('Not Found', { status: 404 });
    }
    const cdnBase = catalogService.getCatalog().cdnBase || 'https://ddragon.leagueoflegends.com/cdn';
    const result = await assetCacheService.resolveAssetBytes(parsed, cdnBase);
    if (!result) {
      return new Response('Not Found', { status: 404 });
    }
    return new Response(new Uint8Array(result.bytes), {
      status: 200,
      headers: {
        'Content-Type': result.mimeType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  });
}

app.whenReady().then(async () => {
  const userDataDir = app.getPath('userData');
  stateFilePath = path.join(userDataDir, 'kayn-dicas-state.json');
  riotKeyFilePath = path.join(userDataDir, 'riot-key.bin');
  const cacheFilePath = path.join(userDataDir, 'ddragon-cache.json');
  const assetCacheDir = path.join(userDataDir, 'ddragon-assets');
  const bundledAssetsDir = path.join(__dirname, '../../dist/ddragon-assets');

  assetCacheService = new AssetCacheService({
    cacheRoot: assetCacheDir,
    bundledRoot: bundledAssetsDir,
  });

  appState = readStateFileSafely(stateFilePath).state;
  catalogService = new DdragonCatalogService(cacheFilePath, {
    assetCache: assetCacheService,
  });
  lolLiveService = new LolLiveMonitorService({
    getCatalog: () => catalogService.getCatalog(),
    getPreferBlueAsTiebreaker: () => appState.settings.preferBlueAsTiebreaker,
    onChange: () => broadcastLiveLolStatus(),
    onMatchFinished: (review) => handleAutoRecordedMatch(review),
    enabled: !IS_SMOKE_TEST && !CAPTURE_SCREENS_DIR && appState.settings.liveLolSyncEnabled !== false,
  });

  registerAssetProtocol();
  registerIpcHandlers();
  registerShortcuts();
  mainWindow = createMainWindow();
  lolLiveService.start();

  if (IS_SMOKE_TEST || CAPTURE_SCREENS_DIR) {
    try {
      if (CAPTURE_SCREENS_DIR) {
        await runCaptureScreens(CAPTURE_SCREENS_DIR);
      } else {
        await runSmokeTest();
      }
      globalShortcut.unregisterAll();
      if (cardWindow && !cardWindow.isDestroyed()) cardWindow.destroy();
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.destroy();
      if (smokeTempDir) {
        try {
          fs.rmSync(smokeTempDir, { recursive: true, force: true });
        } catch {
          // No Windows o Chromium pode manter lock em DIPS até o processo encerrar
        }
      }
      app.exit(0);
    } catch (err) {
      console.error('[SMOKE/CAPTURE] FALHOU:', err);
      globalShortcut.unregisterAll();
      app.exit(1);
    }
  }
});

app.on('will-quit', () => {
  lolLiveService?.stop();
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
