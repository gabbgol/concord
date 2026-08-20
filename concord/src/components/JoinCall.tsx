import { useState } from 'react'
import type { CallStatus } from '../types/call'

type Props = {
  roomId: string
  status: CallStatus
  error: string | null
  onJoin: (participantName: string) => void
  onDismissError: () => void
}

const STATUS_LABEL: Record<CallStatus, string> = {
  idle: 'Entrar na chamada',
  connecting: 'Conectando…',
  connected: 'Conectado',
  reconnecting: 'Reconectando…',
  disconnected: 'Você saiu da chamada',
  error: 'Falha na conexão',
}

export default function JoinCall({ roomId, status, error, onJoin, onDismissError }: Props) {
  const [name, setName] = useState('')

  const isBusy = status === 'connecting'

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed || isBusy) return
    onDismissError()
    onJoin(trimmed)
  }

  function handleCopyLink() {
    navigator.clipboard.writeText(window.location.href)
  }

  return (
    <div className="join-screen">
      <div className="join-card">
        <h1>Concord</h1>
        <p className="join-room-id">Sala: {roomId}</p>

        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Seu nome"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            autoFocus
            disabled={isBusy}
          />
          <button type="submit" disabled={isBusy || name.trim().length === 0}>
            {isBusy ? 'Conectando…' : '🎧 Entrar'}
          </button>
        </form>

        <button type="button" className="link-button" onClick={handleCopyLink}>
          🔗 Copiar link da sala
        </button>

        {status !== 'idle' && status !== 'connecting' && (
          <p className={`join-status ${status}`}>{STATUS_LABEL[status]}</p>
        )}

        {error && <p className="join-error">{error}</p>}
      </div>
    </div>
  )
}
