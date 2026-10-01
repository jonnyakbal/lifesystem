# Estação única — 01/10/2026

Pedido aprovado: unificar escritório e mapa em uma experiência interativa de gestão.
Preservar estética espacial sóbria, identidade dos agentes e confirmações reais de escrita.

Implementação: uma cena persistente com estação, planetas, constelações e satélites.
Tripulação/Universo são destinos de câmera, não páginas ou cenas distintas. Robô abre
ficha dentro da cena; planeta abre tarefas; pilar abre metas/tarefas. Busca e atalhos de
tripulação permanecem acessíveis. Lista é alternativa acessível quando 3D falha.

Ações nesta rodada: criar tarefas e mudar etapas via APIs já verificadas; preparar
pedido específico ao agente; acessar módulos internos e CRM externo. Não inventar
um endpoint para mandar ordens ao Hermes: telemetria atual é observação e respostas
continuam nos canais autorizados. Animação de equipe não prova execução de tarefas.

Plano: teste UI de entrada unificada e troca de foco sem desmontar canvas; adaptar
estado de seleção e câmera; integrar ficha flutuante/atalhos; testar leitura/escrita,
mobile, teclado e falhas; build webpack; integrar main sem descartar trabalho paralelo;
publicar pelo GitHub/Hostinger e verificar a interface real.
