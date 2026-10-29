# Central do Marco ("Jarvis")

Uma tela só com tudo da vida pessoal e das empresas: áreas, tarefas e Google Agenda.
Construída por etapas (plano de 29/10/2026):

1. **Tela com áreas, tarefas e agenda** ← pronta (falta publicar)
2. E-mails → itens na área certa
3. WhatsApp (Evolution) → conversas que precisam do Marco
4. Números dos sistemas (CRM Aluguel, CRM Vendas, Resultado das Obras, Imoview)
5. Jarvis no WhatsApp: conversar e mandar executar de qualquer lugar
6. Resumo automático de manhã e à noite

## Onde está cada coisa
- Tela: `index.html` (um arquivo só, login do Supabase, mesmo visual do CRM Aluguel).
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
