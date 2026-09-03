# Prompt: rodada 2 de usabilidade do The Stryx

Cole este arquivo inteiro como primeira mensagem em uma nova sessão do Claude Code aberta na pasta do projeto (`/Users/cristianodacio/Documents/the-stryx`).

> Gerado em 03/09/2026 a partir de uma revisão de usabilidade do código no commit `2075afe` (v1.33.0, branch `main`). Não é uma reavaliação do plano anterior: o `PROMPT-melhorias-usabilidade.md` da raiz foi executado até o Pacote 4 (v1.29.1 → v1.33.0). O que segue é (a) o Pacote 5 daquele plano, que **nunca foi feito**, e (b) achados novos encontrados agora, lendo o código atual.

---

Você vai implementar melhorias de usabilidade já avaliadas. Não é para reavaliar nem propor alternativas grandes: é para executar, por pacotes, com commits pequenos, e reportar ao final de cada pacote.

## Contexto do projeto

- **The Stryx**: PWA em React 19 + Vite + Firebase (Firestore em tempo real com cache persistente, Auth Google, FCM push via GitHub Actions em `.github/scripts/`). Feito para UMA banda amadora brasileira. UI em português do Brasil, tom informal, com piadas internas nos rótulos. **Não formalize a linguagem.** Clareza sim, formalidade não.
- Público: poucos músicos, todos conhecidos. Usam no **celular** (Android e iPhone, inclusive instalado na tela inicial), no ensaio e no palco. Há um admin (e-mail fixo em código) com ferramentas extras.
- Telas: `/` Setlist (acervo, voto de domínio/opinião/dificuldade por música), `/cifras`, `/ensaios` rotulado "Eventos" (presença, músicas do evento, Modo palco), `/rascunhos`, `/sugestoes`, `/membros` "Banda", `/import` (admin).
- Não é possível logar no app a partir da sessão (login Google). Valide com `npm run lint` e `npm run build`, e lendo o código. Onde uma mudança precisar de teste manual no celular, diga isso no relatório do pacote.
- Referências: `docs/usabilidade/achados.md` detalha cada id `Fxx` (problema, impacto, evidência, sugestão e o "ajuste da verificação"). **Quando um item abaixo citar um `Fxx` e parecer curto, leia o id lá antes de implementar.** Os ids `Nxx` são achados novos desta rodada e estão descritos por completo aqui mesmo (seção "Achados novos" no fim).
- Números de linha citados abaixo são do commit `2075afe` e podem ter deslocado. **Localize pelo trecho com `grep -n`, não pela linha.**

## Regras de trabalho

1. **Branch.** Crie `feat/usabilidade-rodada-2` a partir de `main` (`git checkout -b feat/usabilidade-rodada-2 main`). Não faça merge em `main` sem o dono pedir.
2. **Um pacote por vez, na ordem abaixo.** Ao terminar um pacote: `npm run lint`, `npm run build`, commit(s), relatório curto no chat (modelo no fim). Só então siga para o próximo. O dono pode interromper entre pacotes.
3. **Commits pequenos, em português, no estilo do histórico** (`feat:`/`fix:`, uma frase minúscula descrevendo o efeito para o usuário). Um commit por item ou por grupo de itens muito próximos. Atualize `CHANGELOG.md` (topo, mesmo formato das entradas existentes) e `src/version.js` + `package.json` (`version`) ao fechar cada pacote: minor para pacote com feature visível, patch para pacote só de ajustes. Versões previstas: Pacote 5 → 1.34.0, Pacote 6 → 1.34.1, Pacote 7 → 1.35.0, Pacote 8 → 1.36.0.
4. **Não mexa** no que está na seção "Não mexer" no fim.
5. **Não refatore por refatorar.** Nada de TypeScript, testes novos, reorganização de pastas. Biblioteca nova só no Pacote 8, e só se o dono aprovar.
6. **Padrão de gravação (F08, já adotado no app inteiro):** disparar `updateDoc/addDoc`, fechar a caixa/modal na hora, e `.catch(() => alert('Não deu pra salvar agora. Confere a internet e tenta de novo.'))`. Nunca `await` seguido de fechar — sem sinal a caixa fica presa.
7. Se encontrar algo que contradiz o que está aqui (já foi resolvido, o arquivo mudou muito, o item não faz mais sentido), **não invente**: pule, anote no relatório do pacote e siga.

## Decisões já tomadas (não pergunte de novo)

