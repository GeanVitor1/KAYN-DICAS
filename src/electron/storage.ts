import fs from 'node:fs';
import path from 'node:path';
import {
  DEMO_DRAFTS,
  DEMO_REVIEWS,
  DEMO_TRAINING_SCENARIOS,
} from '../engine/demos';
import { MAX_FAVORITE_MICRO_CARDS } from '../engine/studyLibrary';
import type {
  AppSettings,
  CardWindowOptions,
  DraftSide,
  DraftState,
  FrozenPreGameCard,
  LaneRole,
  PersistedAppState,
  ReviewMatch,
  StudyLesson,
  TrainingScenario,
} from '../shared/types';

export const CURRENT_SCHEMA_VERSION = 3;

export const DEFAULT_CARD_OPTIONS: CardWindowOptions = {
  alwaysOnTop: true,
  opacity: 0.92,
  clickThrough: false,
  toggleShortcut: 'CommandOrControl+Shift+K',
  showStaticMap: false,
};

export const DEFAULT_SETTINGS: AppSettings = {
  preferBlueAsTiebreaker: true,
  cardWindow: { ...DEFAULT_CARD_OPTIONS },
  riotApiKeyMode: 'none',
  riotRegionRouting: 'americas',
};

export function createDefaultPersistedState(): PersistedAppState {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    settings: {
      ...DEFAULT_SETTINGS,
      cardWindow: { ...DEFAULT_CARD_OPTIONS },
    },
    currentDraft: { ...DEMO_DRAFTS.balanced },
    savedDrafts: [
      { ...DEMO_DRAFTS.blue },
      { ...DEMO_DRAFTS.red },
      { ...DEMO_DRAFTS.balanced },
    ],
    frozenCard: null,
    trainingScenarios: [...DEMO_TRAINING_SCENARIOS],
    reviews: [...DEMO_REVIEWS],
    activeReviewId: DEMO_REVIEWS[0].id,
    customLessons: [],
    favoriteMicroIds: [
      'caiozera-micro-rhaast-e-wall-pivot',
      'drill-blue-w-motion',
    ],
    pinnedReminderIds: ['rule-caiozera-macro-bot-abort-river'],
    tacticalRuleNotes: {},
  };
}

function sanitizeSide(rawSide: unknown, ensureKaynJungle: boolean): DraftSide {
  const roles: LaneRole[] = ['top', 'jungle', 'mid', 'bot', 'support'];
  const obj = rawSide && typeof rawSide === 'object' ? (rawSide as Record<string, unknown>) : {};
  const result: DraftSide = {
    top: null,
    jungle: ensureKaynJungle ? 'Kayn' : null,
    mid: null,
    bot: null,
    support: null,
  };
  for (const r of roles) {
    const v = obj[r];
    if (typeof v === 'string' && v.trim()) {
      result[r] = v.trim();
    } else if (v === null) {
      result[r] = r === 'jungle' && ensureKaynJungle ? 'Kayn' : null;
    }
  }
  return result;
}

function sanitizeDraft(raw: unknown, fallbackId: string): DraftState | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  return {
    id: typeof obj.id === 'string' && obj.id.trim() ? obj.id.trim() : fallbackId,
    name: typeof obj.name === 'string' && obj.name.trim() ? obj.name.trim() : 'Draft salvo',
    allies: sanitizeSide(obj.allies, true),
    enemies: sanitizeSide(obj.enemies, false),
    staticNotes: typeof obj.staticNotes === 'string' ? obj.staticNotes : '',
    updatedAt: typeof obj.updatedAt === 'string' && obj.updatedAt ? obj.updatedAt : new Date().toISOString(),
  };
}

