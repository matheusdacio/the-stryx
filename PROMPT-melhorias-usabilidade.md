# Prompt: implementar as melhorias de usabilidade do The Stryx

Cole este arquivo inteiro como primeira mensagem em uma nova sessão do Claude Code aberta na pasta do projeto (`/Users/cristianodacio/Documents/the-stryx`).

---

Você vai implementar um conjunto de melhorias de usabilidade já avaliadas e **aprovadas pelo dono do app**. Não é para reavaliar nem para propor alternativas grandes: é para executar, por pacotes, com commits pequenos, e reportar ao final de cada pacote.

## Contexto do projeto

- **The Stryx**: PWA em React 19 + Vite + Firebase (Firestore em tempo real, Auth Google, FCM push via GitHub Actions em `.github/scripts/`). Feito para UMA banda amadora brasileira. UI em português do Brasil, tom informal, com piadas internas nos rótulos das escalas de voto. **Não formalize a linguagem.** Clareza sim, formalidade não.
- Público: poucos músicos, todos conhecidos. Usam no **celular**, inclusive no ensaio e no palco. Há um admin (e-mail fixo em código) com ferramentas extras.
- Telas: `/` Setlist (acervo da banda, votos de domínio por música), `/cifras`, `/ensaios` rotulado "Eventos" (presença, repertório do evento, modo palco), `/rascunhos`, `/sugestoes` (votos de opinião e dificuldade, admin envia pro setlist), `/membros` "Banda", `/import` (admin).
- Não é possível logar no app a partir da sessão (login Google). Valide com `npm run lint` e `npm run build`, e lendo o código. Onde uma mudança precisar de teste manual no celular, diga isso no relatório do pacote.

## Referência completa dos achados

O arquivo **`docs/usabilidade/achados.md`** tem o detalhe de cada item citado abaixo pelo id (F01…F105 e D01…D20): problema, impacto, evidência `caminho:linha`, sugestão original e os ajustes feitos pela verificação. **Quando um item abaixo parecer curto, leia o id lá antes de implementar.** Prefira sempre a "versão enxuta recomendada" quando ela existir.

Os números de linha foram anotados sobre a branch `feat/ordenacao-melhores-e-faceis` em commits entre `d1f6fbf` e `4a8db90` e podem estar deslocados. Localize pelo trecho com `grep -n`, não pela linha.

## Regras de trabalho

1. **Branch.** Trabalhe em `feat/ordenacao-melhores-e-faceis` (ponta atual `4a8db90`). Confira com `git branch --show-current`; o working tree pode estar em `main`. Se estiver, faça `git checkout feat/ordenacao-melhores-e-faceis` antes de qualquer coisa. Não faça merge em `main` sem o dono pedir.
2. **Um pacote por vez, na ordem abaixo.** Ao terminar um pacote: `npm run lint`, `npm run build`, commit(s), e um relatório curto no chat com o que mudou, o que ficou de fora e o que precisa ser testado no celular. Só então siga para o próximo. O dono pode interromper entre pacotes.
3. **Commits pequenos, em português, no estilo do histórico** (`feat:`, `fix:`, uma frase minúscula descrevendo o efeito para o usuário). Um commit por item ou por grupo de itens muito próximos. Atualize `CHANGELOG.md` e `src/version.js` como o repositório já faz (minor para pacote com feature visível, patch para pacote só de ajustes).
4. **Não mexa** no que está na seção "Não mexer" no fim deste arquivo.
5. **Não refatore por refatorar.** Nada de TypeScript, testes novos, troca de bibliotecas, reorganização de pastas. Se um item exigir mais do que o esforço marcado, faça a versão menor descrita e registre o resto como pendência no relatório.
6. **Decisões já tomadas** (não pergunte de novo): rótulo "✓ Aprovada" vira "No setlist"; badge de presença pendente em Eventos, sim; o remover da música sai do cabeçalho do card e vai para o rodapé do card expandido; "+ Música" continua aberto a todos, com uma linha apontando para Sugerir; o tipo Apresentação sai da família vermelha e vai para fuchsia (`#d946ef`, fundo `rgba(217,70,239,0.12)`).
7. Se encontrar algo que contradiz o que está aqui (já foi resolvido, o arquivo mudou muito, o item não faz mais sentido), **não invente**: pule, anote no relatório do pacote e siga.