- Apresentação sai da família vermelha/rosa e vai para **fuchsia** (`#d946ef`, fundo `rgba(217,70,239,0.12)`, borda fraca `rgba(217,70,239,0.25)`, texto claro `#e879f9`).
- "🗳 Falta meu voto" é um **toggle pessoal** e ganha a classe `.btn-tag` (roxo tracejado = liga/desliga), tanto no Setlist quanto nas Sugestões. Os filtros de nível/status continuam `.btn-filter`.
- O toggle de status do evento vira **"🚫 Marcar como cancelado" / "↩ Reativar evento"**; o botão "Cancelar" do rodapé do modal continua com esse nome (é o mesmo em todos os modais).
- "Sair" da Navbar passa a **pedir confirmação**.
- Efeitos `:hover` que levantam card ou mudam borda ficam **só em dispositivo com mouse** (`@media (hover: hover)`).
- Modo leitura (título + conteúdo + botão "Editar") é o **padrão para Cifra e Rascunho**; edição só depois de tocar em "Editar".
- Tamanho da letra da cifra (A−/A+) é preferência da pessoa e fica em **localStorage** (`stryx-cifra-fs`), compartilhado entre o modal de Cifra e o Modo palco.
- Botão "Remover" (destrutivo) fica sempre **no rodapé do modal, à esquerda**, nunca no topo ao lado de "Editar"/"Fechar".

---

## Pacote 5 — polimento visual, acessibilidade e texto (v1.34.0)

É o Pacote 5 do plano anterior, não executado. Cada item cita o id do `achados.md`.

- **P5-1 · F24 — piso de fonte.** `src/index.css`: `.diff-pill` `0.7rem` → `0.78rem`; `.mini-chip` `0.7rem` → `0.78rem`; `.opinion-pill` `0.7rem` → `0.78rem`; `.sug-diff-chip` `0.68rem` → `0.78rem`; `.section-label` `font-size: 0.72rem` → `0.78rem` e `letter-spacing: 1.2px` → `0.6px`; `.presenca-linha-titulo` `0.68rem` → `0.75rem`. `.status-dot` já está em 0.78rem — não mexer. Conferir que os chips do card fechado (`.song-collapsed`) continuam quebrando linha sem estourar o card.

- **P5-2 · F25 + F76 — contraste.** `src/index.css`: `.placeholder { opacity: 0.45 }` → `0.75`; em `.sug-card-rejeitada` tirar `opacity: 0.6` e adicionar `.sug-card-rejeitada .sug-thumb { opacity: 0.5; filter: grayscale(1); }`; `.btn-ghost-danger`, `.rascunho-author` e `.sug-rejeitada`: `color: var(--gray)` → `var(--text-muted)`; `.btn-meta-add { opacity: 0.7 }` → `opacity: 1` (e tirar o `opacity: 1` do `:hover`, que fica redundante).

- **P5-3 · F32 + F33 + F34 — cores.**
  - Apresentação em fuchsia (ver decisões). Em `src/index.css`, trocar a família rosa nas regras: `.btn-event-type.active.apresentacao`, `.event-type-badge.apresentacao`, `.ensaio-row.destaque.apresentacao` (gradiente, `border-left-color` e `border-color: #4a2230` → `#3d1f45`), `.apresentacao .next-ensaio-label`, `.apresentacao .next-ensaio-relative`. Onde era `#e11d48` → `#d946ef`; `rgba(225, 29, 72, X)` → `rgba(217, 70, 239, X)`; `#fb7185` → `#e879f9`. Nada de rosa/vermelho sobra na família Apresentação.
  - `.sug-card-aberta { border-left: 4px solid #3b82f6 }` → `var(--border)`.
  - `src/components/setlist/SongCard.jsx`, chip `⭐ {formatarNota(nota.media)}` do card fechado: classe `mini-chip mini-chip-nota`. CSS: `.mini-chip-nota { color: #fbbf24; font-weight: 600; }`.

- **P5-4 · F35 — `.prompt-label` para pergunta de voto.** CSS: `.prompt-label { font-size: 0.82rem; font-weight: 600; color: var(--text); margin-bottom: 7px; }` (caixa normal, sem letter-spacing). Trocar `className="section-label"` por `"prompt-label"` em: `SongCard.jsx` ("✅ Você se sente pronto nessa?", "⭐ Vale tocar?"/"⭐ A banda toda já opinou", "🎯 Dificuldade pra tocar"); `SugestoesPage.jsx` no `SugestaoModal` ("Vale tocar?"/"A banda toda já opinou" e "Dificuldade pra tocar"); `EnsaiosPage.jsx` no `PresencaBar` ("Você vai?"); `MusicLookup.jsx` ("É alguma destas?"). Em `EnsaioModal.jsx`, a frase `Músicas e pauta vieram do evento de …` deixa de ser `.section-label` e vira `<p className="filter-hint" style={{ margin: '0 0 12px' }}>` (parágrafo normal em `--text-muted`).

- **P5-5 · F18 — "+" e "✓" dentro de formulário viram `.btn-secondary`.** `SongCard.jsx` botão `+` da `tag-edit-row`; `EnsaioModal.jsx` botão `+` da `pauta-input-row`; `MembrosPage.jsx` botão `+` do apelido (`onClick={addAlias}`) e botão `✓` do instrumento (`onClick={saveRole}`). O vermelho primário fica só para a ação principal do formulário.

