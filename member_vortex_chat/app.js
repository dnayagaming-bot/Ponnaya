import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, serverTimestamp, getDocs, getDoc, query, where, orderBy, limit, doc, onSnapshot, updateDoc, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyDAfgn6EhQjlrM4KrxMsLt8JFZLN1xQ2qQ",
    authDomain: "demoxhexa.firebaseapp.com",
    projectId: "demoxhexa",
    storageBucket: "demoxhexa.firebasestorage.app",
    messagingSenderId: "1003743776194",
    appId: "1:1003743776194:web:771ea255d6ff2229b1da5b",
    measurementId: "G-GKNQ27DHDR"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// --- GLOBAL STATE ---
let currentUser = null;
let activeTarget = null;
let allMembers = [];
let unsubscribes = {
    messages: null,
    members: null,
    status: null,
    broadcasts: null,
    typing: null
};
let typingTimeout = null;

// --- DOM ELEMENTS ---
const authLayer = document.getElementById('auth-layer');
const mainInterface = document.getElementById('interface');
const loginInput = document.getElementById('member-login-id');
const loginBtn = document.getElementById('login-confirm-btn');
const loginError = document.getElementById('error-msg');

const myProfileImg = document.getElementById('my-profile-img');
const myDisplayName = document.getElementById('my-display-name');
const chatListContainer = document.getElementById('chat-list-container');
const globalSearch = document.getElementById('global-search');

const welcomeScreen = document.getElementById('welcome-screen');
const convoHeader = document.getElementById('convo-header');
const messagesFlow = document.getElementById('messages-flow');
const convoFooter = document.getElementById('convo-footer');
const msgInput = document.getElementById('msg-input');
const sendBtn = document.getElementById('send-btn');
const micBtn = document.getElementById('mic-btn');

const profileDrawer = document.getElementById('profile-drawer');
const mediaLayer = document.getElementById('media-layer');
const mediaZoomImg = document.getElementById('media-zoom-img');

const sidebar = document.querySelector('aside');
const chatWindow = document.getElementById('main-chat-window');

const mediaInput = document.getElementById('media-input');
const groupModal = document.getElementById('group-modal');
const newGroupBtn = document.getElementById('new-group-btn');
const groupMemberList = document.getElementById('group-member-list');
const createGroupConfirm = document.getElementById('create-group-confirm');
const newGroupNameInput = document.getElementById('new-group-name');

// --- AUTHENTICATION & INITIALIZATION ---
function checkAuth() {
    const session = sessionStorage.getItem('member_chat_auth');
    if (session) {
        try {
            currentUser = JSON.parse(session);
            initializePlatform();
        } catch (e) {
            console.error("Session Corrupt");
            authLayer.classList.remove('hidden');
        }
    } else {
        authLayer.classList.remove('hidden');
    }
}

// Call checkAuth immediately
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkAuth);
} else {
    checkAuth();
}

loginBtn.onclick = async () => {
    const userInput = loginInput.value.trim();
    if (!userInput) return;

    loginBtn.disabled = true;
    loginBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Verifying...';
    loginError.classList.add('hidden');

    try {
        // We will try 3 different queries for maximum compatibility:
        // 1. By ID (Case-Insensitive)
        // 2. By Nickname (Case-Sensitive as stored)
        // 3. By Email (Case-Insensitive usually)

        const appsRef = collection(db, "applications");
        const queries = [];

        const cleanInput = userInput.toUpperCase();

        // 1. ID Query
        if (cleanInput.startsWith('DL-')) {
            queries.push(query(appsRef, where("id", "==", cleanInput)));
        } else {
            // Also try adding DL- prefix if they forgot it
            queries.push(query(appsRef, where("id", "==", "DL-" + cleanInput)));
        }

        // 2. Nickname Query
        queries.push(query(appsRef, where("nickname", "==", userInput)));

        // 3. Email Query
        if (userInput.includes('@')) {
            queries.push(query(appsRef, where("email", "==", userInput.toLowerCase())));
            queries.push(query(appsRef, where("email", "==", userInput))); // Some might have caps in email
        }

        const results = await Promise.all(queries.map(q => getDocs(q)));
        let foundDoc = null;

        for (const snap of results) {
            if (!snap.empty) {
                foundDoc = snap.docs[0];
                break;
            }
        }

        if (foundDoc) {
            const data = foundDoc.data();

            // Check Status
            if (data.status !== 'Approved') {
                loginError.innerText = `Access Denied: Your application is currently ${data.status || 'Pending'}.`;
                loginError.classList.remove('hidden');
                return;
            }

            // Check Ban
            if (data.isBanned) {
                alert(`Account Suspended: ${data.banReason || 'Policy violations'}`);
                return;
            }

            currentUser = {
                id: data.id,
                firebaseId: foundDoc.id,
                name: data.nickname,
                avatar: data.photos?.[0] || '../logo.png',
                email: data.email,
                isVerified: data.isVerified || false
            };

            sessionStorage.setItem('member_chat_auth', JSON.stringify(currentUser));
            initializePlatform();
        } else {
            loginError.innerText = "Account not found. Please check your ID/Nickname/Email.";
            loginError.classList.remove('hidden');
        }
    } catch (err) {
        console.error(err);
        alert("Connection Error. Please check your internet and try again.");
    } finally {
        loginBtn.disabled = false;
        loginBtn.innerHTML = 'Login';
    }
};

