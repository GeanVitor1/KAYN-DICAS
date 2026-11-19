import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  readStateFileSafely,
  sanitizePersistedState,
  writeStateFileSafely,
} from '../src/electron/storage';

describe('Persistência Tolerante e Desacoplamento do Cartão', () => {
  it('tolera JSON corrompido criando backup e restaurando padrões válidos sem crash', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kayn-storage-test-'));
    const filePath = path.join(tmpDir, 'state.json');

    try {
      fs.writeFileSync(filePath, '{corrompido!!!', 'utf-8');
      const res = readStateFileSafely(filePath);
      expect(res.recoveredFromCorruption).toBe(true);
      expect(res.backupPath).toBeTruthy();
      expect(fs.existsSync(res.backupPath!)).toBe(true);
      expect(res.state.currentDraft.allies.jungle).toBe('Kayn');
      expect(res.state.reviews.length).toBeGreaterThanOrEqual(2);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('migra e completa estado antigo/incompleto preservando preferências e dados válidos', () => {
    const sanitized = sanitizePersistedState({
      schemaVersion: 0,
      settings: {
        preferBlueAsTiebreaker: false,
        cardWindow: {
          opacity: 5, // fora do limite -> deve normalizar para 1
          bounds: { x: 100, y: 120, width: 50, height: 50 }, // pequeno demais -> descartar
        },
      },
      currentDraft: {
        id: 'd-old',
        name: 'Draft antigo',
        allies: { top: 'Ornn' }, // faltam posições -> completa jungle: Kayn
        enemies: { mid: 'Syndra' },
      },
    });

    expect(sanitized.schemaVersion).toBe(3);
    expect(sanitized.settings.preferBlueAsTiebreaker).toBe(false);
    expect(sanitized.settings.cardWindow.opacity).toBe(1);
    expect(sanitized.settings.cardWindow.bounds).toBeUndefined();
    expect(sanitized.currentDraft.allies.top).toBe('Ornn');
    expect(sanitized.currentDraft.allies.jungle).toBe('Kayn');
    expect(sanitized.currentDraft.enemies.mid).toBe('Syndra');
    expect(sanitized.trainingScenarios.length).toBe(8);
    expect(sanitized.favoriteMicroIds.length).toBeLessThanOrEqual(3);
    expect(Array.isArray(sanitized.pinnedReminderIds)).toBe(true);
  });

  it('preserva favoritos (máximo 3) e lições customizadas ao gravar e recarregar estado', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kayn-phase2-persist-'));
    const filePath = path.join(tmpDir, 'state.json');

    try {
      const sanitized = sanitizePersistedState({
        schemaVersion: 2,
        favoriteMicroIds: ['a', 'b', 'a', 'c', 'd'],
        pinnedReminderIds: ['rule-1', 'rule-2'],
        tacticalRuleNotes: { 'rule-1': 'Minha correção local' },
        customLessons: [
          {
            id: 'custom-1',
            title: '[PENDENTE] Teste',
            creator: 'caiozera',
            creatorDisplayName: 'CaiozeraLoL',
            attributionLabel: 'Fonte pendente',
            topic: 'macro',
            form: 'base',
            verificationStatus: 'pending_curation',
            speechVerified: false,
            isHistoricalReference: false,
            patch: 'Desconhecido',
            videoUrl: 'https://www.youtube.com/watch?v=ubwHhx3DdZA',
            videoTitle: 'Teste',
            channelName: 'caíozera',
            channelUrl: 'https://www.youtube.com/@caiozerinha',
            contextStartSeconds: 60,
            playMomentSeconds: 60,
            timestampDisplay: '01:00',
            gameClockDisplay: 'Pendente',
            shortSummaryPt: 'Nota',
            evidenceNote: 'Manual',
            isCustom: true,
          },
        ],
      });
      writeStateFileSafely(filePath, sanitized);
      const reloaded = readStateFileSafely(filePath).state;
      expect(reloaded.favoriteMicroIds).toEqual(['a', 'b', 'c']);
      expect(reloaded.pinnedReminderIds).toEqual(['rule-1', 'rule-2']);
      expect(reloaded.tacticalRuleNotes?.['rule-1']).toBe('Minha correção local');
      expect(reloaded.customLessons.length).toBe(1);
      expect(reloaded.customLessons[0].id).toBe('custom-1');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('grava e recarrega o cartão congelado sem mutações', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kayn-card-persist-'));
    const filePath = path.join(tmpDir, 'state.json');

    try {
      const initial = readStateFileSafely(filePath).state;
      initial.frozenCard = {
        id: 'card-1',
        frozenAt: '2026-11-18T22:00:00.000Z',
        draftName: 'Plano Congelado',
        patch: '16.23.1',
        patchMismatch: false,
        recommendedForm: 'red',
        recommendedFormLabel: 'Rhaast (Darkin)',
        alternativeFormLabel: 'Kayn Azul',
        flipCondition: 'Condição teste',
        confidenceLabel: 'ALTA',
        keyReasons: ['Motivo 1'],
        runesSummary: {
          primaryTree: 'Precisão',
          primaryRunes: ['Conquistador'],
          secondaryTree: 'Inspiração',
          secondaryRunes: ['Calçados Mágicos'],
          statShards: ['+9 AD'],
        },
        buildSummary: {
          junglePet: 'Broto de Esmagamusgo',
          boots: 'Botas Galvanizadas de Aço',
          coreItems: ['Eclipse', 'Cutelo Negro'],
          activeSituational: [],
        },
        lanesToWatch: {
          firstGankWindow: 'Top',
          bestPlayAroundLane: 'Top',
          perLaneNotes: [],
        },
        farmPlan: 'Full clear Bot -> Top',
        staticReminders: ['Não forçar Bot sem setup'],
        schematicPlan: {
          primaryFocusSide: 'top',
          suggestedStart: 'Full clear Bot -> Top',
          note: 'Estático',
        },
      };

      writeStateFileSafely(filePath, initial);
      const reloaded = readStateFileSafely(filePath).state;
      expect(reloaded.frozenCard?.id).toBe('card-1');
      expect(reloaded.frozenCard?.recommendedForm).toBe('red');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('garante que CardWindowPage.tsx não importa lógica de treino ou dados ao vivo', () => {
    const cardPagePath = path.resolve(
      __dirname,
      '../src/renderer/pages/CardWindowPage.tsx',
    );
    const source = fs.readFileSync(cardPagePath, 'utf-8');
    expect(source).not.toContain('trainingSimulator');
    expect(source).not.toContain('reviewAnalyzer');
    expect(source).not.toContain('127.0.0.1:2999');
  });

  it('garante que preload.ts é compatível com sandbox: true e sincronizado com IPC_CHANNELS', async () => {
    const { IPC_CHANNELS } = await import('../src/shared/ipc');
    const preloadPath = path.resolve(__dirname, '../src/electron/preload.ts');
    const source = fs.readFileSync(preloadPath, 'utf-8');
    const relativeImports = source
      .split('\n')
      .filter((line) => line.includes("from '../") || line.includes('from "../'));
    expect(relativeImports.every((line) => line.startsWith('import type '))).toBe(true);
    for (const val of Object.values(IPC_CHANNELS)) {
      if (val === 'kayn:get-catalog') continue; // reservado
      expect(source).toContain(val);
    }
  });
});