function sanitizeCardOptions(raw: unknown): CardWindowOptions {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const opacityRaw = typeof obj.opacity === 'number' && Number.isFinite(obj.opacity) ? obj.opacity : DEFAULT_CARD_OPTIONS.opacity;
  const opacity = Math.min(1, Math.max(0.35, opacityRaw));

  let bounds: CardWindowOptions['bounds'];
  if (obj.bounds && typeof obj.bounds === 'object') {
    const b = obj.bounds as Record<string, unknown>;
    if (
      typeof b.x === 'number' && Number.isFinite(b.x) &&
      typeof b.y === 'number' && Number.isFinite(b.y) &&
      typeof b.width === 'number' && Number.isFinite(b.width) && b.width >= 260 &&
      typeof b.height === 'number' && Number.isFinite(b.height) && b.height >= 260
    ) {
      bounds = {
        x: Math.round(b.x),
        y: Math.round(b.y),
        width: Math.round(b.width),
        height: Math.round(b.height),
      };
    }
  }

  return {
    alwaysOnTop: typeof obj.alwaysOnTop === 'boolean' ? obj.alwaysOnTop : DEFAULT_CARD_OPTIONS.alwaysOnTop,
    opacity,
    clickThrough: typeof obj.clickThrough === 'boolean' ? obj.clickThrough : DEFAULT_CARD_OPTIONS.clickThrough,
    toggleShortcut:
      typeof obj.toggleShortcut === 'string' && obj.toggleShortcut.trim()
        ? obj.toggleShortcut.trim()
        : DEFAULT_CARD_OPTIONS.toggleShortcut,
    showStaticMap:
      typeof obj.showStaticMap === 'boolean' ? obj.showStaticMap : DEFAULT_CARD_OPTIONS.showStaticMap,
    bounds,
  };
}

function sanitizeFrozenCard(raw: unknown): FrozenPreGameCard | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  if (
    typeof obj.id !== 'string' ||
    typeof obj.frozenAt !== 'string' ||
    typeof obj.recommendedFormLabel !== 'string' ||
    !obj.runesSummary ||
    !obj.buildSummary ||
    !obj.lanesToWatch
  ) {
    return null;
  }
  return raw as FrozenPreGameCard;
}

