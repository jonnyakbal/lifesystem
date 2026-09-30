# LIFESYSTEM — direção da interface

## Decisões de produto

- Mobile é a experiência principal. Capturar, consultar e planejar precisam funcionar por toque, sem depender de hover ou arrastar.
- Identidade astral refinada: órbitas discretas, profundidade entre superfícies e tipografia expressiva. Decoração não deve prejudicar leitura.
- LIFESYSTEM continua sendo o nome público; marca e módulos devem ser personalizáveis.
- Desktop amplia as visões e a densidade útil sem mudar o significado das ações.

## Base implementada

- Navegação agrupada com barra inferior móvel, menu completo e área segura.
- Barra lateral com largura compartilhada com o conteúdo.
- Notificações, comandos, configurações e alternância de tema acessíveis na nova navegação.
- Fontes servidas por Next Font, sem carregamento duplicado via CSS.
- Sincronização de tema entre controles, abas e preferência do sistema.
- Configuração inicial da marca e visibilidade dos destinos em `src/lib/workspace-config.ts`.

Ocultar um destino é uma preferência de apresentação. Não revoga permissões, não desativa APIs e não remove dados. A configuração de marca ainda precisa ser aplicada às demais superfícies, como login e metadados.

## Critérios da revisão por tela

- Verificar larguras de 360, 390, 768 e 1440 pixels.
- Ações principais com alvos de toque confortáveis e nomes acessíveis.
- Planejamento com tarefas sem data e alternativa ao arrastar e soltar.
- Formulários utilizáveis com teclado virtual; diálogos roláveis e com fechamento acessível.
- Estados de vazio, carregamento, falha e sucesso que orientem a próxima ação.
- Gráficos com informações disponíveis também em texto.
- Contraste nos dois temas, foco visível e respeito a movimento reduzido.

## Estado e trabalho pendente — 29/09/2026

Os smoke tests abrangem 18 rotas em desktop e mobile. O ciclo principal recebeu regressões de captura, planejamento, conclusão, revisão e recuperação de falhas. Screenshots sem erros de execução não equivalem a uma auditoria completa de contraste, teclado e acessibilidade.

Continuar claro/escuro, teclado virtual, movimento reduzido e formulários secundários. O [roadmap](ROADMAP.md) concentra prioridades; marca em login/metadados permanece pendente.

Para abertura do projeto: revisar dados de exemplo, instruções de instalação, configuração de identidade, contribuição e documentação dos módulos. Não publicar dados reais ou credenciais como exemplos.
