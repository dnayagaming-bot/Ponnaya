document.addEventListener('DOMContentLoaded', () => {
    initCustomSelect('serviceSelect');
    initCustomSelect('countrySelect');

    const generateBtn = document.getElementById('generateBtn');
    const numberDisplay = document.getElementById('numberDisplay');
    const otpSection = document.getElementById('otpSection');
    const countdown = document.getElementById('countdown');
    const otpBox = document.getElementById('otpBox');
    const feedContainer = document.getElementById('feedContainer');

    generateBtn.addEventListener('click', async () => {
        generateBtn.disabled = true;
        generateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Reserving Number...';

        await new Promise(r => setTimeout(r, 2000));

        const region = document.querySelector('#countrySelect .select-selected').textContent.trim();
        const prefix = region.includes('+1') ? '+1' : region.includes('+44') ? '+44' : region.includes('+91') ? '+91' : '+49';
        const randomNum = Math.floor(Math.random() * 9000000000) + 1000000000;

        document.getElementById('generatedNumber').textContent = `${prefix} ${randomNum.toString().replace(/(\d{3})(\d{3})(\d{4})/, '$1 $2 $3')}`;

        numberDisplay.style.display = 'block';
        otpSection.style.display = 'block';
        generateBtn.style.display = 'none';

        startTimer(1200, countdown);
        simulateOtpArrival();
        addFeedItem('Anonymous', 'Reserved a WhatsApp Number', 'Just now');
    });

    function startTimer(duration, display) {
        let timer = duration, minutes, seconds;
        const interval = setInterval(() => {
            minutes = parseInt(timer / 60, 10);
            seconds = parseInt(timer % 60, 10);
            minutes = minutes < 10 ? "0" + minutes : minutes;
            seconds = seconds < 10 ? "0" + seconds : seconds;
            display.textContent = minutes + ":" + seconds;
            if (--timer < 0) clearInterval(interval);
        }, 1000);
    }

    async function simulateOtpArrival() {
        await new Promise(r => setTimeout(r, 8000));
        otpBox.style.display = 'block';
        document.getElementById('refreshOtp').style.display = 'none';
        addFeedItem('Anonymous', 'Received WhatsApp OTP', 'Just now');
    }

    function addFeedItem(user, action, time) {
        const item = document.createElement('div');
        item.className = 'feed-item';
        item.innerHTML = `
            <div class="feed-icon"><i class="fas fa-user-shield"></i></div>
            <div class="feed-info">
                <div class="feed-user">${user}</div>
                <div class="feed-action">${action}</div>
            </div>
            <div class="feed-time">${time}</div>
        `;
        feedContainer.prepend(item);
        if (feedContainer.children.length > 5) feedContainer.lastChild.remove();
    }

    // Initial feed
    const actions = ['Reserved a UK Number', 'Verified Telegram', 'Received WhatsApp Code', 'New User Joined'];
    setInterval(() => {
        const action = actions[Math.floor(Math.random() * actions.length)];
        addFeedItem('User_' + Math.floor(Math.random() * 999), action, 'Just now');
    }, 15000);

    // Initial items
    for (let i = 0; i < 3; i++) {
        addFeedItem('User_' + Math.floor(Math.random() * 999), actions[i], (i + 1) + 'm ago');
    }
});

function initCustomSelect(id) {
    const x = document.getElementById(id);
    const selected = x.querySelector('.select-selected');
    const items = x.querySelector('.select-items');

    selected.addEventListener('click', (e) => {
        e.stopPropagation();
        closeAllSelect(selected);
        items.classList.toggle('select-hide');
        selected.classList.toggle('select-arrow-active');
    });

    items.querySelectorAll('div').forEach(item => {
        item.addEventListener('click', () => {
            selected.innerHTML = item.innerHTML;
            items.classList.add('select-hide');
        });
    });
}

function closeAllSelect(elmnt) {
    const x = document.querySelectorAll('.select-items');
    const y = document.querySelectorAll('.select-selected');
    for (let i = 0; i < y.length; i++) {
        if (elmnt == y[i]) continue;
        x[i].classList.add('select-hide');
    }
}

document.addEventListener('click', closeAllSelect);

window.copyNumber = function () {
    const num = document.getElementById('generatedNumber').textContent;
    navigator.clipboard.writeText(num);
    const btn = document.querySelector('.btn-copy i');
    btn.className = 'fas fa-check';
    setTimeout(() => btn.className = 'fas fa-copy', 2000);
};
