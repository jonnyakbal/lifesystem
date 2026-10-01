# Execução incremental do roadmap — 01/10/2026

Pedido: executar todas as pendências e expansões descritas no roadmap. Base isolada `b1cf1af`, incluindo o trabalho recente do Escritório; preservar o servidor pessoal e os dados existentes. Publicação posterior segue o canal GitHub/Hostinger e exige verificação da versão servida. Não modificar Hermes/Arco CRM nesta sessão; preparar e testar os contratos do LifeSystem. Reescrita pública do histórico somente depois de revisão da candidata concreta.

- [x] CI: servidor de produção isolado, autenticação sintética coerente, estado de sessão e suíte completa sem mascarar falhas.
- [x] Recorrência: geração no servidor, ID determinístico por ocorrência de origem e vínculo persistente; retries, reinício, reabertura e concorrência não duplicam.
- [x] Storage: exclusão entre processos em todas as coleções, dono/heartbeat e rejeição de caminhos inválidos; gravações atômicas existentes preservadas.
- [x] Backup: restauração verificada apenas em destino vazio e isolado, fixtures sintéticas e detecção de corrupção/traversal.
- [ ] Privacidade: inventário/scanner redigido e candidata atualizada, sem publicar backups nem reescrever refs remotos nesta preparação.
- [x] Produtividade: subtarefas e dependências validadas, estimativas opcionais e capacidade configurável; evitar inferir esforço de tarefas sem estimativa.
- [x] Integrações: diagnósticos e piloto dos contratos Órion/Sirius com propostas, aprovação humana e recibos, sem autoaprovação ou dados reais de teste.
- [x] Acabamento: lint, teclado/acessibilidade, login/metadados/PWA coerentes com configurações públicas.
- [x] Especificação das expansões de agenda: contratos explícitos para múltiplos blocos/agendas e projeções editorial/financeira, sem criação ou sincronização silenciosa.

Cada item termina com testes relevantes, tipos/lint/build e registro de evidências reais; resultado parcial não é marcado como roadmap concluído. Falhas anteriores da CI serão distinguidas das novas. Arquivos de QA e seus diretórios de dados ficam fora do Git.

## Validação local final

O trabalho do Escritório em `117ed3c96cd7f6205eaaa7d319e1d47c4c2b7b4a` foi incorporado por fast-forward antes da verificação final. O servidor pessoal existente não foi reutilizado ou interrompido.

- `node node_modules/@playwright/test/cli.js test --config=playwright.ci.config.ts`: **352 passed (8.7m)**, 1 worker, zero retries, servidor de produção e armazenamento sintético isolados; exit 0.
- `node --test scripts/playwright-ci-setup.test.mjs`: **3 testes passaram**.
- `tsc --noEmit`: exit 0.
- `npm run lint -- --max-warnings=0`: exit 0, zero erros/avisos.
- `npm run build` com Webpack e diretórios de build isolados: exit 0.
- `npm audit --audit-level=low`: **found 0 vulnerabilities**, exit 0.

A primeira execução integral encontrou duas falhas: hidratação da frase de abertura com mudança de data entre servidor e navegador, e expectativa antiga do formato de horário da jornada. A frase inicial agora é estável durante o carregamento; o teste de agenda usa preferências sintéticas explícitas e confere o formato vigente. A suíte completa foi executada novamente, sem excluir os casos.

Evidências locais ficam em `C:/dev/jonny/lifesystem-task-qa-evidence/roadmap-final-{suite,types,lint,build}.log` e seus arquivos `.exit`; não são artefatos públicos. Este resultado não certifica o transporte real dos agentes nem implementa os contratos futuros de agenda. O recibo da versão publicada será registrado separadamente após observar Hostinger e aplicação pública.