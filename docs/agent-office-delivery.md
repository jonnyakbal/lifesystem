# Escritório 3D dos agentes

Implementação na branch `feat/agent-office`, worktree `C:/dev/jonny/lifesystem-agent-office`. Esta entrega não foi publicada no LifeSystem nem ativada na VPS.

## O que entra no LifeSystem

- Rota `/escritorio` com seis personagens originais, seleção 3D/lista, fichas de princípios, skills, fontes e ações.
- GET `/api/hermes/office`, autenticado pela sessão do usuário inclusive em desenvolvimento.
- POST `/api/hermes/office/sessions` e `/events`, com credencial exclusiva, validação estrita, limites e persistência atômica com trava entre processos.
- Catálogo local apresentado explicitamente como referência até receber metadados da instalação. Ações e implantação não são confirmadas por estarem descritas em um arquivo.
- Nenhum comando de execução é enviado pela página; exemplos de pedidos apenas copiam texto.

## Ativação após integrar e publicar a branch

1. Revisar e integrar a branch junto das mudanças da sessão LifeSystem. Preservar `next build --webpack`; o push para main dispara deploy Hostinger e exige verificação pública independente.
2. No ambiente do LifeSystem, configurar `HERMES_OFFICE_TOKEN` com um segredo exclusivo de pelo menos 32 caracteres e `HERMES_OFFICE_INSTALLATION_ID=personal`. Não usar a chave geral do MCP. Não gravar esse segredo no Git nem em mensagens.
3. Preparar a atualização do plugin pessoal a partir de `C:/dev/jonny/hermes/runtime/specialists`: `specialist_router/office.py` novo e `bridge.py` atualizado. Preservar o plugin atual em backup antes da substituição e manter os outros arquivos. Não alterar o contêiner Dona Maria.
4. Gerar o catálogo usando `export_office_catalog.py`, com `--source` apontando para `src/lib/office/catalog.json`, `--hermes` para a pasta local Hermes e `--output` para o arquivo de publicação. Instalar em `/opt/data/specialists/office-catalog.json`. O exportador usa apenas fontes aprovadas e hashes, sem ler credenciais.
5. No ambiente do gateway pessoal, configurar `HERMES_OFFICE_URL=https://lifesystem.oj0nny.com/api/hermes/office` (confirmar o domínio efetivamente publicado antes de ativar) e o mesmo `HERMES_OFFICE_TOKEN`. Variáveis precisam estar presentes no processo do gateway; editar um arquivo sem reiniciar não as aplica automaticamente.
6. Reiniciar apenas o gateway pessoal em janela sem atendimento ativo. Sem variáveis, o publicador permanece desabilitado. Verificar logs sanitizados e resposta dos endpoints antes de chamar o estado de conectado.
7. Abrir `/escritorio`; enviar um pedido autorizado pelo canal pessoal; confirmar fila, execução e término no agente correspondente. Interromper a publicação temporariamente e verificar desatualização após 90 segundos; reconectar e verificar o retrato atual.

O catálogo exportado aponta para arquivos relativos a `/opt/data`. Se algum hash ou caminho divergir, a UI continua dizendo que a implantação não foi confirmada. Ajustar a origem por comparação com o arquivo aprovado; nunca trocar o hash apenas para remover o aviso. O briefing Arco é esperado em `documentation/personal-specialists/briefings/cosmo-arco-conteudo.md`; sua ausência não impede telemetria, mas impede atestar o catálogo inteiro.

## Recuperação e limites

Remover as duas variáveis `HERMES_OFFICE_*` do gateway e reiniciar desativa o publicador; restaurar o backup de `bridge.py` retira a integração. A aplicação continua atendendo independentemente do escritório. Uma falha na publicação não repete tarefas.

Snapshots pendentes são substituídos e enviados antes do histórico. Após reinício, somente términos pendentes são reapresentados na nova sessão de transporte, mantendo runId e horário original; registros transitórios são descartados com indicação de lacuna. O servidor não usa distância numérica entre sequências para descartar históricos recentes, e deduplica términos por identidade.

Persistência própria em `LIFESYSTEM_DATA_DIR/office-<hash>.json`, outbox em `/opt/data/specialists/office.sqlite`. A trava usa `proper-lockfile`; manter essa pasta em armazenamento que suporte mkdir/rename atômicos e compartilhado pelos workers do mesmo deploy. A UI mostra “estado desatualizado” quando não há sinal recente; não declara offline por mero silêncio.

## Validação

Validação local concluída em 30/09/2026: 9 testes de contrato/API, 2 testes de interface e 59 testes Python (1 ignorado por depender de POSIX no Windows). TypeScript, lint dos arquivos alterados e build de produção webpack passaram. A revisão independente resultou em correções de recuperação após desconexão/reinício e de classificação de falhas de entrega, cobertas por regressões.

O pacote versionado do publicador está em `integrations/hermes-office`; é uma atualização parcial do plugin existente. A cena foi inspecionada em desktop e celular com dados fictícios. O desempenho de 30 fps na máquina em uso e a integração real com WhatsApp/VPS ainda não foram aferidos.

```powershell
npx playwright test --config playwright.office.config.ts
npx playwright test --config playwright.office-ui.config.ts
npx tsc --noEmit
npm run build
```

Os testes UI usam servidor isolado na porta 4185 e dados fictícios em `.office-test-data`, ignorada pelo Git. Eles não acessam WhatsApp ou registros reais. Capturas ficam em `test-results/office-desktop.png` e `office-mobile.png` quando essa suite termina; outras execuções Playwright podem limpar a pasta de resultados.

A inclusão de tipos Three.js torna `React.ElementType` amplo demais para os ícones da paleta existente. A alteração em `command-palette.tsx` restringe somente os três campos `icon` a `LucideIcon`, preservando comportamento.

O audit de instalação apontou vulnerabilidades em dependências já existentes (incluindo Next 16.3.5). Não houve atualização ampla do framework nesta funcionalidade; a sessão responsável pelo LifeSystem deve tratar a atualização de segurança e verificar o deploy correspondente.
