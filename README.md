# KAYN-DICAS

Aplicativo desktop em português do Brasil para **main Kayn Jungle** no servidor **BR (Solo/Duo, Summoner's Rift)**, focado em jogadores de nível **Diamante** que querem parar de forçar ganks ruins na Bot por impulso e tomar decisões consistentes de forma, build, tempo de mapa e objetivos.

Funciona **100% offline**, sem necessidade de login, chave Riot, LoL aberto ou conexão com a internet.

---

## Primeiro teste (menos de 2 minutos)

1. Instale e abra o app:
   ```bash
   npm install
   npm start
   ```
2. Na aba **Draft** (que já abre com a demo equilibrada):
   - Clique em **Demo Rhaast** para ver o app recomendar **Rhaast** mesmo com a preferência pelo Kayn Azul ligada como desempate.
   - Clique em **Demo Azul** e depois em **Salvar plano pré-jogo** e **Abrir cartão** para congelar a cópia estática usada durante a partida.
3. Clique na aba **Revisão** (topo):
   - O cenário fictício **`[EXEMPLO FICTÍCIO] Diamante 3 -> 4: Forçando Bot e Perdendo Ritmo`** já vem carregado.
   - Veja no painel esquerdo o resumo das **3 tentativas na Bot**: a tentativa do **minuto 4** (sem kill, mas forçou Flash/Curar rápido) é reconhecida como útil, enquanto as dos **minutos 6 e 8** mostram o custo de esperar 24s sem prio ou entrar sem informação do caçador inimigo — além da diferença explícita entre **`[CONFIRMADO]`** e **`[HIPÓTESE]`** e os **padrões recorrentes** com o foco para as próximas partidas.

---

## Pré-requisitos e Instalação

- **Sistema:** Windows 10/11 (x64)
- **Node.js:** v20+ (testado em v24.11.0 / npm 11.6.1)

```bash
git clone https://github.com/GeanVitor1/KAYN-DICAS.git
cd KAYN-DICAS
npm install
```

## Comandos principais

| Comando | O que faz |
| --- | --- |
| `npm start` | Compila a interface + processo Electron e abre o app desktop |
| `npm run dev` | Modo desenvolvimento com hot-reload Vite + Electron |
| `npm test` | Executa toda a suíte de testes unitários (Vitest) |
| `npm run typecheck` | Checa tipos TypeScript do renderer, motor e Electron |
| `npm run lint` | Roda ESLint no código-fonte |
| `npm run build` | Gera build de produção em `dist/` e `dist-electron/` |
| `npm run smoke` | Roda smoke test automatizado no Electron real (Draft, Cartão, Treino, Revisão) |
| `npm run sync:ddragon` | Atualiza o snapshot local `src/data/ddragon-snapshot.json` direto do Data Dragon |
| `npm run package:win` | Gera executável portátil Windows em `release/KAYN-DICAS-0.1.0-portable.exe` |

---

## O que o app entrega (revisão visual, ícones oficiais e memória tática)

### 1. Antes da partida — Draft visual (`Draft`)
- Layout em duas áreas principais pensado para `1200 × 780` sem rolagem: composições 5v5 com retratos oficiais + cartão hero da forma recomendada (`Kayn Azul`, `Rhaast` ou `Indefinido`) à esquerda; página de runas visual (runa principal grande com nome em PT-BR sempre visível, árvore principal, secundária e fragmentos oficiais) + núcleo da build em ordem visual com pet/botas compactos à direita.
- Faixa curta abaixo com **1ª janela para observar**, **alternativa de farm** e **lembrete tático** pré-jogo; justificativa completa, alternativa, condição de inversão e pesos internos abrem sob demanda em **Por quê?**.
- **Regra de desempate pelo Azul:** só decide drafts na faixa equilibrada — nunca mascara uma composição claramente favorável ao Rhaast.

### 2. Aba **Aprender** — Memória Tática (CaiozeraLoL & Karasmai)
- Cartões curtos e acionáveis no lugar de transcrições longas: título direto (*"Quando desistir da Bot"*), dica de 1 linha, até 3 sinais visuais, botão **Praticar**, fixação de combos/lembretes e **Ver exemplo** sob demanda com fonte, timestamp, estado de evidência e personalização local.
- CaiozeraLoL no topo por padrão e ensinamentos do Karasmai resumidos em português, sem inventar falas, combos ou timestamps.

### 3. Durante a partida — Cartão Flutuante Estático (`Cartão`)
- Janela estreita sem parágrafos com forma, ícone da runa principal + secundárias, ícones da build em ordem, 1–2 lembretes pré-jogo e combos fixados em teclas grandes (apenas sequências verificadas ou exercícios de treino rotulados).
- Congela uma cópia estática ao clicar em **Salvar plano pré-jogo**, com opções **Sempre no topo**, **Opacidade**, **Clique atravessado** (`Ctrl+Shift+L`) e atalho global (`Ctrl+Shift+K`).

### 4. Treino de decisões (`Treino`) e Revisão pós-jogo (`Revisão`)
- **Treino:** um cenário por vez com mapa esquemático, sinais curtos e botões de decisão (*Gankar Bot*, *Farmar*, *Resetar*, *Objetivo*). A resposta só aparece depois da sua escolha, com análise completa e regra tática vinculada em **Ver análise**. Separa CS de lane e campos da selva apenas quando a fonte permite distinguir.
- **Revisão:** timeline limpa mostrando minuto, evento e aprendizado curto de primeira, com contexto completo, `[CONFIRMADO]` vs `[HIPÓTESE]`, comparação com a memória tática, JSON local ([formato documentado](docs/REVIEW_JSON_FORMAT.md)) e importação opcional via **Riot Match-V5**.

---

## Dados usados, Ícones Oficiais e Atualizações por Patch

- **Catálogo oficial BR:** verificado via `realms/br.json` (`pt_BR`, Summoner's Rift `mapId: 11`), validado no patch **`16.23.1`** (`173` campeões, `215` itens compráveis no Summoner's Rift, `5` árvores de runas e `7` fragmentos com ícones oficiais em cache offline).
- **Gerações isoladas & proteção contra itens/runas removidos:** catálogo e ícones são versionados por patch; em caso de runa removida ou item inválido para Summoner's Rift, o app exibe **Revisão necessária** sem substituição silenciosa nem reaproveitamento de imagem antiga. Em falha de rede/validação, preserva a última versão válida offline.
- **Perfis versionados separadamente:**
  - `src/engine/championTactics.ts` (`TACTICAL_DATA_META`)
  - `src/engine/buildProfiles.ts` (`BUILD_DATA_META`)
  - `src/engine/tacticalMemory.ts` (`TACTICAL_MEMORY_META`)
- Em **Configurações → Dados**, você vê o patch do catálogo BR, o patch em que builds/runas foram revisadas, a contagem de ícones em cache offline e o botão **Atualizar Data Dragon (pt_BR)**.
- Para atualizar o snapshot e o cache embutido em novos patches:
  ```bash
  npm run sync:ddragon
  npm test
  ```

---

## Política da Riot e Limitações Conhecidas

Leia detalhes completos em [`docs/RIOT_POLICY.md`](docs/RIOT_POLICY.md). Resumo:
- **Zero automação e zero leitura em tempo real:** o cartão em partida exibe apenas o plano congelado antes do jogo; não usa `Live Client Data`, não lê memória, não exige privilégios de administrador e não desativa o Vanguard.
- **Anonimato respeitado:** nenhuma identificação de jogadores no champion select.
- **Tela Cheia Exclusiva no Windows:** o DirectX em modo Tela Cheia Exclusiva oculta janelas desktop sobrepostas. Para usar o cartão sobre o jogo, coloque o LoL em **Janela sem Bordas** ou arraste o cartão para um **segundo monitor**.
- **Riot Match-V5 opcional:** exige chave própria da Riot API (armazenada apenas em memória ou criptografada via `safeStorage` do Windows, nunca no Git) e não fornece posição exata de wave, tempo parado no mato nem ganks sem abate — por isso a API preenche apenas um esqueleto parcial para o jogador revisar manualmente.
