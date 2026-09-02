// Lembretes dos eventos que estão chegando.
//
// Roda uma vez por dia e manda no máximo dois avisos por evento:
//   • 3 dias antes — só pra quem ainda não disse se vai
//   • 1 dia antes  — pra quem confirmou presença
//
// O que já foi enviado fica marcado no próprio evento (campo `lembretes`),
// então rodar de novo no mesmo dia não duplica nada.
const admin = require('firebase-admin')

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_STRYX)
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) })
const db = admin.firestore()
const messaging = admin.messaging()

const LINK = 'https://matheusdacio.github.io/the-stryx/#/ensaios'
const DIA = 86400000

async function enviar(token, titulo, corpo) {
  try {
    await messaging.send({
      token,
      notification: { title: titulo, body: corpo },
      webpush: {
        notification: { icon: '/favicon.svg' },
        fcmOptions: { link: LINK },
      },
    })
    return true
  } catch (err) {
    console.error(`✗ Falha (${token.slice(0, 20)}…):`, err.message)
    return false
  }
}

// Quantos dias faltam, contando por data e não por hora — senão um evento
// marcado pro meio-dia vira "2 dias" na madrugada
function diasAte(data) {
  const hoje = new Date()
  const zero = (d) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())
  return Math.round((zero(data) - zero(hoje)) / DIA)
}

const formatarData = (d) =>
  d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' })

async function main() {
  const [eventosSnap, tokensSnap] = await Promise.all([
    db.collection('ensaios').get(),
    db.collection('fcm_tokens').get(),
  ])

  if (tokensSnap.empty) {
    console.log('Nenhum token FCM cadastrado.')
    process.exit(0)
  }

  // uid → token, pra falar só com quem interessa em cada aviso
  const tokenPorUid = Object.fromEntries(
    tokensSnap.docs.map((d) => [d.id, d.data().token]).filter(([, t]) => t)
  )
  const todosUids = Object.keys(tokenPorUid)

  let enviados = 0

  for (const docSnap of eventosSnap.docs) {
    const ev = docSnap.data()
    if (ev.status === 'cancelado' || !ev.date) continue

    const data = ev.date.toDate ? ev.date.toDate() : new Date(ev.date)
    const dias = diasAte(data)
    const marcos = ev.lembretes || {}
    const presenca = ev.presenca || {}
    const tipo = ev.type === 'apresentacao' ? 'Apresentação' : 'Ensaio'
    const onde = ev.location ? ` em ${ev.location}` : ''

    let chave = null
    let alvos = []
    let titulo = ''
    let corpo = ''

    if (dias === 3 && !marcos.d3) {
      // Só quem não respondeu — quem já disse que vai (ou que não vai) fica em paz
      chave = 'd3'
      alvos = todosUids.filter((uid) => !presenca[uid])
      titulo = `${tipo} em 3 dias 🗓`
      corpo = `${formatarData(data)}${onde}. Você vai? Confirme sua presença.`
    } else if (dias === 1 && !marcos.d1) {
      chave = 'd1'
      alvos = todosUids.filter((uid) => presenca[uid]?.status === 'vai')
      const confirmados = Object.values(presenca).filter((p) => p.status === 'vai').length
      const musicas = ev.setlist?.length ? ` ${ev.setlist.length} músicas no repertório.` : ''
      titulo = `${tipo} amanhã 🎸`
      corpo = `${formatarData(data)}${onde}. ${confirmados} confirmados.${musicas}`
    }

    if (!chave) continue

    for (const uid of alvos) {
      if (await enviar(tokenPorUid[uid], titulo, corpo)) enviados++
    }

    // Marca mesmo sem destinatário: o aviso daquele marco já passou
    await docSnap.ref.update({ [`lembretes.${chave}`]: true })
    console.log(`${formatarData(data)} (${chave}): ${alvos.length} destinatário(s).`)
  }

  console.log(`Lembretes enviados: ${enviados}.`)
  process.exit(0)
}

main().catch((err) => { console.error(err); process.exit(1) })
