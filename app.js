const socket = io();

const nameScreen  = document.getElementById('nameScreen');
const usersScreen = document.getElementById('usersScreen');
const chatScreen  = document.getElementById('chatScreen');
const nameInput   = document.getElementById('nameInput');
const passwordInput = document.getElementById('passwordInput');
const nameBtn     = document.getElementById('nameBtn');
const authError   = document.getElementById('authError');
const usersList   = document.getElementById('usersList');
const myAvatar    = document.getElementById('myAvatar');
const otherAvatar = document.getElementById('otherAvatar');
const otherName   = document.getElementById('otherName');
const typingStatus = document.getElementById('typingStatus');
const messagesEl  = document.getElementById('messages');
const form        = document.getElementById('form');
const input       = document.getElementById('input');
const backBtn     = document.getElementById('backBtn');
const deleteAccountBtn = document.getElementById('deleteAccountBtn');

// Reply elements
const replyPreview = document.getElementById('replyPreview');
const replyName = document.getElementById('replyName');
const replyText = document.getElementById('replyText');
const cancelReply = document.getElementById('cancelReply');

let myName = '';
let myId   = '';
let myToken = '';
let currentOther = null;
let unreadCounts = {}; 
let replyTo = null;

// --- Notification permission maango ---
function askNotificationPermission() {
  if (!('Notification' in window)) {
    console.log('Notification not supported');
    return;
  }
  if (Notification.permission === 'default') {
    Notification.requestPermission().then(permission => {
      console.log('Notification permission:', permission);
    });
  }
}

// --- Auth Functions ---
async function doAuth() {
  const name = nameInput.value.trim();
  const password = passwordInput.value;
  authError.textContent = '';

  if (!name || !password) {
    authError.textContent = 'Naam aur password dono daalo';
    return;
  }

  try {
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, password })
    });
    const data = await res.json();
    if (!res.ok) {
      authError.textContent = data.error || 'Kuch galat ho gaya';
      return;
    }

    myToken = data.token;
    myName = data.user.name;
    myId = data.user.userId;

    localStorage.setItem('chat_token', myToken);
    localStorage.setItem('chat_name', myName);
    localStorage.setItem('chat_user_id', myId);

    enterApp();
  } catch (err) {
    authError.textContent = 'Network error. Try again.';
    console.error(err);
  }
}

nameBtn.onclick = doAuth;
passwordInput.addEventListener('keydown', e => { if (e.key === 'Enter') doAuth(); });
nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') passwordInput.focus(); });

// --- Auto-login ---
async function checkAutoLogin() {
  const token = localStorage.getItem('chat_token');
  if (!token) {
    nameScreen.classList.remove('hidden');
    return;
  }
  try {
    const res = await fetch('/api/me', {
      headers: { Authorization: 'Bearer ' + token }
    });
    if (!res.ok) throw new Error('Invalid');
    const data = await res.json();
    myToken = token;
    myName = data.user.name;
    myId = data.user.userId;
    enterApp();
  } catch (err) {
    localStorage.removeItem('chat_token');
    nameScreen.classList.remove('hidden');
  }
}

checkAutoLogin();

socket.on('connect', () => {
  // Socket connected
});

function enterApp() {
  nameScreen.classList.add('hidden');
  usersScreen.classList.remove('hidden');
  myAvatar.textContent = myName.charAt(0).toUpperCase();
  socket.emit('join', { userId: myId, name: myName });
  
  // Notification permission maango
  askNotificationPermission();
}

