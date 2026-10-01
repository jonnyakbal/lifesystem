# Publicador do escritório — Hermes pessoal

Este diretório preserva os arquivos da integração junto da branch LifeSystem. É uma atualização parcial do plugin `jonny-specialists` existente, não um plugin independente. O ambiente de desenvolvimento original fica em `C:/dev/jonny/hermes/runtime/specialists`.

- `specialist_router/office.py`: publicador opcional, fila SQLite e metadados sanitizados.
- `specialist_router/bridge.py`: ponte existente com instrumentação e classificação de falha de entrega.
- `export_office_catalog.py`: gera o catálogo a partir das fontes locais aprovadas.
- `assets/office-catalog.json`: pacote de referências e hashes; não contém o texto integral de instruções privadas.
- `tests/`: testes a executar dentro do plugin completo.

Antes de implantar, comparar `bridge.py` com a versão atual do plugin e preservar alterações posteriores. Os demais módulos do plugin são necessários e não devem ser substituídos ou apagados. Os testes dependem deles.

Para gerar novamente o catálogo, usar `--source src/lib/office/catalog.json --hermes C:/dev/jonny/hermes --output integrations/hermes-office/assets/office-catalog.json`. Se mudar o bridge após a geração, gerar novamente para manter os hashes coerentes.

A ativação e recuperação estão documentadas em `docs/agent-office-delivery.md`. Nenhuma credencial de produção acompanha esta entrega. A telemetria fica desabilitada até definir URL HTTPS e token exclusivo no processo do Hermes pessoal.
