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

## [1.38.0] — 2026-09-04
- **Qualquer membro pode mandar sugestão pro setlist**, não só o admin — a decisão final era um gargalo desnecessário quando a banda toda já opinou; o admin continua sendo o único que reabre sugestão fechada e exporta pra Excel

## [1.37.0] — 2026-09-04
- **Músicas do evento organizadas em blocos**: cada evento pode ter quantos blocos quiser (nome opcional, "Bloco N" por posição), com músicas entrando, saindo e reordenando dentro do bloco certo; numeração continua contínua no evento inteiro. Evento antigo (sem blocos) continua funcionando normalmente e é migrado ao ser reeditado
- No modo palco, "Tocando agora" e "Próxima" avisam quando a música abre outro bloco, e a lista pra pular mostra o nome de cada bloco
- Novo campo **"Quem canta"** na música (texto livre) — chip 🎤 no Setlist, na lista do evento e em destaque no Modo palco
- Ferramentas admin novas em "🛠 Manutenção": "Blocos: migrar músicas soltas" (converte evento antigo de vez) e "Montar o próximo ensaio", que monta o repertório do próximo ensaio a partir da sequência de músicas/cantor/tom mandada pelo líder no grupo

## [1.36.0] — 2026-09-03
- **App abre sem internet**: agora cacheia o app inteiro (HTML/CSS/JS), não só os dados — antes, sem o cache HTTP, o Modo palco podia não abrir no ensaio sem sinal (precisa de teste real em Android e iPhone antes de ir pra produção)
- Marcar item da pauta do evento não perde mais a marcação de quem mexeu ao mesmo tempo
- Filtros de status em Sugestões (Em aberto/Rejeitadas) param de usar o vermelho de "urgente" — só "Todas" mantém o gradiente
- Botões de voto de domínio (Dominada/Ensaiando/Crua) passam a seguir a mesma ordem da barra de filtros do Setlist

## [1.35.0] — 2026-09-03
- **Nota ⭐ com a mesma cara em Setlist e Sugestões**: componente único (antes eram dois visuais diferentes pra mesma coisa); em Sugestões, "3 de 6 opinaram" explica por que a sugestão ainda não fechou
- **Chip 🎯 de dificuldade aparece também no Setlist** (card fechado) — antes só existia em Sugestões, mesmo o Setlist já ordenando por ela
- Domínio (Dominada/Ensaiando/Crua) usa o mesmo selo cheio em Eventos e no modal de evento que já usava no Setlist — antes era um chip vazado diferente
- Lista de músicas do evento mostra o tom, não só o BPM
- "Músicas (N)" explica "· marque as que rolaram" quando dá pra marcar a presença nos ensaios
- Setlist e Eventos repetem o número de pendências no título, como Sugestões já fazia
- "Presença pendente" vira "Falta eu responder", com a cara de toggle pessoal — mesmo conceito de "Falta meu voto"
- Perguntas de opinião em Sugestões ganham os mesmos ícones ⭐/🎯 do Setlist
- Uma linha explica o fluxo das Sugestões (sugere → banda opina → admin manda pro setlist), e o modal mostra quem falta opinar
- Card de Sugestão ganha a setinha › que avisa que abre, como Setlist e Eventos
- Modal de sugestão mostra a data, não só quem sugeriu
- Data curta (Realizados/Cancelados) volta a mostrar o ano quando o evento é de outro ano
- **Cifra alcançável dos dois lados**: chip 📄 no evento só aparece se a música tiver cifra de verdade; música sem cifra no Setlist ganha "📄 + cifra" que abre o cadastro já preenchido; busca sem resultado em Cifras oferece o mesmo atalho
- "+ instrumento" na Banda vira botão de verdade, não texto com título escondido
- Badge do rodapé trava em "99+" em vez de esticar
- Sucesso ao ativar notificações vira toast em vez de alerta bloqueante
- Contador do Modo palco ganha uma seta indicando que abre a lista de músicas

