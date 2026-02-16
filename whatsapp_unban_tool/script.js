const appVersion = "4.5.0";

// --- STATE MANAGEMENT ---
let userProfile = {
    id: 'GUEST',
    theme: 'red',
    history: [],
    savedProfiles: []
};

let currentConfig = {
    isEscalated: 0,
    useHumanizer: false,
    useLegal: false,
    useVip: false
};

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    // 1. Theme Boot
    const savedTheme = localStorage.getItem('dl_theme') || 'red';
    setTheme(savedTheme);

    // 2. Auth Check
    checkSession();

    // 3. Populate Selects
    populateLanguages();

    // 4. Load Data
    loadUserHistory();
    loadProfiles();

    // 5. FX Init
    initMatrix();

    // 6. UI Bindings
    setupNavigation();
});

// --- NAVIGATION SYSTEM ---
function setupNavigation() {
    window.switchTab = function (tabId) {
        // Nav Active
        document.querySelectorAll('.nav-menu li').forEach(li => li.classList.remove('active'));
        const activeLi = document.querySelector(`.nav-menu li[onclick="switchTab('${tabId}')"]`);
        if (activeLi) activeLi.classList.add('active');

        // Panel Active
        document.querySelectorAll('.view-panel').forEach(p => p.classList.remove('active'));
        const target = document.getElementById(tabId);
        if (target) target.classList.add('active');
    };
}

// --- CORE GENERATOR ENGINE ---
window.generateAppeal = async function () {
    await showLoading("Drafting Email...", 800);

    const fullNumber = getFullNumber();
    if (!fullNumber) { alert("Please enter a valid number first."); return; }

    const region = document.getElementById('countryCode').value;
    const lang = document.getElementById('languageSelect').value;
    const reason = document.getElementById('banReason').value;

    // Read Advanced Toggles
    currentConfig.useHumanizer = document.getElementById('humanizerToggle')?.checked;
    currentConfig.useLegal = document.getElementById('legalToggle')?.checked;
    currentConfig.useVip = document.getElementById('vipToggle')?.checked;

    // 1. Select Base Template
    let subject = "", body = "";
    const reasonData = banReasons[reason] || banReasons['unknown'];

    // 2. Apply Language Pack
    const trans = translations[lang] || translations['default'];

    if (lang !== 'en' && translations[lang]) {
        // Native Lang Construction
        const g = trans.greetings[0];
        const r = trans.reasons[0];
        const c = trans.closings[0];
        body = `${g}\n\n${r}\n\n${c}`;
        subject = reasonData.subject[0];
    } else {
        // English Rich Construction
        subject = reasonData.subject[Math.floor(Math.random() * reasonData.subject.length)];
        body = reasonData.body[Math.floor(Math.random() * reasonData.body.length)];
    }

    // 3. Feature: Humanizer
    if (currentConfig.useHumanizer) {
        body = applyHumanizer(body);
        subject = subject.toLowerCase();
    }

    // 4. Feature: Legal Injection
    if (currentConfig.useLegal) {
        const legalTexts = [
            "\n\nRef: GDPR Art 22 / CCPA Consumer Rights.",
            "\n\nNote: This number is vital for my daily life and business.",
            "\n\nI request a manual review under the Terms of Service."
        ];
        body += legalTexts[Math.floor(Math.random() * legalTexts.length)];
    }

    // 5. Final Assembly
    const caseID = generateSupportID();
    subject += ` [Case ID: ${caseID}]`;
    body = body.replace(/{{number}}/g, fullNumber);
    body += `\n\nSent from: Samsung Galaxy S24 (Android 14)`;

    // 6. VIP Routing
    let toEmail = "support@whatsapp.com";
    if (currentConfig.useVip) {
        const vipMails = ["smb_web@support.whatsapp.com", "android_web@support.whatsapp.com", "priority_support@whatsapp.com"];
        toEmail = vipMails[Math.floor(Math.random() * vipMails.length)];
    }

    // 7. Update UI
    document.getElementById('previewTo').innerText = toEmail;
    document.getElementById('previewSubject').innerText = subject;
    document.getElementById('previewBody').value = body;
    document.getElementById('tag-lang').innerText = lang.toUpperCase();
    document.getElementById('tag-type').innerText = currentConfig.useLegal ? "LEGAL" : "STD";

    // Populate Web Form Helper
    const webMsgField = document.getElementById('webFormMessage');
    if (webMsgField) webMsgField.value = body;

    // 8. Log History
    addToHistory(fullNumber, reason);
};

