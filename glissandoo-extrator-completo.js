// ============================================================
// Glissandoo — Extrator Completo (The Stryx) v2
//
// Estrutura validada diretamente no app em Jun/2026.
//
// ── COMO USAR ────────────────────────────────────────────────
//
//  Para extrair MÚSICAS + SUGESTÕES + MEMBROS:
//    1. Acesse: https://app.glissandoo.com/group/thestryx/repertory
//       (sem filtro de busca ativo — deve mostrar todas as 112 peças)
//    2. Abra o console do navegador (F12 → Console)
//    3. Cole todo este script e pressione Enter
//    4. Arquivo "thestryx-export-repertorio-YYYY-MM-DD.json" será baixado
//
//  Para extrair ENSAIOS:
//    1. Acesse: https://app.glissandoo.com/group/thestryx/events
//    2. Clique em "Anteriores" para ver os ensaios passados
//    3. Role a página até o fim para garantir que todos carregaram
//    4. Cole este script no console e pressione Enter
//    5. Arquivo "thestryx-export-eventos-YYYY-MM-DD.json" será baixado
//
//  Depois de exportar, use a página de Importação do The Stryx App.
// ============================================================

(function () {
  'use strict';

  // ── Mapeamento de UIDs do Glissandoo → nomes ─────────────────────
  // (usado para converter votes de músicas, que só têm UID)
  const memberMap = {
    "QrBlf5DKDWYCh88sd0CNrgd5j4x2": "Cristiano",
    "Ev6SDcTdrRXUjMUHN0xKr3pIcSc2": "Shirleano",
    "lJsOgNbrmYdXracpJPtz0VIpT592": "Marcio Braz",
    "ZfZoh8wjUPbKp2jur5TcSUqGtv12": "Marcos",
    "JdbYF7kUaUNRVK2lAgbm4XEEbi32": "Albano",
    "YV2aDlkRbzfmnvMqQ5aF013qtjB3": "Matheus Dacio",
  };

  // Legenda dos votos do Glissandoo
  const VOTE_LABEL = {
    4: 'Adora',
    3: 'Eu Gosto Disso',
    2: 'Eu Não Sei',
    1: 'Eu Não Gosto Disso'
  };

  // ── Helpers ──────────────────────────────────────────────────────
  const root = document.getElementById('root');
  const containerKey = Object.keys(root).find(k => k.startsWith('__reactContainer'));
  if (!containerKey) { alert('Erro: React root não encontrado.'); return; }
  const fiber = root[containerKey];

  // Busca array em memoizedState do fiber (para músicas)
  function findArrayInState(check, minLen = 5) {
    const visited = new WeakSet();
    function _s(n, depth) {
      if (!n || depth > 160 || visited.has(n)) return null;
      visited.add(n);
      try {
        let s = n.memoizedState;
        while (s) {
          const ms = s.memoizedState;
          if (Array.isArray(ms) && ms.length >= minLen) {
            try { if (check(ms[0])) return ms; } catch (_) {}
          }
          s = s.next;
        }
      } catch (_) {}
      return _s(n.child, depth + 1) || _s(n.sibling, depth + 1);
    }
    return _s(fiber, 0);
  }

  // Coleta objetos evento via memoizedProps (para ensaios)
  function collectEventProps() {
    const events = [];
    const visited = new WeakSet();
    function scan(n, depth) {
      if (!n || depth > 220 || visited.has(n)) return;
      visited.add(n);
      try {
        const p = n.memoizedProps;
        if (p && p.event && p.event._data && p.event.id && !events.find(e => e.id === p.event.id)) {
          events.push(p.event);
        }
      } catch (_) {}
      scan(n.child, depth + 1);
      scan(n.sibling, depth + 1);
    }
    scan(fiber, 0);
    return events;
  }

  // Converte Firestore Timestamp → "YYYY-MM-DD"
  function tsToDate(ts) {
    if (!ts) return '';
    if (ts.seconds) return new Date(ts.seconds * 1000).toISOString().slice(0, 10);
    if (ts.toDate) return ts.toDate().toISOString().slice(0, 10);
    if (typeof ts === 'string') return ts.slice(0, 10);
    if (typeof ts === 'number') return new Date(ts).toISOString().slice(0, 10);
    return '';
  }

  // ── Detecta a página atual ───────────────────────────────────────
  const path = window.location.pathname;
  const isRepertory = path.includes('/repertory');
  const isEvents = path.includes('/events');

  if (!isRepertory && !isEvents) {
    alert(
      'Execute este script na página de Repertório ou Eventos do Glissandoo.\n\n' +
      '• Músicas/Sugestões: /group/thestryx/repertory\n' +
      '• Ensaios: /group/thestryx/events'
    );
    return;
  }

  let songs = [], sugestoes = [], ensaios = [], membros = [];
  let tipo = '';

  // ── EXTRAÇÃO DE MÚSICAS E SUGESTÕES ─────────────────────────────
  if (isRepertory) {
    tipo = 'repertorio';

    // Músicas estão num array de memoizedState com campos: id, title, tags, votes
    // OBS: os campos vêm de _data via getters, por isso 'tags' e 'title' funcionam
    // como propriedades diretas mas NÃO são own properties do objeto.
    const songsRaw = findArrayInState(
      item => item && item.id && item.title !== undefined && item.tags !== undefined
    );

    if (!songsRaw) {
      alert(
        'Músicas não encontradas!\n\n' +
        'Verifique:\n' +
        '• Está na página https://app.glissandoo.com/group/thestryx/repertory\n' +
        '• Não há filtro de busca ativo (barra de pesquisa vazia)\n' +
        '• A página terminou de carregar (deve mostrar 112 peças)'
      );
      return;
    }

    console.log(`🔍 ${songsRaw.length} itens encontrados no repertório...`);

    songsRaw.forEach(s => {
      const tags = s.tags || [];

      // Determina se é sugestão (tag "Sugestão") ou música ativa
      const isSugestao = tags.some(t => t === 'Sugestão' || /sugest/i.test(t));

      // Constrói objeto de votos: { nomeDoMembro: { value: 1-4, label: '...' } }
      const votes = {};
      Object.entries(s.votes || {}).forEach(([uid, v]) => {
        const name = memberMap[uid] || uid; // fallback: usa UID se não encontrar
        const numVal = typeof v === 'number' ? v : (v?.value ?? 0);
        if (numVal >= 1 && numVal <= 4) {
          votes[name] = { value: numVal, label: VOTE_LABEL[numVal] };
        }
      });

      // YouTube: campo correto é 'compositor' (não 'artist' nem 'author')
      const ytId = s.media?.id || null;
      const ytThumb = s.media?.thumbnails?.maxres?.url
                   || s.media?.thumbnails?.high?.url
                   || s.media?.thumbnails?.standard?.url
                   || null;

      const item = {
        title: s.title || '',
        artist: s.compositor || '', // ← campo real no Glissandoo é 'compositor'
        tags,
        votes,
        videoId: ytId,
        videoThumb: ytThumb,
      };

      if (isSugestao) {
        sugestoes.push(item);
      } else {
        // "Repertório" e "Extra" vão para songs
        songs.push(item);
      }
    });

    membros = Object.entries(memberMap).map(([uid, name]) => ({ uid, name }));

    console.log(`✅ ${songs.length} músicas, ${sugestoes.length} sugestões encontradas`);
  }

  // ── EXTRAÇÃO DE ENSAIOS ──────────────────────────────────────────
  // Estratégia: acumula via localStorage (passados + futuros ficam em abas separadas).
  // Passo 1: estar em "Anteriores" OU "Próximos" e rodar o script → salva no localStorage
  // Passo 2: mudar para a outra aba e rodar de novo → combina e baixa o JSON final
  if (isEvents) {
    tipo = 'eventos';

    const CACHE_KEY = 'thestryx_events_cache';

    const eventsRaw = collectEventProps();

    if (eventsRaw.length === 0) {
      alert(
        'Nenhum evento encontrado!\n\n' +
        'Certifique-se de:\n' +
        '• Estar em https://app.glissandoo.com/group/thestryx/events\n' +
        '• Ter carregado os eventos (Próximos ou Anteriores) antes de rodar'
      );
      return;
    }

    // Reconstrói mapa de membros a partir dos eventos
    const dynamicMemberMap = { ...memberMap };
    eventsRaw.forEach(ev => {
      Object.entries(ev._data.players || {}).forEach(([uid, p]) => {
        if (p.name && !dynamicMemberMap[uid]) dynamicMemberMap[uid] = p.name.trim();
      });
    });
    membros = Object.entries(dynamicMemberMap).map(([uid, name]) => ({ uid, name }));

    const now = Date.now() / 1000;

    // Converte eventos da tela atual
    const ensaiosAtual = eventsRaw
      .filter(ev => ev._data.datetime)
      .map(ev => {
        const d = ev._data;
        const isPastEv = d.datetime.seconds < now;
        const status = isPastEv ? 'realizado' : 'planejado';
        const membersPresent = Object.values(d.players || {})
          .filter(p => p.status === 'confirmed' || (!isPastEv && p.status !== 'declined'))
          .map(p => (p.name || '').trim())
          .filter(Boolean);
        return {
          _id: ev.id,   // chave de dedup — removida na exportação final
          date: tsToDate(d.datetime),
          dateEnd: tsToDate(d.datetimeEnd),
          location: d.locality || '',
          notes: (d.description || '').trim(),
          status,
          type: d.type || 'practice',
          members: membersPresent,
          pauta: [],
        };
      })
      .filter(e => e.date);

    // Carrega cache anterior (se houver)
    let cached = [];
    try { cached = JSON.parse(localStorage.getItem(CACHE_KEY) || '[]'); } catch (_) {}

    // Mescla e remove duplicatas pelo id original
    const mergedMap = {};
    [...cached, ...ensaiosAtual].forEach(e => { mergedMap[e._id || e.date] = e; });
    const allEnsaios = Object.values(mergedMap).sort((a, b) => a.date < b.date ? -1 : 1);

    // Separa passados e futuros para mostrar na mensagem
    const pastCount   = allEnsaios.filter(e => e.status === 'realizado').length;
    const futureCount = allEnsaios.filter(e => e.status === 'planejado').length;

    // Verifica se ainda falta alguma aba
    const hasPast   = pastCount > 0;
    const hasFuture = futureCount > 0;

    if (hasPast && hasFuture) {
      // Tem ambos → exporta agora e limpa o cache
      localStorage.removeItem(CACHE_KEY);
      ensaios = allEnsaios.map(({ _id, ...rest }) => rest); // remove _id temporário
      console.log(`✅ ${ensaios.length} ensaios (${pastCount} realizados + ${futureCount} planejados)`);
    } else {
      // Salva no cache e pede a outra aba
      localStorage.setItem(CACHE_KEY, JSON.stringify(allEnsaios));
      const falta = hasPast ? '"Próximos"' : '"Anteriores"';
      console.log(`⏳ ${allEnsaios.length} evento(s) salvos. Clique em ${falta} e rode o script de novo para combinar tudo.`);
      alert(
        `✅ ${allEnsaios.length} evento(s) coletados e salvos!\n\n` +
        `Agora clique em ${falta} na página de Eventos e rode o script novamente.\n` +
        `O JSON final será baixado automaticamente com todos os ensaios.`
      );
      return;
    }
  }

  // ── Exporta JSON ─────────────────────────────────────────────────
  const output = {
    exportedAt: new Date().toISOString(),
    fonte: `Glissandoo - The Stryx (${tipo})`,
    tipo,
    resumo: {
      musicas: songs.length,
      sugestoes: sugestoes.length,
      ensaios: ensaios.length,
      membros: membros.length,
    },
    membros,
    musicas: songs,
    sugestoes,
    ensaios,
  };

  const blob = new Blob([JSON.stringify(output, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `thestryx-export-${tipo}-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  console.log(`\n✅ Exportação (${tipo}) concluída:`);
  console.table(output.resumo);
  console.log(`📁 Arquivo: thestryx-export-${tipo}-*.json`);
})();