## [1.34.1] — 2026-09-03
- **Safe-area no iPhone instalado**: rodapé, palco, toast, modal e navbar respeitam a barra de gesto e o notch em vez de ficar por baixo
- Efeitos de hover (levantar card, borda vermelha) não grudam mais depois de um toque no celular — o card de sugestão não fica "selecionado" depois de fechar o modal
- Modal de evento: "Cancelar este evento" (status) vira "Marcar como cancelado"/"Reativar evento", sem confundir com o "Cancelar" de descartar edição; trocar o tipo do evento agora avisa antes de sair sem salvar
- Notas da sugestão e ferramentas da Banda (instrumento, apelido, "Tá na banda") gravam e fecham na hora, sem travar esperando a rede
- Confirmação de apagar evento ou membro explica o que se perde e aponta a saída segura (cancelar evento, marcar "Saiu")
- "Sair" da conta pede confirmação — evita perder a sessão com um toque sem querer
- Cifras, Rascunhos e Banda não piscam mais "vazio" antes do primeiro carregamento
- Prévia da cifra sem conteúdo mostra "Sem conteúdo" em vez de só "..."
- Só um metrônomo toca por vez — abrir outro para o anterior automaticamente
- "Remover" da cifra sai do topo (colado em Editar/Fechar) e vai pro rodapé, como no resto do app
- Botão de opinião no Setlist não fala mais em "tira da fila" — esse conceito só existe em Sugestões
- "Dificuldade" e "Melhores e fáceis" passam a usar a mesma conta no Setlist e nas Sugestões (o nível mais alto votado, não a média)
- Avatar sem foto do Google mostra a inicial do nome em vez do ícone de imagem quebrada

## [1.34.0] — 2026-09-03
- Textos pequenos (chips, contadores, rótulos) ganham letra maior — estavam abaixo do confortável pra ler em pé no palco
- Contraste maior em placeholders, botões "+" apagados e textos acinzentados (rejeitada, autor, "remover") que ficavam quase invisíveis
- Apresentação muda de vermelho pra magenta/fuchsia em toda a tela — cor exclusiva, sem colidir com o vermelho de "urgente"/erro
- Botões "+" (tag, pauta, apelido) deixam de parecer ação principal — viram secundários, do tamanho de "adicionar item pequeno"
- Botões e campos sem rótulo visível (busca, ▲▼ reordenar, tirar tag, sair do palco) ganham nome pra leitor de tela
- Vocabulário revisado: modais de criar/editar com o mesmo título em vez de "Adicionar X"/"Editar X", tom mais direto ("Toque pra..." em vez de "Clique para..."), "Membros"→"Banda" e "Ensaios"→"Eventos" nos textos visíveis do Importar
- Mensagens de lista vazia explicam o motivo (filtro sem resultado, busca sem match) em vez de repetir sempre "nada aqui ainda", com atalho pra limpar o filtro
- **Rascunhos abre em modo leitura** (era direto pro formulário, atropelava quem só queria ler) — "Editar" alterna pra edição, com busca por título/conteúdo
- **Cifra ganha ajuste de tamanho de letra** (A−/A+ no modo leitura, preferência compartilhada com o Modo palco), Tom vira campo de texto livre com sugestões, e some o scroll duplo que travava o dedo
- "Falta meu voto" (Setlist e Sugestões) combina com os outros filtros em vez de zerá-los — o visual de botão exclusivo enganava, mas sempre combinou na prática