// --- FEATURE: BUSINESS MODE (NEW) ---
window.generateBusinessAppeal = async function () {
    const bizName = document.getElementById('bizName').value || "[Company Name]";
    const bizReg = document.getElementById('bizReg').value || "[Tax ID]";
    const bizSite = document.getElementById('bizSite').value || "[Website]";
    const fullNumber = getFullNumber();

    if (!fullNumber) { alert("Enter Number on Dashboard First!"); return; }

    await showLoading("Generating Business Appeal...", 1000);

    const subject = `Urgent: Business API Account Suspension - ${bizName}`;
    const body = `To WhatsApp Business Support,

Our official business account (${fullNumber}) has been suspended. This is halting our operations and customer service.

Business Details:
- Name: ${bizName}
- Registration/Tax ID: ${bizReg}
- Website: ${bizSite}

We strictly follow the WhatsApp Business Policy and Commerce Policy. This number is used for legitimate customer support. We suspect this is a false flag due to high message volume.

Please review our account status and restore access immediately. We are ready to provide further documentation (Business License attached).

Sincerely,
${bizName} Admin Team`;

    // Switch to Dashboard to show result (re-use preview card)
    switchTab('dashboard');
    document.getElementById('previewTo').innerText = "smb_web@support.whatsapp.com"; // Direct to SMB support
    document.getElementById('previewSubject').innerText = subject;
    document.getElementById('previewBody').value = body;
    document.getElementById('tag-type').innerText = "BUSINESS";

    addToHistory(fullNumber, "Business Appeal");
};

// --- FEATURE: SOCIAL MEDIA (NEW) ---
window.generateTweet = function () {
    const num = getFullNumber() || "[NUMBER]";
    const caseID = generateSupportID();
    const templates = [
        `@WhatsApp @WhatsAppSupport My business number ${num} was banned by mistake! I have hundreds of clients waiting. Please help immediately! Case: ${caseID}`,
        `Urgent: @WhatsAppSupport please restore my account ${num}. I have provided all documents. This is a false positive ban! #WhatsAppBan #Help`,
        `@WayToBlue @WhatsApp My account ${num} is suspended without reason. I am a compliant user. Please review Case ${caseID}`,
        `Hey @WhatsAppSupport, why was my number ${num} banned? I only use it for family. Please fix this! #WhatsAppDown`
    ];
    document.getElementById('tweetBody').value = templates[Math.floor(Math.random() * templates.length)];
};

// --- FEATURE: AI PROMPTS (NEW) ---
window.copyAIPrompt = function () {
    const num = getFullNumber() || "[NUMBER]";
    const reason = document.getElementById('banReason').value;

    const prompt = `Act as a professional lawyer specializing in digital rights. Write a formal demand letter to WhatsApp LLC regarding the suspension of number ${num}. 
    Context: The user was banned for '${reason}' but believes it is a mistake. 
    Requirements:
    1. Cite lack of prior warning.
    2. Reference GDPR/CCPA data access rights.
    3. Tone: Professional, firm, and urgent.
    4. Request immediate restoration or specific evidence of violation.`;

    document.getElementById('aiPromptOutput').value = prompt;
    navigator.clipboard.writeText(prompt).then(() => alert("AI Prompt Copied! Paste into ChatGPT."));
};