function initializePlatform() {
    // Immediate Feedback
    authLayer.style.opacity = '0';
    authLayer.style.pointerEvents = 'none';

    // Setup Profile
    if (myProfileImg) myProfileImg.src = currentUser.avatar;
    if (myDisplayName) myDisplayName.innerHTML = `${currentUser.name} ${currentUser.isVerified ? '<i class="fa-solid fa-circle-check text-[#00d4ff] text-[12px]"></i>' : ''}`;

    setTimeout(() => {
        authLayer.style.display = 'none';
        mainInterface.style.display = 'flex';
        mainInterface.classList.add('visible');
        syncMemberDirectory();
        startPresenceHeartbeat();
        listenToBroadcasts();
    }, 400);
}

// --- NEW CHAT FEATURE: BROADCASTS ---
function listenToBroadcasts() {
    if (unsubscribes.broadcasts) unsubscribes.broadcasts();
    const q = query(collection(db, "vortex_broadcasts"), orderBy("timestamp", "desc"), limit(1));
    unsubscribes.broadcasts = onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
            const data = snapshot.docs[0].data();
            const lastViewed = localStorage.getItem('last_broadcast');
            if (lastViewed !== snapshot.docs[0].id) {
                showGlobalAlert(data.message, snapshot.docs[0].id);
            }
        }
    });
}

function showGlobalAlert(msg, id) {
    const banner = document.createElement('div');
    banner.className = "fixed top-4 left-1/2 -translate-x-1/2 z-[5000] w-[90%] max-w-md bg-primary text-white p-6 rounded-3xl shadow-2xl animate-fadeIn flex flex-col gap-4";
    banner.innerHTML = `
        <div class="flex items-center gap-3">
            <span class="material-symbols-rounded animate-pulse">campaign</span>
            <p class="text-[10px] font-black uppercase tracking-widest">Global Broadcast</p>
        </div>
        <p class="text-sm font-bold leading-relaxed">${msg}</p>
        <button onclick="this.parentElement.remove(); localStorage.setItem('last_broadcast', '${id}')" class="w-full py-2 bg-white/20 rounded-xl text-[10px] font-black uppercase hover:bg-white/30 transition-all">Acknowledge</button>
    `;
    document.body.appendChild(banner);
}

// --- NEW CHAT FEATURE: PRESENCE ---
function startPresenceHeartbeat() {
    const updatePresence = async () => {
        if (!currentUser) return;
        try {
            await setDoc(doc(db, "member_presence", currentUser.id), {
                lastSeen: serverTimestamp(),
                name: currentUser.name
            });
        } catch (e) { }
    };
    updatePresence();
    setInterval(updatePresence, 30000); // Every 30s
}