export function sanitizePersistedState(raw: unknown): PersistedAppState {
  const defaults = createDefaultPersistedState();
  if (!raw || typeof raw !== 'object') {
    return defaults;
  }

  const obj = raw as Record<string, unknown>;
  const rawSettings = obj.settings && typeof obj.settings === 'object' ? (obj.settings as Record<string, unknown>) : {};
  const settings: AppSettings = {
    preferBlueAsTiebreaker:
      typeof rawSettings.preferBlueAsTiebreaker === 'boolean'
        ? rawSettings.preferBlueAsTiebreaker
        : defaults.settings.preferBlueAsTiebreaker,
    cardWindow: sanitizeCardOptions(rawSettings.cardWindow),
    riotApiKeyMode:
      rawSettings.riotApiKeyMode === 'session_only' || rawSettings.riotApiKeyMode === 'saved_encrypted'
        ? rawSettings.riotApiKeyMode
        : 'none',
    riotRegionRouting: 'americas',
  };

  const currentDraft = sanitizeDraft(obj.currentDraft, 'draft-current') ?? defaults.currentDraft;

  const savedDraftsRaw = Array.isArray(obj.savedDrafts) ? obj.savedDrafts : [];
  const savedDrafts = savedDraftsRaw
    .map((d, idx) => sanitizeDraft(d, `draft-saved-${idx}`))
    .filter((d): d is DraftState => Boolean(d));

  const trainingScenariosRaw = Array.isArray(obj.trainingScenarios) ? obj.trainingScenarios : [];
  const demoScenarioById = new Map(DEMO_TRAINING_SCENARIOS.map((d) => [d.id, d]));
  const trainingScenariosUser = trainingScenariosRaw
    .filter(
      (s): s is TrainingScenario =>
        Boolean(
          s &&
            typeof s === 'object' &&
            typeof (s as TrainingScenario).id === 'string' &&
            typeof (s as TrainingScenario).minute === 'number',
        ),
    )
    .map((s) => {
      // Atualiza demos padrão não editados para refletir a correção de campos vs CS total
      const freshDemo = demoScenarioById.get(s.id);
      if (freshDemo && s.isExampleDemo) {
        return { ...freshDemo };
      }
      return s;
    });
  // Garante que novos cenários de lições estejam disponíveis ao migrar de versões anteriores
  const existingScenarioIds = new Set(trainingScenariosUser.map((s) => s.id));
  const mergedTrainingScenarios =
    trainingScenariosUser.length > 0
      ? [
          ...trainingScenariosUser,
          ...DEMO_TRAINING_SCENARIOS.filter((d) => !existingScenarioIds.has(d.id)),
        ]
      : defaults.trainingScenarios;

  const reviewsRaw = Array.isArray(obj.reviews) ? obj.reviews : [];
  const reviews = reviewsRaw.filter(
    (r): r is ReviewMatch =>
      Boolean(r && typeof r === 'object' && typeof (r as ReviewMatch).id === 'string' && Array.isArray((r as ReviewMatch).events)),
  );

  const finalReviews = reviews.length > 0 ? reviews : defaults.reviews;
  const activeReviewId =
    typeof obj.activeReviewId === 'string' && finalReviews.some((r) => r.id === obj.activeReviewId)
      ? obj.activeReviewId
      : finalReviews[0].id;

  const customLessonsRaw = Array.isArray(obj.customLessons) ? obj.customLessons : [];
  const customLessons = customLessonsRaw.filter(
    (l): l is StudyLesson =>
      Boolean(
        l &&
          typeof l === 'object' &&
          typeof (l as StudyLesson).id === 'string' &&
          typeof (l as StudyLesson).title === 'string' &&
          typeof (l as StudyLesson).videoUrl === 'string',
      ),
  );

  const favoriteMicroIds = Array.isArray(obj.favoriteMicroIds)
    ? Array.from(
        new Set(
          obj.favoriteMicroIds.filter((id): id is string => typeof id === 'string' && id.trim().length > 0),
        ),
      ).slice(0, MAX_FAVORITE_MICRO_CARDS)
    : defaults.favoriteMicroIds;

  const pinnedReminderIds = Array.isArray(obj.pinnedReminderIds)
    ? Array.from(
        new Set(
          obj.pinnedReminderIds.filter((id): id is string => typeof id === 'string' && id.trim().length > 0),
        ),
      ).slice(0, 3)
    : (defaults.pinnedReminderIds ?? []);

  const tacticalRuleNotes: Record<string, string> = {};
  if (obj.tacticalRuleNotes && typeof obj.tacticalRuleNotes === 'object') {
    for (const [k, v] of Object.entries(obj.tacticalRuleNotes as Record<string, unknown>)) {
      if (typeof k === 'string' && k.trim() && typeof v === 'string' && v.trim()) {
        tacticalRuleNotes[k.trim()] = v.trim().slice(0, 240);
      }
    }
  }

  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    settings,
    currentDraft,
    savedDrafts: savedDrafts.length > 0 ? savedDrafts : defaults.savedDrafts,
    frozenCard: sanitizeFrozenCard(obj.frozenCard),
    trainingScenarios: mergedTrainingScenarios,
    reviews: finalReviews,
    activeReviewId,
    customLessons,
    favoriteMicroIds,
    pinnedReminderIds,
    tacticalRuleNotes,
  };
}

export function readStateFileSafely(filePath: string): {
  state: PersistedAppState;
  recoveredFromCorruption: boolean;
  backupPath?: string;
} {
  if (!fs.existsSync(filePath)) {
    return {
      state: createDefaultPersistedState(),
      recoveredFromCorruption: false,
    };
  }

  try {
    const rawText = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(rawText);
    return {
      state: sanitizePersistedState(parsed),
      recoveredFromCorruption: false,
    };
  } catch {
    const backupPath = `${filePath}.corrupt.${Date.now()}.bak`;
    try {
      fs.copyFileSync(filePath, backupPath);
    } catch {
      // Ignora erro ao copiar backup caso o disco não permita
    }
    const defaults = createDefaultPersistedState();
    writeStateFileSafely(filePath, defaults);
    return {
      state: defaults,
      recoveredFromCorruption: true,
      backupPath,
    };
  }
}

export function writeStateFileSafely(filePath: string, state: PersistedAppState): void {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const tmpPath = `${filePath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(state, null, 2) + '\n', 'utf-8');
  fs.renameSync(tmpPath, filePath);
}
