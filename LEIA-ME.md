# Central do Marco ("Jarvis")

Uma tela só com tudo da vida pessoal e das empresas: áreas, tarefas e Google Agenda.
Construída por etapas (plano de 29/10/2026):

1. **Tela com áreas, tarefas e agenda** ← no ar: https://marcomartinssm.github.io/central/ (card no Portal)
   + **Falar com a Central** (microfone/texto → Claude) ← no ar 29/10/2026
2. E-mails → itens na área certa
3. WhatsApp (Evolution) → conversas que precisam do Marco
4. Números dos sistemas (CRM Aluguel, CRM Vendas, Resultado das Obras, Imoview)
5. Jarvis no WhatsApp: conversar e mandar executar de qualquer lugar
6. Resumo automático de manhã e à noite

## Onde está cada coisa
- Tela: `index.html` (um arquivo só, login do Supabase). Visual **"Jarvis + Vidro"**, escolhido pelo Marco em 29/10/2026:
  vidro fosco sobre luzes coloridas, núcleo de voz com anéis, relógio e linha do tempo de HUD. Fontes: Sora (texto),
  **Chakra Petch** (números e títulos) e JetBrains Mono (detalhes). As opções que ele viu estão em `opcoes/`.
  Preview no Mac: launch.json `central`, porta 8896.
- Função `central-agenda` (`supabase/functions/central-agenda/index.ts`), projeto `jgdbnkwhmesgjvsymgma`, com verify_jwt ligado.
  Ela lê o Google Agenda pelo **endereço secreto iCal** guardado em `central_config` (chave `google_ical`).
  Só o dono da Central consegue chamar a função. Ela entende eventos que se repetem, dias remarcados e eventos de dia inteiro.

## Banco (todas as tabelas com prefixo `central_`)
- `central_usuarios`: quem é dono (hoje só o Marco). A função `central_e_dono()` é usada em todas as regras de acesso.
- `central_areas`: árvore de áreas (`pai_id`). Áreas principais: Pessoal, Projetar Imóveis, Construtora, Seguralta e Estética Morgana.
  Esconder uma área é `ativo = false`, e nada é apagado.
- `central_tarefas`: título, área, dia, hora, importante, feita/feita_em, anotações.
  `origem` vale `manual` por enquanto; nas próximas etapas virá `email`, `whatsapp` ou `claude`.
- `central_config`: a tela não acessa direto. Salvar o link da agenda é feito pela RPC `central_agenda_salvar_link`.

O antigo "Gestão Pessoal" (tabelas empresas/setores/projetos/tarefas/atividades) **não foi mexido**.
Foi decisão do Marco começar do zero.

## Falar com a Central (microfone)
- Barra no topo da tela. 🎤 usa o reconhecimento de voz do navegador (pt-BR, grátis); onde não existe, use o 🎤 do teclado na caixa.
  Ao parar de falar, envia sozinho; a resposta aparece e é falada em voz alta.
- Função `central-comando` (verify_jwt ligado, só o dono): monta o contexto (áreas, tarefas abertas + feitas há 2 dias,
  Google Agenda pela `central-agenda`) e pede ao Claude (`claude-opus-5-5`, effort low, chave `ANTHROPIC_API_KEY` dos secrets)
  uma lista de ações: **criar, concluir, reabrir, alterar**. **Apagar não é feito por voz.** A função confere ids, datas e horas antes de gravar.
  Tarefas criadas assim ficam com `origem = claude`.
- Histórico de cada pedido (texto, resposta, ações, erro, custo em US$): tabela `central_comandos`.
- `central-comando-teste` foi só para teste e está desativada (responde 410). Pode ser apagada no painel do Supabase.
