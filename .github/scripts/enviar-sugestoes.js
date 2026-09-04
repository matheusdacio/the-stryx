// Processa a fila de notificações e envia FCM para todos os membros
const admin = require('firebase-admin')

// URL absoluta: o app vive em /the-stryx/ (base do Vite), então um caminho
// raiz como '/icon-192.png' resolveria fora do site no GitHub Pages
const ICONE = 'https://matheusdacio.github.io/the-stryx/icon-192.png'
const BADGE = 'https://matheusdacio.github.io/the-stryx/badge-96.png'
// Cai ordenado por Recentes e filtrado em "Falta meu voto": a sugestão que
// o push anunciou não tem opinião ainda, então a ordenação padrão jogaria
// ela pro fim da lista
const LINK_NOVA_SUGESTAO = 'https://matheusdacio.github.io/the-stryx/#/sugestoes?ordem=recentes&naovotei=1'
const LINK_ENSAIOS = 'https://matheusdacio.github.io/the-stryx/#/ensaios'

const formatarData = (d) =>
  d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' })

// Mesma lógica de src/utils/data.js (formatHorario) — Node puro, sem
// import de src/, então duplica de propósito
const formatarHora = (t) => {
  const [hh, mm] = t.split(':')
  return mm === '00' ? `${Number(hh)}h` : `${Number(hh)}h${mm}`
}
const formatarHorario = (ini, fim) => {
  if (ini && fim) return `${formatarHora(ini)} às ${formatarHora(fim)}`
  if (ini) return `a partir das ${formatarHora(ini)}`
  if (fim) return `até ${formatarHora(fim)}`
  return ''
}

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_STRYX)
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) })
const db = admin.firestore()
const messaging = admin.messaging()

async function enviar(token, titulo, corpo, link) {
  try {
    await messaging.send({
      token,
      notification: { title: titulo, body: corpo },
      webpush: {
        notification: { icon: ICONE, badge: BADGE, vibrate: [200, 100, 200] },
        fcmOptions: { link: link ?? 'https://matheusdacio.github.io/the-stryx/#/sugestoes' },
      },
    })
    console.log(`✓ Enviado: ${titulo}`)
  } catch (err) {
    console.error(`✗ Falha (${token.slice(0, 20)}…):`, err.message)
  }
}

async function main() {
  // Busca itens não processados na fila
  const filaSnap = await db.collection('notification_queue')
    .where('processado', '==', false)
    .get()

  if (filaSnap.empty) {
    console.log('Nenhuma notificação pendente.')
    process.exit(0)
  }

  // Busca todos os tokens FCM cadastrados
  const tokensSnap = await db.collection('fcm_tokens').get()
  if (tokensSnap.empty) {
    console.log('Nenhum token FCM cadastrado.')
    // Marca como processados de qualquer forma
    const batch = db.batch()
    filaSnap.docs.forEach(d => batch.update(d.ref, { processado: true }))
    await batch.commit()
    process.exit(0)
  }

  const tokens = tokensSnap.docs.map(d => ({ uid: d.id, ...d.data() }))

  // Quem monta repertório de uma vez sugere várias músicas em minutos; sem
  // agrupar, cada uma vira um push separado 15 min depois (cron desse
  // workflow) — rajada de "Nova sugestão" é o tipo de ruído que faz
  // desligar o sino e perder junto o lembrete de ensaio
  const gruposSugestao = new Map()
  const outros = []
  filaSnap.docs.forEach((item) => {
    const dados = item.data()
    if (dados.tipo !== 'nova_sugestao') { outros.push(item); return }
    if (!gruposSugestao.has(dados.suggestedById)) {
      gruposSugestao.set(dados.suggestedById, { suggestedBy: dados.suggestedBy, itens: [] })
    }
    gruposSugestao.get(dados.suggestedById).itens.push({ ref: item.ref, ...dados })
  })

  for (const [suggestedById, { suggestedBy, itens }] of gruposSugestao) {
    let titulo, corpo
    if (itens.length === 1) {
      const artista = itens[0].artista ? ` — ${itens[0].artista}` : ''
      titulo = `Nova sugestão 🎵`
      corpo = `${suggestedBy} sugeriu "${itens[0].titulo}${artista}". Dê sua opinião!`
    } else {
      const nomes = itens.slice(0, 2).map((i) => `"${i.titulo}"`)
      const resto = itens.length - nomes.length
      const lista = resto > 0 ? `${nomes.join(', ')} e mais ${resto}` : nomes.join(' e ')
      titulo = `Novas sugestões 🎵`
      corpo = `${suggestedBy} sugeriu ${itens.length} músicas: ${lista}. Dê sua opinião!`
    }

    // Envia para todos exceto quem sugeriu
    const destinatarios = tokens.filter((t) => t.uid !== suggestedById)
    for (const dest of destinatarios) {
      await enviar(dest.token, titulo, corpo, LINK_NOVA_SUGESTAO)
    }
    console.log(`Sugestões de ${suggestedBy} (${itens.length}): ${destinatarios.length} notificações enviadas.`)

    const batch = db.batch()
    itens.forEach((i) => batch.update(i.ref, { processado: true }))
    await batch.commit()
  }

  // Evento novo, cancelado ou remarcado — cada item já é a mensagem
  // inteira (sem agrupar, ao contrário da sugestão)
  for (const item of outros) {
    const dados = item.data()
    const data = dados.data?.toDate ? dados.data.toDate() : new Date(dados.data)
    const tipoLabel = dados.tipoEvento === 'apresentacao' ? 'Apresentação' : 'Ensaio'
    const onde = dados.local ? ` em ${dados.local}` : ''
    const horario = formatarHorario(dados.horaInicio, dados.horaFim)
    const quandoHorario = horario ? `, ${horario}` : ''

    if (dados.tipo === 'novo_evento' || dados.tipo === 'evento_remarcado') {
      const titulo = dados.tipo === 'novo_evento' ? `${tipoLabel} marcado 🎸` : `${tipoLabel} remarcado 🗓`
      const corpo = dados.tipo === 'novo_evento'
        ? `${formatarData(data)}${quandoHorario}${onde}. Você vai?`
        : `Agora é ${formatarData(data)}${quandoHorario}${onde}.`
      for (const dest of tokens) {
        await enviar(dest.token, titulo, corpo, LINK_ENSAIOS)
      }
      console.log(`${dados.tipo} (${dados.ensaioId}): ${tokens.length} notificações enviadas.`)
    } else if (dados.tipo === 'evento_cancelado') {
      const titulo = `${tipoLabel} cancelado ✕`
      const corpo = `${formatarData(data)}${quandoHorario}${onde} foi cancelado.`
      // Só quem tinha confirmado presença precisa saber que não precisa mais ir
      const ensaioSnap = await db.collection('ensaios').doc(dados.ensaioId).get()
      const presenca = ensaioSnap.exists ? (ensaioSnap.data().presenca || {}) : {}
      const destinatarios = tokens.filter((t) => ['vai', 'parte'].includes(presenca[t.uid]?.status))
      for (const dest of destinatarios) {
        await enviar(dest.token, titulo, corpo, LINK_ENSAIOS)
      }
      console.log(`evento_cancelado (${dados.ensaioId}): ${destinatarios.length} notificações enviadas.`)
    }

    await item.ref.update({ processado: true })
  }

  console.log('Fila processada.')
  process.exit(0)
}

main().catch(err => { console.error(err); process.exit(1) })
