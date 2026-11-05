# Apple Saúde → LifeSystem

O Apple Saúde não tem API na web: os dados só saem do iPhone. A integração usa
uma automação do app **Atalhos** (gratuito) que, uma vez por dia, lê amostras do
Saúde e envia ao LifeSystem. Decisão do Jonny em 04/11/2026: os dados **entram
direto**, marcados como medidos pelo aparelho, separados dos relatos.

## Consentimento

- Configurações → **Integrações** → *Ligar e gerar chave*. A chave aparece uma
  única vez; o servidor guarda só o hash (`apple_health_consent`).
- *Trocar chave* invalida a anterior. *Revogar* desliga o envio; o que já entrou
  continua no histórico (e pode ser corrigido em Corpo, com versão anterior).
- A chave só serve para `POST /api/health/apple`. Não lê nada, não acessa
  outras áreas e não substitui a sessão.

## O que entra

| Atalhos (Saúde) | `type` enviado | Vira em Corpo |
| --- | --- | --- |
| Análise do Sono | `sleep` (início e fim de cada trecho) | 1 registro de Sono por noite (trechos com menos de 60 min de intervalo são unidos) |
| Peso corporal | `weight` (`value` + `unit` kg ou lb) | Peso em kg |
| Água | `water` (`value` + `unit` ml, L ou fl oz) | Água em ml |
| Treinos | `workout` (`name`, início e fim) | Movimento com duração |
| Passos | `steps` (`value` por dia) | Movimento "8.432 passos", só de dias já encerrados |

Cada registro leva `origin: "device"` e fonte "Apple Saúde". Reenviar as mesmas
amostras não duplica (chave estável por amostra); se uma amostra mudar com a
mesma chave, ela é contada como conflito e **não** sobrescreve o registro.

## Formato do envio

```http
POST /api/health/apple
Authorization: Bearer ls_apple_…
Content-Type: application/json

{
  "timezone": "America/Sao_Paulo",
  "samples": [
    { "type": "sleep", "start": "2026-11-03T23:40:00-03:00", "end": "2026-11-04T02:10:00-03:00" },
    { "type": "sleep", "start": "2026-11-04T02:25:00-03:00", "end": "2026-11-04T07:05:00-03:00" },
    { "type": "weight", "start": "2026-11-04T07:30:00-03:00", "value": 72.4, "unit": "kg" },
    { "type": "water", "start": "2026-11-04T10:00:00-03:00", "value": 350, "unit": "ml" },
    { "type": "workout", "name": "Caminhada", "start": "2026-11-03T18:00:00-03:00", "end": "2026-11-03T18:40:00-03:00" },
    { "type": "steps", "start": "2026-11-03T00:00:00-03:00", "value": 8432 }
  ]
}
```

Resposta: `{ "created": 6, "duplicates": 0, "conflicts": 0, "invalid": 0 }`.
Até 5000 amostras por envio e 30 envios por hora.

## Montando o atalho no iPhone

1. App **Atalhos** → *Automação* → *Nova automação* → *Hora do dia* (ex.: 7h,
   diariamente) → *Executar imediatamente*.
2. Ação **Texto** com a chave e outra com o endereço (copiados de Configurações →
   Integrações). Guarde em variáveis `Chave` e `Endereço`.
3. Para cada tipo, ação **Encontrar Amostras de Saúde**:
   - Sono: tipo *Análise do Sono*, data de início *nos últimos 2 dias*.
   - Peso, Água: *nos últimos 7 dias*.
   - Passos: *nos últimos 7 dias*, **Agrupar por: Dia** (um total por dia).
   - Treinos: *nos últimos 7 dias* (se o tipo Treino não aparecer no seu iOS,
     pule esta parte).
4. **Repetir com Cada** resultado → **Dicionário** com `type`, `start`
   (*Data de Início* formatada em ISO 8601), `end` (*Data de Término*, ISO 8601),
   `value` (*Valor*), `unit` (*Unidade*), `name` (nome do treino) →
   **Adicionar à Variável** `Amostras`.
5. **Dicionário** final: `timezone` = `America/Sao_Paulo`, `samples` = `Amostras`.
6. **Obter Conteúdo do URL**: URL = `Endereço`, método *POST*, cabeçalho
   `Authorization` = `Bearer ` + `Chave`, corpo *JSON* = dicionário do passo 5.

Mandar a janela inteira (últimos 2 ou 7 dias) todo dia é proposital: o que já
entrou é reconhecido e ignorado, e um dia que faltou é preenchido no envio
seguinte.

## Limites conhecidos

- O atalho em si não foi testado num iPhone nesta entrega; o servidor foi
  testado com envios sintéticos no formato acima.
- Passos de um dia só entram depois que o dia acaba, com o total enviado na
  primeira vez. Um total diferente para o mesmo dia vira conflito (não sobrescreve).
- O Órion lê esses registros pelas ferramentas de saúde de sempre; o campo
  `origin` passa a poder ser `"device"` além de `"self_report"`.