- **P5-6 · F23 — nome acessível em botão só com símbolo e em campo só com placeholder.** `aria-label` (e `title` onde não houver):
  - `EnsaioModal.jsx`: `.btn-order` ▲ "Mover pra cima", ▼ "Mover pra baixo"; `.btn-remove` da música `aria-label={\`Tirar ${s.title} do evento\`}` `title="Tirar do evento"`; `.btn-remove` da pauta "Remover item da pauta"; input "Buscar música do setlist..." `aria-label="Buscar música do setlist"`; input da pauta "Novo item da pauta"; input `quantasCruas` "Quantas músicas trazer".
  - `SongCard.jsx`: `.tag-remove` `aria-label={\`Tirar tag ${t}\`}`; input de tag nova "Nova tag"; `.song-expand-btn` ganha `aria-label` igual ao `title` e `aria-expanded={expanded}`.
  - `MembrosPage.jsx`: `.tag-remove` do apelido `aria-label={\`Tirar apelido ${a}\`}`; `✓` "Confirmar instrumento"; `✕` "Cancelar edição"; input do apelido "Novo apelido".
  - `PerformanceMode.jsx`: `.perf-close` ✕ `aria-label="Sair do modo palco" title="Sair do modo palco"`.
  - `SearchLupa.jsx`: input `aria-label={placeholder}`.

- **P5-7 · F17 + F31 — textos.**
  - `SongCard.jsx`: `Clique para adicionar observações...` → `Toque pra anotar: quem canta, afinação, deixa do solo… (aparece no modo palco)`.
  - `SugestoesPage.jsx` (`SugestaoModal`): `Clique para adicionar observações...` → `Toque pra anotar algo pra banda`.
  - `AddSongModal.jsx`: `<h2>Adicionar Música</h2>` → `Nova música`; placeholder do textarea `Notas...` → `Quem canta, afinação, deixa do solo…`.
  - `SugestoesPage.jsx`: `<h2>Nova Sugestão</h2>` → `Nova sugestão`.
  - `EnsaioModal.jsx`: títulos `'Editar Evento' / 'Copiar Evento' / 'Agendar Evento'` → `'Editar evento' / 'Copiar evento' / 'Novo evento'`; placeholder `Notas do evento...` → `Ex: levar cabo extra, ensaiar a entrada da 3ª…`.
  - `CifraModal.jsx`: `'Editar Cifra' / 'Nova Cifra'` → `'Editar cifra' / 'Nova cifra'`; no placeholder do textarea, trocar a linha `Lorem ipsum...` por `Letra ou acordes aqui…`.
  - `RascunhosPage.jsx`: `'Editar Rascunho' / 'Novo Rascunho'` → `'Editar rascunho' / 'Novo rascunho'`.
  - `ImportPage.jsx`: rótulos visíveis `'Membros'` → `'Banda'` e `'Ensaios'` → `'Eventos'` nos `label:` dos passos (~linhas 369-372), nos `ResumoCard` (`label="Membros"`, `label="Ensaios"`) e nos `PreviewSection` (`title="👤 Membros"`, `title="📅 Ensaios"`). **Não** mexer nas chaves `key:` nem nos nomes de função.
  - `MembrosPage.jsx`: `<h2>A Banda</h2>` → `Banda` (mesmo nome do rodapé); `title="Clique para editar"` → `"Toque pra editar"`.

- **P5-8 · F30 + F44 — estado vazio nomeia o filtro e oferece saída.**
  - `SetlistPage.jsx` (bloco `Nenhuma música aqui ainda.`), nesta ordem: (1) `search.trim()` → mantém o texto atual; (2) `filter === 'falta_meu_voto'` → `🎉 Você já votou em todas as músicas daqui!`; (3) `filter !== 'all'` → `Nenhuma música {label do filtro} agora 🎉` + `<button className="btn-secondary" onClick={() => mudarFiltro('all')}>Ver todas</button>`; (4) `tagFilterValida || eventoChip` → `Nenhuma música com esse filtro.` + botão `✕ Limpar filtros` que chama `mudarTagFilter(null)` e `mudarEventoChip(null)`; (5) senão (acervo vazio) → texto atual + "Adicionar primeira música". O `label` vem de `FILTERS.find((f) => f.value === filter)?.label`.
  - `RascunhosPage.jsx`: com `filterType !== 'all'` → `Nenhum rascunho do tipo {label} ainda.` + botão `Ver todos`; com `'all'`, mantém.
  - `SugestoesPage.jsx`: botão `Fazer primeira sugestão` → `visiveis.length > 0 ? 'Sugerir uma música' : 'Fazer primeira sugestão'`.
  - `CifrasPage.jsx`: busca sem resultado → `Nenhuma cifra pra "{search}".` + `<button className="btn-primary">+ Cadastrar cifra de "{search}"</button>` que abre o modal já com o título preenchido (depende de **P7-1b**; se fizer o Pacote 5 antes, deixe só o texto e complete no Pacote 7).

