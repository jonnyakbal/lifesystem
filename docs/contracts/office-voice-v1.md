# Contrato proposto — voz local da estação (office-voice v1)

Estado: **proposta, não implementada**. Data: 02/10/2026. Responsável pela
implementação no Hermes: a sessão Hermes pessoal (VPS). A sessão LifeSystem não
altera o Hermes e não enviou esta proposta a outra sessão. Este documento é
o contrato a ser confirmado por ela.

## O que já existe no LifeSystem (entregue nesta branch)

- O chat de cada agente na estação tem o botão **Falar**, que transcreve pelo
  reconhecimento do navegador. No Chrome, esse serviço envia o áudio ao
  Google. Por isso ele é opcional e vem com aviso na tela. O texto preenche a
  mensagem; com "Enviar ao terminar de falar", ele é enviado uma única vez pelo
  `POST /api/hermes/office/chat` atual. Não existe outro caminho de envio.
- **Ouvir respostas** lê em voz alta, com as vozes do sistema operacional e um
  tom e ritmo por agente, as respostas que chegam depois de ativado. O
  histórico não é relido. Há também o botão **Ouvir** por mensagem.
- Na cena, o robô mostra "♪ FALANDO" e anima a cabeça enquanto a resposta é
  lida.

Nada disso muda o consumidor 1.4.0: a voz atual gera os mesmos `ChatJob` de
texto.

## Objetivo da v1

Substituir o reconhecimento do navegador e as vozes do sistema por **modelos
locais no Hermes** (por exemplo Whisper para transcrição e Piper ou Kokoro para
síntese), sem que o áudio passe por terceiros. A UI escolhe o modo local
quando o Hermes anunciar a capacidade, e volta ao modo do navegador, com
aviso, quando ele não estiver disponível.

## Anúncio da capacidade

No catálogo publicado pelo Hermes, campo opcional e ignorado por versões
anteriores:

```json
{ "voice": { "version": 1, "stt": "whisper-<modelo>", "tts": { "hermes": "<voz>", "sirius": "<voz>" }, "maxSeconds": 30, "formats": ["audio/webm;codecs=opus", "audio/ogg;codecs=opus"] } }
```

Sem `voice`, ou com versão desconhecida, a UI mantém o modo do navegador.

## Fluxo proposto (assíncrono, reutiliza a fila atual)

1. O navegador grava até `maxSeconds` (padrão 30 s) e envia
   `POST /api/hermes/office/voice` (multipart: `clientId`, `agentId`, `audio`).
   Limites: sessão humana, 2 MB, os mesmos 100 envios por dia e quatro
   pendentes do chat. O LifeSystem guarda o áudio fora do Git, com retenção
   curta (24 h).
2. O job resultante é um `ChatJob` com `input: "voice"` e `text` vazio até a
   transcrição. O `clientId` mantém a mesma idempotência do texto.
3. O consumidor reivindica o job por `/commands`, como hoje, e recebe uma URL
   de áudio de uso único e curta duração, autenticada pelo token do publisher.
   O áudio nunca fica embutido no JSON do comando.
4. O Hermes transcreve localmente e devolve `transcript` (o texto vira o
   `text` do job e aparece no chat), depois `response` (texto) e,
   opcionalmente, `audio` de resposta (opus, até 60 s), com o mesmo recibo
   idempotente atual.
5. A UI mostra a transcrição assim que chega e toca o áudio da resposta. Se só
   houver texto, usa a voz do sistema operacional.

## Regras que não mudam

- Selecionar agente, abrir ficha ou fazer polling nunca envia nem inicia
  inferência.
- Retry com o mesmo `clientId` e o mesmo áudio (hash) devolve o mesmo job;
  áudio diferente com o mesmo `clientId` é conflito.
- Job retirado da fila não volta automaticamente após reinício; um recibo
  tardio válido continua aceito.
- Não há envio para WhatsApp ou Telegram por esse fluxo.
- Uma transcrição não aprova nada: propostas Órion e Sirius continuam exigindo
  revisão e aprovação humana explícita na interface. "Sim" falado não é
  aprovação.

## "Ao vivo" (fase 2, fora da v1)

A conversa contínua, com fala interrompível, exige streaming (WebSocket ou
WebRTC) entre o navegador e o Hermes, e uma GPU para latência aceitável. Na
VPS sem GPU, a v1 assíncrona é o alvo realista. A fase 2 só deve ser
desenhada depois de medir a latência da v1 no hardware real.

## Verificação esperada da sessão Hermes

- Catálogo com `voice.version = 1` em um ambiente de teste.
- Transcrição e síntese locais sem chamada de rede externa (confirmar pelo
  firewall ou pelos logs).
- Replay do mesmo `clientId` sem nova inferência; conflito com áudio
  diferente.
- Latência medida: tempo de transcrição, tempo de resposta e tempo de síntese
  para áudios de 5 s e 30 s.

## Conversa ao vivo (03/10/2026)

Modo de voz rápido, sem as mãos, implementado na interface; o Hermes não muda.

- **Fluxo:** o usuário fala, o reconhecimento do navegador transcreve e
  `POST /api/hermes/office/live` envia `{agentId, text, history≤12}`. A
  resposta vem pela cadeia de IA do LifeSystem (`src/lib/ai.ts`, por exemplo
  Workers AI ou Groq), com a persona pública do catálogo local. A voz do
  sistema fala a resposta e o microfone reabre sozinho. Tocar enquanto o robô
  fala interrompe e passa a ouvir. Esc ou "Encerrar" termina o modo.
- **Limites:** não é o perfil Hermes. Não tem memória, ferramentas nem job na
  fila, e nada é persistido. O prompt proíbe afirmar que algo foi registrado,
  consultado, agendado ou enviado. "Mandar a última fala ao Hermes" apenas
  preenche a caixa de mensagem; o envio continua explícito.
- **Proteções:** exige sessão humana; o proxy aplica a regra de mesma origem.
  Limite de 30 falas por minuto, entrada de até 1000 caracteres e fala
  limpa de markdown e links. A interface mostra o provedor, o modelo e o
  tempo de cada resposta.
- **Voz de saída:** escolhe a melhor voz pt disponível (Natural, Neural ou
  Online primeiro, depois Google, por último as vozes locais "Desktop"), com
  uma voz diferente por tripulante quando houver várias. O tom fica próximo
  de 1 para não distorcer.
- **Ainda local futuro:** STT/TTS no Hermes continuam como descrito acima.
  Workers AI ainda não oferece TTS em português; por isso a voz depende das
  vozes do sistema (Edge "Natural" ou Chrome "Google").