// --- Users list ---
socket.on('users', (list) => {
  usersList.innerHTML = '';
  const others = list.filter(u => u.id !== myId && u.name !== myName);
  if (others.length === 0) {
    usersList.innerHTML = '<div class="empty">Abhi koi doosra user online nahi hai.</div>';
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
    p.textContent = u.online ? 'online' : 'offline';
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
  
  replyTo = null;
  replyPreview.classList.add('hidden');
}; 

// --- Delete Account ---
deleteAccountBtn.onclick = async () => {
  const confirmDelete = confirm('Kya tum sach me apna account delete karna chahte ho? Ye wapas nahi aayega!');
  if (!confirmDelete) return;

  try {
    const res = await fetch('/api/delete-account', {
      method: 'DELETE',
      headers: { Authorization: 'Bearer ' + myToken }
    });

    if (!res.ok) {
      alert('Account delete nahi ho paya. Try again.');
      return;
    }

    localStorage.removeItem('chat_token');
    localStorage.removeItem('chat_name');
    localStorage.removeItem('chat_user_id');

    alert('Account delete ho gaya. Ab app reload hoga.');

    location.reload();

  } catch (err) {
    console.error(err);
    alert('Network error. Try again.');
  }
};

// Reply cancel button
cancelReply.onclick = () => {
  replyTo = null;
  replyPreview.classList.add('hidden');
};

// --- Send message ---
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text || !currentOther) return;
  
  const payload = { to: currentOther.id, text };
  if (replyTo) {
    payload.replyTo = {
      id: replyTo.id,
      name: replyTo.name,
      text: replyTo.text
    };
  }
  
  socket.emit('dm', payload);
  
  replyTo = null;
  replyPreview.classList.add('hidden');
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
  if (currentOther) {
    const involved =
      (msg.from === myId && msg.to === currentOther.id) ||
      (msg.from === currentOther.id && msg.to === myId);
    if (involved) {
      addMessage(msg);
      return;
    }
  }
  
  if (msg.from !== myId) {
    unreadCounts[msg.from] = (unreadCounts[msg.from] || 0) + 1;
    const badge = document.getElementById('badge-' + msg.from);
    if (badge) {
      badge.textContent = unreadCounts[msg.from];
      badge.style.display = 'inline-flex';
    }
    
    // Notification dikhao (agar app background me hai)
    if (Notification.permission === 'granted' && document.hidden) {
      const senderName = msg.fromName || 'Someone';
      new Notification(senderName, {
        body: msg.text,
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        tag: 'chat-' + msg.from,
        renotify: true,
        vibrate: [200, 100, 200]
      });
    }
  }
});

function addMessage(msg) {
  const own = msg.from === myId;
  const div = document.createElement('div');
  div.className = 'msg ' + (own ? 'own' : 'other');
  
  if (msg.replyTo) {
    const quote = document.createElement('div');
    quote.className = 'reply-quote';
    const qName = document.createElement('span');
    qName.className = 'reply-quote-name';
    qName.textContent = msg.replyTo.name;
    const qText = document.createElement('span');
    qText.className = 'reply-quote-text';
    qText.textContent = msg.replyTo.text;
    quote.appendChild(qName);
    quote.appendChild(qText);
    div.appendChild(quote);
  }
  
  const t = document.createElement('div');
  t.textContent = msg.text;
  const w = document.createElement('span');
  w.className = 'when';
  w.textContent = new Date(msg.time).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
  div.appendChild(t);
  div.appendChild(w);
  
  let pressTimer;
  const startPress = () => {
    pressTimer = setTimeout(() => {
      replyTo = {
        id: msg.from,
        name: own ? myName : (currentOther ? currentOther.name : 'User'),
        text: msg.text
      };
      replyName.textContent = replyTo.name;
      replyText.textContent = replyTo.text;
      replyPreview.classList.remove('hidden');
      input.focus();
    }, 500);
  };
  const cancelPress = () => clearTimeout(pressTimer);
  
  div.addEventListener('touchstart', startPress);
  div.addEventListener('touchend', cancelPress);
  div.addEventListener('touchmove', cancelPress);
  div.addEventListener('mousedown', startPress);
  div.addEventListener('mouseup', cancelPress);
  div.addEventListener('mouseleave', cancelPress);
  
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// Service worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js');
}

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