// --- FEATURE: ESCALATION ENGINE ---
window.selectLevel = function (lvl) {
    document.querySelectorAll('.level-card').forEach(c => c.classList.remove('selected'));
    document.querySelector(`.level-card.level-${lvl}`).classList.add('selected');
    document.getElementById('escalation-preview').style.display = 'block';
    document.getElementById('selected-lvl-disp').innerText = lvl;
    currentConfig.isEscalated = lvl;
};

window.generateEscalatedAppeal = async function () {
    const lvl = currentConfig.isEscalated;
    await showLoading(`Engaging Level ${lvl} Protocol...`, 1000);

    switchTab('dashboard');

    const templates = {
        1: "I believe this ban is a mistake. Please review my activity log. I have not violated any terms.",
        2: "This is my second request. My business is suffering losses due to this unjustified ban. Restore access now or provide proof of violation.",
        3: "NOTICE OF DISPUTE: You have suspended my account without citing specific violations. Under consumer protection laws, I demand data logs and immediate reinstatement."
    };

    const body = templates[lvl] + `\n\nNumber: ${getFullNumber() || "[NUMBER]"}`;
    document.getElementById('previewBody').value = body;
    document.getElementById('previewSubject').innerText = `URGENT APPEAL - LEVEL ${lvl}`;
    document.getElementById('tag-type').innerText = `ESCALATION-L${lvl}`;

    addToHistory(getFullNumber(), `Escalation L${lvl}`);
};

// --- FEATURE: HUMANIZER LOGIC ---
function applyHumanizer(text) {
    // 1. Add Hesitations
    if (Math.random() > 0.5) text = "Um, " + text;

    // 2. Simple typo injection
    const typos = { 'please': 'plz', 'help': 'hlp', 'whatsapp': 'watsapp', 'banned': 'baned', 'account': 'acc' };
    Object.keys(typos).forEach(k => {
        if (Math.random() > 0.7) text = text.replace(new RegExp(k, 'yi'), typos[k]);
    });

    return text;
}

// --- FEATURE: HISTORY LOGS ---
function addToHistory(number, reason) {
    if (!number) return;
    const entry = {
        time: new Date().toLocaleTimeString(),
        date: new Date().toLocaleDateString(),
        number: number,
        reason: reason,
        status: 'Generated'
    };

    userProfile.history.unshift(entry);
    if (userProfile.history.length > 50) userProfile.history.pop();
    localStorage.setItem('dl_history', JSON.stringify(userProfile.history));

    renderHistory();
}

function renderHistory() {
    const tbody = document.getElementById('history-table-body');
    if (!tbody) return;
    tbody.innerHTML = userProfile.history.map(row => {
        const safeDate = window.LEGION_UTILS ? window.LEGION_UTILS.sanitize(row.date) : row.date;
        const safeTime = window.LEGION_UTILS ? window.LEGION_UTILS.sanitize(row.time) : row.time;
        const safeNumber = window.LEGION_UTILS ? window.LEGION_UTILS.sanitize(row.number) : row.number;
        const safeReason = window.LEGION_UTILS ? window.LEGION_UTILS.sanitize(row.reason) : row.reason;

        return `
            <tr>
                <td><span style="color:#666">${safeDate}</span> ${safeTime}</td>
                <td style="color:var(--primary)">${safeNumber}</td>
                <td>${safeReason}</td>
                <td><span class="status-online">${row.status}</span></td>
            </tr>
        `;
    }).join('');
}

function loadUserHistory() {
    const stored = localStorage.getItem('dl_history');
    if (stored) userProfile.history = JSON.parse(stored);
    renderHistory();
}

// --- FEATURE: PROFILES ---
window.addProfile = function () {
    const name = document.getElementById('prof-name').value;
    const num = document.getElementById('prof-num').value;
    if (!name || !num) return alert("Enter Name and Number");

    userProfile.savedProfiles.push({ name, num });
    localStorage.setItem('dl_profiles', JSON.stringify(userProfile.savedProfiles));
    renderProfiles();
};