## Pacote R — regressões dos commits recentes (fazer primeiro)

São achados sobre o que entrou entre `e428885` e `4a8db90`. Não passaram por verificação independente: **confirme cada um no código antes de mexer** e pule os que não se confirmarem.

- **D01** Pills de dificuldade no card do setlist renderizam `{d.short}` mas `DIFFICULTIES` em `src/utils/dificuldade.js` não tem `short`. Trocar por `d.label` ou adicionar `short` às três entradas.
- **D11** "↩ Voltar pras sugestões" não leva `songs/{id}.opinoes` de volta. No `updateDoc` da reabertura, `opinoes: fundirVotos(existentes, song.opinoes)` (helper em `src/utils/score.js`); no `addDoc` da sugestão nova, `opinoes: song.opinoes || {}`.
- **D18** `approve` em `SugestoesPage.jsx` não copia `dificuldade` para a música. Acrescentar `dificuldade: sugestao.dificuldade || {}` no `addDoc`.
- **D02 + D15** `SongCard` tem dois `<VideoInline>` (um no resumo fechado, outro na barra do card aberto), cada um com estado próprio: expandir ou recolher mata o vídeo. Subir `tocando` para o `SongCard` e renderizar um único `VideoInline` fora dos condicionais de `expanded`.
- **D08** Vários players tocam ao mesmo tempo (cards inline + "Tocar as N músicas"). Um `tocandoId` único na `SetlistPage` (id da música ou `'lista'`) passado aos cards; abrir um fecha o outro.
- **D09** Trocar filtro ou ordenação com a lista tocando muda a faixa em reprodução. Congelar a fila ao dar play (guardar `comVideo` em estado quando `tocando` liga) e limitar `idx` a `faixas.length - 1`.
- **D14** "▶ Tocar o set" continua tocando embaixo do overlay do Modo palco. Ao abrir o palco, parar o `SetPlayer`. Renderizar o `SetPlayer` logo acima da linha de botões nos dois cards de evento.
- **D04 + D05 + D12 + D13** Rejeição por veto é só calculada (`estaRejeitada`), nunca gravada. Consequências: badge do rodapé infla, planilha exporta "Em aberto", o modal da vetada mostra ao mesmo tempo o banner "Rejeitada" e o botão "➤ Enviar pro setlist", e o card da lista não mostra etiqueta. Fazer: gravar `status: 'rejeitada'` e `rejeitadaPor: 'veto'` no `submitOpinion` quando `todosVotaram && temVeto` (manter `estaRejeitada` como fallback para dados antigos); na vetada, esconder "Decisão final" e oferecer "Reabrir" no banner; na lista, usar `estaRejeitada` para a etiqueta "✕ Rejeitada" e um chip "⚠️ veto" quando `temVeto && !todosVotaram`.
- **D03** Banner "tem veto, falta gente votar" não diz quem falta. Listar primeiros nomes de `bandMembers` que não passam em `votou`, e dar classe de aviso (amarela) ao banner.
- **D06** Trava "já foi sugerida" não distingue aberta, rejeitada e aprovada. `checarDuplicata` devolve também `{ id, status, suggestedBy }` da existente e a mensagem muda conforme o status. Junto com **F70**: botão "Abrir essa" que fecha o modal de cadastro e abre o modal da sugestão existente.
- **D19** Card aberto empilha três blocos iguais de voto. Renomear "Como tá pra você?" para "Dificuldade pra tocar" e "O que você acha dessa música?" para "Vale tocar?", com um ícone distinto por bloco (🎯 / ⭐ / ✅). Isto substitui a parte de rótulos de **F46**.
- **D07** Número na bolinha do card virou só `i + 1` da ordenação. Mostrar `#N` só nas ordenações por nota/dificuldade, omitir em Recentes/Antigas, como as Sugestões já fazem.
- **D16** `.btn-tocar` parece chip informativo e o "✕ Fechar" do vídeo usa `.btn-meta-add`. Dar cor de ação ao `.btn-tocar` (▶ sólido) e criar `.btn-fechar-video` com texto "✕ Fechar vídeo". No `SetPlayer`, manter um só controle de parar.
- **D10 + D20** Barra admin da Banda com oito ferramentas e relatório de integridade com ids crus. Agrupar tudo num bloco recolhido "🛠 Manutenção" fechado por padrão, com sub-bloco "Já rodadas" para Normalizar, Migrar presença, Dificuldade e Tom; no relatório de integridade, mostrar eventos como "dd/mm · local", usar ℹ️ nos itens informativos e não escrever "…e mais N" quando o detalhe não foi cortado.
- **D17** cai no Pacote 4 (reordenação por toque no modal do evento).

