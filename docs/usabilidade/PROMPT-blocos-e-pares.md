# Prompt: blocos de músicas no evento + pares de músicas (sucessora/predecessora)

Cole este arquivo inteiro como primeira mensagem em uma nova sessão do Claude Code aberta na pasta do projeto (`/Users/cristianodacio/Documents/the-stryx`).

> Gerado em 03/09/2026. **Só comece depois que a rodada 2 de usabilidade (`docs/usabilidade/PROMPT-rodada-2.md`) estiver commitada** — este trabalho mexe nos mesmos arquivos (`EnsaioModal.jsx`, `EnsaiosPage.jsx`, `PerformanceMode.jsx`, `SongCard.jsx`) e faria conflito no meio.

---

Você vai implementar um ajuste de permissão e duas features novas, já decididos pelo dono do app, mais um dado de apoio que as features precisam. Não é para propor alternativas: é para executar, por pacotes, com commits pequenos, e reportar ao final de cada pacote.

## Contexto do projeto

- **The Stryx**: PWA em React 19 + Vite + Firebase (Firestore em tempo real com cache persistente, Auth Google, FCM push via GitHub Actions em `.github/scripts/`). Feito para UMA banda amadora brasileira. UI em português do Brasil, tom informal. **Não formalize a linguagem.**
- Público: poucos músicos, no **celular**, no ensaio e no palco. Há um admin (e-mail fixo em código) com ferramentas extras na aba Banda ("🛠 Manutenção", padrão **verificar → aplicar** com preview).
- Telas envolvidas: `/ensaios` "Eventos" (card do evento `EnsaiosPage.jsx`, modal de edição `EnsaioModal.jsx`, Modo palco `PerformanceMode.jsx`, player `SetPlayer.jsx`), `/` Setlist (`SetlistPage.jsx`, `SongCard.jsx`, `AddSongModal.jsx`), `/membros` Banda (`MembrosPage.jsx`, ferramentas admin), scripts de push (`.github/scripts/lembrar-eventos.js`).
- Não é possível logar no app a partir da sessão nem acessar o Firestore por script local (a credencial admin só existe como secret do GitHub Actions). Por isso, **tudo que precisa gravar dados reais vira ferramenta admin dentro do app**, que o dono roda uma vez. Valide com `npm run lint` e `npm run build`, e lendo o código.
- Números de linha citados são do estado atual da branch `feat/usabilidade-rodada-2` e podem ter deslocado. **Localize pelo trecho com `grep -n`, não pela linha.**

## Regras de trabalho

1. **Branch.** Crie `feat/blocos-e-pares` a partir da ponta de `feat/usabilidade-rodada-2` (ou de `main`, se a rodada 2 já tiver sido mergeada). Não faça merge em `main` sem o dono pedir.
2. **Um pacote por vez, na ordem: A (Enviar pro setlist pra todos) → B (blocos) → C (pares) → D (dificuldade só nas Sugestões) → E (presença "só uma parte" com observação) → F (horário do evento).** D, E e F são pequenos e independentes: se B ou C ainda não tiverem começado quando você reler este arquivo, faça-os antes. Ao terminar um pacote: `npm run lint`, `npm run build`, commit(s), relatório curto (modelo no fim). O dono pode interromper entre pacotes.
3. **Commits pequenos, em português, no estilo do histórico** (`feat:`/`fix:`, frase minúscula descrevendo o efeito). Atualize `CHANGELOG.md` (topo) e `src/version.js` + `package.json` ao fechar cada pacote: cada pacote é um **minor** (use o próximo minor livre — confira `src/version.js` antes; A, B, C, D, E e F são minors seguidos).
4. **Não refatore por refatorar.** Nada de TypeScript, testes novos, bibliotecas novas (dnd-kit já está no projeto e é o que se usa).
5. **Padrão de gravação:** disparar `updateDoc/addDoc`, fechar na hora, `.catch(() => alert('Não deu pra salvar agora. Confere a internet e tenta de novo.'))`. Nunca `await` antes de fechar.
6. Tudo que é escala/rótulo/cor continua definido como dado em `src/utils/*` e reaproveitado — nada de string solta repetida em três telas.
7. Se algo aqui contradizer o código (já feito, arquivo mudou muito), **não invente**: pule, anote no relatório e siga.

## Decisões já tomadas (não pergunte de novo)

- **Modelo:** `ensaios/{id}.blocos = [{ id, nome, musicas: [{ id, title, artist, bpm }] }]`. O campo `setlist` **deixa de ser gravado**: música só existe no evento dentro de um bloco (Evento → bloco → música). Evento antigo que só tem `setlist` é lido como um bloco único **só na leitura**, e uma migração admin converte os antigos de vez.
- **Nome do bloco** é texto livre e opcional; vazio mostra "Bloco N" pela posição (renumera sozinho ao reordenar).
- **Numeração das músicas é contínua** no evento inteiro (1…28), como na mensagem do Marcos — não recomeça por bloco.
- **Quantos blocos quiser**, inclusive vazio. "⧉ Copiar" copia os blocos (com ids novos).
- **Pares:** grava-se só a sucessora, em `songs/{id}.proxima = <songId>`. A predecessora é derivada (quem tem `proxima` apontando pra mim). Cadeias A → B → C são permitidas; um **grupo** é a cadeia inteira. Uma música tem no máximo uma sucessora e no máximo uma predecessora; círculo é proibido.
- **No evento o grupo é uma unidade:** entra junto, sai junto, move junto (setas e arrasto), sempre no mesmo bloco e contíguo, na ordem da cadeia.
- **Campo novo `cantor`** em `songs` ("Quem canta", texto livre: "Marcos", "Márcio/Marcos"). É o que falta pra reproduzir a mensagem do Marcos (título — cantor — tom). Aparece como chip 🎤 no card do Setlist, na lista do evento e no Modo palco.
- **Montar o próximo ensaio como na mensagem** é uma ferramenta admin de dois passos (preview → aplicar), com os 28 itens como constante no código (tabela no fim deste arquivo). Depois de rodada, vai pra "Já rodadas".
- **"➤ Enviar pro setlist" aparece para todo membro logado**, não só para o admin, com as mesmas condições de hoje (sugestão `aberta`). Continuam só do admin: "Reabrir" (no banner de aprovada/rejeitada) e "📊 Exportar".
- **Dificuldade é informada e mostrada só nas Sugestões.** No Setlist ela deixa de ser votada, de aparecer no card e de virar ordenação ou pendência; continua só alimentando, por baixo, o desconto de "⚖️ Melhores e fáceis" (o voto viaja da sugestão pra música na aprovação). Isto **reverte o P7-2 da rodada 2** (chip 🎯 no card do Setlist).
- **Presença ganha a terceira resposta "Só uma parte"** (`status: 'parte'`) e uma **observação livre** por pessoa (`presenca.{uid}.obs`, ex.: "chego 21h", "saio antes do bloco 4"). Quem respondeu "só uma parte" conta como confirmado pra lembrete D-1 e pra aviso de cancelamento. Responder qualquer coisa continua tirando a pessoa de "Falta eu responder".
- **Evento ganha horário de início e fim** em dois campos texto `horaInicio`/`horaFim` ("HH:mm"). O campo `date` **continua gravado ao meio-dia**: é a âncora de toda comparação por dia (`jaPassou`, `jaComecou`, `diaDe`, lembretes D-3/D-1) e não pode mudar. Ensaios que já existem e não têm horário recebem **09:00–17:00** por migração admin; apresentação sem horário fica em branco pro dono preencher. Evento novo do tipo ensaio já nasce 09:00–17:00.
- `ensaiadas` (ids das músicas marcadas como ensaiadas) e `presenca` **não mudam de formato**: continuam planos, por id de música/uid (a presença só ganha campos novos dentro da entrada de cada pessoa).

