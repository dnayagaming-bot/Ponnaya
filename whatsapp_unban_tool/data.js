/* Data Definitions */

const supportEmails = [
    "support@whatsapp.com",
    "android_web@support.whatsapp.com",
    "iphone_web@support.whatsapp.com",
    "smb_web@support.whatsapp.com",
    "jan_koum@whatsapp.com",
    "press@whatsapp.com",
    "accessibility@support.whatsapp.com",
    "enterprise@support.whatsapp.com",
    "bd@whatsapp.com",
    "partners@whatsapp.com"
];

const banReasons = {
    "mistake": {
        subject: ["Urgent: Account Banned by Mistake", "Review Request: Banned Number", "My Number is Banned - Error?", "Wrongfully Banned Account"],
        body: ["Hello WhatsApp Team,\n\nMy number {{number}} has been banned. I believe this is an error as I strictly follow all guidelines. Please review and restore access.\n\nThank you.", "Dear Support,\n\nI am writing to appeal the ban on my phone number {{number}}. I use this account for personal communication and have not violated any terms. Please help.\n\nRegards."]
    },
    "spam": {
        subject: ["Please Unban My WhatsApp Account", "Flagged by mistake?", "System Error - Spam Flag", "Not a Spammer - Unban Request"],
        body: ["Hi,\n\nMy WhatsApp account associated with {{number}} is currently inactive. I was added to random groups without consent which might have triggered spam filters. Please reinstate my account.\n\nThanks.", "Dear WhatsApp,\n\nI think my number {{number}} was flagged by mistake by your automated systems. I am a real person, not a bot. Please unban me."]
    },
    "otp": {
        subject: ["Too Many Attempts - Login Issue", "OTP Verification Failed - Restore Access", "Login Blocked - OTP Error", "Help - Cannot Verify Number"],
        body: ["Dear Support,\n\nI am unable to login to my account {{number}} due to 'Too many attempts' error. I might have requested OTPs too quickly due to network lag. Please reset my attempts.\n\nThank you.", "Hello,\n\nI am facing login issues with {{number}}. It says I guessed too many times. This was unintentional. Please help me recover my account."]
    },
    "guest": {
        subject: ["Suspicious Registration Flag", "New Account Immediately Banned", "Fresh SIM - Banned?", "Registration Error"],
        body: ["Hello,\n\nI just registered my new number {{number}} and it was immediately banned. I have not even used it yet. Please review this error.\n\nRegards.", "Hi,\n\nMy new SIM number {{number}} is blocked from WhatsApp. This is a fresh registration. Please fix this."]
    },
    "business": {
        subject: ["Business Account Access Lost", "Commerce Policy Appeal", "SMB Account Ban Review", "Business API Issue"],
        body: ["To whom it may concern,\n\nMy business depends on WhatsApp. My number {{number}} was banned unexpectedly. I ensure full compliance with WhatsApp Commerce Policy. Kindly unban me immediately.\n\nBest,", "Hello,\n\nWe use {{number}} for legitimate business communication. The ban is causing financial loss. Please review manually."]
    },
    "scam": {
        subject: ["Reported by Mistake", "I am not a Scammer", "False Report Appeal", "Account Flagged Incorrectly"],
        body: ["Dear Team,\n\nSomeone likely reported my number {{number}} maliciously. I do not engage in scams or fraud. Please check your logs.\n\nThanks.", "Hello,\n\nMy account {{number}} was banned for 'scamming' but this is false. I only talk to family and friends. Please re-verify."]
    },
    "feedback": {
        subject: ["Feedback on Support", "App Appreciation", "Bug Report & Feedback", "User Experience Feedback"],
        body: ["Hello,\n\nI wanted to share positive feedback. Despite the ban issues, I love using WhatsApp on {{number}}. Please restore it so I can continue using it.", "Dear Team,\n\nGreat app, but the automated ban system is too aggressive. My number {{number}} was hit. Please improve this."]
    },
    "unknown": {
        subject: ["Question about account status", "Requesting immediate review", "Account Disabled", "Why am I banned?"],
        body: ["Hi Support,\n\nWhy is my number {{number}} banned? I need this for my daily work. Please reactivate it as soon as possible.", "Hello,\n\nPlease review the ban on {{number}}. It is very important for me. I apologize if I unintentionally violated any rule, but I promise to be careful."]
    }
};

