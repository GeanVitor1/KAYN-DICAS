# Formato JSON de Revisão Pós-Jogo — KAYN-DICAS

O aplicativo permite importar e exportar revisões pós-jogo em JSON local (`schemaVersion: 1`) sem depender de conexão ou chave da Riot API.

## Estrutura

```json
{
  "schemaVersion": 1,
  "exportedAt": "2026-11-18T23:00:00.000Z",
  "review": {
    "id": "review-exemplo-1",
    "title": "Diamante 4 - Kayn Azul vs Jinx/Lulu",
    "isExampleDemo": false,
    "sourceLabel": "Preenchimento manual",
    "patch": "16.23.1",
    "rankContext": "Diamante 4 Solo/Duo BR",
    "plannedForm": "blue",
    "actualFormMinute": 12,
    "actualFormChosen": "blue",
    "playerSummaryNote": "Resumo livre da partida.",
    "events": [
      {
        "id": "ev-1",
        "minute": 6,
        "type": "gank",
        "lane": "bot",
        "allyPrio": "enemy",
        "estimatedEnemyJungler": "unknown",
        "kaynHpPercent": 78,
        "resourcesReady": true,
        "timeSpentSeconds": 22,
        "outcome": "nothing_lost_tempo",
        "whatHappenedAfter": "Ficou esperando atrás da parede e perdeu Acuaminas/Kruges.",
        "enemyResponseText": "Jungler inimigo pode ter garantido Vastilarvas.",
        "enemyResponseCertainty": "hypothesis",
        "executionNote": "Tentou forçar W sem setup aliado.",
        "decisionContextSource": "manual_observed"
      }
    ]
  }
}
```

## Campos principais por evento

| Campo | Valores permitidos |
| --- | --- |
| `type` | `"gank"`, `"death"`, `"reset"`, `"farm"`, `"objective"` |
| `lane` | `"top"`, `"mid"`, `"bot"`, `"jungle"`, `"river"` |
| `allyPrio` | `"ally"`, `"even"`, `"enemy"`, `"unknown"` |
| `estimatedEnemyJungler` | `"bot_side"`, `"top_side"`, `"mid"`, `"dead_or_base"`, `"unknown"` |
| `timeSpentSeconds` | Número inteiro em segundos ou `null` quando desconhecido |
| `outcome` | `"kill"`, `"assist"`, `"forced_spell_or_recall"`, `"nothing_lost_tempo"`, `"died"`, `"completed_objective"`, `"clean_reset"`, `"efficient_clear"` |
| `enemyResponseCertainty` | `"confirmed"` (comprovado na fonte/replay) ou `"hypothesis"` (estimativa) |
| `decisionContextSource` | `"manual_observed"` ou `"api_partial_hypothesis"` |