## [1.33.0] — 2026-09-02
- **Arrastar pra reordenar chega no modal de Evento**: mesma alça por toque do Setlist (arrasta só pelo ⠿, rolar a lista continua funcionando), com botões ▲▼ maiores como alternativa
- **Músicas do evento viram link**: título abre a música filtrada no Setlist, e um botão "📄 Cifra" abre a cifra correspondente — no card do evento e dentro do Modo palco, sem sair da apresentação
- **Modo palco**: navega por swipe (toque simples parava de acordar a tela sem querer); tocar no contador "N / total" abre lista pra pular direto pra qualquer música; layout adaptado pra celular deitado e tipografia maior; avisa "Repertório atualizado · aplicar" se o líder editar o evento durante o show, sem trocar a música no meio da execução
- Pulso do metrônomo agora bate no andamento real (BPM), não num piscar fixo igual pra qualquer música
- Card do próximo evento deixa de ser uma versão reduzida: mostra a lista completa, com checkbox de ensaiada e Remover, igual às outras linhas
- Busca de música no modal de Evento não apaga mais o texto a cada música adicionada, ignora acento e mostra o nível de domínio de cada resultado
- Abas Realizados e Cancelados (Eventos) vêm recolhidas por padrão
- Select "Status: Planejado/Realizado/Cancelado" do evento vira um botão só — "Cancelar este evento" / "Reativar" (Realizado não fazia nada além da data)
- Data do evento usa o mesmo formato em toda tela (Eventos, editar evento, Importar, ferramentas admin) — antes cada lugar mostrava um jeito diferente, às vezes dois na mesma aba
- Vocabulário unificado: "Setlist" pro acervo, "Músicas do evento" pra lista do evento, "Última música do evento!" no palco (eram "repertório"/"set" misturados)
- **Migração "pra presença por pessoa" não sobrescreve mais respostas reais** — o filtro deixava passar todo evento com presença já registrada e zerava Vou/Não vou; "Remover duplicatas" de membro ganha preview (apaga X · mantém Y) em vez de apagar direto no clique
- **Importar do Glissandoo** passa a confirmar antes de gravar, pula música/sugestão/evento repetido em vez de duplicar, e avisa "concluída com erro(s)" quando algo falha (antes dizia sucesso mesmo assim)
- Ferramentas de manutenção da Banda mostram erro em português (era o texto cru do Firebase em inglês) numa mensagem só, que some sozinha depois de alguns segundos
- **Membro que saiu da banda** ganha um toggle "Tá na banda"/"Saiu" — para de contar como "Sem resposta" em todo evento novo e de puxar música pra "Crua" pra sempre no domínio, mas o histórico de votos continua gravado
- Tela preta na entrada do app vira o logo (mesmo cartão da tela de login) enquanto o Firebase decide se tem sessão; botão de login mostra "Entrando..." e avisa quando o popup falha (comum em quem abre o link pelo WhatsApp)
- Tocar o repertório do evento sem internet avisa em vez de travar numa caixa preta
- Navbar do admin perde o link "Banda" (duplicado do rodapé); "Importar do Glissandoo" muda pra dentro das ferramentas da página Banda, junto das outras

## [1.32.0] — 2026-09-02
- **Veto fica explícito nas Sugestões**: "Não faz sentido" e "Não curti" ganham "· tira da fila" e viram vermelho de alerta (eram laranja/cinza, cara de opção neutra); linha de ajuda antes dos botões; confirm só nessas duas; "Remover" a própria opinião fica sempre visível, mesmo depois que a banda toda já opinou — antes o botão sumia bem quando alguém precisava desfazer um veto por engano
- **Opinar vira 1 toque**: bloco de opinião sobe pra logo abaixo do vídeo (antes ficava depois de observações, dificuldade e da lista de opiniões dos outros) e grava direto, igual à dificuldade — sem escolher, rolar e apertar "Enviar"; comentário vira campo à parte, com "Editar" e "Salvar" próprios, então trocar de opinião não apaga mais o que foi escrito
- **Toast de confirmação** ("Foi pro setlist, marcada Crua pra geral", "Voltou pras sugestões", "Reaberta pra votação") — as duas ações que só faziam o item sumir da tela agora avisam que deu certo, com o botão desabilitado e "Enviando..."/"Devolvendo..." enquanto grava (dois toques rápidos não duplicam mais a música)
- Sugestão nova sem nenhuma opinião vai pro topo de "Melhores e fáceis" em vez de empatar em 0 com as reprovadas; chip 🆕 em sugestão e música recente; "Enviar pro setlist" já avisa que a música some da lista e entra Crua pra geral
- **Lista de Sugestões para de reordenar sozinha** enquanto alguém está lendo — a posição só muda quando o próprio filtro/ordenação/busca mudam; um chip "Ordem mudou · reordenar" aparece quando o voto de outro membro deixaria a ordem diferente
- Resumo de opiniões no card usa palavra ("Ajustar 1", "Fora 1") em vez de símbolo quase ilegível ("~ 1", "– 1"); nota da banda formatada com vírgula (1,05) e uma linha explica a ordenação ativa; "🗳 Votos" vira "👥 Mais votadas"
- Fileira de 5 pills de ordenação vira um único select, em Sugestões e no Setlist — sobra mais tela pra ver as músicas antes de rolar
- Busca automática de música (Sugestões) avisa "Procurando no catálogo…" e, se não achar nada, "Não achei no catálogo — preenche na mão"
- Card "✓ Aprovada" vira "✓ No setlist"; modal de Cifra em edição não mostra mais dois botões ("Fechar" e "Cancelar") fazendo a mesma coisa
- Tocar fora do modal de Cifra ou Evento não descarta mais o que foi digitado (só fecha por Cancelar, que confirma se algo mudou); botão voltar do Android fecha modal e Modo palco em vez de trocar de aba de repente — e o Modo palco lembra em que música parou se você sair e voltar

