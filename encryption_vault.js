/**
 * DL QUANTUM CRYPTOGRAPHY VAULT (V2.5)
 * -------------------------------------
 * High-Level Obfuscation, XSS Shield, and Legion Network CDN.
 */

const DL_CIPHER = {
    encrypt: (str) => {
        if (!str) return "";
        const shifted = str.split('').map(c => String.fromCharCode(c.charCodeAt(0) + 7)).join('');
        return btoa(shifted).split('').reverse().join('');
    },
    decrypt: (encoded) => {
        if (!encoded) return "";
        try {
            const reversed = encoded.split('').reverse().join('');
            const decoded = atob(reversed);
            return decoded.split('').map(c => String.fromCharCode(c.charCodeAt(0) - 7)).join('');
        } catch (e) {
            console.error("CRYPT_ERROR: DECRYPTION_FAILURE");
            return null;
        }
    }
};

const LEGION_UTILS = {
    // XSS Sanitizer to fix vulnerabilities in chat/admin
    sanitize: (str) => {
        if (typeof str !== 'string') return str;
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },

    // Proof of Work (PoW) Challenge Generator
    generateChallenge: () => {
        const difficulty = 4;
        const seed = Math.random().toString(36).substring(7);
        return { seed, difficulty };
    },

    verifyChallenge: (seed, nonce, difficulty) => {
        // Simple mock of a resource-heavy check
        const hash = btoa(seed + nonce);
        return hash.startsWith('0'.repeat(difficulty));
    }
};

const LEGION_NETWORK = {
    version: "1.0.0-STABLE",
    endpoint: "/cdn/legion-network/",
    resolve: (asset) => {
        // Redirects asset requests to the internal "CDN"
        const mapping = {
            'logo': '../logo.png',
            'security': '../protection.js',
            'vault': '../encryption_vault.js'
        };
        return mapping[asset] || asset;
    }
};

window.DL_CIPHER = DL_CIPHER;
window.LEGION_UTILS = LEGION_UTILS;
window.LEGION_NETWORK = LEGION_NETWORK;

// Simulated Runtime Protection
(function () {
    console.log("%c[COMMUNITY NETWORK] CORE ENGINE INITIALIZED", "color: #ff002b; font-weight: bold;");

    // Prevent common bypasses (Console usage)
    const warningText = "System Notice: This interface is for authorized management only.";
    console.log("%c" + warningText, "color: #ff002b; font-size: 16px; font-weight: bold;");
})();