## Pacote 0 — fundação (tudo pequeno, quase sem risco)

- **F09** Cache persistente: em `src/firebase/config.js`, trocar `getFirestore(app)` por `initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) })`. Depois, em cada página, iniciar as listas como `null` e mostrar `<p className="empty-state">Carregando...</p>` enquanto for `null`, em vez do estado vazio.
- **F08** Formulários fazem `setSaving(true); await addDoc/updateDoc; onClose()` sem catch. Em AddSongModal, Nova Sugestão, EnsaioModal, CifraModal, RascunhoModal, "Enviar opinião" e os Salvar do `SongCard`: disparar a gravação, fechar na hora, e `.catch(() => alert('Não deu pra salvar agora. Confere a internet e tenta de novo.'))`. Depende do cache persistente acima para não perder escrita ao fechar o app.
- **F11** `required` nos quatro inputs de título (AddSongModal, CifraModal, RascunhosPage, campo "Música" da Nova Sugestão). Não desabilitar o botão, não usar `min` na data.
- **F27 + F21 (parte 1)** `index.html`: `lang="pt-BR"`, `<title>The Stryx</title>`, `<meta name="theme-color" content="#0a0a0d">`, `<meta name="apple-mobile-web-app-capable" content="yes">`, `viewport-fit=cover`.
- **F06** `App.jsx`: `<Route path="*" element={<Navigate to="/" replace />} />`.
- **F41 + F90** `EnsaiosPage.jsx`: nos filtros de Próximos/Realizados, trocar `isPast(e.date)` por `jaPassou(e.date)` e apagar `isPast` se ficar sem uso.
- **F20** `@media (max-width: 480px) { input, select, textarea { font-size: 16px } }` e tirar o `!important` de `.cifra-textarea`.
- **F83** Wake Lock no `PerformanceMode`: `useEffect` com `navigator.wakeLock?.request('screen')` em try/catch, repetir em `visibilitychange`, `release()` no unmount.
- **F89** Bloco `@media (prefers-reduced-motion: reduce)` no fim do CSS zerando animações e transições.
- **F43** `SongCard`: criar `openMeta()` que re-semeia `tom`, `bpm`, `videoUrl`, `tags` a partir de `song` antes de `setEditingMeta(true)`; usar nos botões "✏️ Editar", "♩ + BPM" e "🎬 + vídeo". Idem `setNotes(song.notes || '')` antes de abrir observações.
- **F71** Textarea de comentário da opinião nasce vazio: iniciar com `sugestao.opinoes?.[uid]?.comment || ''` (inicializador preguiçoso no `useState`).
- **F101** `toggleEnsaiada`: usar `arrayUnion`/`arrayRemove` em vez de regravar o array. No Salvar do EnsaioModal, gravar só os campos que mudaram em relação ao objeto carregado ao abrir.

## Pacote 1 — PWA e notificações

