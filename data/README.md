# Dados do LIFESYSTEM

Os arquivos JSON desta pasta são dados locais privados. O Git ignora novos arquivos JSON; não os envie ao repositório. A produção deve usar `LIFESYSTEM_DATA_DIR` apontando para um diretório persistente fora da pasta do deploy.

Em uma instalação nova, execute `npm run seed:demo` se quiser começar com seis pilares genéricos. O comando recusa sobrescrever um arquivo `pillars.json` existente. Os demais dados começam vazios e são criados conforme o uso.

Os JSON já publicados no histórico remoto exigem revisão e eventual limpeza de histórico antes de anunciar o projeto como open source. Tirar arquivos do índice atual não apaga versões antigas do Git. Antes de qualquer deploy:

1. Faça backup do diretório persistente.
2. Confirme que `LIFESYSTEM_DATA_DIR` continua configurado.
3. Verifique a quantidade de tarefas e projetos após o deploy.
