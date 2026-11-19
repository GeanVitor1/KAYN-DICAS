import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  BrowserWindow,
  app,
  dialog,
  globalShortcut,
  ipcMain,
  screen,
  shell,
} from 'electron';
import { parseAndValidateReviewJson, serializeReviewJson } from '../engine/reviewAnalyzer';
import { IPC_CHANNELS } from '../shared/ipc';
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
import { DdragonCatalogService } from './ddragonService';
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
const UNLOCK_CLICK_THROUGH_SHORTCUT = 'CommandOrControl+Shift+L';
const EXCLUSIVE_FULLSCREEN_NOTE =
  'No Windows, jogos em Tela Cheia Exclusiva assumem o controle direto da GPU e ocultam janelas sobrepostas. Use o League of Legends em "Janela sem Bordas" ou arraste o cartão para um segundo monitor.';

let smokeTempDir: string | null = null;
if (IS_SMOKE_TEST) {
  smokeTempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kayn-dicas-smoke-'));
  app.setPath('userData', smokeTempDir);
}

let mainWindow: BrowserWindow | null = null;
let cardWindow: BrowserWindow | null = null;
let appState: PersistedAppState;
let catalogService: DdragonCatalogService;
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
    width: 392,
    height: 540,
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
      minWidth: 320,
      minHeight: 280,
      frame: false,
      resizable: true,
      minimizable: false,
      maximizable: false,
      backgroundColor: '#0B101B',
      title: 'KAYN-DICAS — Cartão Pré-Jogo',
      show: !IS_SMOKE_TEST,
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
    width: 1220,
    height: 800,
    minWidth: 980,
    minHeight: 660,
    backgroundColor: '#0B101B',
    title: 'KAYN-DICAS — Kayn Jungle (BR Solo/Duo)',
    autoHideMenuBar: true,
    show: !IS_SMOKE_TEST,
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
    shortcutRegistered,
    cardWindowOpen: Boolean(cardWindow && !cardWindow.isDestroyed() && cardWindow.isVisible()),
    isExclusiveFullscreenCaveat: EXCLUSIVE_FULLSCREEN_NOTE,
  }));

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
        const others = appState.reviews.filter((r) => r.id !== res.review!.id);
        appState = sanitizePersistedState({
          ...appState,
          reviews: [res.review, ...others],
          activeReviewId: res.review.id,
        });
        persistState();
      }
      return res;
    },
  );
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
      if (karasmaiOnlyText.includes('Observado no CaiozeraLoL')) {
        throw new Error('Filtro de criador Karasmai ainda exibiu CaiozeraLoL.');
      }
      creatorSel.value = 'all';
      creatorSel.dispatchEvent(new Event('change', { bubbles: true }));
      await sleep(80);

      // Voltar para Draft e checar se o cartão já recebeu os combos favoritos fixados
      clickBtn('nav-draft');
      await sleep(80);

      // 4. Navegar para Treino via botão "Praticar no Treino" da lição e verificar cenários
      clickBtn('nav-learn');
      await sleep(80);
      clickBtn('practice-btn-caiozera-macro-bot-abort-river');
      await sleep(120);
      const trainResult = document.querySelector('[data-testid="training-preferred-option"]')?.textContent || '';
      if (!trainResult) throw new Error('Tela Treino não exibiu opção preferida.');

      // 5. Navegar para Revisão e verificar demo de gank ruim na bot + comparação com lição
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
        if (el && el.textContent && el.textContent.includes('PLANO PRÉ-JOGO') && el.textContent.includes('Combos fixados')) {
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
        if (el && el.textContent && el.textContent.includes('PLANO PRÉ-JOGO')) {
          return el.textContent;
        }
        await sleep(100);
      }
      return '';
    })();
  `);
  if (!reopenedText.includes('Draft Equilibrado')) {
    throw new Error('Cartão reaberto não preservou o plano congelado original.');
  }
  console.log('[SMOKE] Reabertura do cartão preservou plano congelado!');
}

app.whenReady().then(async () => {
  const userDataDir = app.getPath('userData');
  stateFilePath = path.join(userDataDir, 'kayn-dicas-state.json');
  riotKeyFilePath = path.join(userDataDir, 'riot-key.bin');
  const cacheFilePath = path.join(userDataDir, 'ddragon-cache.json');

  appState = readStateFileSafely(stateFilePath).state;
  catalogService = new DdragonCatalogService(cacheFilePath);

  registerIpcHandlers();
  registerShortcuts();
  mainWindow = createMainWindow();

  if (IS_SMOKE_TEST) {
    try {
      await runSmokeTest();
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
      console.error('[SMOKE] FALHOU:', err);
      globalShortcut.unregisterAll();
      app.exit(1);
    }
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
