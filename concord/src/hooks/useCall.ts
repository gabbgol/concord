import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ConnectionState,
  LocalParticipant,
  Participant as LKParticipant,
  RemoteParticipant,
  Room,
  RoomEvent,
} from 'livekit-client'
import { fetchAccessToken } from '../services/realtime'
import type { CallStatus, Participant } from '../types/call'

function toParticipant(p: LKParticipant, isLocal: boolean): Participant {
  return {
    id: p.identity,
    name: p.name || p.identity,
    isLocal,
    cameraEnabled: p.isCameraEnabled,
    microphoneEnabled: p.isMicrophoneEnabled,
    screenSharing: p.isScreenShareEnabled,
    speaking: p.isSpeaking,
  }
}

function friendlyMediaError(error: unknown, kind: 'câmera' | 'microfone'): string {
  const name = (error as { name?: string })?.name
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return `Permissão de ${kind} negada. Verifique as permissões do navegador.`
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return `Nenhuma ${kind} encontrada neste dispositivo.`
  }
  if (name === 'NotReadableError') {
    return `${kind[0].toUpperCase()}${kind.slice(1)} está sendo usada por outro aplicativo.`
  }
  return `Não foi possível acessar a ${kind}.`
}

export type UseCallResult = {
  status: CallStatus
  error: string | null
  participants: Participant[]
  room: Room | null
  roomVersion: number
  micEnabled: boolean
  cameraEnabled: boolean
  screenSharing: boolean
  activeScreenShare: { participantId: string; participantName: string } | null
  join: (participantName: string) => Promise<void>
  leave: () => Promise<void>
  toggleMic: () => Promise<void>
  toggleCamera: () => Promise<void>
  toggleScreenShare: () => Promise<void>
  clearError: () => void
}

