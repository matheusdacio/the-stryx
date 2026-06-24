# Changelog — The Stryx App

Convenção [semver](https://semver.org/lang/pt-BR/): `MAJOR.MINOR.PATCH`
- **PATCH** — correção ou ajuste pequeno
- **MINOR** — feature nova
- **MAJOR** — mudança grande / reformulação

A versão exibida no app vem de `src/version.js` (mantenha em sincronia com o `package.json`).

---

## [1.0.0] — 2026-06-24

Primeira versão oficial versionada. Reúne tudo o que foi construído até aqui.

### Setlist
- Status das músicas: Ensaiando, Pronta, Extra
- Campo de BPM com **metrônomo** embutido (Web Audio API)
- Link de vídeo do YouTube no card
- **Tags personalizadas** com filtro
- **Voto de dificuldade** ("Como tá pra você?"): Ainda não vi · De boa · OK · Estou sofrendo · Preciso de um tempo · Moisés, não consegue né
- Ordenações no filtro Ensaiando: Padrão, 📅 Mais antigas, 🎯 Mais fáceis (pela média da banda; "Ainda não vi" não conta)

### Sugestões
- Votação com pontuação: Hino (1,2) · Escopo (1) · Ajustar (0,6) · Fora (0,2) · Não curti (0)
- Ranking pela **média** entre quem votou (quem não votou não influencia)
- Ordenar por Média / Votos / Recentes e filtro "Não votei"
- Observações por sugestão; aprovação leva vídeo e notas pro repertório
- Exportação para planilha Excel

### Eventos
- Tipos 🎸 Ensaio e 🎤 Apresentação
- Setlist do evento com ordenação por drag-and-drop (e setas no celular)
- **Modo Palco** em tela cheia: música atual, próxima e metrônomo

### Banda
- Página de membros com auto-cadastro no login Google
- Cada membro edita o próprio instrumento
- Fusão de votos importados por nome aproximado; remoção de duplicatas

### Importação
- Importador do Glissandoo (músicas, sugestões, membros, ensaios)
- Limpeza de sugestões duplicadas

### Visual
- Repaginada geral: tipografia, gradientes, glassmorphism na navegação