- **P5-9 · F15 + F64 — Rascunhos com modo leitura e subtítulo.**
  - `RascunhosPage.jsx` (`RascunhoModal`): `const [editing, setEditing] = useState(!rascunho)`. Em leitura: `.modal-top` com `<h2>{rascunho.title}</h2>` e botões "Editar" (`setEditing(true)`) e "Fechar"; badge do tipo; `<pre className="rascunho-content">{rascunho.content || 'Sem conteúdo.'}</pre>`; autor em `--text-muted`; rodapé `.modal-actions` com "Remover" à esquerda (`marginRight: 'auto'`). Em edição: como hoje, mas "Cancelar" volta pra leitura quando `rascunho` existe (só fecha quando é novo), e tocar fora não fecha. CSS: `.rascunho-content { font-family: monospace; font-size: 0.9rem; line-height: 1.6; white-space: pre-wrap; background: var(--surface2); padding: 14px; border-radius: var(--radius); }`.
  - Subtítulo logo abaixo do `.page-header`: `<p className="filter-hint" style={{ marginTop: -12 }}>Ideias, letras, riffs e estruturas de música da banda.</p>`.
  - Estado vazio geral: `Nenhum rascunho ainda.` → `Nenhuma ideia guardada ainda. Letra, riff, estrutura — anota aqui antes que fuja.`

- **P5-10 · F87 + F103 + F104 + F105 — Cifras.**
  - CSS: apagar a regra `.cifra-view { overflow-y: auto; max-height: 60vh; }` (o `.modal` já rola; dois scrolls aninhados travam o dedo). `.cifra-content`: `white-space: pre-wrap` → `white-space: pre; overflow-x: auto;` e `font-size: 0.88rem` → `font-size: var(--cifra-fs, 0.88rem)`. `.perf-cifra-content`: `white-space: pre; overflow-x: auto; font-size: var(--cifra-fs, clamp(1rem, 3vw, 1.3rem))`.
  - `CifraModal.jsx`, modo leitura: botões `A−` e `A+` (`btn-secondary`, `aria-label="Diminuir letra"`/`"Aumentar letra"`) no `.modal-top`, antes de "Editar". Estado `fs` lido de `localStorage.getItem('stryx-cifra-fs')` (número em rem; padrão `0.88`; limites `0.7`–`1.6`; passo `0.1`), aplicado com `style={{ '--cifra-fs': \`${fs}rem\` }}` no `.cifra-view`, gravado a cada mudança (try/catch). `PerformanceMode.jsx` lê a mesma chave ao montar e aplica no `<pre className="perf-cifra-content">`.
  - Tom: em `CifraModal.jsx`, `<select name="key">` → `<input name="key" value={form.key} onChange={handleChange} placeholder="Ex: Sol, Am" list="tons-cifra" />` + `<datalist id="tons-cifra">{KEYS.map((k) => <option key={k} value={k} />)}</datalist>`. Badges `Tom: {key}` (CifraModal e CifrasPage) → `<span className="mini-chip">♪ {key}</span>`.
  - `CifrasPage.jsx`: trocar o `<input className="search-input">` por `<SearchLupa value={search} onChange={setSearch} placeholder="Buscar cifra..." />` dentro de `<div className="page-header-actions">` junto do botão "+ Cifra" (copiar a estrutura do `page-header` de `SetlistPage.jsx`).
  - `RascunhosPage.jsx`: mesma lupa com `placeholder="Buscar rascunho..."`, filtrando com `matchesSearch(search, r.title, r.content)` (`import { matchesSearch } from '../../utils/search'`).
  - `CifrasPage.jsx` re-sincroniza o modal aberto a cada snapshot: copiar de `SugestoesPage.jsx` o efeito comentado `// Atualiza o modal com dados frescos do Firestore`. `CifraModal.jsx` em leitura renderiza `cifra.title/artist/key/bpm/content` (props), não `form.*`; ao entrar em edição, re-semeia `form` a partir de `cifra`.
  - Apagar `const isView = cifra && !cifra._editing` (sem uso) em `CifraModal.jsx`.

- **P5-11 · F72 — "🗳 Falta meu voto" com cara de liga/desliga.** `SetlistPage.jsx` e `SugestoesPage.jsx`: o botão "🗳 Falta meu voto" troca `btn-filter` por `btn-tag` (mantém `active` e o `.count`). Fica igual a "🎸 Último ensaio", que também é toggle pessoal.

---

## Pacote 6 — correções novas: bugs, coerência técnica e texto que engana (v1.34.1)