---

## Pacote A — "➤ Enviar pro setlist" para todo membro

Pequeno e independente dos outros dois; vai primeiro.

- **A1 · liberar o botão.** `SugestoesPage.jsx`, `SugestaoModal`: o bloco `{isAdmin && sugestao.status === 'aberta' && (<div className="admin-controls"> … Decisão final … ➤ Enviar pro setlist …)}` perde o `isAdmin &&` — aparece para qualquer membro enquanto a sugestão estiver `aberta`. O `section-label` "Decisão final" vira "Mandar pro setlist" (a classe `.admin-controls` pode ficar). Manter o `confirm` de hoje e acrescentar o aviso de veto: quando `temVeto(sugestao)`, o texto vira `Enviar "${sugestao.title}" pro setlist mesmo com veto de ${nomes}? Ela some daqui e entra como Crua pra todo mundo.`, com `nomes = Object.values(sugestao.opinoes || {}).filter((v) => VETOS.includes(v.opinion)).map((v) => firstName(v.userName)).join(', ')`. A função `approve` (grava a música, marca `status: 'aprovada'`, toast) não muda.

- **A2 · textos que citam o admin.** Na página: `Você sugere, a banda opina. Quando todo mundo opinar sem veto, o admin manda pro setlist.` → `Você sugere, a banda opina. Quando fechar sem veto, qualquer um manda pro setlist.` No modal: o hint `{sugestao.status === 'aberta' && !isAdmin && !temVeto(sugestao) && (…)}` perde o `!isAdmin` (vale pra todos) e `'Todo mundo já opinou — agora é com o admin.'` → `'Todo mundo já opinou — pode mandar pro setlist.'`. Rodar `grep -rn "admin" src/components src/App.jsx` e ajustar qualquer outro texto visível que ainda diga que só o admin envia (não mexer em comentários de código nem em `ADMIN_EMAIL`).

- **A3 · o que continua só do admin.** "Reabrir" (`{isAdmin && <button className="btn-reopen" …>}`) e "📊 Exportar" ficam como estão; `isAdmin` continua sendo passado ao modal por causa do Reabrir. Registrar no `CHANGELOG.md` que qualquer membro pode mandar pro setlist.

---

## Pacote B — blocos de músicas no evento

