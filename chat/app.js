// Firebase Chat Logic
const { db, collection, addDoc, serverTimestamp, getDocs, getDoc, query, where, orderBy, limit, doc, onSnapshot, updateDoc, setDoc, deleteDoc } = window.firebaseChat;

let currentUser = null;
let activeChatId = 'GLOBAL_TEAM_CHAT'; // Default global room
let chatUnsubscribe = null;

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    setupSearch();

    // Hide loader
    const loader = document.getElementById('loader');
    if (loader) {
        setTimeout(() => {
            loader.style.opacity = '0';
            setTimeout(() => loader.classList.add('hidden'), 500);
        }, 1500);
    }
});

// Authentication Check
function checkAuth() {
    const savedUser = sessionStorage.getItem('deathly_chat_user');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        showMainInterface();
    } else {
        document.getElementById('login-overlay').classList.remove('hidden');
    }
}

// Global scope for HTML button
window.verifyMember = async () => {
    const memberId = document.getElementById('member-id').value.trim().toUpperCase();
    const errorEl = document.getElementById('login-error');

    if (!memberId) return;

    errorEl.classList.add('hidden');
    const loginBtn = document.querySelector('#login-overlay button');
    loginBtn.disabled = true;
    loginBtn.innerText = 'Verifying...';

    try {
        // Query applications for this ID and status Approved
        const q = query(collection(db, 'applications'), where('id', '==', memberId), where('status', '==', 'Approved'));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            const userData = querySnapshot.docs[0].data();
            currentUser = {
                id: memberId,
                name: userData.nickname,
                avatar: userData.photos ? userData.photos[0] : '../logo.png',
                firebaseId: querySnapshot.docs[0].id
            };

            sessionStorage.setItem('deathly_chat_user', JSON.stringify(currentUser));
            showMainInterface();
            document.getElementById('login-overlay').classList.add('hidden');
        } else {
            errorEl.innerText = 'Member record not found or not approved.';
            errorEl.classList.remove('hidden');
        }
    } catch (err) {
        console.error(err);
        errorEl.innerText = 'Connection Error: ' + err.message;
        errorEl.classList.remove('hidden');
    } finally {
        loginBtn.disabled = false;
        loginBtn.innerText = 'Request Access';
    }
};

function showMainInterface() {
    const main = document.getElementById('main-interface');
    main.classList.remove('opacity-0');

    // Update Sidebar User Profile
    document.getElementById('user-name').innerText = currentUser.name;
    document.getElementById('user-avatar').src = currentUser.avatar;

    loadChatList();
    selectChat('GLOBAL_TEAM_CHAT', 'Global Tactics Room', '../logo.png'); // Default room
}

// Chat List
async function loadChatList() {
    const listContainer = document.getElementById('chat-list');

    // Always include Global Chat first
    const globalItem = createChatItem('GLOBAL_TEAM_CHAT', 'Global Tactics Room', '../logo.png', 'Official team channel', true);
    listContainer.innerHTML = '';
    listContainer.appendChild(globalItem);

    try {
        // Fetch other approved members
        const q = query(collection(db, 'applications'), where('status', '==', 'Approved'), limit(20));
        const snap = await getDocs(q);

        snap.forEach(docSnap => {
            const data = docSnap.data();
            if (data.id !== currentUser.id) {
                const item = createChatItem(docSnap.id, data.nickname, data.photos ? data.photos[0] : '../logo.png', 'Secure Line Available');
                listContainer.appendChild(item);
            }
        });
    } catch (err) {
        console.error("Error loading members:", err);
    }
}

function createChatItem(id, name, avatar, lastMsg, isActive = false) {
    const div = document.createElement('div');
    div.className = `chat-item p-4 flex items-center gap-4 cursor-pointer hover:bg-white/5 transition-all ${isActive ? 'active bg-white/5' : ''}`;
    div.setAttribute('data-id', id);

    div.innerHTML = `
        <div class="relative">
            <img src="${avatar}" class="w-12 h-12 rounded-2xl border border-white/10 user-image object-cover" alt="${name}">
            <div class="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 border-2 border-sidebar-dark rounded-full"></div>
        </div>
        <div class="flex-1 min-w-0">
            <div class="flex justify-between items-start mb-0.5">
                <h4 class="text-sm font-black text-white truncate uppercase tracking-tight">${name}</h4>
                <span class="text-[8px] text-gray-600 font-bold uppercase whitespace-nowrap">Online</span>
            </div>
            <p class="text-[10px] text-gray-500 truncate font-medium uppercase tracking-widest">${lastMsg}</p>
        </div>
    `;

    div.onclick = () => selectChat(id, name, avatar);
    return div;
}

