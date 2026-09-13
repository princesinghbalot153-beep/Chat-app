const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

app.use(express.static(__dirname));

const users = new Map();
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

  socket.on('load chat', (otherId) => {
    if (!socket.userId) return;
    const chatId = chatIdOf(socket.userId, otherId);
    socket.emit('chat history', chats.get(chatId) || []);
  });

  socket.on('typing', (to) => {
    if (!socket.userId) return;
    const target = users.get(to);
    if (target && target.socketId) {
      io.to(target.socketId).emit('typing', {
        from: socket.userId,
        name: socket.username
      });
    }
  });

  socket.on('stop typing', (to) => {
    if (!socket.userId) return;
    const target = users.get(to);
    if (target && target.socketId) {
      io.to(target.socketId).emit('stop typing', { from: socket.userId });
    }
  });

  socket.on('dm', ({ to, text, replyTo }) => {
  if (!socket.userId || !text) return;
  const chatId = chatIdOf(socket.userId, to);
  const msg = {
    from: socket.userId,
    fromName: socket.username,
    to,
    text,
    time: Date.now(),
    replyTo: replyTo || null   // Reply data yahan save hoga
  };
  if (!chats.has(chatId)) chats.set(chatId, []);
  chats.get(chatId).push(msg);
  if (chats.get(chatId).length > 500) chats.get(chatId).shift();

  socket.emit('dm', msg);
  const target = users.get(to);
  if (target && target.socketId) {
    io.to(target.socketId).emit('dm', msg);
  }
});

  socket.on('disconnect', () => {
    const userId = socketToUser.get(socket.id);
    if (userId) {
      const user = users.get(userId);
      if (user && user.socketId === socket.id) {
        user.socketId = null;
      }
      socketToUser.delete(socket.id);
      const list = Array.from(users.values()).map(u => ({
        id: u.userId,
        name: u.name,
        online: !!u.socketId
      }));
      io.emit('users', list);
    }
  });

});

server.listen(PORT, () => console.log('Running on ' + PORT));
