# Changelog — The Stryx App

Convenção [semver](https://semver.org/lang/pt-BR/): `MAJOR.MINOR.PATCH`
- **PATCH** — correção ou ajuste pequeno
- **MINOR** — feature nova
- **MAJOR** — mudança grande / reformulação

A versão exibida no app vem de `src/version.js` (mantenha em sincronia com o `package.json`).

> As versões abaixo foram **reconstruídas retroativamente** a partir do histórico de
> commits (o versionamento formal começou na 1.21.0). Cada `feat` virou um *minor*,
> cada `fix` um *patch*, partindo da 1.0.0 no primeiro commit.

---

## [1.28.0] — 2026-09-02
- **Presença por pessoa nos eventos**: no lugar da lista de checkboxes onde qualquer um marcava por todo mundo, cada pessoa logada responde **Vou / Não vou** no próprio card do evento (clicar de novo desfaz). O card mostra quem vai, quem não vai e quem ainda não respondeu, e o cabeçalho traz os contadores ✓/✕
- _fix:_ a marcação de "ensaiada" e a pergunta "Você vai?" não aparecem mais em evento fora de hora — a marcação começa no dia do evento, a pergunta desaparece quando a data passa, e o resumo de presença passa a falar no passado ("Foram" / "Não foram")
- **Sugestão que já está no setlist sai das Sugestões**, inclusive do filtro "Todas". O cruzamento usa o vínculo gravado na aprovação e, pras aprovadas antigas que não têm esse vínculo, o título + artista normalizados. Se a música for removida do setlist depois, a sugestão reaparece
- **Cards de evento sempre abertos**: acabou o "Ver detalhes" e o clique pra expandir — músicas, presença, pauta e observações ficam à mostra
- **Ciclo ensaiando → pronta**: a partir do dia do evento, cada música do repertório tem uma marcação de "ensaiada"; marcando as que rolaram, aparece um botão que promove de uma vez as que ainda estão em "Ensaiando" pra "Pronta" no setlist
- **Busca automática ao cadastrar sugestão**: digitando o nome da música, o app oferece os candidatos do catálogo do iTunes (título, artista e ano) e preenche o artista com um clique, sem sobrescrever o que já foi digitado. Se as chaves opcionais estiverem configuradas, também busca o link do YouTube e o tom/BPM da gravação original — ver `.env.example`
- **Lembretes automáticos de evento** por push: três dias antes, só pra quem ainda não indicou presença; um dia antes, pra quem confirmou, com local, número de confirmados e tamanho do repertório. Cada aviso é marcado no evento, então não repete
- _chore:_ eslint passa a reconhecer os scripts de notificação como Node, o que zera 6 erros de lint que já existiam no projeto
- **Tocar o set em sequência** no Modo palco: botão "▶ Tocar" que abre um player do YouTube dentro do app e emenda a próxima música quando a atual termina, sem sair pro YouTube. O primeiro play exige um toque na tela (política de autoplay dos navegadores), vídeo com incorporação bloqueada pelo dono avisa em vez de travar, e no celular o som para se a tela bloquear
- A aba de eventos ganhou **⏳ Presença pendente** como segunda opção, logo depois de Próximos
- **Card do evento mais informativo**: além de quem vai e quem falta responder, o card do próximo evento já lista as **5 primeiras músicas** com o total restante, sem precisar abrir os detalhes
- **Filtro "⏳ Falta indicar"**: mostra só os eventos futuros em que você ainda não respondeu se vai ou não, com o número pendente no próprio botão
- **Copiar evento**: novo botão que abre um evento novo já com o repertório, a pauta (itens desmarcados), local e tipo do evento escolhido. A data fica em branco e a presença começa zerada
- **Ferramenta "Migrar pra presença por pessoa"** na página Banda (admin): eventos já realizados preservam o histórico como "Vou", os futuros nascem em branco pra banda confirmar de verdade, e quem não está no cadastro (convidado de ensaio antigo) é preservado à parte. Rodada uma vez nos 21 eventos
- **Tom da música** (Ex: Sol, Am): campo novo no cadastro e na edição da música, chip no card do setlist, e viaja junto na ida e volta entre sugestão e setlist
- **Modo palco** passa a mostrar o **tom em destaque** e as **observações** da música (ex: quem canta). Além disso, o palco agora lê o repertório ao vivo em vez do retrato guardado no evento — mudou o BPM, o tom ou a observação no setlist, o palco já reflete; música removida do repertório continua aparecendo com os dados salvos no evento

## [1.27.0] — 2026-09-02
- **Ordenação "Melhores e fáceis"** nas Sugestões, agora a **padrão** ao abrir a página e primeira da barra: combina a nota das opiniões com a dificuldade votada, pra deixar no topo o que a banda gostou mais e toca mais fácil. A nota é a base e a dificuldade entra como desconto (Fácil não desconta, Ok ×0,85, Difícil ×0,7), então música difícil precisa ser bem melhor avaliada pra passar na frente de uma fácil. Quem ainda não tem voto de dificuldade conta como Ok. O badge de posição (#1, #2…) agora aparece também nessa ordenação
- **Ferramenta "Normalizar membros dos eventos"** na página Banda (admin): mostra evento por evento quais nomes antigos serão trocados pelos do cadastro atual e, se confirmado, regrava só o campo de membros. Rodada uma vez: 17 dos 21 eventos tinham nome antigo ou pessoa repetida
- _fix:_ membros dos eventos: o card mostrava a mesma pessoa duas vezes quando o nome do cadastro mudava depois do evento ("Cristiano" e "Cristiano Dácio"), e misturava nome com e sem sobrenome. Agora os chips juntam os nomes da mesma pessoa e mostram só o primeiro nome (o nome completo fica no title). No modal de edição, os checkboxes reconhecem os nomes antigos salvos no evento — inclusive por apelido, então "Marcio Braz" marca o "Marcio Filho" de hoje —, quem saiu da banda aparece como "fora da banda" pra poder ser desmarcado, e salvar regrava os nomes como estão no cadastro atual
- _fix:_ o chip de dificuldade no card da sugestão passa a mostrar o **nível mais alto votado** em vez da média: se alguém disse que é difícil, aparece Difícil. A ordenação "Dificuldade" segue o mesmo critério, pra lista e chip não se contradizerem

## [1.26.1] — 2026-08-31
- _fix:_ arrastar pra reordenar passa a funcionar também nos filtros Ensaiando/Prontas/Extras, com tag e com busca ativa (soltar em cima de uma música move a arrastada pra posição dela na lista completa). Continua desligado só nas ordenações "Mais antigas" e "Mais fáceis"

## [1.26.0] — 2026-08-31
- **Busca com lupa** no Setlist e nas Sugestões: ícone discreto no header que expande num campo de busca por título/artista, ignorando acentos e maiúsculas (Esc ou ✕ fecha)
- **Arrastar pra reordenar** o setlist: segure a bolinha da posição e arraste (no celular, segure ~250ms). Disponível no filtro "Todas" sem tag/busca ativa; as setinhas continuam funcionando em qualquer filtro

## [1.25.0] — 2026-08-18
- **Voltar pras sugestões**: botão no card do setlist que tira a música da lista e devolve pra aba de Sugestões. Se a música tinha vindo de uma sugestão aprovada, a sugestão original é reaberta com as opiniões preservadas; senão nasce uma sugestão nova em aberto. Os votos de dificuldade do setlist (5 níveis) são convertidos pros 3 da sugestão, e BPM/tags viajam junto nos dois sentidos.

## [1.24.0] — 2026-06-24
- **Apelidos / nomes antigos** por membro na página Banda: permite fundir votos importados de quem usou outro sobrenome no Glissandoo (ex: "Marcio Braz" → Marcio). A fusão de votos passa a considerar esses apelidos.

## [1.23.1] — 2026-06-24
- _fix:_ chip de dificuldade movido pro canto superior (junto da nota) e com estilo vazado, pra não confundir com as opiniões

## [1.23.0] — 2026-06-24
- Voto de **dificuldade nas sugestões** (Fácil / Ok / Difícil) + ordenação **🎯 Dificuldade** e chip de dificuldade no card

## [1.22.0] — 2026-06-24
- Cards do setlist **recolhidos por padrão** com setinha pra expandir; recolhido mostra um resumo compacto (status, BPM, vídeo, tags, votos de dificuldade, observações)

## [1.21.0] — 2026-06-24
- Nível neutro **"Ainda não vi"** no "Como tá pra você?" (não conta na média de dificuldade)

## [1.20.0]
- Ordenações no filtro Ensaiando: **📅 Mais antigas** e **🎯 Mais fáceis** (pela média da banda)

## [1.19.0]
- 5º nível de dificuldade: **"Moisés, não consegue né"** 😄

## [1.18.0]
- **Voto de dificuldade** nas músicas em Ensaiando ("Como tá pra você?")

## [1.17.0]
- Limpeza de **sugestões duplicadas** na página Importar

## [1.16.2]
- _fix:_ ranking das sugestões passa a usar a **média** (não a soma)

## [1.16.1]
- _fix:_ corrige votos duplicados (importado vs login Google), com match de nome aproximado

## [1.16.0]
- Filtro **"Não votei"** nas sugestões

## [1.15.1]
- _fix:_ remove emoji de raio do voto "Hino"

## [1.15.0]
- **Tags personalizadas** no repertório + **repaginada visual** geral

## [1.14.0]
- **Eventos** (🎸 Ensaio / 🎤 Apresentação) com setlist ordenável e **Modo Palco**

## [1.13.0]
- Feedback da banda: **BPM + metrônomo**, vídeo no repertório, observações nas sugestões, voto **Hino**

## [1.12.0]
- Sistema de **pontuação** das sugestões + planilha Excel reformatada

## [1.11.0]
- Exportação de sugestões para **planilha Excel**

## [1.10.1]
- _fix:_ remove botão "Descartada" dos cards

## [1.10.0]
- Página de Membros: remoção, deduplicação e **auto-cadastro no login**

## [1.9.0]
- Remove o filtro "Descartadas" do setlist

## [1.8.0]
- Redesign da página de Ensaios; extrator captura eventos passados e futuros

## [1.7.0]
- Categoria **Extras** no setlist

## [1.6.1]
- _fix:_ fusão busca UID em `users/{uid}` quando o membro não tem `firebaseUid`

## [1.6.0]
- Página de **Membros da banda** com vinculação automática ao Google

## [1.5.0]
- Vincula membros ao Google e funde votos importados

## [1.4.1]
- _fix:_ reescreve o extrator com a estrutura real validada do Glissandoo

## [1.4.0]
- Importação completa do Glissandoo (membros, músicas, sugestões, ensaios)

## [1.3.0]
- Página de **importação** + script extrator do Glissandoo

## [1.2.3]
- _fix:_ restringe aprovação de sugestões ao admin

## [1.2.2]
- _fix:_ mostra botões de aprovar/rejeitar a todos os membros logados

## [1.2.1]
- _fix:_ limita a 1 opinião por usuário (userId como chave)

## [1.2.0]
- Módulo de **Sugestões** com opiniões e aprovação manual

## [1.1.0]
- Módulos **Cifras, Ensaios e Rascunhos** + ordenação do setlist

## [1.0.1]
- _fix:_ ajuste no workflow de deploy (GitHub Pages)

## [1.0.0]
- Primeira versão: login Google, setlist e base do app
