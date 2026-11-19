# Política da Riot Games e Limites do Produto — KAYN-DICAS

Este documento registra como o **KAYN-DICAS** respeita a documentação oficial da Riot Games e as Políticas Gerais para Desenvolvedores (`developer.riotgames.com/docs/lol` e artigo `22698591841939-General-Policies`):

## 1. Integração oficial somente-leitura (LCU + Live Client Data API)

1. **Seleção de Campeões (`LCU` local — `/lol-champ-select/v1/session`):**
   - Lê exclusivamente os **IDs dos campeões** (`championId` / `championPickIntent`) e posições atribuídas (`assignedPosition`) para preencher os 10 retratos automaticamente.
   - **Anonimato estrito respeitado:** nunca lê, armazena ou exibe `summonerId`, `puuid`, nomes ou históricos de jogadores anônimos na seleção de campeões.
2. **Partida em tempo real (`Riot Live Client Data API` — `https://127.0.0.1:2999/liveclientdata/allgamedata`):**
   - Usa exclusivamente o endpoint oficial local documentado pela Riot Games — **zero leitura de memória**, **zero injeção**, **zero alteração do Vanguard** e sem necessidade de privilégios de administrador.
   - Exibe apenas dados públicos factuais da partida atual (10 campeões reais, nível, ouro na mão, KDA, CS total do HUD, itens já comprados na sua build e alertas factuais de itens comprados pelos inimigos).
   - **Limites de Game Integrity respeitados:** não rastreia cooldowns ocultos de ultimates/feitiços inimigos, não expõe posições no minimapa/nevoeiro, não toca alertas sonoros e não toma decisões automatizadas de macro ("faça Dragão agora") durante a partida.
3. **Fora da partida ativa (Treino e Revisão Pós-Jogo):** toda simulação de decisão (Dragão vs gank vs farm vs reset) e análise de timeline roda isoladamente fora de partidas ao vivo.

## 2. Privacidade e fontes de dados

- **Data Dragon oficial BR (`pt_BR`, Map 11):** usado como catálogo estático de campeões, itens compráveis, runas, fragmentos e ícones oficiais em cache offline.
- **Persistência local:** drafts, cenários de treino, revisões, regras táticas e preferências ficam gravados somente no diretório `userData` do usuário no Windows.
- **Riot Match-V5 opcional:** se o usuário optar por informar sua própria chave da Riot API na aba Revisão, as requisições usam `americas.api.riotgames.com` para BR1 fora de partida ativa.

## 3. Nota sobre vídeo no Windows

No Windows, jogos em **Tela Cheia Exclusiva** assumem controle exclusivo da saída de vídeo e ocultam janelas desktop sobrepostas. Para manter o cartão visível durante a partida, configure o League of Legends em **Janela sem Bordas** ou posicione o cartão em um **segundo monitor**.