## [1.31.0] — 2026-09-02
- **Card do Setlist fica menos poluído**: ✕ de apagar some do cabeçalho (virou "Remover" no rodapé do card aberto, ao lado de "↩ Voltar pras sugestões", com confirm explicando o que se perde); a lista de quem votou cada nível de domínio só aparece com o card aberto; domínio continua em caixa cheia, opinião e dificuldade viram "vazados" — os três paravam de parecer a mesma pergunta três vezes
- Botões de voto (domínio, dificuldade, opinião, presença) sobem de ~24px pra 40px de altura — é o gesto mais frequente do app, e um toque errado no vizinho trocava ou apagava o voto sem aviso; voto marcado ganha um anel, não só cor (daltonismo, leitor de tela)
- Selo do domínio explica o que significa (é sempre o pior voto da banda) numa linha fixa sob os filtros; "Crua" semeada pra todo mundo ao aprovar uma sugestão não finge mais ser voto de alguém — vira "Ainda não disseram" até a pessoa votar de verdade
- **Filtro "Falta meu voto" chega no Setlist** cobrindo domínio, dificuldade e opinião, com o mesmo nome do filtro que já existia em Sugestões; "Sem voto" (agregado da banda) sai, porque virou redundante
- Chips de nível no Setlist e de tipo em Rascunhos ganham a cor que o próprio card já usa (antes todos ficavam cinza/vermelho); a rampa de domínio deixa de ter um azul "neutro" entre o verde e o âmbar
- Votar com um filtro de nível ativo não faz mais a música sumir debaixo do dedo — ela fica visível até o filtro mudar, em vez do próximo card subir pro lugar exato do toque (mesma proteção nas Sugestões)
- Dois chips novos no Setlist: "🎸 Último ensaio" e "Próximo ensaio" — filtram só as músicas do repertório desse evento, pra atualizar o domínio sem cruzar Eventos e Setlist música a música
- Tag do Setlist e ordenação de Sugestões sobrevivem a trocar de aba (o resto do filtro continua voltando ao padrão de propósito)
- Modal "Adicionar Música" deixa claro que propor música nova é em Sugerir, não ali
- Cabeçalho do evento troca "✓ 2 · ✕ 1" por "2 vão · 1 não"; Cifras e Rascunhos também movem "Remover" do card pro modal, com confirm avisando que não dá pra desfazer

## [1.30.0] — 2026-09-02
- **Instalar na tela inicial**: o app ganha manifest e ícones (192/512px) — no Android/Chrome aparece "Instalar app"; no iPhone o Safari aceita "Adicionar à Tela de Início", que é o que destrava push no Safari 16.4+
- Notificação em segundo plano não duplica mais (o service worker ficou só com o essencial) e o toque nela passa a focar o app aberto em vez de abrir aba nova sempre; com o app já aberto, sugestão nova ou lembrete de ensaio agora aparecem de verdade (antes não aparecia nada)
- **Sino de notificação não mente mais**: só acende 🔔 depois de confirmar que o token foi salvo de verdade; se ativar falhar (sem internet, navegador bloqueou), o ícone continua 🔕 e a Navbar explica o motivo
- Banner dispensável convida a ativar avisos (ou, no iPhone, a instalar o app) e um banner de boas-vindas guia quem ainda não escolheu instrumento pelos três primeiros passos: instrumento, sino, voto de domínio
- **Contador de Sugestões no rodapé e no título mostra só o que falta você votar**, não mais tudo que está em aberto
- **"Falta meu voto" é o mesmo filtro, com o mesmo nome, no Setlist e nas Sugestões** — no Setlist cobre os três votos do card (domínio, dificuldade, opinião); nas Sugestões, opinião e dificuldade. Escolher esse filtro desliga o filtro de status, e vice-versa
- Push de sugestão nova leva pra ela de verdade: cai ordenado por Recentes e filtrado em "Falta meu voto", em vez de cair no fim da ordenação padrão
- Rajada de sugestões cadastradas de uma vez vira uma notificação por pessoa, não uma por música
- Evento novo, cancelado ou remarcado agora avisa quem não abre o app (cancelado avisa só quem tinha confirmado presença); ensaio marcado com menos de 3 dias de antecedência deixa de ficar sem nenhum lembrete

