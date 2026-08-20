# Concord — chamadas de áudio, vídeo e tela

Reescrita da arquitetura de chamadas: saiu o WebRTC P2P manual (offer/answer/ICE
via Socket.IO), entrou um **SFU (LiveKit)**. O backend agora só emite tokens de
acesso assinados; toda a complexidade de mídia, reconexão e roteamento de
tracks fica a cargo do LiveKit.

## Por que LiveKit (e não mediasoup)

Ambos são SFUs open source sólidos, mas para este projeto:

- **mediasoup** é uma biblioteca de baixo nível: você ainda escreveria toda a
  sinalização, gerenciamento de salas, reconexão e transporte manualmente —
  essencialmente reconstruindo boa parte do que já estava dando problema.
- **LiveKit** entrega servidor de mídia + SDKs de cliente prontos
  (`livekit-client`) que já resolvem: reconexão automática, publicação/
  assinatura de tracks por *source* (câmera vs. tela — semanticamente
  distintos, como pedido), TURN embutido, e uma API de alto nível
  (`setCameraEnabled`, `setScreenShareEnabled` etc.) que elimina a maior parte
  dos bugs do código anterior (senders órfãos, `replaceTrack` sem sender,
  ICE candidates fora de ordem).

Dado que a prioridade era simplicidade, estabilidade e compatibilidade com
React, LiveKit é a escolha mais direta.

## Arquitetura

```
                 ┌─────────────────┐
                 │ React Frontend  │  (concord/)
                 └────────┬────────┘
                          │
                    HTTPS (POST /token)
                          │
                 ┌────────▼────────┐
                 │ Backend/API     │  (server/) — só emite tokens JWT
                 └────────┬────────┘
                          │
                     token assinado
                          │
                    ┌─────▼─────┐
                    │  LiveKit  │  (Cloud ou self-hosted)
                    │    SFU    │
                    └─────┬─────┘
                         / \
                        /   \
                       A     B   (áudio, câmera, tela — tracks independentes)
```

- **Frontend**: pede um token ao backend, conecta direto ao LiveKit via
  `livekit-client` (WebSocket + WebRTC). Não fala mais com o backend depois
  de entrar na sala.
- **Backend**: único endpoint sensível é `POST /token`, que assina um JWT
  de curta duração (2h) usando `LIVEKIT_API_SECRET` — esse segredo nunca
  chega ao navegador.
- **LiveKit**: roteia as tracks entre participantes (SFU real, não mesh
  P2P), cuida de TURN/STUN internamente e escala para N participantes sem
  mudança de código no frontend.

## Estrutura de arquivos

```
API/
├── server/
│   ├── src/index.js       # Express: POST /token, GET /health
│   ├── .env.example
│   └── package.json
│
└── concord/
    ├── src/
    │   ├── components/
    │   │   ├── JoinCall.tsx         # Tela "Entrar na chamada"
    │   │   ├── CallStage.tsx        # Área principal (câmera/tela + fullscreen)
    │   │   ├── ParticipantTile.tsx  # Um tile de vídeo
    │   │   ├── ParticipantList.tsx  # Lista de participantes
    │   │   ├── CallControls.tsx     # Mic / câmera / tela / sair
    │   │   └── RemoteAudio.tsx      # Reprodução de áudio remoto (invisível)
    │   ├── hooks/
    │   │   └── useCall.ts           # Toda a lógica de conexão/estado do LiveKit
    │   ├── services/
    │   │   └── realtime.ts          # Busca o token no backend
    │   ├── types/
    │   │   └── call.ts
    │   ├── App.tsx
    │   └── main.tsx
    ├── .env.example
    └── package.json
```

## Dependências

**Backend** (`server/`):
```bash
cd server
npm install
```
Instala `express`, `cors`, `livekit-server-sdk`.

**Frontend** (`concord/`):
```bash
cd concord
npm install
```
Instala `livekit-client` (substitui `socket.io-client`), além de React/Vite.

## Variáveis de ambiente

Você precisa de um projeto LiveKit — o caminho mais rápido para um projeto
pequeno é o **LiveKit Cloud** (tem tier gratuito, TURN incluso, zero infra
para manter). Crie um projeto em https://cloud.livekit.io e copie API Key,
API Secret e a URL do projeto (`wss://SEU-PROJETO.livekit.cloud`).

