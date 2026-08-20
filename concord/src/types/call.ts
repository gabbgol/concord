export type CallStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'error'

export type Participant = {
  id: string
  name: string
  isLocal: boolean
  cameraEnabled: boolean
  microphoneEnabled: boolean
  screenSharing: boolean
  speaking: boolean
}

export type CallError = {
  message: string
  cause?: unknown
}