## [1.29.2] — 2026-09-02
- _fix:_ Pacote 0 (fundação): cache do Firestore fica persistente — setlist, eventos e sugestões abrem do cache sem rede (inclusive o Modo palco no ensaio), e um voto ou presença dado sem sinal não some mais se a aba fechar antes da rede voltar; as três telas principais mostram "Carregando..." em vez do estado vazio piscando enquanto o primeiro snapshot não chega; formulários (Adicionar Música, Nova Sugestão, Evento, Cifra, Rascunho, Enviar opinião, Salvar do card) não travam mais em "Salvando..." sem internet — disparam a gravação, fecham na hora e avisam se falhar; campo de título passa a ser obrigatório de verdade nos quatro cadastros; index.html com lang pt-BR, título "The Stryx" e metas pra instalar melhor na tela inicial; rota desconhecida volta pro Setlist em vez de tela em branco; evento de hoje não some da aba Próximos ao meio-dia; campos de texto em 16px no celular pra não dar zoom automático no iOS; tela não apaga mais no Modo palco (Wake Lock); animações respeitam "reduzir movimento" do sistema; editor de tom/BPM/tags/observação do card do setlist não abre mais com dado velho nem reverte edição de outro membro; comentário da opinião nasce com o que a pessoa já tinha escrito; marcar música ensaiada e salvar evento não pisam mais em edição simultânea de outro membro

## [1.29.1] — 2026-09-02
- _fix:_ pente de correções de regressão dos últimos commits (revisão independente): vídeo inline do card volta a tocar sem cortar ao expandir/recolher, e não toca mais de um ao mesmo tempo; "Tocar as músicas" e "Tocar o set" congelam a fila enquanto tocam e param sozinhos ao abrir o Modo palco; "↩ Voltar pras sugestões" e "➤ Enviar pro setlist" voltam a levar opinião/dificuldade nos dois sentidos; rejeição por veto nas sugestões passa a ser gravada (badge, planilha e etiqueta da lista deixam de divergir), o banner de veto pendente diz quem falta votar, e a vetada oferece "Reabrir" em vez de mostrar "Enviar pro setlist" ao mesmo tempo que "Rejeitada"; a trava de música repetida diz se a existente está aberta, rejeitada ou aprovada, com "Abrir essa"/link pra Sugestões; a bolinha do card do setlist só mostra número em ordenação por nota/dificuldade; os três blocos de voto do card (domínio, opinião, dificuldade) ganham nomes e ícones distintos; ferramentas admin da Banda ficam num bloco recolhido, com as migrações de uso único separadas em "Já rodadas"; relatório de integridade mostra eventos por data em vez de id cru

