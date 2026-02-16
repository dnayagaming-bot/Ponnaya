import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, query, orderBy, onSnapshot, doc, updateDoc, setDoc, getDocs, where, deleteDoc, serverTimestamp, getDoc, limit } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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

// --- STATE ---
let members = [];
let selectedMemberId = null;

// --- DOM ELEMENTS ---
const loader = document.getElementById('command-loader');
const authLayer = document.getElementById('auth-layer');
const mainInterface = document.getElementById('main-interface');
const adminUser = document.getElementById('admin-user');
const adminPass = document.getElementById('admin-pass');
const authBtn = document.getElementById('auth-btn');
const errorMsg = document.getElementById('error-msg');

const userTableBody = document.getElementById('user-table-body');
const activityFeed = document.getElementById('activity-feed');
const aiAlerts = document.getElementById('ai-alerts');
const aiTerminal = document.getElementById('ai-live-logs');

const actionModal = document.getElementById('user-action-modal');
const closeModal = document.querySelector('.close-modal');

// --- AUTH LOGIC ---
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        loader.style.opacity = '0';
        setTimeout(() => loader.style.display = 'none', 800);
    }, 1000);

    const session = sessionStorage.getItem('vortex_admin_auth');
    if (session) {
        unlockDashboard();
    }
});

authBtn.onclick = async () => {
    const user = adminUser.value.trim();
    const pass = adminPass.value.trim();

    if (!user || !pass) return;

    authBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Logging in...';

    try {
        const adminRef = doc(db, "admins", user);
        const snap = await getDoc(adminRef);

        if (snap.exists() && snap.data().pass === pass) {
            sessionStorage.setItem('vortex_admin_auth', 'active');
            unlockDashboard();
        } else {
            errorMsg.classList.remove('hidden');
            setTimeout(() => errorMsg.classList.add('hidden'), 3000);
        }
    } catch (e) {
        alert("Login Error: " + e.message);
    } finally {
        authBtn.innerHTML = 'Login';
    }
};

function unlockDashboard() {
    authLayer.classList.add('hidden');
    mainInterface.classList.remove('hidden');
    syncIntelligence();
}

// --- SYNC SYSTEMS ---
function syncIntelligence() {
    // 1. SYNC ALL MEMBERS (Approved)
    onSnapshot(query(collection(db, "applications"), where("status", "==", "Approved")), (snapshot) => {
        members = snapshot.docs.map(d => ({ ...d.data(), firebaseId: d.id }));
        renderUserTable();
        logTerminal(`Connected to member database. Synchronized ${members.length} records.`);
    });

    // 2. SYNC GLOBAL CHAT FOR AI MONITORING
    onSnapshot(query(collection(db, "chat_vortex_data", "GLOBAL_PORTAL", "messages"), orderBy("at", "desc"), limit(10)), (snapshot) => {
        snapshot.docChanges().forEach(change => {
            if (change.type === "added") {
                const msg = change.doc.data();
                pushActivity(`${msg.author}: ${msg.text.substring(0, 30)}${msg.text.length > 30 ? '...' : ''}`, msg.author);
                runAIScan(msg);
            }
        });
    });

    // 3. SYNC APPEALS
    onSnapshot(collection(db, "vortex_appeals"), (snapshot) => {
        renderAppeals(snapshot);
    });
}

// --- RENDERERS ---
function renderUserTable() {
    userTableBody.innerHTML = '';
    members.forEach(m => {
        const tr = document.createElement('tr');
        const statusText = m.isBanned ? 'Banned' : (m.isSuspended ? 'Suspended' : 'Active');
        const riskScore = m.riskScore || 0;

        tr.innerHTML = `
            <td>
                <div class="user-cell">
                    <img src="${m.photos?.[0] || '../../logo.png'}" alt="">
                    <div>
                        <p>${m.nickname || 'Unknown'} ${m.isVerified ? '<i class="fa-solid fa-circle-check text-[#00d4ff]"></i>' : ''}</p>
                        <span>${m.id || 'N/A'}</span>
                    </div>
                </div>
            </td>
            <td><span class="badge ${statusText.toLowerCase()}">${statusText}</span></td>
            <td>Active Now</td>
            <td class="${riskScore > 50 ? 'red' : 'green'} font-bold">${riskScore}%</td>
            <td><button class="table-btn" onclick="openUserAction('${m.id}')">Manage</button></td>
        `;
        userTableBody.appendChild(tr);
    });
}

function pushActivity(text, author) {
    const div = document.createElement('div');
    div.className = 'event-item animate-fadeIn';
    div.innerHTML = `
        <div class="event-details">
            <p>${text}</p>
            <div class="time">Just now</div>
        </div>
    `;
    activityFeed.prepend(div);
    if (activityFeed.children.length > 20) activityFeed.removeChild(activityFeed.lastChild);
}

function renderAppeals(snapshot) {
    const list = document.getElementById('appeals-list');
    list.innerHTML = '';
    snapshot.forEach(docSnap => {
        const data = docSnap.data();
        const div = document.createElement('div');
        div.className = 'appeal-card animate-fadeIn';
        div.innerHTML = `
            <div class="appeal-sender">
                <strong>${data.name}</strong> <span>(${data.id})</span>
            </div>
            <p class="appeal-text">"${data.message}"</p>
            <div class="appeal-actions">
                <button class="app-btn accept" onclick="pardonUser('${data.id}', '${docSnap.id}')">Approve Appeal</button>
                <button class="app-btn deny" onclick="denyAppeal('${docSnap.id}')">Reject</button>
            </div>
        `;
        list.appendChild(div);
    });
}

