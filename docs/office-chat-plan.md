# Conversa na estação — desenho e plano, 01/10/2026

Objetivo autorizado: conversar com cada robô dentro do LifeSystem, com resposta real
do Hermes pessoal. Execução nesta sessão; preservar perfis, modelos gratuitos,
aprovações por domínio e isolamento da Dona Maria.

Arquitetura: fila persistente no LifeSystem, autenticada pela sessão do navegador.
A ponte na VPS pessoal busca um pedido por vez com o token do escritório já existente;
executa no mesmo lock dos canais, no perfil selecionado, e devolve o recibo/resposta.
Cada perfil tem conversa própria do escritório, separada dos outros canais, com memória
do perfil preservada. Hermes geral usa sua configuração raiz atual.

Estados: queued → claimed → running → completed/failed/interrupted. ClientId evita
duplicidade de envio. Pedido retirado da fila nunca volta automaticamente a queued.
Resultado é persistido antes da entrega e pode ser reenviado sem nova inferência.
Pedido perdido em reinício ou acima de dez minutos fica interrompido, com orientação
para conferir registros antes de repetir. Nenhum corpo de conversa vai à telemetria.

Limites: texto 6.000 caracteres, resposta 24.000, quatro pedidos pendentes, cem envios
por dia, histórico persistente até mil pedidos antes de exigir manutenção. Leituras
e escrita exigem sessão; worker exige token, instalação personal e sessão ativa.
O navegador não recebe credenciais. Nada é enviado ao WhatsApp/Telegram por este fluxo.

Plano de execução:
- [ ] Testes de deduplicação, concorrência, autenticação, transição e reinício.
- [ ] Store/API de conversa e recebimento dos comandos, sem polling causar inferência.
- [ ] Consumidor na ponte, inicializado por hook nativo gateway:startup, sob lock comum.
- [ ] Painel Conversar/Ficha por agente, histórico, envio explícito, falhas e recibos.
- [ ] Testes do consumidor, regressões da ponte, UI, build e revisão independente.
- [ ] Backup e implantação exclusiva 7faz; publicação GitHub/Hostinger; teste real no Chrome.

Ruling: as autorizações anteriores de integração e publicação, e o pedido atual,
permitem executar o plano sem repetir aprovação das mesmas ações.
