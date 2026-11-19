import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUTPUT_PATH = path.join(ROOT, 'src', 'data', 'ddragon-snapshot.json');
const ASSETS_ROOT = path.join(ROOT, 'public', 'ddragon-assets');

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

// Fragmentos oficiais (StatMods) do Summoner's Rift — ícones verificados no CDN oficial do Data Dragon
const OFFICIAL_STAT_SHARDS = [
  {
    id: 5008,
    key: 'AdaptiveForce',
    name: '+9 de Força Adaptativa',
    shortLabel: 'Força Adaptativa',
    row: 'offense',
    icon: 'perk-images/StatMods/StatModsAdaptiveForceIcon.png',
  },
  {
    id: 5005,
    key: 'AttackSpeed',
    name: '+10% de Velocidade de Ataque',
    shortLabel: 'Vel. de Ataque',
    row: 'offense',
    icon: 'perk-images/StatMods/StatModsAttackSpeedIcon.png',
  },
  {
    id: 5007,
    key: 'AbilityHaste',
    name: '+8 de Aceleração de Habilidade',
    shortLabel: 'Aceleração',
    row: 'offense',
    icon: 'perk-images/StatMods/StatModsCDRScalingIcon.png',
  },
  {
    id: 5010,
    key: 'MoveSpeed',
    name: '+2% de Velocidade de Movimento',
    shortLabel: 'Vel. Movimento',
    row: 'flex',
    icon: 'perk-images/StatMods/StatModsMovementSpeedIcon.png',
  },
  {
    id: 5001,
    key: 'HealthScaling',
    name: '+10–180 de Vida (por nível)',
    shortLabel: 'Vida Escalável',
    row: 'defense',
    icon: 'perk-images/StatMods/StatModsHealthScalingIcon.png',
  },
  {
    id: 5011,
    key: 'HealthFlat',
    name: '+65 de Vida Base',
    shortLabel: 'Vida Base',
    row: 'defense',
    icon: 'perk-images/StatMods/StatModsHealthPlusIcon.png',
  },
  {
    id: 5013,
    key: 'Tenacity',
    name: '+10% de Tenacidade e Resistência a Lentidão',
    shortLabel: 'Tenacidade',
    row: 'defense',
    icon: 'perk-images/StatMods/StatModsTenacityIcon.png',
  },
];

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'KAYN-DICAS/0.2.0' },
  });
  if (!res.ok) {
    throw new Error(`Falha HTTP ${res.status} ao buscar ${url}`);
  }
  return res.json();
}