function renderProfiles() {
    const list = document.getElementById('profile-list');
    if (!list) return;
    list.innerHTML = userProfile.savedProfiles.map((p, i) => {
        const safeName = window.LEGION_UTILS ? window.LEGION_UTILS.sanitize(p.name) : p.name;
        const safeNum = window.LEGION_UTILS ? window.LEGION_UTILS.sanitize(p.num) : p.num;
        return `
            <div class="user-chip" style="margin-bottom:10px; cursor:pointer;" onclick="loadProfile(${i})">
                <div class="user-info">
                    <span>${safeName}</span>
                    <span style="font-size:0.8rem; color:#888;">${safeNum}</span>
                </div>
                <i class="fas fa-chevron-right" style="margin-left:auto; color:#444;"></i>
            </div>
        `;
    }).join('');
}

window.loadProfile = function (index) {
    const p = userProfile.savedProfiles[index];
    document.getElementById('phoneNumber').value = p.num;
    alert(`Profile '${p.name}' Loaded`);
};

function loadProfiles() {
    const stored = localStorage.getItem('dl_profiles');
    if (stored) userProfile.savedProfiles = JSON.parse(stored);
    renderProfiles();
}

// --- FEATURE: THEME SWITCHER ---
window.setTheme = function (colorName) {
    document.documentElement.setAttribute('data-theme', colorName);
    localStorage.setItem('dl_theme', colorName);
    document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`.theme-btn.${colorName}`)?.classList.add('active');
};

// --- AUTH & SESSION ---
window.attemptLogin = async function () {
    const input = document.getElementById('dl-id-input');
    const log = document.getElementById('login-log');
    const id = input.value.trim().toUpperCase();

    if (!id) { log.innerHTML += `<div class="term-line term-error">> ERROR: ID REQUIRED</div>`; return; }

    log.innerHTML = `<div class="term-line">> CONNECTING...</div>`;
    await new Promise(r => setTimeout(r, 600));

    if (id.startsWith('DL-') || id.length > 3) {
        log.innerHTML += `<div class="term-line term-success">> SUCCESS: ${id}</div>`;
        await new Promise(r => setTimeout(r, 800));

        sessionStorage.setItem('dl_auth_id', id);

        document.getElementById('login-screen').classList.add('hidden');
        document.querySelector('.app-container').classList.add('logged-in');
        document.getElementById('sidebar-display-id').innerText = id;
        document.getElementById('settings-dl-id').value = id;
    }
};

function checkSession() {
    const id = sessionStorage.getItem('dl_auth_id');
    if (id) {
        document.getElementById('login-screen').style.display = 'none';
        document.querySelector('.app-container').classList.add('logged-in');
        document.getElementById('sidebar-display-id').innerText = id;
    }
}

window.generateNewID = function () {
    const id = "DL-" + Math.floor(1000 + Math.random() * 9000);
    document.getElementById('dl-id-input').value = id;
};

// --- UTILITIES ---
window.getFullNumber = function () {
    const region = document.getElementById('countryCode').value;
    const num = document.getElementById('phoneNumber').value;
    return num ? region + num : "";
};

function showLoading(text, duration = 1000) {
    const overlay = document.getElementById('loadingOverlay');
    document.getElementById('loadingText').innerText = text;
    overlay.classList.add('active');
    return new Promise(r => setTimeout(() => {
        overlay.classList.remove('active');
        r();
    }, duration));
}

function generateSupportID() {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    return `ID-${date}-${Math.floor(1000 + Math.random() * 9000)}`;
}

function populateLanguages() {
    const sel = document.getElementById('languageSelect');
    languages.forEach(l => {
        const o = document.createElement('option');
        o.value = l.code;
        o.innerText = l.name;
        if (l.code === 'en') o.selected = true;
        sel.appendChild(o);
    });
}