function setupSearch() {
    const searchInput = document.getElementById('chat-search');
    if (!searchInput) return;

    searchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const items = document.querySelectorAll('.chat-item');
        items.forEach(item => {
            const name = item.querySelector('h4').innerText.toLowerCase();
            const id = item.getAttribute('data-id').toLowerCase();
            if (name.includes(term) || id.includes(term)) {
                item.style.display = 'flex';
            } else {
                item.style.display = 'none';
            }
        });
    });
}

// Active Chat Selection
function selectChat(id, name, avatar) {
    activeChatId = id;

    // UI Updates
    document.getElementById('empty-chat').classList.add('hidden');
    const activeChatEl = document.getElementById('active-chat');
    activeChatEl.classList.remove('opacity-0', 'pointer-events-none');

    document.getElementById('active-user-name').innerText = name;
    document.getElementById('active-user-avatar').src = avatar;
    document.getElementById('active-user-status').innerText = 'Secure Channel Active';

    // Update active class in list
    document.querySelectorAll('.chat-item').forEach(el => {
        el.classList.remove('active', 'bg-white/5');
        if (el.getAttribute('data-id') === id) el.classList.add('active', 'bg-white/5');
    });

    listenToMessages(id);
}

// Messaging Logic
function listenToMessages(chatId) {
    if (chatUnsubscribe) chatUnsubscribe();

    const container = document.getElementById('message-container');
    container.innerHTML = `<div class="flex justify-center py-10"><span class="material-symbols-rounded animate-spin text-primary">sync</span></div>`;

    const messagesRef = collection(db, 'chat_rooms', chatId, 'messages');
    const q = query(messagesRef, orderBy('timestamp', 'asc'), limit(100));

    chatUnsubscribe = onSnapshot(q, (snapshot) => {
        container.innerHTML = '';
        if (snapshot.empty) {
            container.innerHTML = `
                <div class="flex flex-col items-center justify-center h-full opacity-20 text-center space-y-4">
                    <span class="material-symbols-rounded text-6xl">lock</span>
                    <p class="text-[10px] font-black uppercase tracking-[0.3em]">End-to-End Encrypted Tunnel Established</p>
                </div>
            `;
            return;
        }

        snapshot.forEach(docSnap => {
            const msg = docSnap.data();
            renderMessage(msg);
        });

        scrollToBottom();
    });
}

function renderMessage(msg) {
    const container = document.getElementById('message-container');
    const isSelf = msg.senderId === currentUser.id;

    const div = document.createElement('div');
    div.className = `flex w-full ${isSelf ? 'justify-end' : 'justify-start'} animate-scale-in`;

    const time = msg.timestamp ? new Date(msg.timestamp.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now';

    // XSS PROTECTION: Use LEGION_UTILS.sanitize
    const safeText = window.LEGION_UTILS ? window.LEGION_UTILS.sanitize(msg.text) : msg.text.replace(/</g, "&lt;");
    const safeName = window.LEGION_UTILS ? window.LEGION_UTILS.sanitize(msg.senderName) : (msg.senderName || 'Agent').replace(/</g, "&lt;");

    div.innerHTML = `
        <div class="message-bubble ${isSelf ? 'self' : 'other'}">
            ${!isSelf ? `<p class="text-[8px] font-black text-primary uppercase mb-1 tracking-widest">${safeName}</p>` : ''}
            <p class="text-sm">${safeText}</p>
            <div class="message-time">${time}</div>
        </div>
    `;

    container.appendChild(div);
}

// Sending Messages
const chatForm = document.getElementById('chat-form');
chatForm.onsubmit = async (e) => {
    e.preventDefault();
    const input = document.getElementById('message-input');
    const text = input.value.trim();

    if (!text || !activeChatId) return;

    input.value = '';

    try {
        const messagesRef = collection(db, 'chat_rooms', activeChatId, 'messages');
        await addDoc(messagesRef, {
            text,
            senderId: currentUser.id,
            senderName: currentUser.name,
            timestamp: serverTimestamp()
        });

        // Play subtle sound?
        const sfx = new Audio('https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3');
        sfx.volume = 0.2;
        sfx.play().catch(() => { });

    } catch (err) {
        console.error("Error sending message:", err);
        alert("Transmission Failed: " + err.message);
    }
};

function scrollToBottom() {
    const container = document.getElementById('message-container');
    container.scrollTop = container.scrollHeight;
}

window.logout = () => {
    sessionStorage.removeItem('deathly_chat_user');
    window.location.reload();
};

window.playClick = () => {
    const sfx = new Audio('https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3');
    sfx.volume = 0.2;
    sfx.play().catch(() => { });
};