- **F21 (parte 2) + F38** Criar `public/manifest.webmanifest` (name/short_name "The Stryx", `start_url` e `scope` em `/the-stryx/`, `display: standalone`, `background_color: #0a0a0d`, ícones 192 e 512 PNG gerados a partir de `public/favicon.svg`), linkar no `index.html` com `apple-touch-icon` de 180px. Trocar `icon: '/favicon.svg'` pela URL absoluta do PNG em `public/firebase-messaging-sw.js`, `src/hooks/useNotifications.js`, `.github/scripts/enviar-sugestoes.js` e `lembrar-eventos.js`; nos scripts, setar também `badge` com um PNG monocromático ~96px.
- **F37** `public/firebase-messaging-sw.js`: remover `onBackgroundMessage` e o `notificationclick` custom, deixando só `initializeApp` + `firebase.messaging()`. Registrar no relatório que precisa de teste em Android real.
- **F39** `useNotifications.js`: trocar `new Notification(...)` por `navigator.serviceWorker.ready.then(reg => reg.showNotification(title, { body, icon, data: { url } }))`.
- **F10** `ativar()` devolve `'ok' | 'denied' | 'error'`, com try/catch em volta de register/getToken/setDoc, e só `setPermissao('granted')` depois do `setDoc`. Na montagem, se a permissão do navegador é `granted` mas não existe `fcm_tokens/{uid}`, mostrar 🔕 e regravar o token com `getToken`. Na Navbar: `denied` → alert dizendo onde habilitar no Chrome; `error` → "Não consegui ativar agora. Tenta de novo com internet."; `ok` → alert curto dizendo o que vai chegar (sugestão nova; lembrete 3 dias antes pra quem não respondeu e 1 dia antes pra quem confirmou).
- **F36 + F66** Banner dispensável no topo do Setlist (guardar dispensa em localStorage) enquanto `permissao === 'default' && suportado`: "Quer aviso quando alguém sugerir música e lembrete de ensaio? [Ativar avisos] [Agora não]". No iPhone fora da tela inicial (`!suportado` e UA iPhone/iPad), a mesma faixa explica: "No iPhone os avisos só funcionam com o app na tela de início: Compartilhar › Adicionar à Tela de Início." Para membro com `role === ''`, o banner vira boas-vindas com três links: dizer o instrumento na Banda, ativar o sino, e votar o domínio em cada música.
- **F04 + F79** Script `enviar-sugestoes.js`: `link` passa a ser `.../#/sugestoes?ordem=recentes&naovotei=1`. `SugestoesPage` lê `useSearchParams()` no mount e inicializa `sortBy` e `onlyUnvoted` a partir disso.
- **F40** No script, agrupar itens pendentes por `suggestedById` dentro do lote: 1 item mantém o texto atual; 2 ou mais viram "Fulano sugeriu N músicas: A, B e mais X. Dê sua opinião!".
- **F102** Em `handleSave` do evento: ao criar, enfileirar `{ tipo: 'novo_evento', ensaioId, data, tipoEvento, local }`; ao editar, `evento_cancelado` se o status virou cancelado e `evento_remarcado` se a data mudou. No script, tratar os três tipos com link `#/ensaios`.
- **F01** Badges do rodapé viram "o que falta pra mim". Sugestões: contar abertas, não vetadas, fora do setlist e sem `opinoes[user.uid]` (precisa `useAuth()` e assinar `sugestoes`, `songs` e `members`; melhor extrair um hook `usePendencias` usado pela página e pelo rodapé para o número bater). Eventos: badge com eventos futuros não cancelados em que `faltaResponder(e, uid)`. Trocar `badge: true` por uma chave `badge: 'sugestoes' | 'eventos'` e um objeto `counts`.

## Pacote 2 — card do Setlist

