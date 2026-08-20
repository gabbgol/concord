import { createServer } from 'http'

import { Server } from 'socket.io'

const httpServer = createServer()

const io = new Server(httpServer, {

  cors: {

    origin: '*',

  },

})

io.on('connection', (socket) => {

  console.log('Usuário conectado:', socket.id)

  socket.on('join-room', (roomId) => {

    socket.join(roomId)

    console.log(`Usuário ${socket.id} entrou na sala ${roomId}`)
socket.to(roomId).emit('user-joined', socket.id)

  })

  socket.on('offer', ({ roomId, offer }) => {
socket.to(roomId).emit('offer', offer)

  })

  socket.on('answer', ({ roomId, answer }) => {
socket.to(roomId).emit('answer', answer)

  })

  socket.on('ice-candidate', ({ roomId, candidate }) => {
socket.to(roomId).emit('ice-candidate', candidate)

  })

  socket.on('disconnect', () => {

    console.log('Usuário desconectado:', socket.id)

  })

})

httpServer.listen(3001, () => {

  console.log('Servidor rodando em http://localhost:3001')

})

 