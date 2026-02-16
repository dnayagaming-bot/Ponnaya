const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const querystring = require('querystring');

/**
 * DEATH LEGION SMS SYNC BRIDGE (ULTIMATE)
 * Features:
 * - Multi-Cloud Sync (Firebase + Supabase)
 * - Automatic Session Recovery
 * - Permanent Archiving
 * - Node Presence Tracking
 * - Error Logging to Cloud
 */

const LOGIN_CREDS = { email: "ohlivvy53@gmail.com", pass: "AAQidas123@" };
const HOST = "www.ivasms.com";

const FIREBASE_CONFIG = {
    projectId: "demoxhexa",
    apiKey: "AIzaSyDAfgn6EhQjlrM4KrxMsLt8JFZLN1xQ2qQ"
};

const SUPABASE_CONFIG = {
    url: "https://kmodgzklfxpfavexhdiv.supabase.co",
    key: "sb_publishable_rIlpr9-2k_QipshWx0wchw_0uQHsWcy"
};

const DB_FILE = path.join(__dirname, 'messages.db');
let seen = new Set();
if (fs.existsSync(DB_FILE)) {
    try { seen = new Set(JSON.parse(fs.readFileSync(DB_FILE))); } catch (e) { }
}

let cache = [];
let activeNumbers = [];
let cookies = [];

// --- NETWORK UTILITY ---
function request(opt, data = null) {
    return new Promise((resolve, reject) => {
        const req = https.request(opt, (res) => {
            let body = '';
            res.on('data', d => body += d);
            res.on('end', () => resolve({ body, res }));
            const sc = res.headers['set-cookie'];
            if (sc) sc.forEach(c => {
                const ck = c.split(';')[0];
                if (!cookies.includes(ck)) cookies.push(ck);
            });
        });
        req.on('error', reject);
        if (data) req.write(data);
        req.end();
    });
}

// --- LOGGING ENGINE ---
async function logToCloud(level, message) {
    console.log(`[${level}] ${message}`);
    const body = JSON.stringify({ level, message });
    try {
        const urlObj = new URL(SUPABASE_CONFIG.url);
        await request({
            hostname: urlObj.hostname,
            path: '/rest/v1/dl_sync_logs',
            method: 'POST',
            headers: {
                'apikey': SUPABASE_CONFIG.key,
                'Authorization': `Bearer ${SUPABASE_CONFIG.key}`,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body)
            }
        }, body);
    } catch (e) { }
}

// --- FIREBASE SYNC (Live Dashboard) ---
async function syncFirebase() {
    const body = JSON.stringify({
        fields: {
            msgs: {
                arrayValue: {
                    values: cache.map(m => ({
                        mapValue: {
                            fields: {
                                id: { stringValue: m.id },
                                num: { stringValue: m.num },
                                msg: { stringValue: m.msg },
                                code: { stringValue: m.code },
                                srv: { stringValue: m.srv },
                                time: { stringValue: m.time }
                            }
                        }
                    }))
                }
            },
            nums: {
                arrayValue: {
                    values: activeNumbers.map(n => ({
                        mapValue: {
                            fields: {
                                number: { stringValue: n.number },
                                type: { stringValue: n.type }
                            }
                        }
                    }))
                }
            }
        }
    });

    try {
        await request({
            hostname: 'firestore.googleapis.com',
            path: `/v1/projects/${FIREBASE_CONFIG.projectId}/databases/(default)/documents/sms_sync/latest?key=${FIREBASE_CONFIG.apiKey}&updateMask.fieldPaths=msgs&updateMask.fieldPaths=nums`,
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
        }, body);
    } catch (e) {
        logToCloud('ERROR', `Firebase Sync Failed: ${e.message}`);
    }
}

