import './App.css'
import { useCall } from './hooks/useCall'
import JoinCall from './components/JoinCall'
import CallStage from './components/CallStage'
import ParticipantList from './components/ParticipantList'
import CallControls from './components/CallControls'

function getRoomIdFromUrl(): string {
  const segment = window.location.pathname.split('/').filter(Boolean).pop()
  return segment || 'sala-padrao'
}

function App() {
  const roomId = getRoomIdFromUrl()
  const {
    status,
    error,
    participants,
    room,
    roomVersion,
    micEnabled,
    cameraEnabled,
    screenSharing,
    join,
    leave,
    toggleMic,
    toggleCamera,
    toggleScreenShare,
    clearError,
  } = useCall(roomId)

  const inCall = status === 'connected' || status === 'reconnecting'

  if (!inCall || !room) {
    return (
      <JoinCall
        roomId={roomId}
        status={status}
        error={error}
        onJoin={join}
        onDismissError={clearError}
      />
    )
  }

  return (
    <main className="call-screen">
      {status === 'reconnecting' && (
        <div className="reconnecting-banner">Reconectando…</div>
      )}

      <CallStage room={room} participants={participants} roomVersion={roomVersion} />
      <ParticipantList participants={participants} />
      <CallControls
        micEnabled={micEnabled}
        cameraEnabled={cameraEnabled}
        screenSharing={screenSharing}
        onToggleMic={toggleMic}
        onToggleCamera={toggleCamera}
        onToggleScreenShare={toggleScreenShare}
        onLeave={leave}
      />
    </main>
  )
}

export default App
