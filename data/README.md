# Dados do LIFESYSTEM

Os arquivos JSON desta pasta são dados locais de desenvolvimento/seed. A produção deve usar `LIFESYSTEM_DATA_DIR` apontando para um diretório persistente fora da pasta do deploy.

Não copie dados de produção para o Git. Antes de qualquer deploy:

1. Faça backup do diretório persistente.
2. Confirme que `LIFESYSTEM_DATA_DIR` continua configurado.
3. Verifique a quantidade de tarefas e projetos após o deploy.