- **F12 + F14 + F49 + F53** Tirar o ✕ do cabeçalho do card fechado. No rodapé do card expandido, ao lado de "↩ Voltar pras sugestões", um botão de texto "Remover" com `btn-ghost-danger`. Texto do confirm: `Apagar "X" de vez? Votos, tom, BPM e observações vão junto. Se é só tirar do setlist, use "↩ Voltar pras sugestões".` Em Cifras e Rascunhos, "Remover" vai para dentro do modal, com confirm que diga que não dá para desfazer. O › de expandir ganha `min-width: 40px; min-height: 40px`.
- **F46 + F47** Rótulos conforme D19. Bloco de dificuldade sem caixa e com botões vazados (reaproveitar o raciocínio de `.sug-diff-chip`). `.btn-diff` e `.btn-presenca`: `padding: 9px 14px; font-size: 0.85rem; min-height: 40px`; `gap: 8px` nas linhas. Envolver as regras `:hover` desses botões em `@media (hover: hover)`.
- **F50** `aria-pressed` nos cinco grupos de voto e uma regra CSS que prefixa "✓ " no botão pressionado.
- **F52** Uma linha fixa sob os filtros do Setlist: "O nível da música é o de quem está menos pronto nela". Marcar voto semeado com `seeded: true` na aprovação e, na pill, separar "Crua: Fulano" de "Ainda não disseram: Beltrano". Trocar o aviso do `EnsaioModal` por "Ninguém votou ainda em nenhuma música fora deste evento — vote no Setlist primeiro."
- **F54** Chip "🗳 Não votei N" na barra de filtros do Setlist, copiado do de Sugestões, filtrando `!song.dominio?.[user.uid]`.
- **F62** Manter o card recém-votado visível até o filtro mudar: `Set` de ids fixados na `SetlistPage`, alimentado por `onVotou` do card e zerado ao trocar filtro. Repetir para `onlyUnvoted` nas Sugestões ao enviar opinião.
- **F59** Comprimir o card fechado: tirar a caixa `surface2` e a pergunta em caixa alta do bloco de domínio; virar uma linha "Você:" com os 4 botões em controle segmentado; mover as pills com nomes para o estado expandido; `.status-dot` em 0.78rem/700.
- **F58** Chips "🎸 Último ensaio (N)" e "Próximo ensaio (N)" na barra de filtros do Setlist, com um `onSnapshot` em `ensaios` filtrando `songs` pelos ids do evento.
- **F42** Uma linha sob o título do modal "+ Música": "Pra música que a banda já toca. Quer propor uma nova? Manda em Sugerir 🡒" com `Link to="/sugestoes"` que fecha o modal.
- **F60 + F61** Pontinho de 8px na cor do nível antes do rótulo de cada chip de filtro do Setlist e de Rascunhos; ativo usa borda e texto na cor do nível, gradiente vermelho só em "Todas". Cuidado: `.btn-filter` é compartilhado com Sugestões e Eventos. Trocar o azul de Enferrujada por teal `#2dd4bf` em `dominio.js`.
- **F03** Hook `usePersistedState` mínimo; persistir em localStorage só a `tagFilter` do Setlist (validando contra `allTags`) e o `sortBy` das Sugestões, com chip "✕ limpar" visível quando a tag estiver ativa.

## Pacote 3 — Sugestões

- **F67** Veto explícito: rótulos "✕ Não faz sentido · tira da fila" e "– Não curti · tira da fila", cor de alerta `#ef4444` nos dois, linha de ajuda acima dos botões ("Marcar ✕ ou – veta a música: quando a banda toda opinar, ela sai da fila. Dá pra voltar trocando a opinião."), `confirm` só nessas duas opções, e botão "Remover minha opinião" com `deleteField()`.
- **F68** `busy` em `approve`, `reopen` e `backToSuggestions`: botão desabilitado com "Enviando..." / "Devolvendo...". Criar um toast mínimo compartilhado (div fixa acima da BottomNav, some em 2,5s) e usar aqui ("Foi pro setlist ✓", "Voltou pras sugestões") e onde mais couber.
- **F75** Gravar a opinião no toque (igual à Dificuldade no mesmo modal), mover o bloco de opinião para logo abaixo da thumb, manter o textarea como "Adicionar comentário" com salvar próprio, e um "Fechar" no rodapé do modal.
- **F55** Em "Melhores e fáceis", sugestão sem nenhuma opinião vai para o topo em vez de empatar em 0 com as reprovadas. Mini-chip "🆕" em sugestão e música com `createdAt` nos últimos 7 dias. Após "Enviar pro setlist", toast "Foi pro setlist, marcada Crua pra geral".
- **F78** Congelar a ordem enquanto a página está aberta: guardar a lista de ids ordenada quando os dados chegam e quando o usuário muda ordenação/filtro/busca; ids novos entram no fim. Quando a ordem recalculada divergir, chip discreto "Ordem mudou · reordenar" que aplica ao toque.
- **F73** Linha de ajuda sob "Ordenar:" que muda com a opção ativa ("Melhores e fáceis: nota da banda, descontada se a galera achou difícil", "Média: nota de 0 a 1,2 — Hino vale 1,2, Não curti vale 0"). Formatar a nota com `toLocaleString('pt-BR')`.
- **F26 + F74** Campo `short` em `OPINIONS` (`Hino`, `Escopo`, `Ajustar`, `Fora`, `Não curti`) e renderizar `{o.short} {count}` no resumo. Afastar as cores de "ajustar" e "fora". Trocar "🗳 Votos" por "👥 Mais votadas" para o 🗳 ficar só no filtro "Não votei".
- **F77 + F72** Colapsar a ordenação num `<select>` nativo estilizado como `.btn-sort` ("Ordenar: ⚖️ Melhores e fáceis ▾"). Dar ao toggle "Não votei" a classe `.btn-tag` (roxo tracejado = liga/desliga). Aplicar o mesmo select no Setlist se funcionar bem.
- **F69** `MusicLookup`: estado `consultando` ligado no início do fetch; mostrar "Procurando no catálogo…" e, quando voltar vazio, "Não achei no catálogo — preenche na mão."
- **F29** "✓ Aprovada" vira "✓ No setlist" (etiqueta e filtro); observação padrão da música vira "Veio da sugestão de X"; no `EnsaioModal`, "Buscar música do setlist..." e "Músicas e pauta vieram do evento de…".
- **F16** No `SugestaoModal`, fechar automaticamente após enviar a opinião (com toast) ou repetir "Fechar" no fim; no `CifraModal`, esconder o "Fechar" do topo enquanto `editing`.
- **F13** Só em `CifraModal` e `EnsaioModal`: em edição, não fechar por toque fora; no Cancelar, `confirm('Descartar o que você digitou?')` apenas se algum campo mudou.
- **F02** Hook `useFecharComVoltar(onClose)`: `history.pushState({ modal: true }, '')` no mount, `popstate` → `onClose`, `history.back()` no unmount se o state ainda for nosso, e Esc no mesmo listener. Usar nos seis modais e no `PerformanceMode`.