// --- AI SENTINEL LOGIC ---
const SPAM_KEYWORDS = ['free', 'win', 'prize', 'click', 'scam', 'crypto', 'earn'];
const VIOLENCE_KEYWORDS = ['kill', 'hate', 'die', 'threat', 'violence', 'beat'];

async function runAIScan(msg) {
    const text = msg.text.toLowerCase();
    let violation = null;

    if (SPAM_KEYWORDS.some(k => text.includes(k))) violation = 'Spam Detected';
    else if (VIOLENCE_KEYWORDS.some(k => text.includes(k))) violation = 'Toxic Content';

    if (violation) {
        logTerminal(`AI SENTINEL: Flagged message from ${msg.author}: ${violation}`, 'red');
        pushAlert(violation, msg.author, msg.text);

        const member = members.find(m => m.nickname === msg.author);
        if (member) {
            await updateDoc(doc(db, "applications", member.firebaseId), {
                riskScore: (member.riskScore || 0) + 20
            });
        }
    }
}

function pushAlert(type, user, content) {
    const div = document.createElement('div');
    div.className = 'alert-item animate-fadeIn';
    div.innerHTML = `
        <div class="type"><i class="fa-solid fa-robot"></i> AI FLAG: ${type}</div>
        <div class="msg"><strong>${user}:</strong> ${content}</div>
    `;
    aiAlerts.prepend(div);
}

function logTerminal(msg, color = 'green') {
    const div = document.createElement('div');
    div.className = `log-line ${color === 'red' ? 'red' : ''}`;
    div.innerText = `>> ${msg}`;
    aiTerminal.appendChild(div);
    aiTerminal.scrollTop = aiTerminal.scrollHeight;
}

// --- ACTIONS ---
window.openUserAction = (id) => {
    const member = members.find(m => m.id === id);
    if (!member) return;

    selectedMemberId = member.firebaseId;
    document.getElementById('modal-user-name').innerText = member.nickname;
    document.getElementById('modal-user-id').innerText = member.id;
    document.getElementById('modal-user-img').src = member.photos?.[0] || '../../logo.png';

    document.getElementById('ban-controls').classList.add('hidden');
    actionModal.classList.remove('hidden');

    // Verification button switch
    const verifyBtn = document.getElementById('verify-btn');
    if (member.isVerified) {
        verifyBtn.innerText = "Remove Verified Badge";
        verifyBtn.classList.add('deny');
        verifyBtn.onclick = () => toggleVerify(false);
    } else {
        verifyBtn.innerText = "Grant Verified Badge";
        verifyBtn.classList.remove('deny');
        verifyBtn.onclick = () => toggleVerify(true);
    }
};

async function toggleVerify(status) {
    await updateDoc(doc(db, "applications", selectedMemberId), { isVerified: status });
    logTerminal(`Admin updated verification for ${selectedMemberId}.`, 'green');
    actionModal.classList.add('hidden');
}

window.prepareBan = (type) => {
    document.getElementById('ban-controls').classList.remove('hidden');
    const executeBtn = document.querySelector('.confirm-ban-btn');
    executeBtn.onclick = () => executeBan(type);
};

async function executeBan(type) {
    const days = document.getElementById('ban-days').value;
    const reason = document.getElementById('action-reason').value;

    if (!reason) return alert("Please provide a reason.");

    try {
        const updateData = {
            isBanned: true,
            banType: type,
            banReason: reason,
            banAt: serverTimestamp(),
            status: 'Rejected' // Automatically reject from general list if needed
        };

        if (type === 'temporary') {
            updateData.banUntil = Date.now() + (days * 24 * 60 * 60 * 1000);
        }

        await updateDoc(doc(db, "applications", selectedMemberId), updateData);
        logTerminal(`User ${selectedMemberId} has been ${type} banned.`, 'red');
        actionModal.classList.add('hidden');
    } catch (e) {
        alert("Action failed.");
    }
}

window.pardonUser = async (memberId, appealDocId) => {
    const member = members.find(m => m.id === memberId);
    if (member) {
        await updateDoc(doc(db, "applications", member.firebaseId), {
            isBanned: false,
            isSuspended: false,
            status: 'Approved'
        });
        await deleteDoc(doc(db, "vortex_appeals", appealDocId));
    }
};

window.denyAppeal = async (appealId) => {
    await deleteDoc(doc(db, "vortex_appeals", appealId));
};

closeModal.onclick = () => actionModal.classList.add('hidden');

// --- TABS ---
document.querySelectorAll('.nav-tab').forEach(btn => {
    btn.onclick = () => {
        const tab = btn.dataset.tab;
        document.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        document.getElementById(tab).classList.add('active');
        document.getElementById('view-title').innerText = btn.querySelector('span').innerText;
    };
});

window.logout = () => {
    sessionStorage.removeItem('vortex_admin_auth');
    location.reload();
};
