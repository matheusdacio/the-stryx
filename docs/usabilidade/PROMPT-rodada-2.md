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

