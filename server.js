const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

app.use(express.static(__dirname));

// Online users: { socketId: { id, name } }
const users = new Map();
// DM history: { chatId: [messages] }
const chats = new Map();

function chatIdOf(a, b) {
  return [a, b].sort().join('__');
}

io.on('connection', (socket) => {

  socket.on('join', (name) => {
    socket.username = name;
    users.set(socket.id, { id: socket.id, name });
    // Sabko updated user list bhej do
    io.emit('users', Array.from(users.values()));
  });

  socket.on('load chat', (otherId) => {
    const chatId = chatIdOf(socket.id, otherId);
    socket.emit('chat history', chats.get(chatId) || []);
  });

  socket.on('dm', ({ to, text }) => {
    if (!socket.username || !text) return;
    const chatId = chatIdOf(socket.id, to);
    const msg = {
      from: socket.id,
      fromName: socket.username,
      to,
      text,
      time: Date.now()
    };
    if (!chats.has(chatId)) chats.set(chatId, []);
    chats.get(chatId).push(msg);
    if (chats.get(chatId).length > 500) chats.get(chatId).shift();

    // Dono ko bhej do
    io.to(socket.id).emit('dm', msg);
    io.to(to).emit('dm', msg);
  });

  socket.on('disconnect', () => {
    users.delete(socket.id);
    io.emit('users', Array.from(users.values()));
  });
});

server.listen(PORT, () => console.log('Running on ' + PORT));
