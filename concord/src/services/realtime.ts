const API_BASE_URL =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ??
  'http://localhost:3001'

export type TokenResponse = {
  token: string
  url: string
  identity: string
  roomName: string
}

/**
 * Busca um token de acesso assinado no backend para entrar em uma sala
 * do LiveKit. O segredo da API nunca é exposto ao navegador: o backend
 * é quem assina o token.
 */
export async function fetchAccessToken(
  roomName: string,
  participantName: string,
): Promise<TokenResponse> {
  let response: Response

  try {
    response = await fetch(`${API_BASE_URL}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomName, participantName }),
    })
  } catch {
    throw new Error(
      'Não foi possível conectar ao servidor. Verifique sua internet ou tente novamente em instantes.',
    )
  }

  if (!response.ok) {
    let message = 'Falha ao entrar na sala.'
    try {
      const body = (await response.json()) as { error?: string }
      if (body?.error) message = body.error
    } catch {
      // resposta sem corpo JSON — mantém a mensagem genérica
    }
    throw new Error(message)
  }

  return (await response.json()) as TokenResponse
}