Achados desta rodada (`Nxx`/`Cxx`, detalhe no fim do arquivo). Quase tudo pequeno.

- **P6-1 · N01 — safe-area no iPhone instalado.** `index.html` tem `viewport-fit=cover` e o manifest é `standalone`, mas nenhuma regra usa `env(safe-area-inset-*)` (`grep -n safe-area src/index.css` vem vazio): no iPhone com barra de gesto o rodapé fixo fica em cima da barra e o Modo palco encosta no notch. Em `src/index.css`:
  - `.bottom-nav { height: calc(var(--bottom-nav-h) + env(safe-area-inset-bottom, 0px)); padding-bottom: env(safe-area-inset-bottom, 0px); }`
  - `.app-content { padding-bottom: calc(var(--bottom-nav-h) + 8px + env(safe-area-inset-bottom, 0px)); }`
  - `.toast { bottom: calc(var(--bottom-nav-h) + 14px + env(safe-area-inset-bottom, 0px)); }`
  - `.perf-overlay { padding: max(16px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) max(16px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left)); }`
  - `.navbar { padding-top: env(safe-area-inset-top, 0px); height: calc(var(--nav-h) + env(safe-area-inset-top, 0px)); }`
  - `.modal-overlay { padding: max(16px, env(safe-area-inset-top)) 16px max(16px, env(safe-area-inset-bottom)); }`
  - `.login-credito { bottom: calc(18px + env(safe-area-inset-bottom, 0px)); }`
  Precisa de teste no iPhone instalado na tela inicial.

- **P6-2 · N02 — hover grudado no toque.** Cards com `:hover` que levantam (`transform: translateY(-2px)`) ou pintam a borda de vermelho ficam presos nesse estado depois do toque no celular — em Sugestões, o card fica com borda vermelha depois de fechar o modal, como se estivesse selecionado. Envolver em `@media (hover: hover) { … }` as regras `.song-card:hover`, `.cifra-card:hover`, `.ensaio-row:hover`, `.rascunho-card:hover`, `.sug-card:hover`, `.member-card:hover` (`grep -n "card:hover\|row:hover" src/index.css`). Os `:hover` de botão podem ficar como estão.

- **P6-3 · N03 — dois "Cancelar" com sentidos opostos no modal de Evento.** `EnsaioModal.jsx`: `✕ Cancelar este evento` / `↩ Reativar` → `🚫 Marcar como cancelado` / `↩ Reativar evento` (ver decisões). Também: os dois `.btn-event-type` chamam `setForm` sem `setMexeu(true)` — trocar o tipo e sair por "Cancelar" não pergunta "Descartar?"; adicionar `setMexeu(true)` nos dois `onClick`.

- **P6-4 · N04 — gravações que ainda esperam a rede (padrão F08 não aplicado).** `SugestoesPage.jsx` (`SugestaoModal`): `const saveNotes = async () => { await updateDoc(ref, { notes: notes.trim() }); setEditingNotes(false) }` → `updateDoc(ref, { notes: notes.trim() }).catch(erro); setEditingNotes(false)` (com `erro` = o mesmo `alert` do resto do arquivo). `MembrosPage.jsx` (`MemberCard`): `saveRole`, `addAlias`, `removeAlias`, `toggleAtivo` — tirar o `await`, fechar/limpar na hora, `.catch(...)` com o mesmo alerta.

- **P6-5 · N05 — confirm de apagar não diz o que se perde nem oferece a saída segura.** `EnsaiosPage.jsx`: `Remover evento de ${formatData(e.date)}?` → `Apagar o evento de ${formatData(e.date)} de vez? Músicas, pauta e presenças vão junto. Se ele só não vai acontecer, use Editar › Marcar como cancelado.` `MembrosPage.jsx`: `Remover "${member.name}" da banda?` → `Apagar "${member.name}" do cadastro de vez? Se a pessoa só saiu da banda, use "Tá na banda → Saiu", que guarda o histórico.`

- **P6-6 · N07 — "Sair" sem confirmação.** `Navbar.jsx`: `onClick={logout}` → `onClick={() => confirm('Sair da conta?') && logout()}`. Quem sai sem querer dentro do navegador do WhatsApp não consegue voltar (popup de login bloqueado — ver `Login.jsx`).

- **P6-7 · N19 — "Nenhuma cifra ainda." / "Nenhum rascunho ainda." / "Nenhum membro cadastrado." piscam antes do primeiro snapshot.** F09 só cobriu Setlist, Eventos e Sugestões. Em `CifrasPage.jsx`, `RascunhosPage.jsx` e `MembrosPage.jsx`: `const [loaded, setLoaded] = useState(false)`, `setLoaded(true)` dentro do `onSnapshot`, e `!loaded ? <p className="empty-state">Carregando...</p> : …` antes do estado vazio.

