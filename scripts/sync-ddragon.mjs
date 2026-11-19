import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUTPUT_PATH = path.join(ROOT, 'src', 'data', 'ddragon-snapshot.json');

const REQUIRED_KAYN_ITEM_IDS = [
  '1101', // Filhote de Garrabrasa
  '1102', // Cria de Andabrisas
  '1103', // Broto de Esmagamusgo
  '3158', // Botas Ionianas da Lucidez
  '3009', // Botas da Rapidez
  '3047', // Botas Galvanizadas de Aço
  '3111', // Passos de Mercúrio
  '6697', // Húbris
  '3142', // Lâmina Fantasma de Youmuu
  '6696', // Arco do Axioma
  '6698', // Hidra Profana
  '6699', // Cicloespada Voltaica
  '6694', // Rancor de Serylda
  '3814', // Limiar da Noite
  '6695', // Presa da Serpente
  '3004', // Manamune
  '6692', // Eclipse
  '3071', // Cutelo Negro
  '3161', // Lança de Shojin
  '6333', // Dança da Morte
  '3053', // Sinal de Sterak
  '3156', // Mandíbula de Malmortius
  '3065', // Semblante Espiritual
  '6610', // Céu Dividido
  '3026', // Anjo Guardião
  '3742', // Couraça do Defunto
  '3075', // Armadura de Espinhos
  '3123', // Chamado do Carrasco
  '6609', // Serrespada Quimiopunk
  '3134', // Punhal Serrilhado
];

const REQUIRED_RUNE_IDS = [
  // Árvores
  8100, 8300, 8000, 8200, 8400,
  // Runas usadas nos perfis
  8128, 8112, 8143, 8140, 8141, 8137, 8135, 8105, 8106,
  8369, 8304, 8321, 8313, 8347,
  8010, 9111, 9105, 9104, 8299, 8014, 8017,
  8224, 8210, 8234, 8232, 8236,
  8429, 8473, 8453, 8451,
];

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'KAYN-DICAS/0.1.0' },
  });
  if (!res.ok) {
    throw new Error(`Falha HTTP ${res.status} ao buscar ${url}`);
  }
  return res.json();
}

async function main() {
  const targetPatchArg = process.argv[2];
  const versions = await fetchJson('https://ddragon.leagueoflegends.com/api/versions.json');
  if (!Array.isArray(versions) || versions.length === 0) {
    throw new Error('Lista de versões do Data Dragon vazia ou inválida.');
  }

  const patch = targetPatchArg || versions[0];
  console.log(`[sync:ddragon] Sincronizando patch ${patch} (pt_BR)...`);

  const base = `https://ddragon.leagueoflegends.com/cdn/${patch}/data/pt_BR`;
  const [championRaw, itemRaw, runesRaw] = await Promise.all([
    fetchJson(`${base}/champion.json`),
    fetchJson(`${base}/item.json`),
    fetchJson(`${base}/runesReforged.json`),
  ]);

  const champions = {};
  for (const [id, c] of Object.entries(championRaw.data || {}).sort(([a], [b]) => a.localeCompare(b))) {
    champions[id] = {
      id: c.id,
      key: String(c.key),
      name: c.name,
      title: c.title,
      tags: Array.isArray(c.tags) ? c.tags : [],
      attackrange: Number(c.stats?.attackrange ?? 175),
    };
  }

  const items = {};
  for (const [id, it] of Object.entries(itemRaw.data || {}).sort(([a], [b]) => Number(a) - Number(b))) {
    const numericId = Number(id);
    const map11 = Boolean(it.maps && it.maps['11'] === true);
    const purchasable = Boolean(it.gold && it.gold.purchasable === true);
    const inStore = it.inStore !== false;
    const isArenaOrModeExclusive = Number.isNaN(numericId) || numericId >= 10000;
    const hasChampRestriction = Boolean(it.requiredChampion || it.requiredAlly);

    if (map11 && purchasable && inStore && !isArenaOrModeExclusive && !hasChampRestriction) {
      items[id] = {
        id,
        name: it.name,
        plaintext: it.plaintext || '',
        gold: Number(it.gold?.total ?? 0),
        tags: Array.isArray(it.tags) ? it.tags : [],
        maps11: true,
        purchasable: true,
      };
    }
  }

  const runeTrees = (Array.isArray(runesRaw) ? runesRaw : []).map((tree) => ({
    id: tree.id,
    key: tree.key,
    name: tree.name,
    slots: (tree.slots || []).map((slot) => ({
      runes: (slot.runes || []).map((r) => ({
        id: r.id,
        key: r.key,
        name: r.name,
        shortDesc: r.shortDesc || '',
      })),
    })),
  }));

  // Validação obrigatória de integridade para os IDs do Kayn
  const missingItems = REQUIRED_KAYN_ITEM_IDS.filter((id) => !items[id]);
  if (missingItems.length > 0) {
    throw new Error(`Itens obrigatórios ausentes ou indisponíveis no Map 11 no patch ${patch}: ${missingItems.join(', ')}`);
  }

  const allRuneIds = new Set();
  for (const t of runeTrees) {
    allRuneIds.add(t.id);
    for (const s of t.slots) {
      for (const r of s.runes) {
        allRuneIds.add(r.id);
      }
    }
  }
  const missingRunes = REQUIRED_RUNE_IDS.filter((id) => !allRuneIds.has(id));
  if (missingRunes.length > 0) {
    throw new Error(`Runas obrigatórias ausentes no patch ${patch}: ${missingRunes.join(', ')}`);
  }

  const snapshot = {
    patch,
    locale: 'pt_BR',
    mapId: 11,
    fetchedAt: new Date().toISOString(),
    source: 'Riot Data Dragon',
    championCount: Object.keys(champions).length,
    itemCount: Object.keys(items).length,
    runeTreeCount: runeTrees.length,
    champions,
    items,
    runeTrees,
  };

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(snapshot, null, 2) + '\n', 'utf-8');
  console.log(
    `[sync:ddragon] Concluído! Patch=${patch}, Campeões=${snapshot.championCount}, Itens(SR)=${snapshot.itemCount}, Árvores=${snapshot.runeTreeCount}`
  );
}

main().catch((err) => {
  console.error('[sync:ddragon] ERRO:', err);
  process.exit(1);
});
