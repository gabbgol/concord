import express from 'express'
import cors from 'cors'
import { AccessToken } from 'livekit-server-sdk'

const {
  LIVEKIT_API_KEY,
  LIVEKIT_API_SECRET,
  LIVEKIT_URL,
  CORS_ORIGIN,
  PORT = 3001,
} = process.env

// Falha rápido e de forma explícita se as credenciais não estiverem configuradas.
// É melhor travar o boot do que gerar tokens quebrados silenciosamente.
if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET || !LIVEKIT_URL) {
  console.error(
    '[BOOT] Variáveis de ambiente ausentes. Configure LIVEKIT_API_KEY, LIVEKIT_API_SECRET e LIVEKIT_URL (veja .env.example).'
  )
  process.exit(1)
}

const app = express()
app.use(express.json())

// Em produção, restrinja CORS_ORIGIN ao domínio real do frontend.
// '*' é aceitável apenas em desenvolvimento.
app.use(
  cors({
    origin: CORS_ORIGIN ? CORS_ORIGIN.split(',') : '*',
  })
)

// Regras de validação de nome de sala / participante.
// Isso evita que qualquer string arbitrária vire uma "sala" e limita
// abuso básico de identidade.
const ROOM_NAME_REGEX = /^[a-zA-Z0-9_-]{3,64}$/
const PARTICIPANT_NAME_REGEX = /^.{1,40}$/

function sanitizeName(raw) {
  return String(raw ?? '').trim().slice(0, 40)
}

app.get('/health', (_req, res) => {
  res.json({ ok: true })
})

// POST /token  { roomName, participantName }
// Gera um token de acesso assinado (JWT) de curta duração.
// O segredo (LIVEKIT_API_SECRET) NUNCA sai do backend.
app.post('/token', async (req, res) => {
  try {
    const roomName = sanitizeName(req.body?.roomName)
    const participantNameRaw = sanitizeName(req.body?.participantName)

    if (!ROOM_NAME_REGEX.test(roomName)) {
      return res.status(400).json({
        error:
          'roomName inválido. Use 3-64 caracteres: letras, números, "-" ou "_".',
      })
    }

    if (!PARTICIPANT_NAME_REGEX.test(participantNameRaw)) {
      return res.status(400).json({ error: 'participantName é obrigatório (1-40 caracteres).' })
    }

    // Identidade única por conexão: nome escolhido + sufixo aleatório.
    // Isso impede que duas abas com o mesmo nome colidam como o mesmo
    // participante dentro do LiveKit, e evita que alguém "assuma" a
    // identidade de outro participante já conectado.
    const identity = `${participantNameRaw}-${Math.random().toString(36).slice(2, 8)}`

    const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity,
      name: participantNameRaw,
      ttl: '2h',
    })

    at.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
      // Permite publicar câmera, microfone E compartilhamento de tela
      // sem restrição adicional de fonte.
    })

    const token = await at.toJwt()

    res.json({
      token,
      url: LIVEKIT_URL,
      identity,
      roomName,
    })
  } catch (error) {
    console.error('[TOKEN] Falha ao gerar token:', error)
    res.status(500).json({ error: 'Falha interna ao gerar token.' })
  }
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[BOOT] Servidor de tokens rodando na porta ${PORT}`)
})
