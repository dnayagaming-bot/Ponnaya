const http = require('http');
const fs = require('fs');
const path = require('path');

// This is the "Receiver" bridge. 
// It doesn't scrape. It just holds data for the website.
// It can be hosted on Render, Railway, or any free server.

let cache = [];
let activeNumbers = [];
const DB = path.join(__dirname, 'data.json');
let seen = new Set();
if (fs.existsSync(DB)) {
    try { seen = new Set(JSON.parse(fs.readFileSync(DB))); } catch (e) { }
}

const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

    if (req.url === '/sms' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(cache));
    } else if (req.url === '/numbers' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(activeNumbers));
    } else if (req.url === '/sync' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                if (data.nums) activeNumbers = data.nums;
                if (data.msgs) {
                    const freshMsgs = data.msgs.filter(m => !seen.has(m.id));
                    freshMsgs.forEach(m => {
                        seen.add(m.id);
                        m.time = new Date().toISOString();
                    });
                    cache = [...freshMsgs, ...cache].slice(0, 50);
                    fs.writeFileSync(DB, JSON.stringify([...seen]));
                    console.log(`[${new Date().toLocaleTimeString()}] Cloud Update: ${freshMsgs.length} new messages.`);
                }
                res.writeHead(200); res.end('OK');
            } catch (e) { res.writeHead(400); res.end('Error'); }
        });
    } else {
        res.writeHead(404); res.end();
    }
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`SMS CLOUD BRIDGE ACTIVE ON PORT ${PORT}`);
});
