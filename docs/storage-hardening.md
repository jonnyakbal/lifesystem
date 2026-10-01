# Exclusão de gravações por coleção

As operações mutáveis de `src/lib/storage/index.ts` protegem a sequência ler → alterar → renomear com uma trava por diretório real de dados e coleção. A fila em memória usa esse mesmo caminho, e `AsyncLocalStorage` conserva o diretório capturado durante toda a transação. Coleções iguais em diretórios distintos continuam independentes. A trava no disco usa `.<coleção>.lock`; tarefas conservam `.tasks.lock`.

O arquivo `owner.json` registra um token aleatório, PID e hostname. O heartbeat atualiza a data do diretório a cada segundo. Antes da gravação e de cada tentativa de rename, o escritor confirma que ainda possui a trava. Ao liberar, só remove os arquivos se o token continuar sendo seu. Uma falha no callback não grava o array modificado e libera a trava.

A recuperação automática exige simultaneamente heartbeat com mais de 60 segundos, dono identificado no mesmo hostname e PID comprovadamente inexistente (`ESRCH`). Um processo local vivo conserva a trava mesmo se bloquear seu event loop por mais de 60 segundos. Permissão negada para consultar o PID, PID reutilizado, dono estrangeiro, arquivo ausente ou metadados ilegíveis não autorizam remoção. A espera por uma trava no disco termina em aproximadamente 10 segundos e devolve erro para permitir repetição pelo chamador.

Recuperadores concorrentes disputam `.<coleção>.lock.reclaim`. O vencedor relê o token e a idade dentro desse guard antes de remover a trava abandonada; assim, um recuperador atrasado não remove o sucessor. O guard nunca é roubado automaticamente. **Se um processo cair durante a recuperação, um guard abandonado pode impedir recuperações futuras e exige limpeza manual.** Ele não impede a aquisição de uma trava cujo diretório já foi removido.

Para manutenção manual, suspenda todos os escritores que compartilham o diretório, confira o hostname/PID do `owner.json` e confirme que o dono terminou. Só então remova a trava abandonada e seu guard `.reclaim`, preservando os arquivos JSON das coleções, e reative os escritores. A mesma manutenção é necessária para travas antigas sem `owner.json`. Não remova locks apenas porque o timestamp é antigo.

Nomes de coleção permitem 1–128 caracteres ASCII alfanuméricos, `_` e `-`, com primeiro caractere alfanumérico; nomes reservados de dispositivo do Windows são recusados. Separadores, `.` e caminhos absolutos ou relativos são recusados antes do acesso ao disco.

## Limites

- O protocolo pressupõe processos cooperantes no mesmo host e namespace de PID, com um sistema de arquivos que fornece `mkdir` e rename atômicos. Não é um lock distribuído para máquinas distintas, containers com namespaces diferentes ou storage remoto.
- Atualize todos os escritores juntos: um binário antigo que remove `.tasks.lock` usando apenas mtime não participa do protocolo de ownership novo.
- Transações são atômicas por coleção, não entre coleções. Conversão de captura continua usando identidade estável para repetir uma operação parcialmente concluída.
- Callbacks não podem adquirir recursivamente a mesma coleção; chamadas que adquirem várias coleções precisam conservar ordem consistente para evitar deadlocks.
- Rename publica um JSON completo, mas não oferece garantia de `fsync` contra perda de energia. As leituras não esperam o lock e veem a versão anterior ou a nova versão completa.
- O lock próprio do ledger de saúde e a implementação de Office permanecem separados deste armazenamento.

## Verificação

`tests/storage-concurrency.spec.ts` executa processos Node distintos sobre a implementação TypeScript real e diretórios temporários. Verifica ausência de perda de atualização em tarefas, projetos, capturas, transações financeiras e execuções recorrentes; heartbeat; processo vivo com timestamp antigo; recuperação de processo terminado; callback que lança erro; ownership substituído; diretórios independentes e validação de nomes. `tests/task-storage-lock.spec.ts` conserva a regressão de compatibilidade com `.tasks.lock`.

Execute essas specs com uma configuração Playwright sem `webServer`, sem estado de autenticação e com um worker. Não exigem servidor, navegador nem dados reais.