- **B1 · helper `src/utils/blocos.js`.** Fonte única pra ler evento novo e antigo:
  ```js
  export const novoBlocoId = () => `b${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
  export const nomeDoBloco = (bloco, i) => (bloco?.nome || '').trim() || `Bloco ${i + 1}`
  // Evento antigo (só `setlist`) vira um bloco único — só na leitura; quem
  // grava, grava `blocos` e apaga `setlist`
  export function blocosDe(ensaio) {
    if (Array.isArray(ensaio?.blocos)) return ensaio.blocos
    if (ensaio?.setlist?.length) return [{ id: 'legado', nome: '', musicas: ensaio.setlist }]
    return []
  }
  export const musicasDoEvento = (ensaio) => blocosDe(ensaio).flatMap((b) => b.musicas || [])
  // Achatada com o bloco de cada música e o número contínuo (palco, lista)
  export function musicasComBloco(ensaio) {
    let n = 0
    return blocosDe(ensaio).flatMap((b, bi) =>
      (b.musicas || []).map((m) => ({ ...m, blocoId: b.id, blocoNome: nomeDoBloco(b, bi), blocoIndex: bi, numero: ++n })))
  }
  ```

- **B2 · trocar todos os leitores de `ensaio.setlist` pelo helper.** São estes (`grep -rn "\.setlist" src .github/scripts`):
  - `EnsaiosPage.jsx`: `hasSetlist` → `musicasDoEvento(ensaio).length > 0`; cabeçalho `🎵 {n} músicas` → acrescentar ` · {blocos.length} blocos` quando houver mais de um; `SetlistPreview setlist={musicasDoEvento(ensaio)}` e, no `setlist-preview-more`, `+ N músicas · M blocos`; a lista "Músicas (N)" passa a renderizar **por bloco**: pra cada bloco `<p className="bloco-titulo">{nomeDoBloco(b, bi)} <span className="count">{b.musicas.length}</span></p>` seguido de `<ol className="event-songs-list" start={offset + 1}>` com as mesmas linhas de hoje (link, artista, BPM, ♪ tom, 📄, selo de domínio, checkbox de ensaiada); `SetPlayer setlist={musicasDoEvento(ensaio)}`.
  - `SetlistPage.jsx`: `idsUltimoEnsaio`/`idsProximoEnsaio` a partir de `musicasDoEvento(e)`.
  - `PerformanceMode.jsx`: `useState(event.setlist || [])` → `useState(musicasComBloco(event))`; no `onSnapshot` do evento, `setSetlistAoVivo(musicasComBloco({ id: snap.id, ...snap.data() }))` (a comparação por ids continua igual). Mostrar o bloco: quando o evento tem mais de um bloco, `Tocando agora` vira `Tocando agora · {current.blocoNome}`; na caixa "Próxima", quando `next.blocoId !== current.blocoId`, o rótulo vira `Próxima · abre o {next.blocoNome}`; na lista de pular (`perf-lista`), um `<li className="perf-lista-bloco">{nome}</li>` antes da primeira música de cada bloco. CSS: `.perf-lista-bloco { list-style: none; font-size: 0.78rem; font-weight: 700; letter-spacing: 0.6px; text-transform: uppercase; color: var(--text-muted); margin: 10px 0 2px; }`.
  - `.github/scripts/lembrar-eventos.js` (linha ~99): `const lista = Array.isArray(ev.blocos) ? ev.blocos.flatMap((b) => b.musicas || []) : (ev.setlist || [])` e usar `lista.length` no texto do lembrete D-1. (Node puro, sem import de `src/` — duplicar essa linha é intencional.)
  - `src/utils/integridade.js`: novo check informativo "Eventos com músicas fora de bloco": eventos com `setlist?.length` e sem `blocos` → item `ℹ️ dd/mm · local — rode "Blocos: migrar músicas soltas"` (usar `formatData(ts, { curta: true })` como os outros itens). E um check "Músicas de evento que não existem mais no setlist": pra cada bloco, ids que não estão em `musicas` → `dd/mm · local: Título`.
  - `ImportPage.jsx` `importEnsaios` não grava `setlist` hoje — não precisa mudar.

- **B3 · `EnsaioModal.jsx` edita blocos.**
  - Estado: substituir `const [setlist, setSetlist] = useState(ensaio?.setlist || [])` por
    `const [blocos, setBlocos] = useState(() => blocosDe(ensaio).map((b) => ({ ...b, id: copiando || b.id === 'legado' ? novoBlocoId() : b.id, musicas: [...(b.musicas || [])] })))` — cópia ganha ids novos; evento antigo ganha id de verdade no lugar de `'legado'`.
    `const [blocoDestino, setBlocoDestino] = useState(() => blocos.at(-1)?.id || null)` — pra onde vai a música adicionada (padrão: último bloco).
    `const todasMusicas = blocos.flatMap((b) => b.musicas)` — substitui `setlist` em `menosDominadas(..., todasMusicas.map((s) => s.id), ...)`, na trava de duplicata (`todasMusicas.some(...)`) e no filtro dos resultados da busca.
  - Adicionar: `addSong(song)` e `trazerCruas()` põem no fim do bloco `blocoDestino`; se não há bloco nenhum, criam `{ id: novoBlocoId(), nome: '', musicas: [] }` primeiro e usam ele.
  - UI (na ordem, dentro do `.form-group` "Músicas do evento"):
    1. `<p className="section-label">Músicas do evento {n > 0 && \`(${n})\`}{blocos.length > 1 && \` · ${blocos.length} blocos\`}</p>`.
    2. O input de busca e os resultados, como hoje.
    3. Quando `blocos.length > 1`, logo abaixo da busca: `<label className="bloco-destino">Adicionar em <select value={blocoDestino} onChange={...}>{blocos.map((b, i) => <option value={b.id}>{nomeDoBloco(b, i)}</option>)}</select></label>`.
    4. A linha "Trazer as N músicas menos dominadas", como hoje (vai pro destino).
    5. Um `.bloco-edit` por bloco (classe extra `destino` quando `b.id === blocoDestino`; tocar no cabeçalho do bloco também o torna destino):
       - cabeçalho `.bloco-edit-header`: `<input value={b.nome} placeholder={\`Bloco ${bi + 1}\`} aria-label="Nome do bloco" onChange={...} />`, `<span className="count">{b.musicas.length}</span>`, `.btn-order` ▲/▼ pra mover o bloco (`aria-label="Mover bloco pra cima/baixo"`), `.btn-remove` ✕ (`aria-label="Apagar bloco"`) com `confirm(\`Apagar "${nome}" com ${n} músicas? Elas saem do evento.\`)` quando `n > 0` (bloco vazio apaga sem perguntar).
       - corpo: o mesmo `DndContext` + `SortableContext` + `SortableSetlistItem` de hoje, **um por bloco** (`items = b.musicas.map((s) => s.id)`), com `handleDragEnd` recebendo o `blocoId`. Numeração `event-setlist-pos` contínua (offset = soma dos blocos anteriores). ▲▼ por música atravessam a fronteira: ▲ na primeira música de um bloco que não é o primeiro move ela pro **fim do bloco anterior**; ▼ na última música de um bloco que não é o último move pro **começo do bloco seguinte**. ✕ tira a música.
       - bloco vazio mostra `<p className="filter-hint" style={{ margin: '6px 0 0' }}>Nenhuma música ainda — busque acima ou traga as menos dominadas.</p>`.
    6. `<button type="button" className="btn-secondary" onClick={novoBloco}>+ Novo bloco</button>` que adiciona um bloco vazio no fim e o torna destino.
  - Todo `setBlocos` também chama `setMexeu(true)`.
  - Salvar (`handleSave`): `data.blocos = blocos.map((b) => ({ id: b.id, nome: (b.nome || '').trim(), musicas: b.musicas }))`; **não** gravar `setlist`. Ao editar: comparar `resumo(blocos)` com `resumo(blocosDe(ensaio))`, onde `resumo = (bs) => JSON.stringify(bs.map((b) => [b.nome || '', b.musicas.map((m) => m.id)]))` (ignora o id do bloco, porque o `'legado'` sempre difere); se mudou, `mudou.blocos = data.blocos`; se o evento ainda tinha `setlist` (evento antigo), gravar também `mudou.setlist = deleteField()`. Ao criar/copiar: `{ ...data, presenca: {}, createdAt }` já com `blocos`.
  - Remover do estado local o `setlist` e tudo que só ele usava. `moveSong`/`removeSong`/`handleDragEnd` passam a receber `(blocoId, i, ...)`.
  - CSS: `.bloco-edit { border: 1px solid var(--border); border-radius: var(--radius); padding: 8px 10px 10px; margin-top: 10px; } .bloco-edit.destino { border-color: var(--accent); } .bloco-edit-header { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; } .bloco-edit-header input { flex: 1; font-weight: 700; } .bloco-destino { display: flex; align-items: center; gap: 8px; font-size: 0.8rem; color: var(--text-muted); margin: 8px 0; } .bloco-destino select { width: auto; } .bloco-titulo { font-size: 0.78rem; font-weight: 700; letter-spacing: 0.6px; text-transform: uppercase; color: var(--text-muted); margin: 8px 0 4px; display: flex; gap: 6px; align-items: center; }`.

- **B4 · Copiar copia os blocos.** Já coberto pelo `useState` de B3 (`copiando` → ids novos, mesmas músicas e nomes). Confirmar que `EnsaiosPage.jsx` continua passando `copiando={!!modal.copiar}` e que a frase "Músicas e pauta vieram do evento de…" segue aparecendo.

- **B5 · migração admin "Blocos: migrar músicas soltas dos eventos".** `src/utils/migrarBlocos.js`: `export async function migrarBlocos({ dryRun })` — `getDocs(collection(db, 'ensaios'))`; pra cada doc com `setlist` gravado (mesmo vazio) e sem `blocos` array, `changes.push({ id, label: \`${formatData(date, { curta: true })} · ${location || 'sem local'}\`, n: setlist.length })`; se `!dryRun`, `writeBatch` com `update(ref, { blocos: setlist.length ? [{ id: novoBlocoId(), nome: '', musicas: setlist }] : [], setlist: deleteField() })` (lotes de até 400). Devolve `{ changes }`. Em `MembrosPage.jsx`, ferramenta `BlocosMigrateTool` copiando o padrão de `PresenceMigrateTool` (botão "Verificar" → preview "N evento(s) com músicas fora de bloco" listando os labels → "Aplicar" / "Cancelar"; `setMsg` com `✅ N evento(s) migrado(s)` ou `msgErro(e)`). Fica na fila principal de "🛠 Manutenção" até o dono rodar; depois, mover pra "Já rodadas" num commit à parte.

- **B6 · ferramenta admin "Montar o próximo ensaio (sequência do Marcos, 03/09)".** `src/utils/montarProximoEnsaio.js` com a constante `SEQUENCIA` (tabela no fim deste arquivo, 28 itens `{ bloco, title, cantor, tom, bpm? }`) e `export async function montarProximoEnsaio({ dryRun })`:
  1. Carrega `songs` e `ensaios`. Alvo = o ensaio (`type === 'ensaio'`, `status !== 'cancelado'`) com a menor data ≥ hoje (comparar por dia, como `jaPassou` em `utils/data.js`). Sem alvo → devolver `{ erro: 'Nenhum ensaio futuro. Crie o evento em Eventos › + Evento e rode de novo.' }` (a ferramenta mostra isso em vermelho e não faz nada).
  2. Casa cada item com uma música: `normalizeName` (de `utils/votes.js`) do título, tirando também pontuação (`?!.,'`) dos dois lados; se não achar igual, aceitar `includes` **só quando casar com uma única música**; senão `song: null`.
  3. Preview devolve `{ alvo: label do evento, atuais: nº de músicas que o evento já tem, casadas: [{ title, songTitle }], naoAchadas: [title], camposMusica: [{ title, cantor: 'novo', tom: 'X → Y' | 'mantido X' }] }`. Regras de campos: `cantor` **sempre** vira o da mensagem (é a escala oficial do líder); `tom` só preenche se vazio — se já existe e é diferente, **mantém o do app e lista como conflito** no preview; `bpm` só preenche se vazio.
  4. Aplicar: `writeBatch` — atualiza os campos das músicas casadas e grava no alvo `blocos` = 5 blocos (`nome: ''`, `musicas` na ordem da mensagem, só as casadas, com `{ id, title, artist, bpm }` vindos do doc da música) e `setlist: deleteField()`. Devolve `{ casadas, naoAchadas }`.
  Ferramenta `MontarEnsaioTool` em `MembrosPage.jsx`, mesmo padrão de dois passos; o preview mostra a data do alvo, avisa `vai substituir as N músicas atuais do evento` quando `atuais > 0`, lista as não achadas em amarelo (`adicione manualmente no evento depois`) e os conflitos de tom. Depois de rodada, mover pra "Já rodadas" (commit à parte). **No relatório, liste as músicas não achadas** — o dono pode ajustar títulos no Setlist e rodar de novo.

- **B7 · campo `cantor` ("Quem canta").**
  - `SongCard.jsx`: no `.song-meta-edit` (✏️ Editar), depois de "Tom": `<label>Quem canta<input value={cantor} onChange={...} placeholder="Ex: Marcos, Márcio/Marcos" /></label>`; `openMeta` semeia `setCantor(song.cantor || '')`; `saveMeta` grava `cantor: cantor.trim()`. No card fechado, depois do chip `♪ {tom}`: `{song.cantor && <span className="mini-chip">🎤 {song.cantor}</span>}`. No `backToSuggestions`, levar `...(song.cantor ? { cantor: song.cantor } : {})` no `updateDoc` e `cantor: song.cantor || ''` no `addDoc`.
  - `AddSongModal.jsx`: campo "Quem canta" (opcional) logo depois da `form-row` Tom/BPM, gravado como `cantor: form.cantor.trim()`.
  - `SugestoesPage.jsx` `approve`: `cantor: sugestao.cantor || ''` (a sugestão só terá `cantor` se a música voltou do setlist).
  - `EnsaiosPage.jsx` (linha da música do evento) e `EnsaioModal.jsx` (lista montada e resultados da busca): `{songs[s.id]?.cantor && <span className="event-setlist-bpm"> · 🎤 {songs[s.id].cantor}</span>}` (ao vivo do `songs`/`allSongs`, igual ao tom).
  - `PerformanceMode.jsx`: abaixo do artista, `{current.cantor && <p className="perf-cantor">🎤 {current.cantor}</p>}`; na caixa "Próxima", `{next.cantor && <span className="perf-next-bpm"> · 🎤 {next.cantor}</span>}`. CSS: `.perf-cantor { font-size: clamp(1rem, 3.5vw, 1.4rem); color: var(--accent); font-weight: 600; }`.

---

## Pacote C — pares de músicas (sucessora/predecessora)

- **C1 · helper `src/utils/pares.js`.**
  ```js
  // `proxima` = id da música que SEMPRE vem em seguida. Só a sucessora é
  // gravada; a predecessora é quem tem `proxima` apontando pra esta.
  export const predecessoraDe = (songId, songs) => songs.find((s) => s.proxima === songId) || null
  export const sucessoraDe = (songId, songs) => { const s = songs.find((x) => x.id === songId); return (s?.proxima && songs.find((x) => x.id === s.proxima)) || null }

  // Cadeia inteira a que a música pertence, do começo ao fim (ids). Música
  // solta devolve [songId]. Protegido contra círculo e id que não existe mais.
  export function grupoDe(songId, songs) {
    const porId = Object.fromEntries(songs.map((s) => [s.id, s]))
    let inicio = songId
    const vistos = new Set([songId])
    for (;;) {
      const ant = songs.find((s) => s.proxima === inicio)
      if (!ant || vistos.has(ant.id)) break
      vistos.add(ant.id); inicio = ant.id
    }
    const grupo = [inicio]
    let atual = porId[inicio]
    while (atual?.proxima && porId[atual.proxima] && !grupo.includes(atual.proxima) && grupo.length < 20) {
      grupo.push(atual.proxima); atual = porId[atual.proxima]
    }
    return grupo
  }

  // null se pode gravar songId.proxima = proximaId; senão o motivo, em texto
  export function motivoInvalido(songId, proximaId, songs) {
    if (!proximaId) return null
    if (songId === proximaId) return 'Uma música não pode emendar nela mesma.'
    const outra = songs.find((s) => s.proxima === proximaId && s.id !== songId)
    if (outra) return `Essa já vem depois de "${outra.title}". Tira o vínculo lá primeiro.`
    if (grupoDe(proximaId, songs).includes(songId)) return 'Isso fecharia um círculo (A → B → A).'
    return null
  }
  ```
  Mais duas funções, descritas em prosa (implemente com testes manuais no console se precisar):
  - `unidadesDe(musicas, songs)` → array de unidades, cada uma `{ id: <id da 1ª música>, musicas: [...] }`. Percorre `musicas` em ordem; pra cada música ainda não consumida, pega `grupoDe(m.id, songs)`, e a unidade recebe **as músicas do grupo que estão nesta lista**, na ordem da cadeia, marcando-as como consumidas. Assim um grupo separado ou fora de ordem no bloco vira uma unidade só (e `juntarPares` é quem conserta a posição).
  - `juntarPares(blocos, songs)` → `{ blocos, juntou: [títulos] }`. Pra cada grupo com 2+ músicas presentes no evento: todas as músicas do grupo vão pro **bloco e posição da primeira que aparece** (ordem de leitura dos blocos), contíguas, na ordem da cadeia; as outras são removidas de onde estavam. `juntou` recebe o título das que mudaram de lugar. Não muda nada se já estiver tudo junto.

- **C2 · configurar o par no card do Setlist (`SongCard.jsx`).** O `SetlistPage.jsx` passa `todasMusicas={songs}` pro `SongCard`. No `.song-meta-edit` (✏️ Editar), um bloco `Toca junto com` com dois `<select>` (nativo, 48 opções é ok no celular): `Vem depois de` (predecessora; valor inicial `predecessoraDe(song.id, todasMusicas)?.id || ''`) e `Depois dela vem` (sucessora; valor inicial `song.proxima || ''`), opções `— nenhuma —` + todas as outras músicas em ordem alfabética (`localeCompare` pt-BR). No `saveMeta`, além dos campos de hoje:
  - sucessora mudou → `motivoInvalido(song.id, nova, todasMusicas)`; se der motivo, `alert(motivo)` e não grava nada; senão `proxima: nova || deleteField()` no próprio doc.
  - predecessora mudou → se havia uma antiga, `update(doc(db, 'songs', antiga.id), { proxima: deleteField() })`; se há nova, `motivoInvalido(nova, song.id, todasMusicas)` (alert e aborta se der motivo) e `update(doc(db, 'songs', nova), { proxima: song.id })`.
  - Tudo num `writeBatch` só, com o mesmo `.catch(erroSalvar)`; fechar o editor na hora.
  - Chips no card fechado, depois do 🎤: `{pred && <span className="mini-chip mini-chip-par" title="Sempre vem depois dessa">⛓ ← {pred.title}</span>}` e `{prox && <span className="mini-chip mini-chip-par" title="Emenda direto nessa">⛓ → {prox.title}</span>}`. CSS: `.mini-chip-par { max-width: 160px; overflow: hidden; text-overflow: ellipsis; }`.
  - `remove` (apagar música) e `backToSuggestions`: antes de `deleteDoc(ref)`, se `predecessoraDe(song.id, todasMusicas)` existe, `update(docDela, { proxima: deleteField() })` no mesmo batch — senão fica um `proxima` apontando pro nada.

- **C3 · o grupo é uma unidade no `EnsaioModal.jsx`.**
  - `addSong(song)`: `const ids = grupoDe(song.id, allSongs)`; adiciona **todas** que ainda não estão no evento, na ordem da cadeia, no fim do bloco destino (`{ id, title, artist, bpm }` de cada uma). Se entrou mais de uma, `setAviso(\`Trouxe também ${outras.join(', ')} — sempre tocam juntas.\`)` (reaproveitar o `avisoCruas` renomeado pra `aviso`, exibido no mesmo lugar).
  - `trazerCruas()`: depois de `menosDominadas(...)`, expandir cada escolhida com `grupoDe`, tirar repetidas e as que já estão no evento; mensagem `N músicas adicionadas (M vieram junto por sempre tocarem juntas)` quando `M > 0`.
  - Renderização por bloco: `unidadesDe(b.musicas, allSongs)`; cada unidade é **um** `SortableSetlistItem` (`id = unidade.id`), com **um** conjunto de ▲▼✕ à direita. Unidade com 2+ músicas mostra as músicas empilhadas dentro do item, cada uma com seu número contínuo, e um `⛓` à esquerda com `title="Sempre tocam juntas, nessa ordem"`. `SortableContext items = unidades.map((u) => u.id)`; `handleDragEnd` reordena as unidades (`arrayMove`) e achata de volta pra `b.musicas`. ▲▼ movem a unidade inteira (inclusive atravessando bloco, como em B3). ✕ tira a unidade inteira; com 2+ músicas, `confirm(\`Tirar ${n} músicas do evento? ${títulos} sempre tocam juntas.\`)`.
  - Ao abrir (quando `allSongs` chega — `useEffect` em `[allSongs]` com um `useRef` pra rodar uma vez): `const { blocos: b2, juntou } = juntarPares(blocos, allSongs)`; se `juntou.length`, `setBlocos(b2)`, `setMexeu(true)`, `setAviso(\`Juntei ${juntou.join(' e ')}, que sempre tocam juntas.\`)`.
  - Resultados da busca: música que pertence a um grupo ganha `<span className="mini-chip" title="Vem junto com …">⛓</span>` (o `title` lista os outros títulos do grupo).
  - CSS: `.event-setlist-item.unidade { flex-direction: column; align-items: stretch; } .unidade-musica { display: flex; align-items: center; gap: 8px; } .unidade-elo { color: var(--accent); font-size: 0.9rem; }`.

- **C4 · mostrar o elo fora do modal.** `EnsaiosPage.jsx`, linha da música do evento: `{songs[s.id]?.proxima && <span className="mini-chip" style={{ marginLeft: 6 }} title="Emenda direto na próxima">⛓</span>}`. `PerformanceMode.jsx`, caixa "Próxima": quando `current.proxima === next?.id`, o rótulo vira `Próxima · emenda direto ⛓`.

- **C5 · integridade.** Em `src/utils/integridade.js`, check "Pares de músicas": `proxima` apontando pra música que não existe (`Título → id inexistente`) e música que é `proxima` de duas (`Título vem depois de A e de B`). Informativo, sem correção automática.

---

---

## Pacote D — dificuldade só nas Sugestões

Hoje a dificuldade é votada e mostrada em dois lugares (modal da sugestão e card do Setlist). Passa a existir só na sugestão. Lista completa dos pontos fora das Sugestões: `grep -rn "dificuldade\|DIFFICULTIES\|calcDifficulty\|fatorFacilidade" src --include='*.jsx' --include='*.js' | grep -v "SugestoesPage\|utils/dificuldade\|migrarDificuldade\|utils/pendencias\|dedupSugestoes"`.

- **D1 · tirar o voto e o chip do card do Setlist.** `SongCard.jsx`: apagar o bloco `🎯 Dificuldade pra tocar` (botões `DIFFICULTIES.map` + pills de quem votou), a função `voteDiff`, `myDiff` e o chip `🎯 {diff.label}` da linha do card fechado (entrou na rodada 2 como P7-2). Apagar os imports que sobrarem sem uso (`DIFFICULTIES`, `calcDifficulty`, `difficultyByWeight`). **Manter** `const dificuldade = song.dificuldade || {}` — `backToSuggestions` continua levando os votos de volta pra sugestão (`dificuldade: { ...(snap.data().dificuldade || {}), ...dificuldade }` e `dificuldade` no `addDoc`). Texto do confirm de "Remover": `Votos de domínio, dificuldade e opinião, tom, BPM…` → `Votos de domínio e opinião, tom, BPM…`.

- **D2 · "Falta meu voto" do Setlist deixa de cobrar dificuldade.** `SetlistPage.jsx`, `meuVotoFalta`: apagar a linha `!(s.dificuldade || {})[user.uid] ||`; `src/hooks/usePendencias.js`, `setlistPendentes`: apagar a mesma linha (os dois precisam bater, é a regra do badge do rodapé). `title` do chip "🗳 Falta meu voto" no Setlist → `Mostrar só as músicas que faltam você indicar domínio ou opinião`. Ajustar os comentários que citam "dificuldade" nesses dois trechos. Sem isso, as 32 músicas importadas (que nunca passaram por sugestão) ficariam pendentes pra sempre, sem botão pra resolver.

- **D3 · ordenações do Setlist.** `SetlistPage.jsx`: tirar `{ value: 'dificuldade', label: '🎯 Dificuldade' }` de `SORTS`, o ramo de ordenação por `calcDifficulty(...).max` no `displayed` e o `'dificuldade'` do array que decide a bolinha `#N` (`position={['balanceada', 'media', 'dificuldade'].includes(sortBy) …}`). Apagar `calcDifficulty` do import; **manter** `fatorFacilidade` e a ordenação `'balanceada'`. Como o Setlist passa a ordenar por um dado que não mostra, dar a mesma ajuda que Sugestões já dá: campo `hint` só nessa entrada de `SORTS` (`hint: 'Nota da banda, descontada pela dificuldade que a galera votou lá nas Sugestões'`) e, logo depois da `.sort-bar`, `{SORTS.find((s) => s.value === sortBy)?.hint && <p className="filter-hint">{…}</p>}` (copiar de `SugestoesPage.jsx`). `sortBy` do Setlist não persiste em localStorage, então não há valor velho `'dificuldade'` pra tratar.

- **D4 · Sugestões continuam iguais — só conferir.** No modal: bloco "🎯 Dificuldade pra tocar" gravando no toque; no card da lista: chip 🎯; ordenações "🎯 Dificuldade" e "⚖️ Melhores e fáceis"; filtro "🗳 Falta meu voto" cobrando opinião **e** dificuldade (`utils/pendencias.js` `faltaVotar`, não mexer). `approve` continua copiando `dificuldade` pra música (é o que alimenta o ⚖️ do Setlist). O comentário `// desfaz, igual aos votos de dificuldade` em `EnsaiosPage.jsx` (`PresencaBar`) vira `igual aos votos de domínio`. `CHANGELOG.md`: registrar que a dificuldade passou a ser votada e vista só nas Sugestões, e que o Setlist perdeu a ordenação 🎯.

---

## Pacote E — presença "só uma parte" com observação

Tem gente que vai ao ensaio, mas só parte do tempo (chega depois, sai antes). Hoje só existe Vou/Não vou, e quem vai só uma parte marca "Vou" e avisa no grupo — a informação se perde. Consumidores do campo hoje: `grep -rn "presenca\b\|PRESENCAS\|splitPresenca\|status === 'vai'" src .github/scripts`.

- **E1 · escala.** `src/utils/presenca.js`, `PRESENCAS`: inserir entre "Vou" e "Não vou": `{ value: 'parte', label: 'Só uma parte', short: 'Parte', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' }`. `splitPresenca` devolve também `parte: []` (mesma lógica dos outros dois), e cada membro de `vao`, `parte` e `nao` sai com a observação anexada: `{ ...m, obs: p[m.firebaseUid]?.obs || '' }`. `faltaResponder` não muda (qualquer resposta conta). O `Set` de status válidos em `src/utils/integridade.js` já vem de `PRESENCAS` — nada a fazer lá.

- **E2 · responder e anotar (`EnsaiosPage.jsx`, `PresencaBar`).**
  - Os três botões (`Vou · Só uma parte · Não vou`) saem do `PRESENCAS.map` que já existe; nada muda no toggle (tocar de novo desfaz).
  - Gravar por caminho pontilhado pra **não apagar a observação ao trocar de resposta**: em vez de `` [`presenca.${uid}`]: { status, name, at } ``, gravar `` { [`presenca.${uid}.status`]: status, [`presenca.${uid}.name`]: userName, [`presenca.${uid}.at`]: new Date().toISOString() } `` (o Firestore cria o mapa intermediário sozinho). Desfazer continua `deleteField()` na entrada inteira (a observação vai junto — é sobre aquela resposta).
  - Abaixo dos botões, só quando `meu` existe: uma linha `.presenca-obs` clicável no padrão do `.song-notes` — mostra `📝 {obs}` ou, sem observação, o placeholder em `.placeholder`: `meu === 'parte' ? 'Que parte? Ex: chego às 21h, saio antes do bloco 4' : 'Adicionar observação (ex: chego 10 min atrasado)'`. Tocar abre um `<input>` inline (`notes-edit` com input em vez de textarea, `maxLength={80}`, `aria-label="Observação da presença"`) com "Salvar" e "Cancelar"; Enter salva, Esc cancela. Salvar grava `` [`presenca.${uid}.obs`]: texto.trim() `` (vazio → `deleteField()` só do `obs`), fecha na hora, `.catch` com o alerta padrão. Ao escolher "Só uma parte" **sem observação ainda**, abrir o input automaticamente (autoFocus) — a pessoa pode ignorar e sair sem digitar.

- **E3 · mostrar (`EnsaiosPage.jsx`).**
  - `PresencaResumo`: nova linha entre "Vão" e "Não vão": `linha(passado ? 'Foram parte' : 'Só uma parte', parte, PRESENCAS[1].color)` (atenção: o índice de "Não vou" em `PRESENCAS` vira `[2]`). Nas três linhas, o `member-tag` de quem tem observação vira `{firstName(m.name)} <span className="member-tag-obs">· {m.obs}</span>` com `` title={`${m.name}: ${m.obs}`} ``.
  - Cabeçalho da linha normal: entre `{vao.length} vão` e `{nao.length} não`, `{parte.length > 0 && <span className="ensaio-row-members presenca-parte">{parte.length} parte</span>}`.
  - Card destaque: `✓ {vao.length} confirmados` → `✓ {vao.length + parte.length} confirmados` seguido de ` ({parte.length} só uma parte)` quando `parte.length > 0`; mostrar quando a soma for > 0.
  - CSS: `.presenca-parte { color: #f59e0b; } .presenca-obs { font-size: 0.8rem; color: var(--text-muted); cursor: pointer; margin-top: 4px; padding: 3px 6px; border-radius: var(--radius-sm); border: 1px solid transparent; } .presenca-obs:hover { border-color: var(--border); } .member-tag-obs { font-weight: 400; opacity: 0.85; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: inline-block; vertical-align: bottom; }`.

- **E4 · lembretes e avisos (scripts Node, sem import de `src/`).**
  - `.github/scripts/lembrar-eventos.js`: no D-1, `alvos = todosUids.filter((uid) => ['vai', 'parte'].includes(presenca[uid]?.status))` e `confirmados = Object.values(presenca).filter((p) => ['vai', 'parte'].includes(p.status)).length`; se houver gente em `parte`, o corpo ganha ` (N só uma parte)` depois de "confirmados". D-3 (`!presenca[uid]`) não muda.
  - `.github/scripts/enviar-sugestoes.js`, aviso `evento_cancelado`: `destinatarios = tokens.filter((t) => ['vai', 'parte'].includes(presenca[t.uid]?.status))`.

- **E5 · conferir que continua igual.** `faltaResponder`/`usePendencias` (badge de Eventos e aba "⏳ Falta eu responder"): quem respondeu "só uma parte" não aparece mais como pendente. `migrateEventPresence` (já rodada) não muda. `CHANGELOG.md`: registrar a resposta nova e a observação.

---

## Pacote F — horário do evento

Hoje o evento só tem dia. A banda precisa saber que hora começa e termina (ensaio é 9h às 17h; show tem horário próprio), e o lembrete de véspera deveria dizer a hora. Consumidores da data hoje: `grep -rn "\.date\b\|T12:00:00\|formatData\|relativeLabel" src .github/scripts`.

- **F1 · helper.** `src/utils/data.js`: `export function formatHorario(ini, fim)` — `const h = (t) => { const [hh, mm] = t.split(':'); return mm === '00' ? `${Number(hh)}h` : `${Number(hh)}h${mm}` }`; devolve `${h(ini)} às ${h(fim)}` quando tem os dois, `a partir das ${h(ini)}` só com início, `até ${h(fim)}` só com fim, `''` sem nenhum. Exemplos: `09:00`/`17:00` → `9h às 17h`; `20:30`/`` → `a partir das 20h30`. Duplicar a função (sem import de `src/`) em `.github/scripts/lembrar-eventos.js` e `.github/scripts/enviar-sugestoes.js`, como já se faz com `formatarData`.

- **F2 · `EnsaioModal.jsx`.**
  - `form` ganha `horaInicio` e `horaFim`: ao editar/copiar, vêm do evento (`ensaio?.horaInicio || ''`); ao criar, `type === 'ensaio' ? '09:00' : ''` e `'17:00' : ''`. Ao trocar o tipo pra **Ensaio** com os dois campos vazios, preencher 09:00/17:00; ao trocar pra Apresentação, não mexer no que a pessoa digitou.
  - Nova `form-row` logo abaixo de Data/Local: `<label>Início<input type="time" name="horaInicio" step="300" value={form.horaInicio} onChange={handleChange} /></label>` e `<label>Fim<input type="time" name="horaFim" step="300" … /></label>`. Não é obrigatório.
  - Validação no `handleSave`: se os dois estão preenchidos e `form.horaFim <= form.horaInicio` (comparação de string "HH:mm" funciona), `alert('O fim precisa ser depois do início.')` e não salvar.
  - `data.horaInicio = form.horaInicio || ''`, `data.horaFim = form.horaFim || ''`. No modo edição, entram em `mudou` quando diferem do evento; **mudança de horário também conta como remarcação**: `else if ((mudou.date || mudou.horaInicio || mudou.horaFim) && data.status !== 'cancelado') enfileirarAviso('evento_remarcado', …)`. `enfileirarAviso` passa a gravar também `horaInicio: data.horaInicio, horaFim: data.horaFim` no item da fila.
  - `date` continua `Timestamp.fromDate(new Date(form.date + 'T12:00:00'))` — **não trocar pelo horário de início** (ver decisões).

- **F3 · mostrar (`EnsaiosPage.jsx`, `PerformanceMode.jsx`).**
  - `const horario = formatHorario(ensaio.horaInicio, ensaio.horaFim)`. Linha normal: depois de `formatData(ensaio.date, { curta: true })`, `{horario && <span className="ensaio-row-hora">· {horario}</span>}`. Card destaque: abaixo de `next-ensaio-date`, `{horario && <p className="next-ensaio-loc">🕘 {horario}</p>}` (antes do 📍 local). Aba compacta ("Falta eu responder") usa a linha normal — já cobre.
  - `relativeLabel(ts)` hoje faz `Math.round((d - now) / 86400000)` com a data ao meio-dia — às 22h da véspera dá `Hoje!`. Reescrever por dia: `const dias = Math.round((diaDe(d) - diaDe(new Date())) / 86400000)` (copiar `diaDe` de `SetlistPage.jsx` pra `utils/data.js` e exportar), e receber o evento inteiro: `0` → `Hoje${ensaio.horaInicio ? `, ${h(horaInicio)}` : '!'}`, `1` → `Amanhã`, `>1` → `em N dias`, `<0` → `N dias atrás`.
  - Ordem: o `onSnapshot` de `ensaios` já vem por `date`; desempatar no cliente por `horaInicio` (`(a.horaInicio || '').localeCompare(b.horaInicio || '')`) pra dois eventos no mesmo dia.
  - `PerformanceMode.jsx`, `.perf-event-name`: depois da data curta, ` · {horario}` quando houver. Opcional.
  - CSS: `.ensaio-row-hora { font-size: 0.82rem; color: var(--text-muted); white-space: nowrap; }`.

- **F4 · lembretes e avisos.**
  - `.github/scripts/lembrar-eventos.js`: `const horario = formatarHorario(ev.horaInicio, ev.horaFim)` e, nos dois corpos (D-3 e D-1), `${formatarData(data)}${horario ? `, ${horario}` : ''}${onde}` — ex.: `sáb., 06/09, 9h às 17h em Estúdio X. Você vai? Confirme sua presença.`
  - `.github/scripts/enviar-sugestoes.js`, tipos `novo_evento`/`evento_remarcado`/`evento_cancelado`: `const horario = formatarHorario(dados.horaInicio, dados.horaFim)` e o mesmo encaixe depois de `formatarData(data)`. Item antigo da fila sem os campos cai no `''` e o texto fica como hoje.

- **F5 · migração admin "🕘 Horário 9h–17h nos ensaios sem horário".** `src/utils/migrarHorario.js`: `export async function migrarHorario({ dryRun })` — `getDocs(ensaios)`; alvo = docs com `(type || 'ensaio') === 'ensaio'` e sem `horaInicio`; `changes.push({ id, label: `${formatData(date, { curta: true })} · ${location || 'sem local'}` })`; `!dryRun` → `writeBatch` com `update(ref, { horaInicio: '09:00', horaFim: '17:00' })`. Devolve também `apresentacoesSemHorario: [labels]` (só informa; não mexe — o dono preenche pelo Editar). Ferramenta `HorarioTool` em `MembrosPage.jsx` no mesmo padrão dos outros (Verificar → preview "N ensaio(s) vão ficar 9h às 17h" + "M apresentação(ões) continuam sem horário: …" → Aplicar). Depois de rodada, vai pra "Já rodadas".

- **F6 · importação e integridade.** `ImportPage.jsx` `importEnsaios`: gravar `horaInicio: '09:00', horaFim: '17:00'` nos eventos importados (são ensaios). `src/utils/integridade.js`: check informativo "Horários": eventos com os dois campos e `horaFim <= horaInicio` → `dd/mm · local: fim antes do início`. `CHANGELOG.md`: registrar o horário e a migração.

## Não mexer

- `ensaiadas` e `presenca` continuam planos, por id/uid, sem relação com bloco.
- `date` do evento gravado ao meio-dia (`T12:00:00`) e todas as comparações por dia (`jaPassou`, `jaComecou`, `diaDe`, `diasAte` dos scripts) — o horário vive em `horaInicio`/`horaFim`, nunca dentro de `date`.
- Arrasto por alça ⠿ com `TouchSensor` de 250ms e `PointerSensor` com `distance: 6` — só muda o que é arrastado (unidade) e o escopo (um contexto por bloco).
- Padrão das ferramentas admin (verificar → aplicar, `msgErro`, mensagem única com `setMsg`, "Já rodadas").
- Lembretes D-3/D-1 e a fila `notification_queue` — o script só troca a origem da contagem de músicas.
- Modo palco: swipe, lista pra pular, `sessionStorage`, Wake Lock, "Repertório atualizado · aplicar" (que continua comparando ids achatados).
- Vínculo `sugestaoId`, "↩ Voltar pras sugestões" e "➤ Enviar pro setlist" — só ganham o campo `cantor`; os votos de dificuldade continuam viajando nos dois sentidos.
- `src/utils/dificuldade.js` (escala, `calcDifficulty`, `fatorFacilidade`) e a ferramenta admin "🎯 Converter dificuldade pra escala única" (já rodada) ficam como estão.

## Como reportar cada pacote

1. Ids implementados (A1…A3, B1…B7, C1…C5, D1…D4, E1…E5, F1…F6) e o commit de cada um.
2. Ids pulados e por quê.
3. O que o dono precisa fazer/testar: rodar "Blocos: migrar músicas soltas", "Montar o próximo ensaio" e "Horário 9h–17h nos ensaios" na aba Banda; conferir no celular arrasto dentro do bloco, ▲▼ atravessando bloco, o palco com blocos, e a observação da presença (abrir automático ao marcar "Só uma parte"). **Listar as músicas da sequência que a ferramenta não achou no setlist.**
4. Resultado de `npm run lint` e `npm run build`.

Comece pelo Pacote A.

---

## Apêndice — sequência do Marcos (mensagem no grupo, 03/09/2026, 18:58)

Constante `SEQUENCIA` de `src/utils/montarProximoEnsaio.js`. `tom` está na notação da mensagem (a app aceita texto livre). Só o item 27 tem BPM.

| # | bloco | title | cantor | tom | bpm |
|---|---|---|---|---|---|
| 1 | 1 | Meu Erro | Marcos | C | |
| 2 | 1 | Bichos Escrotos | Márcio | C | |
| 3 | 1 | Até Quando Esperar | Márcio | C | |
| 4 | 1 | Será | Marcos | C | |
| 5 | 1 | O Tempo Não Para | Marcos | Em | |
| 6 | 2 | Tempo Perdido | Marcos | Em | |
| 7 | 2 | Borracho y Loco | Márcio | Em | |
| 8 | 2 | Quase Sem Querer | Márcio | G | |
| 9 | 2 | Mulher de Fases | Márcio | G | |
| 10 | 2 | Me Lambe | Márcio | G | |
| 11 | 3 | SOS | Márcio | G | |
| 12 | 3 | Luz dos Olhos | Márcio | Am | |
| 13 | 3 | Psycho Killer | Márcio | Am | |
| 14 | 3 | Have You Ever Seen The Rain | Marcos | C | |
| 15 | 3 | Jumento Celestino | Márcio | C | |
| 16 | 4 | Reggae do Manero | Marcos | D | |
| 17 | 4 | Não Sei | Marcos | D | |
| 18 | 4 | Pelados em Santos | Márcio | Bm | |
| 19 | 4 | Graffiti | Márcio | C#m | |
| 20 | 4 | Santeria | Marcos | E | |
| 21 | 5 | Clube dos Canalhas | Márcio | E | |
| 22 | 5 | Nothing Else Matters | Marcos | Em | |
| 23 | 5 | Born To Be Wild | Márcio | Em | |
| 24 | 5 | Sharp Dressed Man | Marcos | G | |
| 25 | 5 | Astronauta de Mármore | Marcos | Dm | |
| 26 | 5 | Cabeça de Bagre | Márcio | F | |
| 27 | 5 | You Shook Me All Night Long | Marcos | F | 128 |
| 28 | 5 | Smells Like Teen Spirit | Márcio/Marcos | Fm | |

Em código:

```js
export const SEQUENCIA = [
  { bloco: 1, title: 'Meu Erro', cantor: 'Marcos', tom: 'C' },
  { bloco: 1, title: 'Bichos Escrotos', cantor: 'Márcio', tom: 'C' },
  { bloco: 1, title: 'Até Quando Esperar', cantor: 'Márcio', tom: 'C' },
  { bloco: 1, title: 'Será', cantor: 'Marcos', tom: 'C' },
  { bloco: 1, title: 'O Tempo Não Para', cantor: 'Marcos', tom: 'Em' },
  { bloco: 2, title: 'Tempo Perdido', cantor: 'Marcos', tom: 'Em' },
  { bloco: 2, title: 'Borracho y Loco', cantor: 'Márcio', tom: 'Em' },
  { bloco: 2, title: 'Quase Sem Querer', cantor: 'Márcio', tom: 'G' },
  { bloco: 2, title: 'Mulher de Fases', cantor: 'Márcio', tom: 'G' },
  { bloco: 2, title: 'Me Lambe', cantor: 'Márcio', tom: 'G' },
  { bloco: 3, title: 'SOS', cantor: 'Márcio', tom: 'G' },
  { bloco: 3, title: 'Luz dos Olhos', cantor: 'Márcio', tom: 'Am' },
  { bloco: 3, title: 'Psycho Killer', cantor: 'Márcio', tom: 'Am' },
  { bloco: 3, title: 'Have You Ever Seen The Rain', cantor: 'Marcos', tom: 'C' },
  { bloco: 3, title: 'Jumento Celestino', cantor: 'Márcio', tom: 'C' },
  { bloco: 4, title: 'Reggae do Manero', cantor: 'Marcos', tom: 'D' },
  { bloco: 4, title: 'Não Sei', cantor: 'Marcos', tom: 'D' },
  { bloco: 4, title: 'Pelados em Santos', cantor: 'Márcio', tom: 'Bm' },
  { bloco: 4, title: 'Graffiti', cantor: 'Márcio', tom: 'C#m' },
  { bloco: 4, title: 'Santeria', cantor: 'Marcos', tom: 'E' },
  { bloco: 5, title: 'Clube dos Canalhas', cantor: 'Márcio', tom: 'E' },
  { bloco: 5, title: 'Nothing Else Matters', cantor: 'Marcos', tom: 'Em' },
  { bloco: 5, title: 'Born To Be Wild', cantor: 'Márcio', tom: 'Em' },
  { bloco: 5, title: 'Sharp Dressed Man', cantor: 'Marcos', tom: 'G' },
  { bloco: 5, title: 'Astronauta de Mármore', cantor: 'Marcos', tom: 'Dm' },
  { bloco: 5, title: 'Cabeça de Bagre', cantor: 'Márcio', tom: 'F' },
  { bloco: 5, title: 'You Shook Me All Night Long', cantor: 'Marcos', tom: 'F', bpm: 128 },
  { bloco: 5, title: 'Smells Like Teen Spirit', cantor: 'Márcio/Marcos', tom: 'Fm' },
]
```
