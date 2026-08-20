import { useCallback, useRef, useState } from 'react'
import type { Room } from 'livekit-client'
import type { Participant } from '../types/call'
import ParticipantTile from './ParticipantTile'
import RemoteAudio from './RemoteAudio'

type Props = {
  room: Room
  participants: Participant[]
  roomVersion: number
}

// Elemento com suporte a fullscreen no Safari/iOS (API prefixada).
type FullscreenCapableElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void
}

type FullscreenCapableDocument = Document & {
  webkitExitFullscreen?: () => Promise<void> | void
  webkitFullscreenElement?: Element | null
}

export default function CallStage({ room, participants, roomVersion }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)

  const screenSharer = participants.find((p) => p.screenSharing)

  const handleToggleFullscreen = useCallback(async () => {
    const container = containerRef.current as FullscreenCapableElement | null
    if (!container) return

    const doc = document as FullscreenCapableDocument
    const isCurrentlyFullscreen = Boolean(document.fullscreenElement || doc.webkitFullscreenElement)

    try {
      if (!isCurrentlyFullscreen) {
        if (container.requestFullscreen) {
          await container.requestFullscreen()
        } else if (container.webkitRequestFullscreen) {
          // Safari / iOS
          await container.webkitRequestFullscreen()
        }
        setIsFullscreen(true)
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen()
        } else if (doc.webkitExitFullscreen) {
          await doc.webkitExitFullscreen()
        }
        setIsFullscreen(false)
      }
    } catch (error) {
      console.error('[UI] Falha ao alternar fullscreen:', error)
    }
  }, [])

  return (
    <div className="call-stage" ref={containerRef}>
      <RemoteAudio room={room} refreshKey={roomVersion} />

      {screenSharer ? (
        <div className="call-stage-spotlight">
          <ParticipantTile
            room={room}
            participant={screenSharer}
            source="screen"
            refreshKey={roomVersion}
            className="spotlight-tile"
          />
          <span className="spotlight-label">
            {screenSharer.isLocal ? 'Você está compartilhando a tela' : `${screenSharer.name} está compartilhando a tela`}
          </span>
        </div>
      ) : (
        <div className="call-stage-grid" data-count={participants.length}>
          {participants.length === 0 && (
            <div className="call-stage-empty">Conectando à sala…</div>
          )}
          {participants.map((participant) => (
            <ParticipantTile
              key={participant.id}
              room={room}
              participant={participant}
              source="camera"
              refreshKey={roomVersion}
            />
          ))}
        </div>
      )}

      <button
        type="button"
        className="fullscreen-button"
        onClick={handleToggleFullscreen}
        title={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
      >
        ⛶
      </button>
    </div>
  )
}
