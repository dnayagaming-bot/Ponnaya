/**
 * SECURITY MODULE - BROWSER VERIFICATION (v9.5 UNIVERSAL)
 * ---------------------------------------------
 * Professional Access Control & Monitoring
 * Optimized for local and production environments.
 */

(function () {
    // 1. Safety Check: Avoid debugging in production
    const detectDebugger = () => {
        const start = Date.now();
        debugger;
        if (Date.now() - start > 100) {
            window.location.href = "about:blank";
        }
    };
    setInterval(detectDebugger, 5000);

    // 2. Configuration
    const SECURITY_CONFIG = {
        rateLimitWindow: 30000,
        maxRequests: 500,
        verificationTimeout: 2000,
        bypassToken: 'SYSTEM_UNLOCK_2026',
        allowedOrigins: ['localhost', '127.0.0.1', 'netlify.app', 'github.io', 'vercel.app', 'github.dev', '192.168.']
    };

    // 3. Environment Detection
    const isLocal = ['localhost', '127.0.0.1', '', '::1'].includes(window.location.hostname) || window.location.hostname.includes('192.168.');
    const isDevHost = window.location.hostname.includes('netlify') || window.location.hostname.includes('github') || window.location.hostname.includes('vercel');
    const hasBypass = window.location.search.includes('dev_unlock=true') || sessionStorage.getItem('sys_shield_verified') === 'true';

    if (window.location.search.includes('dev_unlock=true')) {
        sessionStorage.setItem('sys_shield_verified', 'true');
    }

    const isDeveloper = isLocal || isDevHost || hasBypass;
    let visitorTracked = false;

    // 4. Firebase Bridge (Non-Module)
    const getFirebase = () => {
        const admin = window.firebaseAdmin;
        const system = window.firebaseSystem;
        if (admin && admin.db) return admin;
        if (system && system.db) return system;
        return null;
    };

    // 5. Security Logic
    async function logVisitor() {
        if (visitorTracked || isDeveloper) return;
        const fb = getFirebase();
        if (!fb) return;

        try {
            const ipInfo = await fetch('https://ipapi.co/json/').then(res => res.json()).catch(() => ({}));
            await fb.addDoc(fb.collection(fb.db, "visitor_traffic"), {
                ip: ipInfo.ip || 'Unknown',
                location: `${ipInfo.city || 'Unknown'}, ${ipInfo.country_name || 'Unknown'}`,
                deviceType: /Mobile|Android|iPhone/i.test(navigator.userAgent) ? 'Mobile' : 'Desktop',
                timestamp: fb.serverTimestamp(),
                url: window.location.href,
                host: window.location.hostname
            });
            visitorTracked = true;
        } catch (e) {
            console.warn("Traffic log suppressed.");
        }
    }

    async function checkBan() {
        if (isDeveloper) return false;
        const fb = getFirebase();
        if (!fb) return false;

        try {
            const res = await fetch('https://ipapi.co/json/');
            const data = await res.json();
            if (data.ip) {
                const banSnap = await fb.getDoc(fb.doc(fb.db, "blocked_ips", data.ip));
                if (banSnap.exists()) {
                    restrictAccess("Access restricted by administrator.");
                    return true;
                }
            }
        } catch (e) { }
        return false;
    }

    function detectAutomation() {
        if (isDeveloper) return null;
        const n = navigator;
        if (window.self !== window.top) return "Embedded Content Restriction";
        if (n.webdriver || /HeadlessChrome/.test(n.userAgent)) return "Automation Detected";
        return null;
    }

    function restrictAccess(reason) {
        if (isDeveloper) {
            console.warn("Security Triggered (Bypassed for Dev):", reason);
            return;
        }

        document.body.innerHTML = `
            <div style="background: #f8f9fa; color: #333; height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; text-align: center; padding: 20px;">
                <div style="background: #fff; padding: 40px; border-radius: 24px; box-shadow: 0 10px 40px rgba(0,0,0,0.05); max-width: 450px;">
                    <h1 style="font-size: 24px; font-weight: 800; color: #dc3545; margin-bottom: 16px;">Access Restricted</h1>
                    <p style="font-size: 14px; color: #6c757d; line-height: 1.6; margin-bottom: 24px;">${reason}</p>
                    <div style="background: #f1f3f5; padding: 16px; border-radius: 12px; font-size: 12px; color: #495057; text-align: left;">
                        <strong>Security Event ID:</strong> ${Math.random().toString(36).substr(2, 8).toUpperCase()}<br>
                        <strong>IP Status:</strong> Monitored
                    </div>
                    <button onclick="location.reload()" style="margin-top: 24px; background: #212529; color: #fff; border: none; padding: 12px 32px; border-radius: 12px; cursor: pointer; font-weight: 600;">Reload Page</button>
                </div>
            </div>
        `;

        const fb = getFirebase();
        if (fb) {
            fb.addDoc(fb.collection(fb.db, "security_alerts"), {
                type: "ACCESS_RESTRICTED",
                reason: reason,
                ua: navigator.userAgent,
                timestamp: fb.serverTimestamp()
            });
        }
    }

    function showVerification() {
        if (document.getElementById('sys-shield-verification')) return;

        const overlay = document.createElement('div');
        overlay.id = 'sys-shield-verification';
        overlay.style.cssText = `
            position: fixed; inset: 0; background: #fff; z-index: 1000000;
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            color: #333; font-family: -apple-system, sans-serif;
        `;

        overlay.innerHTML = `
            <div style="text-align: center; max-width: 400px; padding: 40px;">
                <div style="width: 60px; height: 60px; border: 3px solid #f1f3f5; border-top-color: #007bff; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 32px;"></div>
                <h2 style="font-size: 20px; font-weight: 700; color: #212529;">Verifying your browser</h2>
                <p style="color: #6c757d; font-size: 14px; margin-top: 12px;">This process is automatic. Your browser will redirect to your requested content shortly.</p>
                <div id="shield-log" style="margin-top: 32px; font-size: 12px; color: #adb5bd;">Connecting to server...</div>
            </div>
            <style> @keyframes spin { to { transform: rotate(360deg); } } </style>
        `;

        document.body.appendChild(overlay);

        let interacted = false;
        const confirmHuman = () => {
            interacted = true;
            const log = document.getElementById('shield-log');
            if (log) log.innerText = "Verification successful. Redirecting...";
            window.removeEventListener('mousemove', confirmHuman);
            window.removeEventListener('touchstart', confirmHuman);
            window.removeEventListener('keydown', confirmHuman);
        };
        window.addEventListener('mousemove', confirmHuman);
        window.addEventListener('touchstart', confirmHuman);
        window.addEventListener('keydown', confirmHuman);

        setTimeout(() => {
            if (!interacted) {
                const log = document.getElementById('shield-log');
                if (log) log.innerHTML = `<span style="color: #dc3545;">Please move your mouse or touch the screen to verify.</span>`;
                return;
            }
            sessionStorage.setItem('sys_shield_verified', 'true');
            overlay.style.opacity = '0';
            overlay.style.transition = 'opacity 0.4s';
            setTimeout(() => overlay.remove(), 400);
        }, SECURITY_CONFIG.verificationTimeout);
    }

    // 6. Initialization
    const initializeSecurity = async () => {
        logVisitor();

        if (isDeveloper || sessionStorage.getItem('sys_shield_verified') === 'true') return;

        if (await checkBan()) return;

        const autoReason = detectAutomation();
        if (autoReason) {
            restrictAccess(autoReason);
            return;
        }

        showVerification();
    };

    function createHoneypot() {
        if (document.querySelector('[name="sys_security_token"]')) return;
        const pot = document.createElement('div');
        pot.style.cssText = "position:absolute;left:-9999px;top:-9999px;opacity:0;visibility:hidden;pointer-events:none;";
        pot.innerHTML = `
            <a href="/admin/config/leaks" rel="nofollow">Security Credentials</a>
            <input type="text" name="sys_security_token" value="" tabindex="-1" autocomplete="off">
        `;

        pot.querySelector('a').onclick = (e) => {
            e.preventDefault();
            restrictAccess("Honeypot Trap Triggered (Link)");
        };

        const input = pot.querySelector('input');
        input.onchange = () => restrictAccess("AI Bot Auto-fill Detected");

        document.body.appendChild(pot);
    }

    function initializeAll() {
        try {
            createHoneypot();
            initializeSecurity();
        } catch (e) {
            console.warn("Security Init partial failure:", e);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeAll);
    } else {
        // Delay slightly for Firebase to initialize if possible
        setTimeout(initializeAll, 500);
    }

    // Global APIs
    window.SYS_SECURITY = {
        isDeveloper,
        restrictAccess,
        showVerification
    };

})();
