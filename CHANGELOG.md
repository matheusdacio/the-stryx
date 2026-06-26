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