export function useCall(roomName: string): UseCallResult {
  const roomRef = useRef<Room | null>(null)

  const [status, setStatus] = useState<CallStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [micEnabled, setMicEnabled] = useState(false)
  const [cameraEnabled, setCameraEnabled] = useState(false)
  const [screenSharing, setScreenSharing] = useState(false)
  const [roomVersion, setRoomVersion] = useState(0)

  const refreshParticipants = useCallback(() => {
    const room = roomRef.current
    if (!room) {
      setParticipants([])
      setMicEnabled(false)
      setCameraEnabled(false)
      setScreenSharing(false)
      return
    }

    const local = room.localParticipant
    const remotes = Array.from(room.remoteParticipants.values()) as RemoteParticipant[]

    const list: Participant[] = [
      toParticipant(local, true),
      ...remotes.map((p) => toParticipant(p, false)),
    ]

    setParticipants(list)
    setMicEnabled(local.isMicrophoneEnabled)
    setCameraEnabled(local.isCameraEnabled)
    setScreenSharing(local.isScreenShareEnabled)
    // Força os componentes que leem publications diretamente do Room a
    // reavaliar quais tracks anexar (útil para vídeo/tela compartilhada).
    setRoomVersion((v) => v + 1)
  }, [])

  const resetLocalState = useCallback(() => {
    roomRef.current = null
    setParticipants([])
    setMicEnabled(false)
    setCameraEnabled(false)
    setScreenSharing(false)
  }, [])

  const attachRoomListeners = useCallback(
    (room: Room) => {
      room.on(RoomEvent.ParticipantConnected, refreshParticipants)
      room.on(RoomEvent.ParticipantDisconnected, refreshParticipants)
      room.on(RoomEvent.TrackSubscribed, refreshParticipants)
      room.on(RoomEvent.TrackUnsubscribed, refreshParticipants)
      room.on(RoomEvent.LocalTrackPublished, refreshParticipants)
      room.on(RoomEvent.LocalTrackUnpublished, refreshParticipants)
      room.on(RoomEvent.TrackMuted, refreshParticipants)
      room.on(RoomEvent.TrackUnmuted, refreshParticipants)
      room.on(RoomEvent.ActiveSpeakersChanged, refreshParticipants)

      room.on(RoomEvent.Reconnecting, () => {
        console.log('[CALL] reconnecting')
        setStatus('reconnecting')
      })

      room.on(RoomEvent.Reconnected, () => {
        console.log('[CALL] reconnected')
        setStatus('connected')
        refreshParticipants()
      })

      room.on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
        console.log('[CALL] connection state:', state)
      })

      room.on(RoomEvent.Disconnected, (reason) => {
        console.log('[ROOM] disconnected:', reason)
        resetLocalState()
        setStatus('disconnected')
      })
    },
    [refreshParticipants, resetLocalState],
  )

  const join = useCallback(
    async (participantName: string) => {
      if (roomRef.current) return

      setStatus('connecting')
      setError(null)

      let room: Room
      try {
        const { token, url } = await fetchAccessToken(roomName, participantName)

        room = new Room({
          adaptiveStream: true,
          dynacast: true,
        })
        roomRef.current = room
        attachRoomListeners(room)

        await room.connect(url, token)
        console.log('[CALL] connected')
      } catch (err) {
        roomRef.current = null
        setStatus('error')
        setError(err instanceof Error ? err.message : 'Falha ao entrar na sala.')
        return
      }

      // Mídia é solicitada só depois da conexão de sinalização estar de pé.
      // Falhas aqui não derrubam a chamada — a pessoa entra sem câmera/mic
      // e pode tentar ligar de novo pelos controles.
      try {
        await room.localParticipant.setMicrophoneEnabled(true)
      } catch (err) {
        setError(friendlyMediaError(err, 'microfone'))
      }

      try {
        await room.localParticipant.setCameraEnabled(true)
        console.log('[MEDIA] camera published')
      } catch (err) {
        setError((prev) => prev ?? friendlyMediaError(err, 'câmera'))
      }

      setStatus('connected')
      refreshParticipants()
    },
    [roomName, attachRoomListeners, refreshParticipants],
  )

  const leave = useCallback(async () => {
    const room = roomRef.current
    if (!room) return

    try {
      await room.localParticipant.setScreenShareEnabled(false)
    } catch {
      // ignora — pode já estar desligado
    }

    room.disconnect()
    // RoomEvent.Disconnected cuida do reset de estado.
    setStatus('idle')
  }, [])

  const toggleMic = useCallback(async () => {
    const room = roomRef.current
    if (!room) return
    const next = !room.localParticipant.isMicrophoneEnabled
    try {
      await room.localParticipant.setMicrophoneEnabled(next)
      console.log(`[MEDIA] microphone ${next ? 'unmuted' : 'muted'}`)
    } catch (err) {
      setError(friendlyMediaError(err, 'microfone'))
    }
    refreshParticipants()
  }, [refreshParticipants])

  const toggleCamera = useCallback(async () => {
    const room = roomRef.current
    if (!room) return
    const next = !room.localParticipant.isCameraEnabled
    try {
      await room.localParticipant.setCameraEnabled(next)
    } catch (err) {
      setError(friendlyMediaError(err, 'câmera'))
    }
    refreshParticipants()
  }, [refreshParticipants])

  const toggleScreenShare = useCallback(async () => {
    const room = roomRef.current
    if (!room) return
    const next = !room.localParticipant.isScreenShareEnabled

    try {
      if (next) {
        await room.localParticipant.setScreenShareEnabled(true, {
          audio: true,
          resolution: { width: 1920, height: 1080, frameRate: 30 },
        })
        console.log('[SCREEN] sharing started')
      } else {
        await room.localParticipant.setScreenShareEnabled(false)
        console.log('[SCREEN] sharing stopped')
      }
    } catch (err) {
      const name = (err as { name?: string })?.name
      // Usuário cancelou o seletor de tela — não é um erro real.
      if (name !== 'NotAllowedError' && name !== 'AbortError') {
        setError('Não foi possível compartilhar a tela. Seu navegador pode não suportar esse recurso.')
      }
    }
    refreshParticipants()
  }, [refreshParticipants])

  const clearError = useCallback(() => setError(null), [])

  // Cleanup robusto: cobre desmontagem do componente, fechar aba/refresh.
  useEffect(() => {
    const handleBeforeUnload = () => {
      roomRef.current?.disconnect()
    }
    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      roomRef.current?.disconnect()
      roomRef.current = null
    }
  }, [])

  const screenSharer = participants.find((p) => p.screenSharing)
  const activeScreenShare = screenSharer
    ? { participantId: screenSharer.id, participantName: screenSharer.name }
    : null

  return {
    status,
    error,
    participants,
    room: roomRef.current,
    roomVersion,
    micEnabled,
    cameraEnabled,
    screenSharing,
    activeScreenShare,
    join,
    leave,
    toggleMic,
    toggleCamera,
    toggleScreenShare,
    clearError,
  }
}

export type { LocalParticipant, RemoteParticipant }
