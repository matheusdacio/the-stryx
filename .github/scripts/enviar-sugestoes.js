// Processa a fila de notificações e envia FCM para todos os membros
const admin = require('firebase-admin')

// URL absoluta: o app vive em /the-stryx/ (base do Vite), então um caminho
// raiz como '/icon-192.png' resolveria fora do site no GitHub Pages
const ICONE = 'https://matheusdacio.github.io/the-stryx/icon-192.png'
const BADGE = 'https://matheusdacio.github.io/the-stryx/badge-96.png'

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

  for (const item of filaSnap.docs) {
    const dados = item.data()

    if (dados.tipo === 'nova_sugestao') {
      const artista = dados.artista ? ` — ${dados.artista}` : ''
      const titulo = `Nova sugestão 🎵`
      const corpo = `${dados.suggestedBy} sugeriu "${dados.titulo}${artista}". Dê sua opinião!`

      // Envia para todos exceto quem sugeriu
      const destinatarios = tokens.filter(t => t.uid !== dados.suggestedById)
      for (const dest of destinatarios) {
        await enviar(dest.token, titulo, corpo)
      }
      console.log(`Sugestão "${dados.titulo}": ${destinatarios.length} notificações enviadas.`)
    }

    // Marca como processado
    await item.ref.update({ processado: true })
  }

  console.log('Fila processada.')
  process.exit(0)
}

main().catch(err => { console.error(err); process.exit(1) })