let syncMemberDirectory = function () {
    if (unsubscribes.members) unsubscribes.members();
    const q = query(collection(db, "applications"), where("status", "==", "Approved"));

    unsubscribes.members = onSnapshot(q, (snapshot) => {
        chatListContainer.innerHTML = '';
        allMembers = snapshot.docs.map(d => ({ ...d.data(), firebaseId: d.id }));

        // 1. GLOBAL GROUP
        renderListItem({
            id: 'GLOBAL_PORTAL',
            name: 'Global Community',
            avatar: '../logo.png',
            lastMsg: 'Community Hub',
            type: 'group'
        });

        // 2. INDIVIDUAL MEMBERS
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            if (data.id !== currentUser.id) {
                renderListItem({
                    id: data.id,
                    name: data.nickname,
                    avatar: data.photos?.[0] || '../logo.png',
                    lastMsg: 'Online',
                    type: 'private',
                    isVerified: data.isVerified
                });
            }
        });
    }, (err) => {
        console.error("Directory Sync Fail:", err);
    });
}

function renderListItem(item) {
    const div = document.createElement('div');
    div.className = `chat-entry ${activeTarget?.id === item.id ? 'active' : ''}`;
    div.innerHTML = `
        <div class="avatar-wrap">
            <img src="${item.avatar}" class="w-12 h-12 rounded-full border border-white/5 object-cover">
            <div class="status-dot"></div>
        </div>
        <div class="flex-1 min-w-0">
            <div class="flex justify-between items-center mb-1">
                <h4 class="text-[15px] font-bold truncate flex items-center gap-1">
                    ${item.name}
                    ${item.isVerified ? '<i class="fa-solid fa-circle-check text-[#00d4ff] text-[10px]"></i>' : ''}
                </h4>
                <span class="text-[10px] text-[#8696a0]">Online</span>
            </div>
            <p class="text-sm text-[#8696a0] truncate">${item.lastMsg}</p>
        </div>
    `;
    div.onclick = () => selectTarget(item);
    chatListContainer.appendChild(div);
}

function selectTarget(target) {
    activeTarget = target;

    // Responsive Toggle for Mobile
    if (window.innerWidth < 768) {
        sidebar.classList.add('hidden');
        chatWindow.classList.remove('hidden');
        chatWindow.classList.add('flex');
    }

    welcomeScreen.classList.add('hidden');
    convoHeader.classList.remove('hidden');
    messagesFlow.classList.remove('hidden');
    convoFooter.classList.remove('hidden');

    document.getElementById('active-user-img').src = target.avatar;
    document.getElementById('active-user-name').innerHTML = `${target.name} ${target.isVerified ? '<i class="fa-solid fa-circle-check text-[#00d4ff] text-[12px]"></i>' : ''}`;
    document.getElementById('active-user-status').innerText = target.id === 'GLOBAL_PORTAL' ? 'Community Channel' : 'Checking connection...';

    // Typing listener
    listenToTyping(target.id);

    // Status listener
    if (target.id !== 'GLOBAL_PORTAL') {
        if (unsubscribes.status) unsubscribes.status();
        unsubscribes.status = onSnapshot(doc(db, "member_presence", target.id), (snap) => {
            const statusEl = document.getElementById('active-user-status');
            if (snap.exists()) {
                const lastSeen = snap.data().lastSeen?.toDate();
                const isOnline = lastSeen && (Date.now() - lastSeen.getTime() < 60000);
                statusEl.innerText = isOnline ? 'Online' : 'Last seen ' + (lastSeen ? lastSeen.toLocaleTimeString() : 'offline');
                statusEl.className = `text-[11px] ${isOnline ? 'text-[#00d4ff]' : 'text-gray-500'}`;
            }
        });
    }

    document.querySelectorAll('.chat-entry').forEach(el => {
        el.classList.remove('active');
        if (el.querySelector('h4').innerText.trim().includes(target.name.trim())) el.classList.add('active');
    });

    listenToMessages(target.id);
}

// Mobile Back Button Logic
window.goBack = () => {
    sidebar.classList.remove('hidden');
    chatWindow.classList.add('hidden');
    chatWindow.classList.remove('flex');
};

