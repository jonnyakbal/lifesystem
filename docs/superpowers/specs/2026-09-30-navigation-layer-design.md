# Camada de navegação do LIFESYSTEM

## Intenção

Conectar as telas já existentes em um percurso legível. Jonny usa principalmente o mobile; precisa chegar a Hoje, Planejar, Capturas e uma ação de captura em um toque. No desktop, o menu precisa mostrar a estrutura do produto sem uma lista extensa permanente. A identidade permanece astral refinada, com movimento discreto e frases curtas ligadas ao contexto.

## Decisão

- Uma lista canônica de destinos alimenta sidebar, dock, busca por comandos, breadcrumb e sugestões dos cabeçalhos.
- O desktop mantém os destinos cotidianos à vista e organiza o restante em grupos independentes, abrindo automaticamente o grupo da página atual. A folha mobile usa a mesma arquitetura.
- O dock mobile traz Início, Hoje, Caixa de entrada, Planejar, Capturar e Explorar. Os seis alvos continuam alcançáveis em 320 px.
- O hero compartilhado oferece no máximo dois próximos destinos relevantes. A ação própria da página continua sendo a principal. Nenhum texto promocional impede o acesso às tarefas.
- O topo usa uma frase breve por percurso, estável e sem rotação aleatória. Ela dá tom sem esconder status reais ou funcionar como instrução.
- O movimento aparece na entrada do hero e em respostas de foco/hover. Respeita `prefers-reduced-motion` e não anima conteúdo operacional continuamente.

## Limites e qualidade

Preservar rotas, dados, funções de criação e atalhos existentes. Destinos ocultos por `workspaceConfig.hiddenModules` não aparecem nas sugestões. Links mantêm semântica nativa e foco de teclado. Validar menu expandido, troca de rota, dock mobile, vínculos de hero, ausência de transbordamento, lint, tipos e build em storage sintético. Trabalho local, sem publicação.
