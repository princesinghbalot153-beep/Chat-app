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
const messagesEl  = document.getElementById('messages');
const form        = document.getElementById('form');
const input       = document.getElementById('input');
const backBtn     = document.getElementById('backBtn');

let myName = '';
let myId   = null;
let currentOther = null;

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
  const others = list.filter(u => u.id !== socket.id);
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
}

backBtn.onclick = () => {
  currentOther = null;
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

// --- History ---
socket.on('chat history', (history) => {
  messagesEl.innerHTML = '';
  history.forEach(addMessage);
});

// --- New DM ---
socket.on('dm', (msg) => {
  // Sirf tab dikhao jab wahi chat khuli ho
  if (!currentOther) return;
  const involved =
    (msg.from === socket.id && msg.to === currentOther.id) ||
    (msg.from === currentOther.id && msg.to === socket.id);
  if (!involved) return;
  addMessage(msg);
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