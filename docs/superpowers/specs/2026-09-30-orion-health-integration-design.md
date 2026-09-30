# Órion — integração pessoal de saúde

O LifeSystem é a fonte de verdade do histórico pessoal; o Órion é cliente MCP de escopo mínimo. Nenhum dado do briefing privado é inicializado, migrado ou publicado. O modelo não transforma relato sem data em observação atual, nem planejamento em realização.

## Corte incremental

1. **Histórico e governança.** Um ledger `health-ledger.json` separado dos indicadores e do ledger profissional contém observações versionadas, propostas, aprovações e recibos. A interface humana lê a mesma camada. O MCP só consulta e propõe; aplicar escrita exige proposta exata aprovada por sessão web autenticada. `record_health_observation` e `correct_health_observation` são atalhos para aplicar uma proposta aprovada do tipo certo, não aceitam `human: true`.
2. **Contexto e rotina.** Contexto explicitamente informado, objetivos e preferências serão versionados pelo mesmo mecanismo de proposta. Ausência de dado aparece como desconhecido, não como resposta negativa. A tela permite revisão.
3. **Integração de ações.** Tarefas e agenda de saúde usam IDs reais e os fluxos atuais de `tasks`/`plan_task_block`, com propostas próprias e checagem de conflitos. Não criar um segundo endpoint de Google Calendar nem conclusão automática de treino. O brief diário deve reportar agenda indisponível em falha. Esta etapa depende de testes de recuperação de operação parcialmente concluída.

## Contrato de observação

Tipos iniciais: `sleep`, `weight`, `water`, `meal`, `movement`, `energy`, `stress`. Todos exigem `observedAt` datado com fuso, `timezone`, ator e chave de idempotência. Sono aceita início e/ou fim, mas duração só se ambos estiverem presentes. Peso exige kg e instante real. Água é evento em ml. Movimento é realização autorrelatada; meta ou evento não a comprovam. Energia/estresse são escalas subjetivas 0–10. Correção exige ID, revisão esperada e motivo, conserva versões anteriores. Não deduplicar por texto ou valor: somente a mesma chave e o mesmo fingerprint representam retransmissão.

O ledger é transacionado em uma gravação atômica por operação, protegida entre processos por lock de diretório. Receipt e mudança persistem juntos. Chave reaproveitada com outra operação ou payload retorna conflito. Lista paginada por posição estável `(recordedAt,id)`; resumo calcula apenas amostras existentes e declara cobertura.

## Aprovação e escopos

Proposta fixa operação, alvo, revisão esperada, payload, hash, ator e validade. O endpoint de aprovação verifica cookie de sessão e origem; ferramenta MCP nenhuma aprova. Alteração posterior do payload, revisão ou expiração invalida aplicação. Não há consentimento recorrente ativo. `health:read` permite consultas; `health:propose` permite preparar; `health:apply` aplica apenas propostas aprovadas. `health:only` impede ferramentas de outros domínios. Chave legada `MCP_API_KEY`, ainda que tenha `*`, não recebe saúde. Uma chave dedicada em `MCP_API_KEYS` será necessária para o Órion; não configurá-la nem compartilhar seu valor nesta mudança.

Logs MCP registram ferramenta/resultado, nunca corpo de observação ou perfil. Nenhuma leitura/escrita de CRM, finanças, Hermes, agendamento de mensagem ou cron de saúde é parte deste corte.