function listenToMessages(chatId) {
    if (unsubscribes.messages) unsubscribes.messages();
    messagesFlow.innerHTML = '';

    const msgsRef = collection(db, "chat_vortex_data", chatId, "messages");
    const q = query(msgsRef, orderBy("at", "asc"), limit(200));

    unsubscribes.messages = onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach(change => {
            if (change.type === "added") {
                renderMessage(change.doc.data());
            }
        });
        scrollToBottom();
    }, (err) => {
        console.error("Message Sync Fail:", err);
    });
}

function renderMessage(data) {
    const isSent = data.uid === currentUser.id;
    const div = document.createElement('div');
    div.className = `flex w-full ${isSent ? 'justify-end' : 'justify-start'} animate-fadeIn`;
    const time = data.at ? new Date(data.at.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : 'Now';

    div.innerHTML = `
        <div class="message-bubble ${isSent ? 'sent' : 'received'}">
            ${(!isSent && (activeTarget.type === 'group' || activeTarget.id === 'GLOBAL_PORTAL')) ? `<div class="text-[11px] font-black text-[#00a884] mb-1">~ ${data.author}</div>` : ''}
            ${data.image ? `<img src="${data.image}" class="rounded-lg mb-2 max-h-60 w-full object-cover cursor-pointer hover:brightness-90 transition-all message-img">` : ''}
            ${data.text ? `<p class="text-[15px] leading-relaxed select-text">${data.text}</p>` : ''}
            <div class="bubble-meta">
                <span class="bubble-time">${time}</span>
                ${isSent ? '<i class="fa-solid fa-check-double scale-75 ml-1 text-[#53bdeb]"></i>' : ''}
            </div>
        </div>
    `;

    // Add image click listener
    const img = div.querySelector('.message-img');
    if (img) {
        img.onclick = () => {
            mediaZoomImg.src = img.src;
            mediaLayer.classList.remove('hidden');
            mediaLayer.classList.add('flex');
        };
    }

    messagesFlow.appendChild(div);
}

async function handleSend() {
    const text = msgInput.value.trim();
    if (!text || !activeTarget) return;

    msgInput.value = '';
    msgInput.style.height = 'auto';
    updateInputUI();

    try {
        const msgsRef = collection(db, "chat_vortex_data", activeTarget.id, "messages");
        await addDoc(msgsRef, {
            text,
            uid: currentUser.id,
            author: currentUser.name,
            at: serverTimestamp()
        });
    } catch (e) {
        console.error("Delivery Error:", e);
        alert("Failed to send message. Check connection.");
    }
}

sendBtn.onclick = handleSend;
msgInput.onkeydown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
    }
};

msgInput.oninput = () => {
    msgInput.style.height = 'auto';
    msgInput.style.height = (msgInput.scrollHeight) + 'px';
    updateInputUI();

    // Typing Indicator Logic
    if (activeTarget) {
        setDoc(doc(db, "typing_status", activeTarget.id), {
            [currentUser.id]: true
        }, { merge: true });

        clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => {
            setDoc(doc(db, "typing_status", activeTarget.id), {
                [currentUser.id]: false
            }, { merge: true });
        }, 2000);
    }
};

function listenToTyping(chatId) {
    if (unsubscribes.typing) unsubscribes.typing();
    unsubscribes.typing = onSnapshot(doc(db, "typing_status", chatId), (snap) => {
        if (snap.exists()) {
            const data = snap.data();
            const typers = Object.keys(data).filter(uid => data[uid] && uid !== currentUser.id);
            const statusEl = document.getElementById('active-user-status');
            if (typers.length > 0) {
                statusEl.innerText = 'typing...';
                statusEl.style.color = '#00d4ff';
            } else {
                // Return to normal presence (handled by presence listener)
            }
        }
    });
}

function updateInputUI() {
    if (msgInput.value.trim()) {
        sendBtn.classList.remove('hidden');
        micBtn.classList.add('hidden');
    } else {
        sendBtn.classList.add('hidden');
        micBtn.classList.remove('hidden');
    }
}

function scrollToBottom() {
    messagesFlow.scrollTop = messagesFlow.scrollHeight;
}