## [1.29.0] — 2026-09-02
- **Sugestões:** o filtro "Aprovadas" saiu — quem foi pro setlist já não aparece na lista — e o botão virou **"➤ Enviar pro setlist"**. Ao enviar, a música nasce marcada como **Crua para todos os membros**, já que ninguém ensaiou ainda; cada um muda o próprio voto depois
- **Card do setlist mais limpo**: BPM e contagem de votos saem do resumo (seguem visíveis ao abrir a música), e o antigo ✎ apagadinho virou um botão **✏️ Editar** legível
- Nas sugestões, o **"🗳 Não votei" foi pra barra de filtros**, ao lado de Rejeitadas, que é o que ele de fato é
- **O setlist perde a ordem manual** — sem arrastar e sem as setinhas ▲▼ nos cards. Montar sequência é papel do repertório do evento; o setlist é um acervo, e a ordem dele vem sempre de um critério: **🕐 Recentes** (padrão), ⚖️ Melhores e fáceis, ⭐ Média, 🎯 Dificuldade e 📅 Antigas
- **Filtro por nome ou artista sempre visível** no Setlist e nas Sugestões: o campo deixa de ficar escondido atrás do ícone de lupa (era preciso clicar pra ele aparecer) e passa a ficar aberto, alinhado à direita na própria linha do cabeçalho, ao lado do botão de adicionar — sem painel ao redor, só a lupa e uma linha discreta sob o texto
- **Crédito do GetSongBPM na tela de login**, que é a única página pública do app — o resto exige conta Google. A atribuição é condição pra obter a chave da API, e precisa estar no ar antes do pedido
- **Trava de música repetida** no cadastro de sugestão e no de música do setlist: se o título + artista já existirem, o formulário mostra onde a música já está e não deixa salvar. Quando só o título bate (artista diferente ou em branco), o aviso é brando e o cadastro continua liberado — pode ser versão ao vivo, cover ou artista escrito de outro jeito
- **Ferramenta "🎵 Fundir sugestões duplicadas"** (admin): quando a mesma música tem duas sugestões, junta as opiniões numa só (uma por pessoa, valendo a da que fica, sem contar duas vezes quem votou com nome importado de um lado e login do outro), assume o status "aprovada" se algum dos lados tinha, repõe o vínculo das músicas do setlist e apaga a duplicada. Rodada uma vez: 10 músicas tinham sugestão repetida, e nenhum voto se perdeu
- **Ferramenta "🔎 Conferir integridade dos dados"** na página Banda (admin): confere, sem alterar nada, se as migrações deixaram ponta solta — membros vinculados e sem duplicata, eventos sem a lista antiga de nomes, presenças com membro e status válidos, votos de domínio válidos, vínculo música↔sugestão, ambiguidade de título+artista, aprovadas que saíram do setlist e votos importados ainda por fundir
- **Rejeição por veto nas sugestões**: a música é rejeitada quando **a banda inteira já opinou** e alguém marcou "Não curti" ou "✕ Não faz sentido". Enquanto faltar gente votar ela continua em aberto, com um aviso no card de que já tem veto. O card mostra quem votou o quê e as opiniões seguem abertas — quem quiser defender a música ainda pode votar. A conferência de "todos votaram" reconhece os votos importados do Glissandoo, inclusive por apelido
- **A rejeição manual saiu**: não existe mais o botão "✕ Rejeitar". As 32 sugestões já rejeitadas assim continuam rejeitadas — o status antigo segue valendo —, e o admin ainda pode reabrir qualquer uma
- **O setlist passa a ser organizado pelo domínio**, não mais por "Ensaiando / Pronta / Extra". Os filtros do topo viraram Crua, Quase lá, Enferrujada, Dominada e Sem voto, o selo e a borda do card seguem o pior voto, e o botão de status sai do card e do cadastro de música
- **O status "Extra" foi aposentado.** Em vez de virar rótulo, a separação passa a ser a própria **nota da banda**: quem tem nota alta sobe nas ordenações e quem nunca foi avaliado fica no fim. O campo `status` não foi apagado dos documentos — só deixou de ser usado, então dá pra voltar atrás
- Como consequência, o botão do evento que promovia música ensaiada pra "Pronta" saiu: quem diz que a música está pronta agora é o voto de domínio de cada um. A marcação de "ensaiada" no evento continua, como registro do que foi tocado
- A votação de dificuldade (5 níveis), que só aparecia nas músicas em "Ensaiando", agora aparece em todas — ela dependia do status que deixou de existir
- **Nota da banda no setlist**: a pontuação das opiniões (⭐), que existia só nas sugestões, agora aparece no card da música. Ela é lida da sugestão que originou a música — pelo vínculo da aprovação ou, nas antigas, pelo título + artista
- **O selo do card passa a ser o domínio**, no pior cenário votado, no lugar de "Ensaiando / Pronta / Extra". Enquanto ninguém tiver votado o domínio de uma música, o selo antigo continua aparecendo, pra lista não ficar sem informação nenhuma
- _fix:_ na aba "Presença pendente" os cards ficam compactos — a pergunta "Você vai?" vem primeiro e o repertório aparece só como prévia (3 músicas + quantas faltam), em vez das 28 linhas que empurravam os botões pra fora da tela
- **Votação de opinião também no setlist**: o card da música ganhou "O que você acha dessa música?", com as mesmas cinco opções das sugestões. É o que permite dar nota às 32 músicas importadas do Glissandoo, que nunca passaram por sugestão. O voto dado no setlist vence o que veio da sugestão de origem, e ninguém conta duas vezes por ter votado com nome importado de um lado e login do outro
- **A votação encerra quando a banda inteira opina** — na sugestão e no setlist. Enquanto faltar alguém, continua aberta e dá pra mudar o próprio voto
- **Ferramenta "♪ Tonalidade das observações → campo Tom"** (admin): tira o "Tonalidade: X" do texto livre e põe no campo próprio, que aparece em destaque no modo palco. Rodada uma vez: só uma música usava essa anotação
- **Uma escala só de dificuldade** na sugestão e no setlist: Fácil · Ok · Difícil. Antes eram duas escalas com o mesmo nome de campo (3 níveis na sugestão, 6 no setlist) e um conversor entre elas — quem lesse o banco não desconfiava da diferença. Os votos antigos do setlist foram convertidos (De boa → Fácil; Estou sofrendo, Preciso de um tempo e Moisés → Difícil; "Ainda não vi" descartado, porque era ausência de voto e não um nível)
- **Domínio da música**, votado por cada membro direto no card do setlist (aparece com o card fechado, sem precisar abrir): **Dominada**, **Enferrujada**, **Quase lá** ou **Crua** — clicar de novo desfaz. "Enferrujada" é a que já foi dominada e ficou parada, precisando só de relembrança. O chip do card mostra o **pior voto**: se uma pessoa está crua, a banda precisa ensaiar, mesmo que o resto esteja tranquilo. Os votos viajam junto se a música for pras sugestões e voltar
- **"Trazer as N músicas menos dominadas"** no evento: escolhe a quantidade e o app puxa pro repertório do ensaio as músicas mais cruas, ignorando as que já estão no evento. A ordem de prioridade é Crua, Quase lá, Enferrujada e Dominada; empate desempata pela média e depois por quem tem mais votos. Música sem nenhum voto fica de fora: não há indício de que precise de ensaio

