import { io } from 'socket.io-client'

import { useEffect, useRef, useState } from 'react'

import './App.css'

const socket = io('https://concord-v470.onrender.com')

function App() {

  const localVideoRef = useRef<HTMLVideoElement>(null)

  const remoteVideoRef = useRef<HTMLVideoElement>(null)

  const streamRef = useRef<MediaStream | null>(null)

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null)

  const [cameraAtiva, setCameraAtiva] = useState(false)

  const [microfoneAtivo, setMicrofoneAtivo] = useState(false)

  const roomId =

    window.location.pathname.split('/').pop() || 'teste'

  function criarPeerConnection() {

    const peerConnection = new RTCPeerConnection({

      iceServers: [

        {

          urls: 'stun:stun.l.google.com:19302',

        },

      ],

    })

    peerConnection.onicecandidate = (event) => {

      if (event.candidate) {

        socket.emit('ice-candidate', {

          roomId,

          candidate: event.candidate,

        })

      }

    }

    peerConnection.ontrack = (event) => {

      const remoteStream = event.streams[0]

      if (remoteVideoRef.current) {

        remoteVideoRef.current.srcObject = remoteStream

      }

    }

    if (streamRef.current) {

      streamRef.current.getTracks().forEach((track) => {

        peerConnection.addTrack(

          track,

          streamRef.current!

        )

      })

    }

    peerConnectionRef.current = peerConnection

    return peerConnection

  }

  async function criarOferta() {

    const peerConnection = criarPeerConnection()

    const offer =

      await peerConnection.createOffer()

    await peerConnection.setLocalDescription(

      offer

    )

    socket.emit('offer', {

      roomId,

      offer,

    })

  }

  useEffect(() => {

    async function preparar() {

      await iniciarCamera()

      socket.emit('join-room', roomId)

    }

    socket.on('user-joined', async () => {

      console.log('Outro usuário entrou')

      await criarOferta()

    })

    socket.on('offer', async (offer) => {

      console.log('Offer recebida')

      const peerConnection =

        criarPeerConnection()

      await peerConnection.setRemoteDescription(

        offer

      )

      const answer =

        await peerConnection.createAnswer()

      await peerConnection.setLocalDescription(

        answer

      )

      socket.emit('answer', {

        roomId,

        answer,

      })

    })

    socket.on('answer', async (answer) => {

      console.log('Answer recebida')

      if (!peerConnectionRef.current) return

      await peerConnectionRef.current.setRemoteDescription(

        answer

      )

    })

    socket.on(

      'ice-candidate',

      async (candidate) => {

        if (!peerConnectionRef.current) return

        try {

          await peerConnectionRef.current.addIceCandidate(

            candidate

          )

        } catch (error) {

          console.error(

            'Erro ao adicionar ICE:',

            error

          )

        }

      }

    )

    preparar()

    return () => {

      socket.off('user-joined')

      socket.off('offer')

      socket.off('answer')

      socket.off('ice-candidate')

    }

  }, [])

  async function iniciarCamera() {

    if (streamRef.current) return

    try {

      const stream =

        await navigator.mediaDevices.getUserMedia({

          video: true,

          audio: true,

        })

      streamRef.current = stream

      if (localVideoRef.current) {

        localVideoRef.current.srcObject = stream

      }

      setCameraAtiva(true)

      setMicrofoneAtivo(true)

    } catch (error) {

      console.error(

        'Erro ao acessar câmera:',

        error

      )

    }

  }

  async function alternarCamera() {

    const stream = streamRef.current

    if (!stream) {

      await iniciarCamera()

      return

    }

    const videoTrack =

      stream.getVideoTracks()[0]

    if (!videoTrack) return

    videoTrack.enabled =

      !videoTrack.enabled

    setCameraAtiva(videoTrack.enabled)

  }

  function alternarMicrofone() {

    const stream = streamRef.current

    if (!stream) return

    const audioTrack =

      stream.getAudioTracks()[0]

    if (!audioTrack) return

    audioTrack.enabled =

      !audioTrack.enabled

    setMicrofoneAtivo(audioTrack.enabled)

  }

  async function compartilharTela() {

    try {

      const screenStream =

        await navigator.mediaDevices.getDisplayMedia({

          video: true,

        })

      const screenTrack =

        screenStream.getVideoTracks()[0]

      const peerConnection =

        peerConnectionRef.current

      if (!peerConnection) {

        console.log(

          'Ainda não existe conexão com outro usuário'

        )

        return

      }

      const sender =

        peerConnection

          .getSenders()

          .find(

            (sender) =>

              sender.track?.kind === 'video'

          )

      if (sender) {

        await sender.replaceTrack(screenTrack)

      }

      if (localVideoRef.current) {

        localVideoRef.current.srcObject =

          screenStream

      }

      screenTrack.onended = async () => {

        const cameraTrack =

          streamRef.current

            ?.getVideoTracks()[0]

        if (cameraTrack && sender) {

          await sender.replaceTrack(cameraTrack)

        }

        if (

          localVideoRef.current &&

          streamRef.current

        ) {

          localVideoRef.current.srcObject =

            streamRef.current

        }

      }

    } catch (error) {

      console.error(

        'Erro ao compartilhar tela:',

        error

      )

    }

  }
  function telaCheiaRemota() {
    if(remoteVideoRef.current){
      remoteVideoRef.current.requestFullscreen()
    }
  }
  function copiarLink() {

    navigator.clipboard.writeText(

      window.location.href

    )

    alert('Link copiado!')

  }

  return (
<main>
<h1>Concord</h1>
<p>Sala: {roomId}</p>
<button onClick={copiarLink}>

        🔗 Copiar link da sala
</button>
<div className="videos">
<div>
<p>Você</p>
<video

            ref={localVideoRef}

            autoPlay

            playsInline

            muted

          />
          <button onClick={telaCheiaRemota}>
            Tela Cheia
          </button>
</div>
<div>
<p>Outro usuário</p>
<video

            ref={remoteVideoRef}

            autoPlay

            playsInline

          />
          <button onClick={telaCheiaRemota}>
            Tela Cheia
          </button>
</div>
</div>
<div className="controles">
<button onClick={alternarCamera}>

          {cameraAtiva

            ? '📹 Desligar câmera'

            : '📹 Ligar câmera'}
</button>
<button onClick={alternarMicrofone}>

          {microfoneAtivo

            ? '🎤 Desligar microfone'

            : '🎤 Ligar microfone'}
</button>
<button onClick={compartilharTela}>

          🖥️ Compartilhar tela
</button>
</div>
</main>

  )

}

export default App