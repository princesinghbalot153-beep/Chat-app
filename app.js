const socket = io();

const nameScreen  = document.getElementById('nameScreen');
const usersScreen = document.getElementById('usersScreen');
const chatScreen  = document.getElementById('chatScreen');
const nameInput   = document.getElementById('nameInput');
const nameBtn     = document.getElementById('nameBtn');
const usersList   = document.getElementById('usersList');
const myAvatar    = document.getElementById('myAvatar');
const otherAvatar = document.getElementById('otherAvatar');
const otherName   = document.getElementById('otherName');
const typingStatus = document.getElementById('typingStatus');
const messagesEl  = document.getElementById('messages');
const form        = document.getElementById('form');
const input       = document.getElementById('input');
const backBtn     = document.getElementById('backBtn');

let myName = '';
let myId   = null;
let currentOther = null;
let unreadCounts = {}; 

// --- Name screen ---
nameBtn.onclick = () => {
  const n = nameInput.value.trim();
  if (!n) return;
  myName = n;
  localStorage.setItem('chat_name', n);
  enterApp();
};
nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') nameBtn.click(); });

// Auto-login agar naam pehle se hai
const saved = localStorage.getItem('chat_name');
if (saved) { myName = saved; }

socket.on('connect', () => {
  myId = socket.id;
  if (myName) enterApp();
  else nameScreen.classList.remove('hidden');
});

function enterApp() {
  nameScreen.classList.add('hidden');
  usersScreen.classList.remove('hidden');
  myAvatar.textContent = myName.charAt(0).toUpperCase();
  socket.emit('join', myName);
}

// --- Users list ---
socket.on('users', (list) => {
  usersList.innerHTML = '';
  const others = list.filter(u => u.id !== socket.id && u.name !== myName);
  if (others.length === 0) {
    usersList.innerHTML = '<div class="empty">Abhi koi doosra user online nahi hai.<br>Dost ko link bhejo.</div>';
    return;
  }
  others.forEach(u => {
    const row = document.createElement('div');
    row.className = 'user-item';
    const av = document.createElement('div');
    av.className = 'avatar';
    av.textContent = u.name.charAt(0).toUpperCase();
    const info = document.createElement('div');
    info.className = 'info';
    const h4 = document.createElement('h4');
    h4.textContent = u.name;
    const p = document.createElement('p');
    p.textContent = 'Tap to chat';
    info.appendChild(h4); info.appendChild(p);
    row.appendChild(av); row.appendChild(info);
        // Unread badge
    const badge = document.createElement('span');
    badge.className = 'unread-badge';
    badge.id = 'badge-' + u.id;
    badge.textContent = unreadCounts[u.id] || '';
    if (!unreadCounts[u.id]) badge.style.display = 'none';
    row.appendChild(badge);
    row.onclick = () => openChat(u);
    usersList.appendChild(row);
  });
});

// --- Chat open ---
function openChat(other) {
  currentOther = other;
  otherAvatar.textContent = other.name.charAt(0).toUpperCase();
  otherName.textContent = other.name;
  messagesEl.innerHTML = '';
  usersScreen.classList.add('hidden');
  chatScreen.classList.remove('hidden');
  input.focus();
  socket.emit('load chat', other.id);
    // Unread count reset karo
  unreadCounts[other.id] = 0;
  const badge = document.getElementById('badge-' + other.id);
  if (badge) badge.style.display = 'none';
}

backBtn.onclick = () => {
  if (currentOther) {
    isTyping = false;
    socket.emit('stop typing', currentOther.id);
  }
  currentOther = null;
  typingStatus.textContent = 'online';
  typingStatus.classList.remove('typing');
  chatScreen.classList.add('hidden');
  usersScreen.classList.remove('hidden');
};

// --- Send message ---
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text || !currentOther) return;
  socket.emit('dm', { to: currentOther.id, text });
  input.value = '';
  input.focus();
});
// Typing indicator bhejo
let typingTimer = null;
let isTyping = false;

input.addEventListener('input', () => {
  if (!currentOther) return;
  if (!isTyping) {
    isTyping = true;
    socket.emit('typing', currentOther.id);
  }
  clearTimeout(typingTimer);
  typingTimer = setTimeout(() => {
    isTyping = false;
    socket.emit('stop typing', currentOther.id);
  }, 1500);
});
// --- History ---
socket.on('chat history', (history) => {
  messagesEl.innerHTML = '';
  history.forEach(addMessage);
});

// --- New DM ---
socket.on('dm', (msg) => {
  // Agar current chat open hai, toh seedha message dikhao
  if (currentOther) {
    const involved =
      (msg.from === socket.id && msg.to === currentOther.id) ||
      (msg.from === currentOther.id && msg.to === socket.id);
    if (involved) {
      addMessage(msg);
      return;
    }
  }
  
  // Agar message kisi aur user se aaya hai (aur tum chat me nahi ho)
  if (msg.from !== socket.id) {
    unreadCounts[msg.from] = (unreadCounts[msg.from] || 0) + 1;
    const badge = document.getElementById('badge-' + msg.from);
    if (badge) {
      badge.textContent = unreadCounts[msg.from];
      badge.style.display = 'inline-flex';
    }
  }
});

function addMessage(msg) {
  const own = msg.from === socket.id;
  const div = document.createElement('div');
  div.className = 'msg ' + (own ? 'own' : 'other');
  const t = document.createElement('div');
  t.textContent = msg.text;
  const w = document.createElement('span');
  w.className = 'when';
  w.textContent = new Date(msg.time).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
  div.appendChild(t);
  div.appendChild(w);
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// Service worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js');
}
// Doosre user ki typing receive karo
socket.on('typing', ({ from, name }) => {
  if (!currentOther) return;
  if (from === currentOther.id) {
    typingStatus.textContent = 'typing...';
    typingStatus.classList.add('typing');
  }
});

socket.on('stop typing', ({ from }) => {
  if (!currentOther) return;
  if (from === currentOther.id) {
    typingStatus.textContent = 'online';
    typingStatus.classList.remove('typing');
  }
});
// ---- Keyboard / Viewport handling ----
function updateAppHeight() {
  const h = window.visualViewport
    ? window.visualViewport.height
    : window.innerHeight;
  document.documentElement.style.setProperty('--app-height', h + 'px');
}

if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', updateAppHeight);
  window.visualViewport.addEventListener('scroll', updateAppHeight);
}
window.addEventListener('resize', updateAppHeight);
updateAppHeight();

// Jab input focus ho, keyboard khulne ke baad messages ko bottom pe scroll karo
input.addEventListener('focus', () => {
  setTimeout(() => {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }, 300);
});
// Love quote rotation
const loveQuotes = [
  "💕 You are my today and all of my tomorrows",
  "❤️ Every love story is beautiful, but ours is my favorite",
  "💖 You make my heart smile",
  "💗 I love you more than yesterday, less than tomorrow",
  "💓 Together is my favorite place to be",
  "💕 My heart is perfect because you are inside",
  "❤️ You are the best thing that ever happened to me",
  "💖 Forever and always, you and me"
];
let quoteIndex = 0;
const loveQuoteEl = document.getElementById('loveQuote');
if (loveQuoteEl) {
  setInterval(() => {
    quoteIndex = (quoteIndex + 1) % loveQuotes.length;
    loveQuoteEl.style.opacity = '0';
    setTimeout(() => {
      loveQuoteEl.textContent = loveQuotes[quoteIndex];
      loveQuoteEl.style.opacity = '1';
    }, 500);
  }, 8000);
}