## Pacote 4 — Eventos, palco e admin

- **F48 + D17** Reordenação por toque no `EnsaioModal` com dnd-kit (`DndContext` + `SortableContext` + `useSortable`, `PointerSensor` com `distance: 6` e `TouchSensor` com `delay: 250, tolerance: 8`), alça na ⠿ com `touch-action: none` e `user-select: none`. Setas ▲▼ com `min-width: 32px; min-height: 28px` e fonte 0.9rem.
- **F56 + F88** Cada música do evento vira link para `#/?q=<título>`; `SetlistPage` e `CifrasPage` leem `?q=` com `useSearchParams` e abrem com a busca preenchida. Casar cifra ↔ música por `chaveMusica(title, artist)` (já em `score.js`): botão "📄 Cifra" no card expandido do Setlist (abre o `CifraModal` em leitura) e no `PerformanceMode` (painel rolável dentro do overlay, monospace, fonte grande).
- **F81** No `PerformanceMode`, trocar o `onClick={goNext}` da área central por swipe horizontal (deslocamento ≥ 60px: esquerda avança, direita volta). Botões grandes continuam como caminho principal.
- **F82** Guardar `idx` do palco em `sessionStorage` por `palco:<event.id>` e ler no `useState` inicial. Tocar em "N / total" abre lista simples do set para pular direto.
- **F84 + F85** CSS do palco: `.perf-current { overflow-y: auto }`; `@media (orientation: landscape) and (max-height: 500px)` com grid de duas colunas (música à esquerda, "Próxima" e botões à direita); título `clamp(2.6rem, 11vw, 4.6rem)`, artista `clamp(1.15rem, 4vw, 1.8rem)` em `--text`, `.perf-notes` `clamp(1.15rem, 3.5vw, 1.5rem)` em `--text` com `max-width: 34ch`.
- **F86** Metrônomo: `style={{ animationDuration: \`${60 / bpm}s\` }}` no botão com `animation-timing-function: steps(1)`; melhor ainda, no `scheduleTick` um `setTimeout` que alterna `.tick`/`.tick-accent` no instante da batida e um flash leve em `.perf-current`.
- **F91** No `PerformanceMode`, `onSnapshot` em `ensaios/{event.id}`; se `setlist` mudou, chip "Repertório atualizado · aplicar" que troca a lista mantendo a música atual pelo id. Não aplicar automaticamente.
- **F98** Card do próximo evento reaproveita o corpo da `EnsaioRow` (lista completa com chips de domínio, checkbox de ensaiada quando já começou, pauta clicável, Remover); o destaque fica só como moldura.
- **F99** `EnsaioModal`: não zerar `songSearch` ao adicionar; usar `matchesSearch` de `utils/search.js`; corte em 10 resultados; mini-chip do pior domínio ao lado de cada resultado e de cada item da lista montada.
- **F100** Abas Realizados e Cancelados renderizam linhas recolhidas por padrão (cabeçalho clicável com a setinha `.ensaio-row-arrow` que já existe no CSS). Próximos continua aberto.
- **F97** Trocar o select "Status" por um único controle "Cancelar este evento" / "Reativar". Realizados continua por data.
- **F96** Helper `formatData(ts, { curta })` em `utils`, usado em `EnsaiosPage`, `EnsaioModal`, `ImportPage` e ferramentas admin: "qua., 02/09" nas linhas e "quarta, 02/09/2026" no destaque; no palco, data curta ao lado do local.
- **F95** Vocabulário: "Setlist" para o acervo em todo lugar ("Buscar música do setlist..."), "Músicas do evento" para a lista do evento, "Última música do evento!" no palco.
- **F93** `utils/presenca.js`: filtro da migração vira `if (!nomes.length || data.presenca) return`; se `data.presenca` tiver chaves, o preview avisa "vai apagar N respostas atuais". "Remover duplicatas" ganha preview antes de apagar (padrão dryRun → aplicar que as outras ferramentas já usam). Normalizar e Migrar saem da barra principal (ver D10).
- **F94** `ImportPage`: `confirm()` com o resumo do que vai gravar; pular músicas e sugestões já existentes por `chaveMusica` e ensaios por data+local, relatando "N pulados"; "Concluída com N erro(s)" quando algum item falhar, mantendo o botão para repetir.
- **F92** Helper `msgErro(e)` que devolve "Não deu certo — tenta de novo (detalhe no console)" e faz `console.error(e)`, nos catches da `MembrosPage`; um único `msg` na página, passado como prop às ferramentas, limpando em ~5s.
- **F57** Campo `ativo` no membro com toggle do admin no card da Banda ("Tá na banda / Saiu"); `splitPresenca`, a semeadura na aprovação e `calcDominio` passam a ignorar inativos.
- **F65** Enquanto `loading` no `AuthProvider`, renderizar a tela de login sem o botão (mesmo `.login-box` com o título). Em `Login`, estado `entrando` com botão "Entrando..." e `.catch(() => alert('Não consegui entrar. Se abriu pelo WhatsApp, toque em ⋮ › Abrir no navegador.'))`.
- **F80** `loadYouTubeApi`: `tag.onerror = reject` e `setTimeout(reject, 8000)`, zerando a promise na falha; no `SetPlayer`, `.catch` mostrando "Não consegui carregar o YouTube — sem internet? Tenta de novo quando o sinal voltar."
- **F05** Tirar o link "👥 Banda" da Navbar; mover "⬆ Importar do Glissandoo" para o bloco de ferramentas admin da página Banda como primeiro item.