// --- DRAWER & MEDIA LOGIC ---
if (document.getElementById('convo-profile-btn')) {
    document.getElementById('convo-profile-btn').onclick = () => {
        if (activeTarget.id === 'GLOBAL_PORTAL') return;

        const member = allMembers.find(m => m.id === activeTarget.id);
        if (!member) return;

        document.getElementById('drawer-img').src = member.photos?.[0] || '../logo.png';
        document.getElementById('drawer-name').innerText = member.nickname;
        document.getElementById('drawer-member-id').innerText = member.id;
        document.getElementById('drawer-email').innerText = member.email;
        document.getElementById('drawer-status').innerHTML = member.isVerified ? 'Verified Member <i class="fa-solid fa-circle-check"></i>' : 'Member';

        profileDrawer.classList.add('open');
    };
}

if (document.getElementById('close-drawer')) {
    document.getElementById('close-drawer').onclick = () => profileDrawer.classList.remove('open');
}

if (document.getElementById('drawer-img')) {
    document.getElementById('drawer-img').onclick = () => {
        mediaZoomImg.src = document.getElementById('drawer-img').src;
        mediaLayer.classList.remove('hidden');
        mediaLayer.classList.add('flex');
    };
}

if (mediaLayer) {
    mediaLayer.onclick = () => {
        mediaLayer.classList.add('hidden');
        mediaLayer.classList.remove('flex');
    };
}

if (document.getElementById('logout-btn')) {
    document.getElementById('logout-btn').onclick = () => {
        sessionStorage.removeItem('member_chat_auth');
        location.reload();
    };
}

// --- NEW FEATURE: MEDIA UPLOAD ---
mediaInput.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file || !activeTarget) return;

    try {
        const reader = new FileReader();
        reader.onload = async (event) => {
            const base64 = event.target.result;
            const msgsRef = collection(db, "chat_vortex_data", activeTarget.id, "messages");
            await addDoc(msgsRef, {
                image: base64,
                text: "",
                uid: currentUser.id,
                author: currentUser.name,
                at: serverTimestamp()
            });
        };
        reader.readAsDataURL(file);
    } catch (err) {
        alert("Upload Failed");
    }
};

// --- NEW FEATURE: GROUP CREATION ---
if (newGroupBtn) {
    newGroupBtn.onclick = () => {
        groupModal.classList.remove('hidden');
        groupModal.classList.add('flex');

        // Populate member list for selection
        groupMemberList.innerHTML = allMembers.map(m => `
            <label class="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 cursor-pointer">
                <input type="checkbox" name="group-member" value="${m.id}" class="accent-[#00a884]">
                <img src="${m.photos?.[0] || '../logo.png'}" class="w-8 h-8 rounded-full">
                <span class="text-sm font-medium">${m.nickname}</span>
            </label>
        `).join('');
    };
}

if (createGroupConfirm) {
    createGroupConfirm.onclick = async () => {
        const name = newGroupNameInput.value.trim();
        const selected = Array.from(document.querySelectorAll('input[name="group-member"]:checked')).map(el => el.value);

        if (!name || selected.length === 0) return alert("Enter name and select members");

        try {
            const groupId = 'GROUP_' + Math.random().toString(36).substr(2, 9).toUpperCase();
            const groupData = {
                id: groupId,
                name: name,
                avatar: '../logo.png',
                type: 'group',
                members: [...selected, currentUser.id],
                createdAt: serverTimestamp(),
                lastMsg: 'Group created'
            };

            await setDoc(doc(db, "vortex_groups", groupId), groupData);
            groupModal.classList.add('hidden');
            // Manual sync instead of reload
            syncMemberDirectory();
        } catch (e) {
            alert("Crisis: Group creation failed");
        }
    };
}

// Extend syncMemberDirectory to include groups
const originalSync = syncMemberDirectory;
syncMemberDirectory = function () {
    originalSync();
    // Listen to groups
    if (!currentUser) return;
    const qGroups = query(collection(db, "vortex_groups"), where("members", "array-contains", currentUser.id));
    onSnapshot(qGroups, (snap) => {
        snap.forEach(docSnap => {
            const data = docSnap.data();
            renderListItem({
                id: data.id,
                name: data.name,
                avatar: data.avatar || '../logo.png',
                lastMsg: data.lastMsg || 'No messages',
                type: 'group'
            });
        });
    });
};
