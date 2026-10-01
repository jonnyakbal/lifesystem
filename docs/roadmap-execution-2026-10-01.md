# Execução incremental do roadmap — 01/10/2026

Pedido: executar todas as pendências e expansões descritas no roadmap. Base isolada `b1cf1af`, incluindo o trabalho recente do Escritório; preservar o servidor pessoal e os dados existentes. Publicação posterior segue o canal GitHub/Hostinger e exige verificação da versão servida. Não modificar Hermes/Arco CRM nesta sessão; preparar e testar os contratos do LifeSystem. Reescrita pública do histórico somente depois de revisão da candidata concreta.

- [x] CI: servidor de produção isolado, autenticação sintética coerente, estado de sessão e suíte completa sem mascarar falhas.
- [x] Recorrência: geração no servidor, ID determinístico por ocorrência de origem e vínculo persistente; retries, reinício, reabertura e concorrência não duplicam.
- [x] Storage: exclusão entre processos em todas as coleções, dono/heartbeat e rejeição de caminhos inválidos; gravações atômicas existentes preservadas.
- [x] Backup: restauração verificada apenas em destino vazio e isolado, fixtures sintéticas e detecção de corrupção/traversal.
- [x] Preparação de privacidade: inventário/scanner redigido e candidata atualizada, sem publicar backups nem reescrever refs remotos nesta preparação.
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
## Publicação verificada

Commit de aplicação `8328c67270527c7e424f464a7c25110e9c2d6846` enviado por push normal para `main`. Em 01/10, hPanel mostrou esse SHA como **Concluído / Atual**. A aplicação pública autenticada apresentou **Configurar capacidade**, início/fim/dias/fuso da jornada e comparação de esforço em Carga. O formulário Nova Tarefa mostrou **Estrutura e esforço**, tarefa principal, dependências e minutos; foi cancelado sem criar ou alterar registros. As provas locais de recorrência/concorrência usam somente fixtures sintéticas.

A preparação privada de privacidade foi atualizada para esse commit, com bundles verificados e 460 arquivos retidos idênticos; a candidata não foi aplicada ao remoto. A ativação real dos agentes, a revisão integral de conteúdo histórico e a implementação das fases futuras de agenda continuam pendentes. Assim, os checkboxes acima marcam as entregas desta rodada, não todo o roadmap como encerrado.

CI GitHub desta aplicação: https://github.com/jonnyakbal/lifesystem/actions/runs/36914635779. Tipos, lint e build concluíram; o resultado da suíte remota será registrado após seu término, separado do deploy confirmado.
Atualização da CI: o run `36914635779` terminou com 184 testes de domínio aprovados e 168 falhas de inicialização do Chromium. O executável era procurado no cache temporário da aplicação, diferente do cache da instalação. A correção preserva o cache original do runner e mantém dados/cache do servidor isolados; quatro testes do setup e 14 testes de interface passaram depois do ajuste (19.2s), sem retries. Tipos passaram novamente. Uma nova execução integral remota será conferida após o push da correção; a release de aplicação acima continua certificada independentemente dessa falha de infraestrutura de teste.
Confirmação final da CI: [run 36917946053](https://github.com/jonnyakbal/lifesystem/actions/runs/36917946053), commit `4ee554537c9f8dc2d80f8c4441bde58428ddf4f6`, terminou **completed / success**. A API oficial confirmou sucesso em autenticação sintética, tipos, lint, build, instalação do Chromium e suíte completa; nenhuma seleção de testes ou retry foi adicionada para obter esse resultado. A documentação posterior conserva o código de aplicação da entrega certificada em `8328c67`.