## Pacote 5 — polimento visual, acessibilidade e texto

- **F24** Piso de 0.78rem em `.status-dot`, `.diff-pill`, `.mini-chip`, `.opinion-pill`, `.sug-diff-chip`; `.section-label` em 0.78rem com `letter-spacing: 0.6px`; `.presenca-linha-titulo` em 0.75rem.
- **F25 + F76** `.placeholder { opacity: .75 }`; no card rejeitado, opacidade só na thumb (`.sug-card-rejeitada .sug-thumb`), texto normal; textos hoje em `--gray` (`.btn-ghost-danger`, `.rascunho-author`, `.sug-rejeitada`, opinião "Não curti") passam para `--text-muted`; `.btn-meta-add { opacity: 1 }`.
- **F32 + F33 + F34** Apresentação em fuchsia (ver decisões); `.sug-card-aberta` com faixa neutra `var(--border)`; ⭐ dourada no card fechado do Setlist (`.mini-chip-nota`, `#fbbf24`, peso 600).
- **F35** Frase do modal de copiar evento vira parágrafo normal em `--text-muted`; classe `.prompt-label` (0.82rem, caixa normal, `--text`, peso 600) para as quatro perguntas de voto e para "É alguma destas?".
- **F18** Os três "+" inline ao lado de inputs (pauta do evento, tag do card, apelido do membro) viram `.btn-secondary`.
- **F23** `aria-label` e `title` nos botões destrutivos e ambíguos ("Remover cifra", "Remover rascunho", "Tirar do evento", "Sair do modo palco", "Confirmar instrumento", "Mover pra cima/baixo") e `aria-label` nos campos só com placeholder.
- **F17 + F31** "Clique para adicionar observações..." vira "Toque pra anotar: quem canta, afinação, deixa do solo… (aparece no modo palco)" no `SongCard` e versão curta no `AddSongModal`; nas Sugestões, "Toque pra anotar algo pra banda"; tirar "Lorem ipsum" da cifra; em Importar, rótulos "Banda" e "Eventos"; títulos de modal em caixa de frase ("Nova música", "Nova sugestão", "Novo evento", "Nova cifra", "Novo rascunho").
- **F30** Estados vazios nomeiam o filtro ativo: Setlist "Nenhuma música {label} agora 🎉", Rascunhos "Nenhum {tipo} ainda", Sugestões "Sugerir uma música" em vez de "Fazer primeira sugestão" quando há sugestões em outros filtros, Banda mostra a dica de importação só para admin.
- **F15 + F64** `RascunhoModal` ganha modo leitura (`editing` começando `false` para rascunho existente, `<pre>` com o conteúdo e botão "Editar"). Subtítulo sob o cabeçalho de Rascunhos: "Ideias, letras, riffs e estruturas de música da banda", e estado vazio no tom do app.
- **F87 + F103 + F104 + F105** Cifras: tirar `max-height: 60vh` de `.cifra-view`; `.cifra-content` com `white-space: pre; overflow-x: auto`; botões "A−/A+" no `.modal-top` ajustando `--cifra-fs` guardado em localStorage; tom vira input de texto com placeholder "Ex: Sol, Am" e chip "♪ {tom}" (opcional `<datalist>` com as 12 notas); busca de Cifras troca o input solto por `<SearchLupa>` + `matchesSearch`, e Rascunhos ganha a mesma lupa buscando em título e conteúdo; `CifrasPage` re-sincroniza o modal aberto a cada snapshot (copiar o efeito da `SugestoesPage`) e o `CifraModal` lê das props no modo leitura.

