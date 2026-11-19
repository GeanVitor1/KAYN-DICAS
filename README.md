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

## O que o app entrega (4 fluxos completos)

### 1. Antes da partida — Draft rápido (`Draft`)
- Seleção rápida 5v5 com busca por teclado (normaliza acentos, setas ↑/↓, Enter, Esc), espaços vazios permitidos e troca rápida de posição para *flex picks*. Kayn já vem na Jungle aliada.
- **4 respostas no topo:**
  - **Forma:** Kayn Azul, Rhaast ou Decisão em aberto, sempre mostrando alternativa, o que inverte a escolha, confiança (`alta`/`media`/`baixa` com motivo, sem "% de vitória" inventado) e pesos explicáveis em expansão.
  - **Runas:** página completa em `pt_BR` e explicação do motivo de diferir entre Azul e Rhaast.
  - **Build (SR):** pet jungle, bota, núcleo e situacionais separados (*alvo frágil*, *frontline inimiga*, *sobrevivência*, *armadura adversária*, *excesso de cura* e *excesso de escudos*) usando apenas itens válidos no mapa 11.
  - **Lanes & Farm:** separa a **1ª janela de gank**, a **melhor lane para jogar em torno** e um **plano de farm** alternativo, com duas frases curtas determinísticas para Top, Mid e Bot (a Bot nunca ganha prioridade automática sem setup e condições).
- **Regra de desempate pelo Azul:** só decide drafts na faixa equilibrada — nunca mascara uma composição claramente favorável ao Rhaast.
- **Mecânica de orbes da Foice Darkin:** considera a diferença entre forma mais forte na comp e forma mais fácil de desbloquear primeiro, além do bloqueio de 4 minutos (-5s por orbe do tipo desejado).

### 2. Aba **Aprender** — Macro e Micro (CaiozeraLoL & Karasmai)
- **Como abrir:** clique na aba **Aprender** na barra superior do app.
- **Filtros e organização:** filtre por **Criador** (`CaiozeraLoL`, `Karasmai` ou `Exercícios de Modo Treino`), **Assunto** (`Macro` ou `Micro`) e **Forma** (`Kayn Base`, `Kayn Azul`, `Rhaast` ou `Ambas`). O CaiozeraLoL aparece no topo por padrão.
- **Transparência de evidência:** o app separa explicitamente trechos **`Verificado (legenda + visual)`**, **`Análise visual (fala não verificada)`**, **`Exercício de treino`** e **`Referência histórica`** (ex.: vídeos da Season 13 marcados para não misturar itens antigos). Termos em inglês do Karasmai (`shove`, `skip camp`, `hover`, `flank`) são resumidos e explicados em português.
- **Fixar combos no Cartão Pré-Jogo (até 3):** em qualquer cartão de **Micro** pronto, clique em **Fixar no cartão**; depois, na aba **Draft**, clique em **Salvar plano pré-jogo** para congelar esses combos (forma, sequência de teclas, condição de uso e habilidade a guardar) na janela compacta offline.
- **Cadastrar vídeo e timestamp manualmente:** abra a seção expansível **Fontes pendentes de curadoria & Cadastro manual de vídeo** no final da aba **Aprender**, preencha título, URL `https://...`, timestamp (`MM:SS` ou segundos), criador, assunto e forma e clique em **Cadastrar como fonte pendente** (tudo é salvo localmente e fica isolado das lições prontas).

### 3. Durante a partida — Cartão Pré-Jogo Estático (`Abrir cartão`)
- Janela compacta separada, sem som, com opção **Sempre no topo**, **Opacidade regulável**, **Clique atravessado** (destravável com `Ctrl+Shift+L`), atalho global configurável (`Ctrl+Shift+K` por padrão) para mostrar/esconder e posição/tamanho persistidos longe do minimapa.
- Congela uma cópia estática ao clicar em **Salvar plano pré-jogo**, incluindo runas, núcleo, condições das lanes, até 3 combos fixados da aba Aprender, lembretes e um mapa esquemático estático original.

### 4. Treino de decisões (`Treino`)
- Simulador offline independente da interface e do cartão para comparar **Objetivo**, **Gank Bot**, **Outra Lane**, **Rota de Farm** e **Reset**, incluindo cenários derivados das lições verificadas do CaiozeraLoL e Karasmai e modo de testar sua escolha antes de revelar a análise.
- Separa explicitamente **CS de lane** e **campos da jungle**, distingue **Estado Observado**, **Hipóteses** e **Dados Desconhecidos** (com decisões condicionais quando faltam dados), e traz cenários Diamante prontos.

### 5. Revisão pós-jogo (`Revisão`)
- Fluxo manual completo + importação/exportação em JSON local ([formato documentado](docs/REVIEW_JSON_FORMAT.md)) + integração opcional com **Riot Match-V5** (`americas.api.riotgames.com` para BR1).
- Analisa tentativas na Bot, não trata gank sem kill (como forçar Flash/recall rápido) como falha automática, separa **qualidade da decisão (pelas informações da hora)** de **falha de execução mecânica**, distingue resposta adversária **`[CONFIRMADO]`** vs **`[HIPÓTESE]`** (editável), permite vincular lições da aba **Aprender** para comparar o que o streamer viu antes da jogada, aponta até **3 padrões recorrentes** citando os minutos reais da timeline e define **1 foco** para as próximas partidas.

---

## Dados usados e Atualizações por Patch

- **Catálogo oficial:** Riot Data Dragon (`pt_BR`, Summoner's Rift `mapId: 11`), validado no patch **`16.23.1`** (`173` campeões, `215` itens compráveis no Summoner's Rift, `5` árvores de runas).
- **Perfis versionados separadamente:**
  - `src/engine/championTactics.ts` (`TACTICAL_DATA_META`)
  - `src/engine/buildProfiles.ts` (`BUILD_DATA_META`)
- Na tela **Configurações**, você pode clicar em **Atualizar Data Dragon (pt_BR)**. Antes de substituir o cache local, o validador (`src/engine/catalogValidator.ts`) confere esquema, idioma, mapa 11 e todos os IDs recomendados. Se falhar, mantém a última versão válida offline e avisa caso o patch do catálogo divirja do patch em que as builds foram validadas.
- Para atualizar o snapshot embutido em novos patches:
  ```bash
  npm run sync:ddragon
  npm test
  ```
  (Se algum item recomendado for removido em um patch futuro, o script falhará indicando exatamente qual ID precisa ser atualizado em `src/engine/buildProfiles.ts`.)

---

## Política da Riot e Limitações Conhecidas

Leia detalhes completos em [`docs/RIOT_POLICY.md`](docs/RIOT_POLICY.md). Resumo:
- **Zero automação e zero leitura em tempo real:** o cartão em partida exibe apenas o plano congelado antes do jogo; não usa `Live Client Data`, não lê memória, não exige privilégios de administrador e não desativa o Vanguard.
- **Anonimato respeitado:** nenhuma identificação de jogadores no champion select.
- **Tela Cheia Exclusiva no Windows:** o DirectX em modo Tela Cheia Exclusiva oculta janelas desktop sobrepostas. Para usar o cartão sobre o jogo, coloque o LoL em **Janela sem Bordas** ou arraste o cartão para um **segundo monitor**.
- **Riot Match-V5 opcional:** exige chave própria da Riot API (armazenada apenas em memória ou criptografada via `safeStorage` do Windows, nunca no Git) e não fornece posição exata de wave, tempo parado no mato nem ganks sem abate — por isso a API preenche apenas um esqueleto parcial para o jogador revisar manualmente.