**`server/.env`** (baseado em `server/.env.example`):
```
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=
LIVEKIT_URL=wss://SEU-PROJETO.livekit.cloud
PORT=3001
CORS_ORIGIN=https://SEU-FRONTEND.onrender.com
```

**`concord/.env`** (baseado em `concord/.env.example`):
```
VITE_API_URL=http://localhost:3001
```

## Como rodar localmente

Em dois terminais:

```bash
# Terminal 1 — backend
cd server
cp .env.example .env   # preencha as credenciais do LiveKit
npm install
npm run dev

# Terminal 2 — frontend
cd concord
cp .env.example .env   # já aponta para localhost:3001 por padrão
npm install
npm run dev
```

Acesse `http://localhost:5173/call/ABC123` (qualquer nome de sala).

## Como testar com dois usuários

1. Abra `http://localhost:5173/call/teste123` em uma aba normal.
2. Abra a mesma URL em uma aba anônima (ou outro navegador) — isso simula um
   segundo participante sem compartilhar cookies/estado.
3. Em cada aba, digite um nome diferente e clique em **Entrar**.
4. Confirme: os dois se veem e se ouvem, a lista de participantes atualiza,
   mute/câmera funcionam independentemente em cada aba.
5. Clique em **Compartilhar tela** em uma aba e confirme que a outra aba
   assume automaticamente a tela compartilhada como conteúdo principal.
6. Feche uma aba (ou clique em Sair) e confirme que a outra aba remove o
   participante da lista sem travar.
7. Reabra a aba fechada com a mesma URL — a sala deve continuar funcionando,
   sem precisar trocar de link.

## Como publicar (Render)

**Backend** — Web Service:
- Root Directory: `server`
- Build Command: `npm install`
- Start Command: `npm run start`
- Environment: `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_URL`,
  `CORS_ORIGIN` (URL pública do frontend no Render)

**Frontend** — Static Site (ou Web Service, como já está hoje):
- Root Directory: `concord`
- Build Command: `npm install && npm run build`
- Publish Directory: `dist`
- Environment: `VITE_API_URL` = URL pública do backend no Render

O Render continua servindo perfeitamente o backend de tokens (é uma API HTTP
comum) e o frontend estático. O que **não** roda no Render é o próprio
servidor de mídia LiveKit — ele não é um serviço HTTP simples, precisa de
portas UDP abertas para WebRTC, o que o Render (nos planos padrão de Web
Service) não expõe. Por isso o projeto usa **LiveKit Cloud** para essa
camada; se no futuro você quiser self-host, vai precisar de uma VM (ex.
EC2, Fly.io, Hetzner) com portas UDP liberadas — fora do escopo do Render.

## STUN/TURN

Resolvido pelo LiveKit (Cloud ou self-hosted): ele já inclui STUN e TURN
gerenciados, então chamadas entre redes diferentes (incluindo NAT simétrico
e redes corporativas restritivas) funcionam sem configuração adicional sua.

## Limitações conhecidas

- Áudio do compartilhamento de tela depende do navegador/SO: Chrome/Edge no
  desktop capturam áudio de aba/tela; Firefox e Safari têm suporte parcial
  ou inexistente. O código já trata isso — se `audio: true` falhar ao
  capturar, o compartilhamento de vídeo continua funcionando normalmente.
- Em mobile (iOS/Android), compartilhamento de tela tem suporte variável
  dependendo do navegador; a UI não esconde essa limitação, apenas o botão
  pode falhar com uma mensagem clara caso a API não exista.

## Checklist

- [x] Botão "Entrar" — não conecta automaticamente ao abrir a URL
- [x] Participante aparece para os outros ao entrar
- [x] Lista de participantes atualiza (entrada/saída)
- [x] Microfone liga/desliga refletindo a track real
- [x] Câmera liga/desliga refletindo a track real
- [x] Compartilhamento de tela funciona e aparece para o outro participante
- [x] Áudio de tela compartilhada quando o navegador suporta
- [x] Fullscreen no container principal, com fallback Safari/iOS
- [x] Sair da chamada limpa tracks, listeners e conexões
- [x] Fechar aba / refresh não deixa participante fantasma
- [x] Mesma sala pode ser reutilizada indefinidamente (não precisa de nova URL)
- [x] Arquitetura SFU permite múltiplos participantes sem mudança de código
