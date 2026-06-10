// ============================================================
// Glissandoo — Extrator de Repertório (músicas ativas)
// Como usar:
//   1. Acesse https://app.glissandoo.com/group/thestryx/repertory
//      (sem filtro de busca, para ver todas as músicas)
//   2. Abra o console (F12 > Console)
//   3. Cole todo este script e pressione Enter
//   4. O arquivo CSV será baixado automaticamente
// ============================================================

(function () {
  const root = document.getElementById('root');
  const containerKey = Object.keys(root).find(k => k.startsWith('__reactContainer'));
  const fiber = root[containerKey];

  function findArray(node, depth, minLen, maxLen, check) {
    const visited = new WeakSet();
    function _search(n, d) {
      if (!n || d > 90 || visited.has(n)) return null;
      visited.add(n);
      try {
        let s = n.memoizedState;
        while (s) {
          const ms = s.memoizedState;
          if (Array.isArray(ms) && ms.length >= minLen && ms.length <= maxLen && check(ms[0])) return ms;
          s = s.next;
        }
      } catch (e) {}
      return _search(n.child, d + 1) || _search(n.sibling, d + 1);
    }
    return _search(node, depth);
  }

  // Extrai todas as músicas (exclui as que têm tag "sugestao")
  const songsRaw = findArray(fiber, 0, 1, 9999,
    item => item && item.id && item.title !== undefined && item.tags !== undefined);

  if (!songsRaw) {
    alert('Músicas não encontradas. Certifique-se de estar na página de repertório sem filtros.');
    return;
  }

  // Filtra apenas músicas ativas (sem a tag "sugestao")
  const repertorio = songsRaw.filter(s => {
    const tags = s.tags || [];
    return !tags.includes('sugestao') && !tags.includes('sugestão');
  });

  if (!repertorio.length) {
    alert('Nenhuma música no repertório encontrada (sem tag sugestao).');
    return;
  }

  // Gera CSV
  const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const headers = ['#', 'Título', 'Artista', 'Tags'];
  const rows = [headers.map(esc).join(';')];

  repertorio.forEach((s, i) => {
    rows.push([
      i + 1,
      s.title || '',
      s.artist || s.author || '',
      (s.tags || []).join(', ')
    ].map(esc).join(';'));
  });

  const csv = '﻿' + rows.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `repertorio_thestryx_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);

  console.log(`✅ Exportado: ${repertorio.length} músicas do repertório`);
})();