- **P6-8 · N11 — prévia da cifra sempre termina em "...".** `CifrasPage.jsx` `{cifra.content?.slice(0, 80)}...` → `{cifra.content ? cifra.content.slice(0, 80) + (cifra.content.length > 80 ? '…' : '') : <span className="placeholder">Sem conteúdo</span>}`.

- **P6-9 · N08 — dois metrônomos ao mesmo tempo.** Dois cards abertos podem tocar dois metrônomos juntos, e recolher o card mata o som sem aviso (o botão desmonta). `MetronomeButton.jsx`: singleton de módulo — `let pararAtivo = null` no topo do arquivo; em `start()`: `pararAtivo?.(); pararAtivo = stop`; em `stop()`: `if (pararAtivo === stop) pararAtivo = null`. Adicionar `aria-pressed={playing}` no botão. Não mudar onde o botão fica.

- **P6-10 · N34 — "Remover" da cifra colado em "Editar"/"Fechar".** `CifraModal.jsx`, modo leitura: tirar o `Remover` do `.modal-top` e pôr num `.modal-actions` no fim do modo leitura, à esquerda (`style={{ marginRight: 'auto' }}`), como o `RascunhoModal` já faz. Em edição, não mostrar "Remover".

- **P6-11 · C04 — "tira da fila" aparece dentro do Setlist, onde não existe fila.** `SongCard.jsx` renderiza `OPINIONS.map((o) => o.label)` e dois rótulos dizem `· tira da fila` — mas votar "Não curti" numa música do setlist não tira nada de lugar nenhum (o veto só existe em Sugestões). Em `src/utils/score.js`, adicionar a cada entrada de `OPINIONS` um campo `labelSetlist` (`'Hino'`, `'✓ Entra no escopo'`, `'~ Ajustar pro nosso estilo'`, `'✕ Não faz sentido'`, `'– Não curti'`) e usar `o.labelSetlist` em `SongCard.jsx` (só ali; o modal de Sugestão continua com `o.label`).

- **P6-12 · C05 — "🎯 Dificuldade" e "⚖️ Melhores e fáceis" fazem contas diferentes em cada aba.** Sugestões usa o **nível mais alto votado** (`calcDifficulty(...).max`, o mesmo que o chip 🎯 mostra); Setlist usa a **média** (`avgDifficulty` em `SetlistPage.jsx`). Mesma ordenação, mesmo nome, resultado diferente. Unificar pelo máximo ("se alguém achou difícil, é difícil" — mesma filosofia do pior voto de domínio):
  - `src/utils/dificuldade.js`: `export const EASE_BY_WEIGHT = { 1: 1, 2: 0.85, 3: 0.7 }` e `export function fatorFacilidade(dificuldade) { const { max } = calcDifficulty(dificuldade); return EASE_BY_WEIGHT[max] ?? EASE_BY_WEIGHT[2] }` (comentário: Fácil não desconta, Ok 15%, Difícil 30%; sem voto conta como Ok).
  - `SetlistPage.jsx`: `facilidade(song)` → `fatorFacilidade(song.dificuldade)`; a ordenação `'dificuldade'` passa a comparar `calcDifficulty(x.dificuldade).max` (sem voto continua no fim); apagar `avgDifficulty` e a função `facilidade` locais. No `porNota`, adicionar os mesmos desempates de Sugestões: `|| nb.total - na.total || nb.soma - na.soma`.
  - `SugestoesPage.jsx`: `calcBalancedScore` usa `fatorFacilidade(dificuldade)`; apagar `EASE_BY_WEIGHT` e `EASE_SEM_VOTO` locais.

- **P6-13 · N16 — modal com teclado aberto.** `.modal { max-height: 90vh }` → `max-height: min(90vh, 90dvh)`.

- **P6-14 · N13 — avatar quebrado sem foto.** `Navbar.jsx`: `<img src={user.photoURL} …>` → `user.photoURL ? <img …/> : <div className="avatar avatar-placeholder">{(user.displayName || '?')[0].toUpperCase()}</div>`. CSS: `.avatar-placeholder { display: flex; align-items: center; justify-content: center; background: var(--surface2); font-size: 0.8rem; font-weight: 700; color: var(--text-muted); }`.

---

## Pacote 7 — coerência entre abas e autoexplicação (v1.35.0)

Regra que orienta o pacote: **mesmo dado, mesma roupa em toda aba** (nota ⭐, dificuldade 🎯, domínio, tom ♪), e **o voto principal de cada aba é o que fica em caixa cheia** (domínio no Setlist, opinião em Sugestões, presença em Eventos); os votos secundários ficam vazados. Isso já é assim e não muda — o pacote conserta o que foge da regra.

