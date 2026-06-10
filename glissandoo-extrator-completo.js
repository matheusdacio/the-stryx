// ============================================================
// Glissandoo — Extrator Completo (The Stryx)
// Extrai: músicas, sugestões, ensaios e membros
//
// Como usar:
//   1. Acesse https://app.glissandoo.com/group/thestryx/repertory
//      (sem filtros, para carregar todas as músicas)
//   2. Abra o console (F12 > Console)
//   3. Cole todo este script e pressione Enter
//   4. O arquivo thestryx-export.json será baixado
// ============================================================

(function () {
  const memberMap = {
    "QrBlf5DKDWYCh88sd0CNrgd5j4x2": "Cristiano",
    "Ev6SDcTdrRXUjMUHN0xKr3pIcSc2": "Shirleano",
    "lJsOgNbrmYdXracpJPtz0VIpT592": "Marcio Braz",
    "ZfZoh8wjUPbKp2jur5TcSUqGtv12": "Marcos",
    "JdbYF7kUaUNRVK2lAgbm4XEEbi32": "Albano",
    "YV2aDlkRbzfmnvMqQ5aF013qtjB3": "Matheus Dacio",
  };

  const VOTE_LABEL = { 4: 'Adora', 3: 'Eu Gosto Disso', 2: 'Eu Não Sei', 1: 'Eu Não Gosto Disso' };

  const root = document.getElementById('root');
  const containerKey = Object.keys(root).find(k => k.startsWith('__reactContainer'));
  const fiber = root[containerKey];

  // ── Busca genérica no fiber ──────────────────────────────
  function findArrayWhere(check, minLen = 1, maxLen = 9999) {
    const visited = new WeakSet();
    function _s(n, d) {
      if (!n || d > 100 || visited.has(n)) return null;
      visited.add(n);
      try {
        let s = n.memoizedState;
        while (s) {
          const ms = s.memoizedState;
          if (Array.isArray(ms) && ms.length >= minLen && ms.length <= maxLen) {
            try { if (check(ms[0])) return ms; } catch(e) {}
          }
          s = s.next;
        }
      } catch (e) {}
      return _s(n.child, d + 1) || _s(n.sibling, d + 1);
    }
    return _s(fiber, 0);
  }

  // ── Músicas ─────────────────────────────────────────────
  const songsRaw = findArrayWhere(
    item => item && item.id && item.title !== undefined && item.tags !== undefined
  );

  if (!songsRaw) {
    alert('Músicas não encontradas. Certifique-se de estar na página de repertório.');
    return;
  }

  const songs = [], sugestoes = [];

  songsRaw.forEach(s => {
    const tags = s.tags || [];
    const isSugestao = tags.some(t => /sugest/i.test(t));

    const votes = {};
    Object.entries(s.votes || {}).forEach(([uid, v]) => {
      const name = memberMap[uid];
      if (name) votes[name] = { value: v, label: VOTE_LABEL[v] || String(v) };
    });

    const item = {
      title: s.title || '',
      artist: s.artist || s.author || '',
      tags,
      votes,
    };

    if (isSugestao) sugestoes.push(item);
    else songs.push(item);
  });

  // ── Ensaios ──────────────────────────────────────────────
  // Tenta diferentes padrões de campo de data
  const rehearsalsRaw = findArrayWhere(
    item => item && item.id && (item.date || item.startDate || item.scheduledAt || item.datetime || item.when)
  );

  const ensaios = (rehearsalsRaw || [])
    .filter(r => r.id && (r.date || r.startDate || r.scheduledAt || r.datetime || r.when))
    .map(r => {
      const rawDate = r.date || r.startDate || r.scheduledAt || r.datetime || r.when;
      let dateISO = '';
      try {
        if (typeof rawDate === 'number') dateISO = new Date(rawDate).toISOString().slice(0, 10);
        else if (typeof rawDate === 'string') dateISO = rawDate.slice(0, 10);
        else if (rawDate && typeof rawDate.toDate === 'function') dateISO = rawDate.toDate().toISOString().slice(0, 10);
        else if (rawDate && rawDate.seconds) dateISO = new Date(rawDate.seconds * 1000).toISOString().slice(0, 10);
      } catch(e) {}

      const membersPresent = [];
      (r.members || r.attendees || r.presence || []).forEach(uid => {
        const name = memberMap[uid] || (typeof uid === 'string' && uid.length < 30 ? uid : null);
        if (name) membersPresent.push(name);
      });

      return {
        date: dateISO,
        location: r.location || r.place || r.local || '',
        notes: r.notes || r.description || r.obs || '',
        status: r.status || 'realizado',
        members: membersPresent,
        pauta: (r.agenda || r.pauta || r.items || []).map(p =>
          typeof p === 'string' ? { text: p, done: false } : { text: p.text || p.title || String(p), done: !!p.done }
        ),
      };
    })
    .filter(r => r.date); // só com data válida

  // ── Membros ──────────────────────────────────────────────
  const membros = Object.entries(memberMap).map(([uid, name]) => ({ uid, name }));

  // ── Exporta JSON ─────────────────────────────────────────
  const output = {
    exportedAt: new Date().toISOString(),
    fonte: 'Glissandoo - The Stryx',
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
  a.download = `thestryx-export-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);

  console.log('✅ Exportação concluída:');
  console.table(output.resumo);
  console.log('📁 Arquivo: thestryx-export-*.json');
})();