// --- SUPABASE SYNC (Permanent Vault) ---
async function syncSupabase(incoming) {
    const urlObj = new URL(SUPABASE_CONFIG.url);
    const headers = {
        'apikey': SUPABASE_CONFIG.key,
        'Authorization': `Bearer ${SUPABASE_CONFIG.key}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
    };

    // 1. Save New Signals
    if (incoming && incoming.length > 0) {
        const msgsBody = JSON.stringify(incoming.map(m => ({
            msg_id: m.id,
            phone_number: m.num,
            content: m.msg,
            otp_code: m.code,
            service: m.srv,
            received_at: m.time
        })));
        try {
            await request({
                hostname: urlObj.hostname, path: '/rest/v1/dl_sms_history', method: 'POST',
                headers: { ...headers, 'Content-Length': Buffer.byteLength(msgsBody) }
            }, msgsBody);
        } catch (e) { logToCloud('ERROR', `Supabase Msgs Fail: ${e.message}`); }
    }

    // 2. Automated OTP Fulfillment
    if (incoming && incoming.length > 0) {
        for (const msg of incoming) {
            try {
                // Check if there is a pending request for this number
                const checkPath = `/rest/v1/dl_otp_requests?phone_number=eq.${msg.num}&status=eq.pending&select=*`;
                const { body } = await request({
                    hostname: urlObj.hostname, path: checkPath, method: 'GET',
                    headers: { 'apikey': SUPABASE_CONFIG.key, 'Authorization': `Bearer ${SUPABASE_CONFIG.key}` }
                });
                const requests = JSON.parse(body);

                if (requests && requests.length > 0) {
                    for (const req of requests) {
                        // Update the request with the code and change status to received
                        const updateBody = JSON.stringify({ status: 'received', otp_code: msg.code, updated_at: new Date().toISOString() });
                        await request({
                            hostname: urlObj.hostname, path: `/rest/v1/dl_otp_requests?id=eq.${req.id}`, method: 'PATCH',
                            headers: { ...headers, 'Content-Length': Buffer.byteLength(updateBody) }
                        }, updateBody);
                        logToCloud('INFO', `OTP Request Fulfilled for Node: ${msg.num}`);
                    }
                }
            } catch (e) { logToCloud('ERROR', `OTP Check Fail: ${e.message}`); }
        }
    }

    // 3. Update Node Catalog
    if (activeNumbers.length > 0) {
        const numsBody = JSON.stringify(activeNumbers.map(n => ({
            phone_number: n.number,
            provider_type: n.type,
            last_active: new Date().toISOString()
        })));
        try {
            await request({
                hostname: urlObj.hostname, path: '/rest/v1/dl_phone_nodes', method: 'POST',
                headers: { ...headers, 'Content-Length': Buffer.byteLength(numsBody) }
            }, numsBody);
        } catch (e) { logToCloud('ERROR', `Supabase Nodes Fail: ${e.message}`); }
    }
}

// --- SCRAPER LOGIC ---
async function run() {
    try {
        const head = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Cookie': cookies.join('; ')
        };

        // Step 1: Login Token Injection
        const loginPage = await request({ hostname: HOST, path: '/login', method: 'GET', headers: head });
        const token = (loginPage.body.match(/name="_token" value="(.+?)"/) || [])[1];
        if (!token) return logToCloud('WARN', 'Auth Token Denied. Check credentials or connection.');

        // Step 2: Establish Secure Session
        const postData = querystring.stringify({ email: LOGIN_CREDS.email, password: LOGIN_CREDS.pass, _token: token });
        await request({
            hostname: HOST, path: '/login', method: 'POST',
            headers: { ...head, 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': postData.length, 'Cookie': cookies.join('; ') }
        }, postData);

        // Step 3: Extract CSRF & Session state
        const dashboard = await request({ hostname: HOST, path: '/portal/dashboard', method: 'GET', headers: { ...head, 'Cookie': cookies.join('; ') } });
        const csrf = (dashboard.body.match(/name="csrf-token" content="(.+?)"/) || [])[1];
        if (!csrf) return logToCloud('WARN', 'Session Establishment Failed.');

        // Step 4: Batch Intercept Signal Groups
        const day = new Date().toLocaleDateString('en-US');
        const fetchPayload = querystring.stringify({ from: day, to: day, _token: csrf });
        const smsRes = await request({
            hostname: HOST, path: '/portal/sms/received/getsms', method: 'POST',
            headers: { ...head, 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': fetchPayload.length, 'Cookie': cookies.join('; ') }
        }, fetchPayload);

        const groupRegex = /getDetials\('(.+?)'\)/g;
        let m;
        const incoming = [];
        const discoveredNodes = [];

        while ((m = groupRegex.exec(smsRes.body)) !== null) {
            const gid = m[1];
            const numPayload = querystring.stringify({ start: day, end: day, range: gid, _token: csrf });
            const numRes = await request({
                hostname: HOST, path: '/portal/sms/received/getsms/number', method: 'POST',
                headers: { ...head, 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': numPayload.length, 'Cookie': cookies.join('; ') }
            }, numPayload);

            const numRegex = /getDetialsNumber\('(.+?)'/g;
            let nm;
            while ((nm = numRegex.exec(numRes.body)) !== null) {
                const phone = nm[1];
                if (!discoveredNodes.find(n => n.number === phone)) discoveredNodes.push({ number: phone, type: gid });

                // Fetch final messages for this node
                const smsPayload = querystring.stringify({ start: day, end: day, Number: phone, Range: gid, _token: csrf });
                const final = await request({
                    hostname: HOST, path: '/portal/sms/received/getsms/number/sms', method: 'POST',
                    headers: { ...head, 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': smsPayload.length, 'Cookie': cookies.join('; ') }
                }, smsPayload);

                const msgRegex = /<p class="mb-0">([\s\S]+?)<\/p>/g;
                let mm;
                while ((mm = msgRegex.exec(final.body)) !== null) {
                    const txt = mm[1].replace(/<[^>]+>/g, '').trim();
                    const hash = crypto.createHash('md5').update(phone + txt).digest('hex');

                    if (!seen.has(hash)) {
                        const code = (txt.match(/\d{3}-?\d{3}/) || txt.match(/\d{4,8}/) || ["N/A"])[0];
                        const signal = { id: hash, num: phone, msg: txt, code, srv: txt.toLowerCase().includes('whatsapp') ? 'WhatsApp' : 'SMS', time: new Date().toISOString() };
                        incoming.push(signal);
                        seen.add(hash);
                    }
                }
            }
        }

        activeNumbers = discoveredNodes;
        if (incoming.length > 0) {
            cache = [...incoming, ...cache].slice(0, 50);
            fs.writeFileSync(DB_FILE, JSON.stringify([...seen]));
            logToCloud('INFO', `Intercepted ${incoming.length} new signals.`);
        }

        // --- MULTI-VORTEX SYNC ---
        await syncFirebase();
        await syncSupabase(incoming);

    } catch (e) {
        logToCloud('ERROR', `Scraper Loop Failed: ${e.message}`);
    }
}

// --- LOCAL LIGHTSPEED API ---
http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (req.url === '/sms') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(cache));
    } else {
        res.writeHead(404); res.end();
    }
}).listen(5000, '0.0.0.0', () => {
    console.log("-----------------------------------------");
    console.log(" DEATH LEGION SYNC BRIDGE : ONLINE      ");
    console.log(" MONITORING: IVASMS -> CLOUD VORTEX     ");
    console.log("-----------------------------------------");
});

setInterval(run, 15000);
run();