- **P7-1 · C01 — nota ⭐ com formato diferente em cada aba.** Setlist mostra `⭐ 1,05` num mini-chip cinza; Sugestões mostra `⭐ 1,05 · 3 votos` em dourado. Criar `src/components/NotaChip.jsx`: `export default function NotaChip({ nota, deQuantos, compacto = false })` que renderiza `<span className="nota-chip" title="Média X · N voto(s)">⭐ {formatarNota(nota.media)}{!compacto && <span className="nota-chip-detalhe"> · {detalhe}</span>}</span>`, onde `detalhe` é `${nota.total} de ${deQuantos} opinaram` quando `deQuantos` existe e `nota.total <= deQuantos`, senão `${nota.total} voto(s)`. Mover `formatarNota` (duplicada em `SongCard.jsx` e `SugestoesPage.jsx`) para `src/utils/score.js` e exportar. CSS: `.nota-chip { font-size: 0.78rem; font-weight: 700; color: #fbbf24; white-space: nowrap; } .nota-chip-detalhe { font-weight: 400; color: var(--text-muted); }`. Usar em `SongCard.jsx` (card fechado, `compacto`) — **substitui o `.mini-chip-nota` do P5-3** — e no card de `SugestoesPage.jsx` com `deQuantos={bandMembers.length}` (o "3 de 6 opinaram" explica por que a sugestão ainda não fechou). Apagar `.sug-score-chip`/`.sug-score-avg` do CSS.

- **P7-2 · C02 — chip 🎯 de dificuldade só existe em Sugestões.** O Setlist ordena por dificuldade e tem o voto, mas o card fechado não mostra o nível. `SongCard.jsx`, linha de chips do card fechado (`.song-collapsed`), depois da nota: `const diff = difficultyByWeight(calcDifficulty(song.dificuldade).max)` e `{diff && <span className="diff-chip" style={{ color: diff.color, borderColor: diff.color }}>🎯 {diff.label}</span>}` (imports de `../../utils/dificuldade`). CSS: renomear `.sug-diff-chip` → `.diff-chip` (e atualizar `SugestoesPage.jsx`), já com o piso de 0.78rem do P5-1.

- **P7-3 · C03 — domínio com roupa diferente em Eventos.** No Setlist o domínio é o selo `.status-dot` (fundo colorido); na lista de músicas do evento (`EnsaiosPage.jsx`) e no `EnsaioModal.jsx` (resultados da busca e lista montada) ele é um `mini-chip` só com borda colorida. Trocar esses três lugares por `<span className="status-dot status-dot-inline" style={{ color: nivel.color, background: nivel.bg }}>{nivel.label}</span>`. CSS: `.status-dot-inline { padding: 1px 8px; margin-left: 6px; vertical-align: middle; }`.

- **P7-4 · C10 — tom da música não aparece na lista do evento.** `EnsaiosPage.jsx`, lista de músicas do evento (`texto`): depois do artista, `{songs[s.id]?.tom && <span className="event-setlist-bpm"> · ♪ {songs[s.id].tom}</span>}` (lido ao vivo do `songs`, igual ao domínio; o BPM continua vindo do retrato do evento). Mesma coisa em `EnsaioModal.jsx`, lista montada (`allSongs.find(...)?.tom`).

- **P7-5 · C21 — checkbox "ensaiada" sem explicação visível.** `EnsaiosPage.jsx`, `<p className="section-label">Músicas ({ensaio.setlist.length})</p>` do bloco não-compacto: quando `podeMarcar`, acrescentar `<span className="filter-hint" style={{ margin: 0, textTransform: 'none', letterSpacing: 0 }}> · marque as que rolaram</span>` dentro do mesmo `<p>` (o `title` do checkbox só aparece com mouse).

- **P7-6 · C17 — badge de pendência no título só em Sugestões.** O rodapé mostra badge nas três abas, mas só o `<h2>` de Sugestões repete o número (`pending-badge`). Em `SetlistPage.jsx`: `<h2>Setlist{meuVotoFaltaCount > 0 && <span className="pending-badge" title="Músicas em que falta seu voto">{meuVotoFaltaCount}</span>}</h2>`. Em `EnsaiosPage.jsx`: `<h2>Eventos{pendentes.length > 0 && <span className="pending-badge" title="Eventos em que falta você responder">{pendentes.length}</span>}</h2>` (mover o cálculo de `pendentes` pra antes do `return`, ele já existe).

- **P7-7 · C39 — "⏳ Presença pendente" é o mesmo conceito de "🗳 Falta meu voto", com outro nome e outra cara.** `EnsaiosPage.jsx`, `TABS`: `label: '⏳ Presença pendente'` → `'⏳ Falta eu responder'`, e esse botão específico usa `btn-tag` em vez de `btn-filter` (mantém `active` e o `.count`). As outras três abas continuam `.btn-filter`.

