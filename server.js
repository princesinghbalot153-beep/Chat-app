require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(__dirname));

// ============ MONGODB CONNECTION ============
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.log('❌ MongoDB Error:', err));

// ============ SCHEMAS ============
const userSchema = new mongoose.Schema({
  userId: { type: String, unique: true, required: true },
  name: { type: String, required: true },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const messageSchema = new mongoose.Schema({
  chatId: { type: String, required: true, index: true },
  from: { type: String, required: true },
  fromName: { type: String, required: true },
  to: { type: String, required: true },
  text: { type: String, required: true },
  time: { type: Date, default: Date.now },
  replyTo: {
    id: String,
    name: String,
    text: String
  }
});

const User = mongoose.model('User', userSchema);
const Message = mongoose.model('Message', messageSchema);

// ============ AUTH ROUTES ============
app.post('/api/auth', async (req, res) => {
  try {
    const { name, password } = req.body;
    if (!name || !password) {
      return res.status(400).json({ error: 'Name aur password dono chahiye' });
    }

    let user = await User.findOne({ name: name });

    if (user) {
      const valid = await bcrypt.compare(password, user.password);
      if (!valid) {
        return res.status(401).json({ error: 'Galat password' });
      }
    } else {
      const userId = 'u_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
      const hashedPassword = await bcrypt.hash(password, 10);
      user = new User({ userId, name, password: hashedPassword });
      await user.save();
    }

    const token = jwt.sign(
      { userId: user.userId, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      token,
      user: { userId: user.userId, name: user.name }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    res.json({ user: { userId: decoded.userId, name: decoded.name } });
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// ============ SOCKET.IO ============
const users = new Map();
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

  socket.on('load chat', async (otherId) => {
    if (!socket.userId) return;
    const chatId = chatIdOf(socket.userId, otherId);
    try {
      const history = await Message.find({ chatId })
        .sort({ time: 1 })
        .limit(500)
        .lean();

      const formatted = history.map(m => ({
        from: m.from,
        fromName: m.fromName,
        to: m.to,
        text: m.text,
        time: m.time.getTime(),
        replyTo: m.replyTo || null
      }));
      socket.emit('chat history', formatted);
    } catch (err) {
      console.error('History error:', err);
      socket.emit('chat history', []);
    }
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

  socket.on('dm', async ({ to, text, replyTo }) => {
    if (!socket.userId || !text) return;
    const chatId = chatIdOf(socket.userId, to);

    const msg = {
      chatId,
      from: socket.userId,
      fromName: socket.username,
      to,
      text,
      time: new Date(),
      replyTo: replyTo || null
    };

    try {
      await Message.create(msg);
    } catch (err) {
      console.error('Save error:', err);
    }

    const clientMsg = { ...msg, time: msg.time.getTime() };

    socket.emit('dm', clientMsg);
    const target = users.get(to);
    if (target && target.socketId) {
      io.to(target.socketId).emit('dm', clientMsg);
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

server.listen(PORT, '0.0.0.0', () => console.log('🚀 Running on ' + PORT));
