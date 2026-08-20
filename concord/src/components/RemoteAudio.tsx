import { useEffect, useRef } from 'react'
import { Room, RemoteTrack, Track } from 'livekit-client'

type Props = {
  room: Room
  /** Muda a cada evento relevante do Room. */
  refreshKey: number
}

/**
 * Garante que o áudio (microfone + áudio de tela compartilhada, quando
 * disponível) de todo participante remoto seja reproduzido — independente
 * de qual vídeo está em destaque na tela naquele momento.
 *
 * O áudio local nunca é anexado aqui: reproduzir o próprio microfone
 * causaria eco/feedback.
 */
export default function RemoteAudio({ room, refreshKey }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const attached: { track: RemoteTrack; el: HTMLAudioElement }[] = []

    room.remoteParticipants.forEach((participant) => {
      const audioSources = [Track.Source.Microphone, Track.Source.ScreenShareAudio]

      for (const source of audioSources) {
        const publication = participant.getTrackPublication(source)
        const track = publication?.track
        if (!track) continue

        const el = document.createElement('audio')
        el.autoplay = true
        track.attach(el)
        container.appendChild(el)
        attached.push({ track: track as RemoteTrack, el })
      }
    })

    return () => {
      attached.forEach(({ track, el }) => {
        track.detach(el)
        el.remove()
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, refreshKey])

  return <div ref={containerRef} style={{ display: 'none' }} aria-hidden="true" />
}
