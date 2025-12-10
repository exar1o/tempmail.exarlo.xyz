document.addEventListener('DOMContentLoaded', () => {
    // === CONFIGURATION ===
    const CLIENT_TOKEN = "EXARLO_OFFICIAL_V1"; 
    const CUSTOM_DOMAIN_ID = "RG9tYWluOjgw"; 
    const TARGET_URL = `https://dropmail.me/api/graphql/${CLIENT_TOKEN}`;
    const API_URL = `https://corsproxy.io/?${encodeURIComponent(TARGET_URL)}`;
    const POLL_INTERVAL = 8000;

    // === STATE ===
    let sessionID = null;
    let currentAddress = null;
    let knownMailIds = new Set(); 
    let pollInterval = null;

    // === UI REFERENCES ===
    const ui = {
        emailInput: document.getElementById('email-address'),
        inboxList: document.getElementById('inbox-list'),
        copyBtn: document.getElementById('copy-btn'),
        refreshBtn: document.getElementById('refresh-btn'),
        newIdentityBtn: document.getElementById('new-identity-btn'),
        statusLabel: document.getElementById('connection-status'),
        autoRefreshToggle: document.getElementById('auto-refresh'),
        modal: document.getElementById('email-modal'),
        modalSender: document.getElementById('modal-sender'),
        modalSubject: document.getElementById('modal-subject'),
        modalText: document.getElementById('modal-text'),
        modalDownload: document.getElementById('modal-download'),
        closeBtns: document.querySelectorAll('.close-modal-btn, .close-modal-action')
    };

    // === API HANDLER ===
    async function gqlQuery(query, variables = {}) {
        try {
            const response = await fetch(API_URL, {
                method: 'POST', 
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({ query, variables })
            });
            if (!response.ok) return null;
            return await response.json();
        } catch (e) { 
            if(ui.statusLabel) {
                ui.statusLabel.innerText = "UPLINK_ERROR";
                ui.statusLabel.style.color = "red";
            }
            return null; 
        }
    }

    // === CORE LOGIC ===
    async function initSession() {
        if(ui.statusLabel) ui.statusLabel.innerText = "NEGOTIATING_UPLINK...";
        
        let mutation;
        if (CUSTOM_DOMAIN_ID) {
            mutation = `mutation { introduceSession(input: { withAddress: true, domainId: "${CUSTOM_DOMAIN_ID}" }) { id addresses { address } } }`;
        } else {
            mutation = `mutation { introduceSession { id addresses { address } } }`;
        }

        const data = await gqlQuery(mutation);
        
        if (data?.data?.introduceSession) {
            sessionID = data.data.introduceSession.id;
            const addr = data.data.introduceSession.addresses[0]?.address;
            
            if (addr) updateAddress(addr);
            else await generateAddress();
            
            updateConnectionStatus('connected');
            startPolling();
        }
    }

    async function generateAddress() {
        let mutation;
        if (CUSTOM_DOMAIN_ID) {
            mutation = `mutation($sessId: ID!) { introduceAddress(input: {sessionId: $sessId, domainId: "${CUSTOM_DOMAIN_ID}"}) { address } }`;
        } else {
            mutation = `mutation($sessId: ID!) { introduceAddress(input: {sessionId: $sessId}) { address } }`;
        }

        const data = await gqlQuery(mutation, { sessId: sessionID });
        if (data?.data?.introduceAddress) updateAddress(data.data.introduceAddress.address);
    }

    function updateAddress(addr) {
        currentAddress = addr;
        ui.emailInput.value = addr;
    }

    async function fetchEmails() {
        if (!sessionID) return;
        const query = `query($sessId: ID!) { session(id: $sessId) { mails { id, fromAddr, headerSubject, text, downloadUrl } } }`;
        const response = await gqlQuery(query, { sessId: sessionID });
        
        if (response?.data?.session?.mails) {
            renderInbox(response.data.session.mails);
        }
    }

    function startPolling() {
        if (pollInterval) clearInterval(pollInterval);
        pollInterval = setInterval(() => {
            if (ui.autoRefreshToggle.checked) fetchEmails();
        }, POLL_INTERVAL);
    }

    function stopPolling() {
        if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
        }
    }

    // === OTP PARSER ===
    function findOTP(text) {
        if (!text) return null;
        const matches = text.match(/\b\d{4,8}\b/g);
        return matches ? matches[0] : null;
    }

    // === RENDER UI ===
    function renderInbox(mails) {
        const sorted = [...mails].reverse();
        
        if (sorted.length === 0) {
            if (!ui.inboxList.innerHTML.includes('empty-state'))
                ui.inboxList.innerHTML = `<div class="empty-state"><p>> Buffer empty.</p><p>> Listening...</p><span class="cursor">_</span></div>`;
            return;
        }

        ui.inboxList.innerHTML = ""; 

        sorted.forEach(mail => {
            const otp = findOTP(mail.text || mail.headerSubject);
            const senderName = (mail.fromAddr.split('<')[0] || "Unknown").trim();
            const subject = mail.headerSubject || "(No Subject)";
            
            const row = document.createElement('div');
            row.className = 'email-item';
            
            let actionButtons = `<span class="read-indicator">[READ]</span>`;
            if (otp) {
                actionButtons = `
                    <button class="otp-btn" onclick="event.stopPropagation(); copyOTP('${otp}', this)">[CODE: ${otp}]</button>
                    ${actionButtons}
                `;
            }

            row.innerHTML = `
                <div class="email-sender">${escapeHtml(senderName)}</div>
                <div class="email-subject">${escapeHtml(subject)}</div>
                <div class="email-actions">${actionButtons}</div>
            `;

            row.onclick = () => openModal(mail);
            ui.inboxList.appendChild(row);

            if (!knownMailIds.has(mail.id)) {
                knownMailIds.add(mail.id);
                updateConnectionStatus('packet_intercepted');
            }
        });
    }

    // === CONNECTION STATUS ===
    function updateConnectionStatus(state) {
        if (!ui.statusLabel) return;
        
        const states = {
            waiting: 'WAITING_FOR_PACKETS',
            connecting: 'ESTABLISHING_HANDSHAKE...',
            connected: 'SECURE_CHANNEL_ACTIVE',
            packet_intercepted: 'PACKET_INTERCEPTED',
            error: 'CONNECTION_DROPPED'
        };
        
        ui.statusLabel.textContent = states[state] || states.waiting;
        ui.statusLabel.className = state === 'connected' ? 'status-active' : 'status-blink';
        
        if (state === 'packet_intercepted') {
            ui.statusLabel.style.color = '#0f0';
            setTimeout(() => { 
                ui.statusLabel.textContent = states.connected;
                ui.statusLabel.style.color = 'inherit';
            }, 2000);
        }
    }

    // === UTILS ===
    window.copyOTP = (code, btn) => {
        navigator.clipboard.writeText(code);
        const original = btn.innerText;
        btn.innerText = "[COPIED]";
        setTimeout(() => btn.innerText = original, 1000);
    };

    function openModal(mail) {
        ui.modalSender.innerText = mail.fromAddr;
        ui.modalSubject.innerText = mail.headerSubject;
        ui.modalText.innerText = mail.text || "NO DATA CONTENT.";
        ui.modalDownload.href = mail.downloadUrl;
        ui.modal.classList.add('show');
    }

    function escapeHtml(text) {
        if (!text) return "";
        return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    // === EVENT LISTENERS ===
    if(ui.copyBtn) {
        ui.copyBtn.addEventListener('click', () => {
            if(currentAddress) {
                navigator.clipboard.writeText(currentAddress);
                const btnText = ui.copyBtn.querySelector('.btn-text');
                if(btnText) {
                    const original = btnText.innerText;
                    btnText.innerText = "COPIED";
                    ui.copyBtn.classList.add('copy-success');
                    setTimeout(() => {
                        btnText.innerText = original;
                        ui.copyBtn.classList.remove('copy-success');
                    }, 2000);
                }
            }
        });
    }
    
    if(ui.refreshBtn) ui.refreshBtn.addEventListener('click', fetchEmails);
    
    if(ui.newIdentityBtn) {
        ui.newIdentityBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if(confirm("TERMINATE CURRENT SESSION AND GENERATE NEW ID?")) {
                stopPolling();
                location.reload();
            }
        });
    }

    ui.closeBtns.forEach(btn => btn.addEventListener('click', () => ui.modal.classList.remove('show')));

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
            e.preventDefault();
            fetchEmails();
        }
        
        if (e.key === 'Escape') {
            ui.modal.classList.remove('show');
        }
        
        if ((e.ctrlKey || e.metaKey) && e.key === 'c' && document.activeElement.id === 'email-address') {
            e.preventDefault();
            if(currentAddress) {
                navigator.clipboard.writeText(currentAddress);
                ui.copyBtn.click();
            }
        }
    });

    // Auto-refresh toggle
    if (ui.autoRefreshToggle) {
        ui.autoRefreshToggle.addEventListener('change', (e) => {
            if (e.target.checked && !pollInterval) {
                startPolling();
            } else if (!e.target.checked && pollInterval) {
                stopPolling();
            }
        });
    }

    // Start App
    initSession();
});
