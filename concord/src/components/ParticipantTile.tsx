import { useEffect, useRef } from 'react'
import { Room, Track } from 'livekit-client'
import type { Participant } from '../types/call'

type TileSource = 'camera' | 'screen'

type Props = {
  room: Room
  participant: Participant
  source: TileSource
  /** Muda a cada evento relevante do Room, forçando reavaliação das tracks. */
  refreshKey: number
  className?: string
}

export default function ParticipantTile({
  room,
  participant,
  source,
  refreshKey,
  className,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const lkParticipant = participant.isLocal
      ? room.localParticipant
      : room.remoteParticipants.get(participant.id)

    if (!lkParticipant) return

    const trackSource = source === 'camera' ? Track.Source.Camera : Track.Source.ScreenShare
    const publication = lkParticipant.getTrackPublication(trackSource)
    const track = publication?.track
    const videoEl = videoRef.current

    if (track && videoEl) {
      track.attach(videoEl)
    }

    return () => {
      if (track && videoEl) {
        track.detach(videoEl)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, participant.id, participant.isLocal, source, refreshKey])

  const isEnabled = source === 'camera' ? participant.cameraEnabled : participant.screenSharing

  return (
    <div className={`participant-tile ${className ?? ''}`}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        // Nunca reproduzimos o próprio áudio local — evita eco/feedback.
        muted={participant.isLocal}
      />
      {!isEnabled && (
        <div className="participant-tile-placeholder">
          <span>{participant.name.slice(0, 1).toUpperCase()}</span>
        </div>
      )}
      <div className="participant-tile-label">
        {participant.name}
        {participant.isLocal ? ' (você)' : ''}
        {!participant.microphoneEnabled && <span className="muted-badge" title="Microfone mudo">🔇</span>}
      </div>
    </div>
  )
}