function initMatrix() {
    const canvas = document.getElementById('matrix-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const letters = "01DL";
    const fontSize = 14;
    const columns = canvas.width / fontSize;
    const drops = [];
    for (let x = 0; x < columns; x++) drops[x] = 1;

    function draw() {
        ctx.fillStyle = "rgba(0, 0, 0, 0.05)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#ff002b";
        ctx.font = fontSize + "px monospace";
        for (let i = 0; i < drops.length; i++) {
            const text = letters.charAt(Math.floor(Math.random() * letters.length));
            ctx.fillText(text, i * fontSize, drops[i] * fontSize);
            if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) drops[i] = 0;
            drops[i]++;
        }
    }
    setInterval(draw, 33);
}

window.copyToClipboard = function () {
    const text = document.getElementById('previewBody').value;
    navigator.clipboard.writeText(text).then(() => alert("Copied to Clipboard"));
};

window.openMailClient = function () {
    const to = document.getElementById('previewTo').innerText;
    const sub = document.getElementById('previewSubject').innerText;
    const body = document.getElementById('previewBody').value;
    location.href = `mailto:${to}?subject=${encodeURIComponent(sub)}&body=${encodeURIComponent(body)}`;
};

window.rotateEmail = function () {
    const mails = ["support@whatsapp.com", "android_web@support.whatsapp.com", "press@whatsapp.com", "grievance_officer_wa@support.whatsapp.com"];
    const current = document.getElementById('previewTo').innerText;
    let next = mails[(mails.indexOf(current) + 1) % mails.length];
    document.getElementById('previewTo').innerText = next;
};

// Reset Form
window.resetForm = function () {
    document.getElementById('phoneNumber').value = '';
    document.getElementById('previewBody').value = '';
    document.getElementById('previewSubject').innerText = '...';
};

// Bulk Generation
window.generateBulkAppeals = function () {
    const list = document.getElementById('bulkList');
    list.innerHTML = '';

    // Check if number exists
    const fullNumber = getFullNumber();
    if (!fullNumber) { alert("Enter Number on Dashboard First!"); return; }

    for (let i = 1; i <= 50; i++) {
        const div = document.createElement('div');
        div.className = 'bulk-item';
        div.innerHTML = `
            <strong>Variation #${i}</strong>
            <p>Subject: Ban Appeal Ref: ${Math.random().toString(36).substr(2, 9).toUpperCase()}</p>
            <div class="button-grid" style="margin-top:10px;">
                 <button class="btn-glass" onclick="alert('Sent var ${i}')">Copy</button>
            </div>
        `;
        list.appendChild(div);
    }
};

window.generateFeedback = function () {
    const feedList = document.getElementById('feedbackList');
    feedList.innerHTML = '';
    for (let i = 1; i <= 10; i++) {
        const div = document.createElement('div');
        div.className = 'bulk-item';
        div.innerText = `Feedback Email #${i} Generated`;
        feedList.appendChild(div);
    }
};

window.copyWebFormMsg = function () {
    const txt = document.getElementById('webFormMessage').value;
    navigator.clipboard.writeText(txt).then(() => alert("Msg Copied"));
};

window.saveSettings = async function () {
    const sbUrl = document.getElementById('supabaseUrl').value;
    const sbKey = document.getElementById('supabaseKey').value;
    // (Firebase not critically needed for V4 core but can be added if requested)

    await showLoading("Connecting...", 1500);

    // Supabase Init
    if (sbUrl && sbKey && window.supabase) {
        try {
            window.supabaseClient = window.supabase.createClient(sbUrl, sbKey);
            localStorage.setItem('sb_url', sbUrl);
            localStorage.setItem('sb_key', sbKey);
        } catch (e) {
            console.error(e);
        }
    }

    document.getElementById('connectionStatus').innerText = "• CREDENTIALS SAVED. CLOUD SYNC ACTIVE.";
    document.getElementById('connectionStatus').style.color = "#ff002b";
};

window.autofillDLKeys = function () {
    document.getElementById('supabaseUrl').value = 'https://kmodgzklfxpfavexhdiv.supabase.co';
    document.getElementById('supabaseKey').value = 'sb_publishable_rIlpr9-2k_QipshWx0wchw_0uQHsWcy';
    alert("DL KEYS LOADED");
};
