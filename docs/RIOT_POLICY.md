# Política da Riot Games e Limites do Produto — KAYN-DICAS

Este documento registra como o **KAYN-DICAS** respeita a documentação oficial da Riot Games e as Políticas Gerais para Desenvolvedores (`developer.riotgames.com/docs/lol` e artigo `22698591841939-General-Policies`):

## 1. Separação estrita em três momentos

1. **Antes da partida (Draft):** análise manual da composição visível/informada pelo jogador. Não tenta identificar jogadores anônimos em champion select nem faz scraping de dados protegidos.
2. **Durante a partida (Cartão Pré-Jogo):** exibe exclusivamente uma cópia congelada (`FrozenPreGameCard`) do plano definido antes de a partida começar.
   - Sem comunicação com `Live Client Data` (`127.0.0.1:2999`).
   - Sem leitura de memória do processo do League of Legends, sem injeção de DLL/código, sem necessidade de rodar como administrador ou alterar o Vanguard.
   - Sem alertas sonoros, sem temporizadores de feitiços/ultimates adversárias, sem marcações dinâmicas de minimapa e sem recalcular "o próximo movimento" com base no estado ao vivo.
   - O desenho esquemático (`TacticalMapSvg`) ilustra apenas a rota planejada pré-jogo de maneira estática.
3. **Fora da partida ativa (Treino e Revisão Pós-Jogo):** toda lógica interativa de decisão (Dragão vs gank vs farm vs reset) e análise da timeline roda isoladamente fora do cartão e fora de partidas ao vivo.

## 2. Privacidade e fontes de dados

- **Data Dragon oficial (`pt_BR`, Map 11):** usado como catálogo estático de campeões, itens compráveis e runas (não como métrica de taxa de vitória).
- **Persistência local:** drafts, cenários de treino, revisões e preferências são armazenados somente no diretório `userData` do usuário no Windows. Nenhum histórico é enviado a servidores externos por padrão.
- **Riot Match-V5 opcional:** se o usuário optar por informar sua própria chave da Riot API na aba Revisão, as requisições usam o roteamento oficial `americas.api.riotgames.com` para o servidor BR1, sempre fora de partida ativa, e jamais salvam tokens no repositório Git. Todo o app funciona 100% offline sem chave ou conexão.

## 3. Nota sobre vídeo no Windows

No Windows, jogos em **Tela Cheia Exclusiva** assumem controle exclusivo da saída de vídeo e ocultam janelas desktop sobrepostas. Para manter o cartão pré-jogo visível durante a partida, configure o League of Legends em **Janela sem Bordas** ou posicione o cartão em um **segundo monitor**.