## [1.28.0] — 2026-09-02
- **Presença por pessoa nos eventos**: no lugar da lista de checkboxes onde qualquer um marcava por todo mundo, cada pessoa logada responde **Vou / Não vou** no próprio card do evento (clicar de novo desfaz). O card mostra quem vai, quem não vai e quem ainda não respondeu, e o cabeçalho traz os contadores ✓/✕
- _fix:_ a marcação de "ensaiada" e a pergunta "Você vai?" não aparecem mais em evento fora de hora — a marcação começa no dia do evento, a pergunta desaparece quando a data passa, e o resumo de presença passa a falar no passado ("Foram" / "Não foram")
- **Sugestão que já está no setlist sai das Sugestões**, inclusive do filtro "Todas". O cruzamento usa o vínculo gravado na aprovação e, pras aprovadas antigas que não têm esse vínculo, o título + artista normalizados. Se a música for removida do setlist depois, a sugestão reaparece
- **Cards de evento sempre abertos**: acabou o "Ver detalhes" e o clique pra expandir — músicas, presença, pauta e observações ficam à mostra
- **Ciclo ensaiando → pronta**: a partir do dia do evento, cada música do repertório tem uma marcação de "ensaiada"; marcando as que rolaram, aparece um botão que promove de uma vez as que ainda estão em "Ensaiando" pra "Pronta" no setlist
- **Busca automática ao cadastrar sugestão**: digitando o nome da música, o app oferece os candidatos do catálogo do iTunes (título, artista e ano) e preenche o artista com um clique, sem sobrescrever o que já foi digitado. Se as chaves opcionais estiverem configuradas, também busca o link do YouTube e o tom/BPM da gravação original — ver `.env.example`
- **Lembretes automáticos de evento** por push: três dias antes, só pra quem ainda não indicou presença; um dia antes, pra quem confirmou, com local, número de confirmados e tamanho do repertório. Cada aviso é marcado no evento, então não repete
- _chore:_ eslint passa a reconhecer os scripts de notificação como Node, o que zera 6 erros de lint que já existiam no projeto
- _fix:_ "Tocar o set" não começava a tocar sozinho — era preciso clicar em "Próxima" pra primeira música iniciar. O player nascia sem vídeo, porque quem manda a faixa pro player rodava antes de ele existir
- **Tocar sem sair pro YouTube**, em três lugares: no **setlist** e nas **sugestões**, o vídeo abre dentro do próprio card (a miniatura só carrega o player quando alguém clica, pra uma lista de 48 músicas não abrir 48 players); no **setlist** e nos **eventos**, um botão toca tudo em sequência — na lista, a fila respeita o filtro, a tag, a busca e a ordenação que estiverem valendo, emendando a próxima quando a atual termina. O modo palco deixa de ter player. O primeiro play exige um toque na tela (política de autoplay dos navegadores), vídeo com incorporação bloqueada pelo dono avisa em vez de travar, e no celular o som para se a tela bloquear
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

## [1.26.2] — 2026-09-02
- Crédito "Tom e BPM por GetSongBPM" no rodapé da tela de login. É a atribuição exigida pelo serviço pra liberar a chave da API que vai sugerir tom e BPM ao cadastrar música, e ela precisa estar publicada antes do pedido. A tela de login é a única página pública do app

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
