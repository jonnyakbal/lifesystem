# Estação orbital — revisão interativa

Direção escolhida por Jonny em 30/09/2026: estação espacial sóbria, robôs técnicos e atmosfera de missão científica. A revisão mantém a página, fichas, permissões e contrato de telemetria existentes; substitui a cena de escritório convencional.

## Interações

- Selecionar um robô ou console aproxima a câmera e abre sua ficha. A lista HTML continua disponível.
- Visão geral reposiciona a câmera sem destruir/recriar o contexto WebGL.
- Passeio orbital gira a câmera; arrastar, aproximar e deslocar a visão continuam disponíveis.
- Reunir equipe desloca os robôs livres à mesa central. Robôs com execução real registrada permanecem em sua estação.
- Cumprimentar mostra uma fala escrita para a personalidade e um gesto animado; não chama o modelo nem envia mensagem.
- Holograma central e Mudar órbita alternam a ambientação planetária.
- Ampliar estação abre uma visão com controles e seleção de tripulação acessíveis por teclado, retenção de foco, Escape e retorno do foco.
- Pausar interrompe a animação contínua; movimento reduzido e aba/cena fora de vista também suspendem o movimento. A interface permanece utilizável.

## Identidades visuais

Hermes tem carenagem clara e antena circular de coordenação; Vega tem base de esteiras, visor de análise e movimentos contidos; Sirius tem estrutura estreita e antena de operações; Órion tem estrutura reforçada e módulo de biossistemas; Astro tem conjunto óptico telescópico e movimentos lentos; Cosmo tem módulos laterais e ferramenta de precisão, com gestos mais expressivos. Cada um conserva nome, domínio e fontes da ficha existente.

## Limite entre ambientação e operação

Movimentos, encontros, gestos, hologramas e falas predefinidas são ambientação, identificada na própria cena. Eles não registram tarefas, alteram status real ou representam mensagens entre LLMs. A presença operacional continua vindo exclusivamente da API autenticada. A conexão real à VPS continua sendo uma etapa separada da publicação visual.

## Implementação e verificação

Three.js / React Three Fiber já instalados, sem novas dependências ou assets externos. Cenário procedural dividido em modelo de movimento, peças, robôs, mundo e controle de câmera. Texturas de rótulos são descartadas no teardown; o listener de perda de contexto também é removido. Resolução limitada a 1,5x; fundo estelar em uma única nuvem de pontos; sem sombras dinâmicas caras.

Testes UI cobrem reunião, saudação sem POST, pausa, expansão, seleção por teclado, Escape, perda de contexto sem scroll preso, redução de movimento, desktop/mobile e presença recebida da API. A inspeção visual complementa esses testes; não representa benchmark de fps no computador de Jonny.

Verificação local: 4 testes UI passaram; TypeScript, lint dos componentes e build de produção Webpack passaram. Revisão independente concluída, com correções de foco e rolagem na expansão. O teste visual também identificou e confirmou a correção do reenquadramento sem remontar o canvas. Capturas estão em `C:/dev/jonny/hermes/entregas/escritorio-3d/orbital-expanded.png` e `orbital-mobile.png`.


## Atlas pessoal — 01/10/2026

A expansão aprovada acrescenta o modo **Mapa estelar**, preservando a estação da tripulação e a lista. Projetos reais aparecem como planetas, pilares como constelações e seis ferramentas como satélites. Diretório pesquisável e filtros mantêm todos os destinos acessíveis; a cena limita corpos simultâneos para preservar legibilidade e inclui sempre a seleção.

Selecionar um corpo aproxima a câmera e abre seu painel dentro da navegação. Projetos e pilares usam dados atuais de `/api/projects`, `/api/pillars`, `/api/tasks` e a configuração real das etapas. O painel mostra contexto, progresso e tarefas; permite criar uma tarefa vinculada e mudar sua etapa. A confirmação depende do recibo do servidor, sem alteração otimista, envio automático ou retry. Uma atualização iniciada antes da escrita não pode apagar da tela o recibo confirmado depois dela. Em resposta ambígua, o painel orienta conferir os dados antes de repetir.

Agenda, conteúdo, financeiro, capturas e Hermes oferecem acesso aos módulos completos; Arco Leads abre o CRM existente em outra aba. Esta entrega não implementa integração MCP comercial nem cria um segundo CRM. Movimentos dos robôs continuam sendo ambientação; presença vem da telemetria real.

A navegação possui movimento reduzido, pausa, recuperação sem WebGL, diretório por teclado e painéis empilhados no celular. Expansão retém foco e admite Escape; seu scrollport foi testado em 600×390. Trocar de aba não desmonta o formulário. Não há dependências novas.

Validação: sete casos UI distintos passaram (suíte de seis e rodada final de três testes do mapa), incluindo tarefas com etapas personalizadas, criação vinculada, erro de leitura, erro de gravação sem repetição, corrida entre refresh e recibo, Lista→Mapa, desktop/mobile, expansão, perda de contexto e presença real na API local. Dados de teste são sintéticos; nenhuma tarefa pessoal foi criada nesses testes. TypeScript e lint dos arquivos alterados passaram. A revisão independente encontrou e confirmou correções de foco, renderização e concorrência. Capturas 3D foram inspecionadas após o canvas carregar. Após integrar o main com as novas telas de tarefas, o build Webpack passou e a suíte completa do Escritório passou contra `next start`: **16 testes, 40,3 segundos, sem retries**. Execute com `OFFICE_UI_PRODUCTION=1 npx playwright test --config playwright.office-ui.config.ts` após o build. A publicação será registrada no recibo de entrega.
