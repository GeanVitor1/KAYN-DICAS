import type { CatalogSnapshot, CatalogValidationReport } from '../shared/types';
import {
  BUILD_DATA_META,
  collectBlueprintItemIds,
  collectBlueprintRuneIds,
} from './buildProfiles';
import { TACTICAL_DATA_META } from './championTactics';

export function validateCatalogSnapshot(raw: unknown): {
  valid: boolean;
  snapshot?: CatalogSnapshot;
  errors: string[];
} {
  const errors: string[] = [];
  if (!raw || typeof raw !== 'object') {
    return { valid: false, errors: ['Payload do catálogo não é um objeto válido.'] };
  }

  const obj = raw as Record<string, unknown>;
  if (typeof obj.patch !== 'string' || !obj.patch.trim()) {
    errors.push('Campo "patch" ausente ou inválido.');
  }
  if (obj.locale !== 'pt_BR') {
    errors.push(`Idioma esperado "pt_BR", recebido "${String(obj.locale)}".`);
  }
  if (obj.mapId !== 11) {
    errors.push(`Mapa esperado 11 (Summoner's Rift), recebido "${String(obj.mapId)}".`);
  }

  const champions = obj.champions as Record<string, unknown> | undefined;
  if (!champions || typeof champions !== 'object' || Object.keys(champions).length < 150) {
    errors.push('Lista de campeões insuficiente ou ausente no catálogo.');
  } else if (!champions.Kayn) {
    errors.push('Campeão Kayn não encontrado no catálogo.');
  }

  const items = obj.items as Record<string, Record<string, unknown>> | undefined;
  if (!items || typeof items !== 'object' || Object.keys(items).length < 100) {
    errors.push('Lista de itens insuficiente ou ausente no catálogo.');
  } else {
    const sampleInvalidItem = Object.values(items).find(
      (it) => it && (it.maps11 !== true || it.purchasable !== true || typeof it.name !== 'string'),
    );
    if (sampleInvalidItem) {
      errors.push('Catálogo contém item incompatível com Summoner\'s Rift ou esquema inválido.');
    }
  }

  const runeTrees = obj.runeTrees as Array<Record<string, unknown>> | undefined;
  if (!Array.isArray(runeTrees) || runeTrees.length < 5) {
    errors.push('Árvores de runas ausentes ou incompletas (esperado 5 árvores).');
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    snapshot: raw as CatalogSnapshot,
    errors: [],
  };
}

export function validateRecommendationsAgainstCatalog(
  catalog: CatalogSnapshot,
): CatalogValidationReport {
  const warnings: string[] = [];
  const requiredItemIds = collectBlueprintItemIds();
  const missingItemIds = requiredItemIds.filter((id) => {
    const item = catalog.items[id];
    return !item || !item.maps11 || !item.purchasable;
  });

  const presentRuneIds = new Set<number>();
  for (const tree of catalog.runeTrees) {
    presentRuneIds.add(tree.id);
    for (const slot of tree.slots) {
      for (const r of slot.runes) {
        presentRuneIds.add(r.id);
      }
    }
  }

  const requiredRuneIds = collectBlueprintRuneIds();
  const missingRuneIds = requiredRuneIds.filter((id) => !presentRuneIds.has(id));

  const patchMismatch =
    catalog.patch !== BUILD_DATA_META.validatedPatch ||
    catalog.patch !== TACTICAL_DATA_META.validatedPatch;

  if (patchMismatch) {
    warnings.push(
      `Divergência de patch: catálogo está em ${catalog.patch}, mas os perfis táticos/builds foram validados em ${BUILD_DATA_META.validatedPatch}.`,
    );
  }
  if (missingItemIds.length > 0) {
    warnings.push(
      `Itens recomendados ausentes ou indisponíveis no Map 11 (${catalog.patch}): ${missingItemIds.join(', ')}.`,
    );
  }
  if (missingRuneIds.length > 0) {
    warnings.push(
      `Runas recomendadas ausentes no catálogo (${catalog.patch}): ${missingRuneIds.join(', ')}.`,
    );
  }

  return {
    validSnapshot: true,
    validRecommendations: missingItemIds.length === 0 && missingRuneIds.length === 0,
    catalogPatch: catalog.patch,
    tacticalVersion: TACTICAL_DATA_META.tacticalVersion,
    tacticalValidatedPatch: TACTICAL_DATA_META.validatedPatch,
    buildVersion: BUILD_DATA_META.buildVersion,
    buildValidatedPatch: BUILD_DATA_META.validatedPatch,
    patchMismatch,
    missingItemIds,
    missingRuneIds,
    warnings,
  };
}