- **P7-8 · C36 — ícones das perguntas de voto só no Setlist.** `SugestoesPage.jsx` (`SugestaoModal`): `'Vale tocar?'` → `'⭐ Vale tocar?'`, `'A banda toda já opinou'` → `'⭐ A banda toda já opinou'`, `Dificuldade pra tocar` → `🎯 Dificuldade pra tocar` (mesmos ícones do `SongCard.jsx`).

- **P7-9 · C40 — o fluxo das Sugestões não está explicado em lugar nenhum.** Em `SugestoesPage.jsx`, logo depois da `.filter-bar` (antes da `.sort-bar`): `<p className="filter-hint">Você sugere, a banda opina. Quando todo mundo opinar sem veto, o admin manda pro setlist.</p>`. No `SugestaoModal`, para quem não é admin e a sugestão está `aberta`: abaixo do bloco de opinião, `<p className="filter-hint" style={{ margin: '4px 0 0' }}>{faltam.length ? \`Faltam opinar: ${faltam.map(firstName).join(', ')}\` : 'Todo mundo já opinou — agora é com o admin.'}</p>` com `const faltam = quemFalta(sugestao, bandMembers)` (já importado). Não mostrar quando já existe o banner de veto pendente (ele já lista quem falta).

- **P7-10 · C15 — card de Sugestão não avisa que abre.** `SugestoesPage.jsx`, dentro de `.sug-card-body` no fim de `.sug-card-top`: `<span className="sug-card-arrow" aria-hidden="true">›</span>`. CSS: `.sug-card-arrow { color: var(--text-muted); font-size: 1.2rem; line-height: 1; align-self: center; margin-left: 4px; }`. É a mesma setinha do card do Setlist e das linhas recolhidas de Eventos.

- **P7-11 · N06 — cifra alcançável dos dois lados.**
  - a) `EnsaiosPage.jsx`: o chip `📄` ao lado de cada música do evento aparece mesmo sem cifra e leva pra uma busca vazia. Carregar `cifras` (um `onSnapshot(collection(db, 'cifras'))`, como já faz com `songs`), passar pro `EnsaioRow` e renderizar o chip só se `acharCifra(cifras, s.title, s.artist)` achar (`import { acharCifra } from '../../utils/score'`).
  - b) `CifraModal.jsx` ganha prop `inicial` (`{ title, artist }`) usada no `useState` do form quando `!cifra`. `CifrasPage.jsx` aceita `modal = { nova: true, title, artist }` e passa `inicial`; o estado vazio com busca (P5-8) usa isso com `title: search`.
  - c) `SongCard.jsx`: quando `!cifra`, `<button className="btn-meta-add" onClick={() => setVerCifra(true)}>📄 + cifra</button>` que abre `<CifraModal cifra={null} inicial={{ title: song.title, artist: song.artist }} onClose={…} KEYS={CIFRA_KEYS} />`. Depois de salvar, o `onSnapshot` de cifras do `SetlistPage` já troca o botão por "📄 Cifra".

- **P7-12 · N20 — modal da sugestão sem data.** `SugestoesPage.jsx` (`SugestaoModal`): `Sugerida por <strong>{sugestao.suggestedBy}</strong>` → acrescentar `{sugestao.createdAt && <> · {formatData(sugestao.createdAt, { curta: true })}</>}` (`import { formatData } from '../../utils/data'`).

- **P7-13 · N15 — data curta sem ano em Realizados/Cancelados.** `src/utils/data.js`, dentro de `formatData` com `curta`: incluir `year: '2-digit'` quando `d.getFullYear() !== new Date().getFullYear()`. Vale pra todo lugar que já usa `curta`.

- **P7-14 · N30 — "+ instrumento" não parece ação.** `MembrosPage.jsx`: quando `canEdit && !member.role`, renderizar `<button type="button" className="btn-link-inline" style={{ marginLeft: 0 }} onClick={() => setEditingRole(true)}>+ instrumento</button>` no lugar do `<p className="member-role">`; quando já tem instrumento e `canEdit`, manter o `<p>` com um ` ✏️` pequeno no fim.

- **P7-15 · N14 — badge do rodapé pode chegar a 48 pra quem entrou agora.** Manter a regra; `BottomNav.jsx`: `{count > 99 ? '99+' : count}`.

- **P7-16 · N09 — alerta de sucesso ao ativar avisos vira toast.** `App.jsx`: `alert('Pronto! Você recebe aviso de sugestão nova e lembrete de ensaio.')` → `showToast('Pronto! Vai chegar aviso de sugestão nova e lembrete de ensaio.')` (`import { showToast } from './utils/toast'`). Os dois alertas de erro continuam `alert`.

- **P7-17 · N36 — contador do palco não parece clicável.** `PerformanceMode.jsx`, `.perf-progress`: `{idxAtual + 1} / {setlist.length}` → `{idxAtual + 1} / {setlist.length} <span aria-hidden="true">▾</span>` (abre a lista pra pular de música; hoje só o `title` avisa).