async function downloadFile(url, destPath) {
  if (fs.existsSync(destPath) && fs.statSync(destPath).size > 0) {
    return 'cached';
  }
  const res = await fetch(url, {
    headers: { 'User-Agent': 'KAYN-DICAS/0.2.0' },
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ao baixar ícone ${url}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  const tmp = `${destPath}.tmp`;
  fs.writeFileSync(tmp, buf);
  fs.renameSync(tmp, destPath);
  return 'downloaded';
}

async function runPool(tasks, concurrency = 12) {
  let idx = 0;
  let downloaded = 0;
  let cached = 0;
  async function worker() {
    while (idx < tasks.length) {
      const current = tasks[idx++];
      const status = await downloadFile(current.url, current.dest);
      if (status === 'downloaded') downloaded += 1;
      else cached += 1;
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker()));
  return { downloaded, cached };
}

async function main() {
  const targetPatchArg = process.argv[2];
  const brRealm = await fetchJson('https://ddragon.leagueoflegends.com/realms/br.json');
  const cdnBase = typeof brRealm?.cdn === 'string' ? brRealm.cdn : 'https://ddragon.leagueoflegends.com/cdn';
  const brPatch = typeof brRealm?.v === 'string' ? brRealm.v : null;

  let patch = targetPatchArg || brPatch;
  if (!patch) {
    const versions = await fetchJson('https://ddragon.leagueoflegends.com/api/versions.json');
    if (!Array.isArray(versions) || versions.length === 0) {
      throw new Error('Lista de versões do Data Dragon vazia ou inválida.');
    }
    patch = versions[0];
  }

  console.log(`[sync:ddragon] Sincronizando cliente BR (realm=br, patch=${patch}, locale=pt_BR)...`);

  const base = `${cdnBase}/${patch}/data/pt_BR`;
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
      imageFull: String(c.image?.full ?? `${c.id}.png`),
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
        imageFull: String(it.image?.full ?? `${id}.png`),
      };
    }
  }

  const runeTrees = (Array.isArray(runesRaw) ? runesRaw : []).map((tree) => ({
    id: tree.id,
    key: tree.key,
    name: tree.name,
    icon: String(tree.icon ?? ''),
    slots: (tree.slots || []).map((slot, slotIndex) => ({
      runes: (slot.runes || []).map((r) => ({
        id: r.id,
        key: r.key,
        name: r.name,
        shortDesc: r.shortDesc || '',
        icon: String(r.icon ?? ''),
        treeId: tree.id,
        slotIndex,
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

  // Verificar e cachear ícones oficiais para uso 100% offline na geração deste patch
  const patchAssetsDir = path.join(ASSETS_ROOT, patch);
  const downloadTasks = [];

  // 1. Retratos oficiais de todos os campeões do catálogo (para Draft offline)
  for (const champ of Object.values(champions)) {
    downloadTasks.push({
      url: `${cdnBase}/${patch}/img/champion/${champ.imageFull}`,
      dest: path.join(patchAssetsDir, 'champion', champ.imageFull),
    });
  }

  // 2. Arte oficial do Kayn (para card hero)
  downloadTasks.push({
    url: `${cdnBase}/img/champion/splash/Kayn_0.jpg`,
    dest: path.join(patchAssetsDir, 'splash', 'Kayn_0.jpg'),
  });

  // 3. Ícones oficiais dos itens recomendados do Kayn
  for (const id of REQUIRED_KAYN_ITEM_IDS) {
    const it = items[id];
    downloadTasks.push({
      url: `${cdnBase}/${patch}/img/item/${it.imageFull}`,
      dest: path.join(patchAssetsDir, 'item', it.imageFull),
    });
  }

  // 4. Ícones oficiais de todas as árvores e runas do catálogo
  for (const t of runeTrees) {
    if (t.icon) {
      downloadTasks.push({
        url: `${cdnBase}/img/${t.icon}`,
        dest: path.join(patchAssetsDir, 'img', ...t.icon.split('/')),
      });
    }
    for (const s of t.slots) {
      for (const r of s.runes) {
        if (r.icon) {
          downloadTasks.push({
            url: `${cdnBase}/img/${r.icon}`,
            dest: path.join(patchAssetsDir, 'img', ...r.icon.split('/')),
          });
        }
      }
    }
  }

  // 5. Ícones oficiais de fragmentos (StatMods) verificados no CDN Data Dragon
  const verifiedStatShards = [];
  for (const shard of OFFICIAL_STAT_SHARDS) {
    const dest = path.join(patchAssetsDir, 'img', ...shard.icon.split('/'));
    try {
      await downloadFile(`${cdnBase}/img/${shard.icon}`, dest);
      verifiedStatShards.push(shard);
    } catch (err) {
      console.warn(`[sync:ddragon] Aviso: ícone de fragmento indisponível (${shard.key}): ${err.message}`);
      verifiedStatShards.push({ ...shard, icon: undefined });
    }
  }

  const iconStats = await runPool(downloadTasks, 16);

  // Remover pastas de patches antigos em public/ddragon-assets para não misturar gerações
  if (fs.existsSync(ASSETS_ROOT)) {
    for (const entry of fs.readdirSync(ASSETS_ROOT)) {
      if (entry !== patch) {
        fs.rmSync(path.join(ASSETS_ROOT, entry), { recursive: true, force: true });
      }
    }
  }

  const snapshot = {
    patch,
    realm: 'br',
    cdnBase,
    locale: 'pt_BR',
    mapId: 11,
    fetchedAt: new Date().toISOString(),
    source: 'Riot Data Dragon (BR)',
    championCount: Object.keys(champions).length,
    itemCount: Object.keys(items).length,
    runeTreeCount: runeTrees.length,
    champions,
    items,
    runeTrees,
    statShards: verifiedStatShards,
  };

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(snapshot, null, 2) + '\n', 'utf-8');
  console.log(
    `[sync:ddragon] Concluído! BR Patch=${patch}, Campeões=${snapshot.championCount}, Itens(SR)=${snapshot.itemCount}, Árvores=${snapshot.runeTreeCount}, Fragmentos=${verifiedStatShards.length}, Ícones=${iconStats.downloaded} baixados / ${iconStats.cached} em cache.`,
  );
}

main().catch((err) => {
  console.error('[sync:ddragon] ERRO:', err);
  process.exit(1);
});
