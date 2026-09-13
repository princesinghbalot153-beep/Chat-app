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
const socketToUser = new Map();

function chatIdOf(a, b) {
  return [a, b].sort().join('__');
}

io.on('connection', (socket) => {

    socket.on('join', ({ userId, name }) => {
    if (!userId || !name) return;
    
    const existing = users.get(userId);
    if (existing && existing.socketId && existing.socketId !== socket.id) {
      socketToUser.delete(existing.socketId);
    }

    socket.userId = userId;
    socket.username = name;
    users.set(userId, { userId, name, socketId: socket.id });
    socketToUser.set(socket.id, userId);
    
    const list = Array.from(users.values()).map(u => ({
      id: u.userId,
      name: u.name,
      online: !!u.socketId
    }));
    io.emit('users', list);
  });
  });

  socket.on('load chat', (otherId) => {
    const chatId = chatIdOf(socket.id, otherId);
    socket.emit('chat history', chats.get(chatId) || []);
  });
  socket.on('typing', (to) => {
    io.to(to).emit('typing', { from: socket.id, name: socket.username });
  });

  socket.on('stop typing', (to) => {
    io.to(to).emit('stop typing', { from: socket.id });
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