## Não mexer

Pontos fortes confirmados pela avaliação. Preserve exatamente como estão:

- Voto de domínio a 1 toque no card fechado, com toggle para desfazer, e nomes de quem votou à vista.
- Níveis de domínio, dificuldade, opinião e presença definidos uma vez como dados (valor, rótulo, cor) e reaproveitados em botões, pills e faixas.
- Piadas internas e tom informal nas escalas ("Estou sofrendo", "Preciso de um tempo", "Moisés, não consegue né").
- Arrasto do setlist com `TouchSensor` de 250ms e `touch-action: none` só na alça (padrão a copiar no `EnsaioModal`).
- "↩ Voltar pras sugestões" preservando opiniões, dificuldade, tom, BPM, tags e domínio pelo vínculo `sugestaoId`.
- Ferramentas admin em dois passos (verificar → aplicar) com preview e contagem em português.
- Confirms que dizem exatamente o que vai acontecer, como o de "Tirar 'X' do setlist e mandar de volta pras sugestões?".
- Setlist com ordem estável que não pula quando outros votam; Modo palco lendo tom/BPM/observações ao vivo mas mantendo a ordem do set congelada.
- Hierarquia visual do Modo palco (título display, artista muted, tom roxo, bloco "Próxima", botões grandes).
- Todas as listas em `onSnapshot`; votos e presença gravados por dot-path com o uid, sem sobrescrever o voto dos outros.
- Lembretes D-3 só para quem não respondeu e D-1 só para quem confirmou; quem sugeriu não recebe a própria notificação.
- Filtro "🗳 Não votei" com contador nas Sugestões.

## Como reportar cada pacote

Ao fechar um pacote, escreva no chat, em português:

1. Lista dos ids implementados e o commit de cada um.
2. Ids pulados e por quê (já resolvido, não confirmado, esforço maior que o previsto).
3. O que precisa ser testado no celular pelo dono (ex.: push em Android real, swipe no palco, arrasto no modal).
4. Resultado de `npm run lint` e `npm run build`.

Comece pelo Pacote R.