const languages = [
    { code: "en", name: "English" },
    { code: "lk", name: "Sinhala (Sri Lanka)" },
    { code: "ar", name: "Arabic (Saudi/UAE)" },
    { code: "ta", name: "Tamil (Sri Lanka/India)" },
    { code: "hi", name: "Hindi (India)" },
    { code: "es", name: "Spanish" },
    { code: "pt", name: "Portuguese" },
    { code: "id", name: "Indonesian" },
    { code: "ru", name: "Russian" },
    { code: "fr", name: "French" },
    { code: "de", name: "German" },
    { code: "tr", name: "Turkish" },
    { code: "it", name: "Italian" },
    { code: "vi", name: "Vietnamese" },
    { code: "ms", name: "Malay" },
    { code: "th", name: "Thai" },
    { code: "zh", name: "Chinese" },
    { code: "ja", name: "Japanese" }
];

// Translation logic
// Expanded for Arabic
const translations = {
    "lk": {
        greetings: ["Ayubowan WhatsApp Team,", "Suba dawasak,"],
        reasons: ["Mage {{number}} ankaya thahanam kara atha.", "Mema ankaya waradeemakin thahanam kara atha.", "Mama kisidu neethiyak kada kara natha."],
        closings: ["Karunakara mage ginuma nawatha laba denna.", "Obage Sahayata sthuthiyi."]
    },
    "ar": {
        greetings: ["مرحباً فريق واتساب،", "السادة في الدعم الفني،", "السلام عليكم،"],
        reasons: ["تم حظر رقمي {{number}} عن طريق الخطأ.", "أرجو إعادة تفعيل حسابي، لم أقم بانتهاك أي شروط.", "هذا الرقم يستخدم للعمل فقط."],
        closings: ["شكراً لكم.", "بانتظار ردكم الكريم.", "مع التحية."]
    },
    "hi": {
        greetings: ["Namaste WhatsApp Team,", "Adarniya Support,"],
        reasons: ["Mera number {{number}} ban ho gaya hai.", "Maine galti se koi group join kiya tha.", "Kripya meri madat karein."],
        closings: ["Dhanyavad.", "Kripya jaldi action lein."]
    },
    "es": {
        greetings: ["Hola equipo de WhatsApp,", "Estimado soporte,"],
        reasons: ["Mi número {{number}} ha sido suspendido.", "No he violado los términos de servicio.", "Creo que es un error."],
        closings: ["Gracias.", "Espero su respuesta."]
    },
    "default": {
        greetings: ["Hello WhatsApp Support,", "Dear Team,", "To the Support Team,", "Hi,", "Greetings,"],
        reasons: ["My number {{number}} has been banned.", "I believe this is a mistake.", "I have not violated any terms.", "Please review my account status."],
        closings: ["Please restore my account.", "Thank you.", "Regards.", "Kindly help."]
    }
};

const feedbackTemplates = [
    "I really appreciate the security updates, but the ban system flagged my number {{number}} incorrectly.",
    "The new features are great. However, losing access to {{number}} has been difficult. Please help.",
    "Support has been slow to respond for {{number}}. Please expedite this request.",
    "I have always recommended WhatsApp. Please don't let this ban on {{number}} change my mind.",
    "Is there a way to prevent false flags? My number {{number}} keeps getting banned.",
    "The call quality is amazing, but account stability for {{number}} needs work.",
    "Please check your AI moderation. It falsely banned {{number}}.",
    "I am a business user on {{number}}. This downtime is critical.",
    "Loving the new privacy tools. Just need my account {{number}} back.",
    "Please add better appeal tools in-app. For now, unban {{number}}."
];
