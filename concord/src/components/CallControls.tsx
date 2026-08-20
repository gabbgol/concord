type Props = {
  micEnabled: boolean
  cameraEnabled: boolean
  screenSharing: boolean
  onToggleMic: () => void
  onToggleCamera: () => void
  onToggleScreenShare: () => void
  onLeave: () => void
}

export default function CallControls({
  micEnabled,
  cameraEnabled,
  screenSharing,
  onToggleMic,
  onToggleCamera,
  onToggleScreenShare,
  onLeave,
}: Props) {
  return (
    <div className="call-controls">
      <button
        type="button"
        className={`control-button ${!micEnabled ? 'off' : ''}`}
        onClick={onToggleMic}
        title={micEnabled ? 'Desligar microfone' : 'Ligar microfone'}
        aria-pressed={!micEnabled}
      >
        {micEnabled ? '🎤' : '🔇'}
      </button>

      <button
        type="button"
        className={`control-button ${!cameraEnabled ? 'off' : ''}`}
        onClick={onToggleCamera}
        title={cameraEnabled ? 'Desligar câmera' : 'Ligar câmera'}
        aria-pressed={!cameraEnabled}
      >
        📹
      </button>

      <button
        type="button"
        className={`control-button ${screenSharing ? 'active' : ''}`}
        onClick={onToggleScreenShare}
        title={screenSharing ? 'Parar compartilhamento' : 'Compartilhar tela'}
        aria-pressed={screenSharing}
      >
        🖥️
      </button>

      <button
        type="button"
        className="control-button leave"
        onClick={onLeave}
        title="Sair da chamada"
      >
        ☎
      </button>
    </div>
  )
}
