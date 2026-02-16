// Admin Live Chat System
// Add this to admin.html before the closing </script> tag

let adminChatUnsubscribe = null;
let currentChatAppId = null;

// Load chat when opening a dossier
function loadAdminChat(appId, nickname) {
    currentChatAppId = appId;
    
    import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js').then(({ onSnapshot, orderBy }) => {
        const { db, collection, query } = window.firebaseSystem;
        
        const chatRef = collection(db, 'applications', appId, 'chat');
        const q = query(chatRef, orderBy('timestamp', 'asc'));
        
        const messagesDiv = document.getElementById('adminChatMessages');
        if (!messagesDiv) return;
        
        // Real-time listener
        if (adminChatUnsubscribe) adminChatUnsubscribe();
        
        adminChatUnsubscribe = onSnapshot(q, (snapshot) => {
            messagesDiv.innerHTML = '';
            
            if (snapshot.empty) {
                messagesDiv.innerHTML = `
                    <div class="text-center py-8">
                        <span class="material-symbols-rounded text-gray-600 text-3xl mb-2">chat_bubble</span>
                        <p class="text-gray-500 text-xs">No messages yet</p>
                    </div>
                `;
            } else {
                snapshot.forEach(doc => {
                    const msg = doc.data();
                    const isAdmin = msg.sender === 'admin';
                    const time = msg.timestamp ? new Date(msg.timestamp.toDate()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Now';
                    
                    const bubble = document.createElement('div');
                    bubble.className = `flex ${isAdmin ? 'justify-end' : 'justify-start'} animate-fadeIn`;
                    bubble.innerHTML = `
                        <div class="max-w-[80%] ${isAdmin ? 'bg-primary' : 'bg-white/10'} rounded-2xl px-4 py-3">
                            <div class="flex items-center gap-2 mb-1">
                                <span class="text-[8px] font-black uppercase tracking-widest ${isAdmin ? 'text-white/70' : 'text-primary'}">${isAdmin ? 'You' : nickname}</span>
                                <span class="text-[7px] text-gray-500">${time}</span>
                            </div>
                            <p class="text-white text-sm leading-relaxed">${msg.message}</p>
                        </div>
                    `;
                    messagesDiv.appendChild(bubble);
                });
                
                // Auto scroll
                messagesDiv.scrollTop = messagesDiv.scrollHeight;
            }
        });
    });
}

async function sendAdminMessage() {
    const input = document.getElementById('adminChatInput');
    if (!input) return;
    
    const message = input.value.trim();
    if (!message || !currentChatAppId) return;
    
    try {
        const { db, collection, addDoc, serverTimestamp } = window.firebaseSystem;
        await addDoc(collection(db, 'applications', currentChatAppId, 'chat'), {
            message,
            sender: 'admin',
            timestamp: serverTimestamp()
        });
        
        input.value = '';
        playClick();
    } catch (err) {
        console.error('Admin chat error:', err);
        alert('Failed to send message: ' + err.message);
    }
}
