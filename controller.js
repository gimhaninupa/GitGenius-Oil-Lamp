document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const triggerBtn = document.getElementById('triggerBtn');
    const currentGuestName = document.getElementById('currentGuestName');
    const currentGuestTitle = document.getElementById('currentGuestTitle');
    const nextWickNumber = document.getElementById('nextWickNumber');
    const maxWicksCount = document.getElementById('maxWicksCount');
    const guestListEl = document.getElementById('guestList');
    const addGuestBtn = document.getElementById('addGuestBtn');
    const newGuestNameInput = document.getElementById('newGuestName');
    const newGuestTitleInput = document.getElementById('newGuestTitle');
    const resetGuestsBtn = document.getElementById('resetGuestsBtn');
    const resetCeremonyBtn = document.getElementById('resetCeremonyBtn');
    const triggerFinaleBtn = document.getElementById('triggerFinaleBtn');
    const connectionStatus = document.getElementById('connectionStatus');

    // Local State
    let guests = [];
    let litWicks = [];
    let ws = null;
    let isConnected = false;
    const maxWicks = APP_CONFIG.totalWicks;
    maxWicksCount.textContent = maxWicks;

    // --- State Sync Functions ---

    // Load initial state from LocalStorage
    const loadState = () => {
        const stored = localStorage.getItem(APP_CONFIG.storageKey);
        if (stored) {
            try {
                const state = JSON.parse(stored);
                guests = state.guests || [];
                litWicks = state.litWicks || [];
                
                // If total wicks configuration changed, auto-reset to avoid stale state issues
                if (guests.length !== maxWicks) {
                    loadDefaultGuests();
                    return;
                }
            } catch (e) {
                console.error("Error parsing local storage state:", e);
                loadDefaultGuests();
            }
        } else {
            loadDefaultGuests();
        }
        renderGuests();
        updateUI();
    };

    // Save state to LocalStorage & dispatch sync event
    const saveState = (dispatchSync = true, origin = 'controller') => {
        const state = {
            litCount: litWicks.length,
            litWicks: litWicks,
            guests: guests,
            timestamp: Date.now(),
            origin: origin
        };
        localStorage.setItem(APP_CONFIG.storageKey, JSON.stringify(state));

        // If in WebSocket mode, send update
        if (isConnected && ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'sync_state', state }));
        }
    };

    const loadDefaultGuests = () => {
        guests = APP_CONFIG.defaultGuests.map((g, index) => ({
            id: 'g-' + index + '-' + Date.now(),
            name: g.name,
            title: g.title,
            lit: false,
            wickIndex: null
        }));
        litWicks = [];
        saveState();
    };

    // --- WebSocket Setup ---
    const connectWebSocket = () => {
        const wsUrl = APP_CONFIG.getSocketUrl();
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
            isConnected = true;
            updateConnectionStatus(true);
            // Request latest state or push ours
            ws.send(JSON.stringify({ type: 'request_state' }));
        };

        ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                if (msg.type === 'sync_state') {
                    // Update our local state with the network state
                    if (msg.state) {
                        guests = msg.state.guests || [];
                        litWicks = msg.state.litWicks || [];
                        renderGuests();
                        updateUI();
                    }
                }
            } catch (e) {
                console.error("Error parsing WS message:", e);
            }
        };

        ws.onclose = () => {
            isConnected = false;
            updateConnectionStatus(false);
            // Attempt reconnect in 3s
            setTimeout(connectWebSocket, 3000);
        };

        ws.onerror = () => {
            isConnected = false;
            updateConnectionStatus(false);
        };
    };

    const updateConnectionStatus = (online) => {
        const indicator = connectionStatus.querySelector('.status-indicator');
        const text = connectionStatus.querySelector('.status-text');
        if (online) {
            indicator.className = 'status-indicator online';
            text.textContent = 'WiFi Sync';
        } else {
            indicator.className = 'status-indicator offline';
            text.textContent = 'Offline Sync';
        }
    };

    // --- UI Update & Rendering ---

    const updateUI = () => {
        const litCount = litWicks.length;
        
        // Find next unlit guest
        const nextGuest = guests.find(g => !g.lit);

        if (litCount >= maxWicks) {
            // All wicks lit
            currentGuestName.textContent = "Ceremony Lit";
            currentGuestTitle.textContent = "All wicks are shining brightly";
            nextWickNumber.textContent = maxWicks;
            triggerBtn.disabled = true;
            triggerBtn.classList.remove('active');
            triggerFinaleBtn.disabled = false;
        } else if (nextGuest) {
            currentGuestName.textContent = nextGuest.name;
            currentGuestTitle.textContent = nextGuest.title || "Guest";
            nextWickNumber.textContent = litCount + 1;
            triggerBtn.disabled = false;
            triggerBtn.classList.add('active');
            triggerFinaleBtn.disabled = true;
        } else {
            // No next guest configured
            currentGuestName.textContent = "No Guest Assigned";
            currentGuestTitle.textContent = "Please add a guest below";
            nextWickNumber.textContent = litCount + 1;
            triggerBtn.disabled = true;
            triggerBtn.classList.remove('active');
            triggerFinaleBtn.disabled = litCount === 0;
        }
    };

    const renderGuests = () => {
        guestListEl.innerHTML = '';
        guests.forEach((guest, index) => {
            const li = document.createElement('li');
            li.className = `guest-item ${guest.lit ? 'lit' : ''}`;
            li.setAttribute('draggable', 'true');

            // Render status marker or order index
            let statusBadge = `<span class="guest-index">${index + 1}</span>`;
            if (guest.lit) {
                statusBadge = `<span class="guest-status-lit">🔥 Wick ${guest.wickIndex + 1}</span>`;
            }

            li.innerHTML = `
                <div class="guest-drag-handle">☰</div>
                ${statusBadge}
                <div class="guest-details">
                    <span class="g-name">${guest.name}</span>
                    <span class="g-title">${guest.title || ''}</span>
                </div>
                <div class="guest-controls">
                    ${!guest.lit ? `
                        <button class="btn-icon btn-delete" data-id="${guest.id}" title="Remove Guest">✕</button>
                    ` : ''}
                </div>
            `;

            // Setup drag events for reordering
            li.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', guest.id);
                li.classList.add('dragging');
            });

            li.addEventListener('dragend', () => {
                li.classList.remove('dragging');
            });

            guestListEl.appendChild(li);
        });

        // Setup dragover / drop for reordering
        guestListEl.addEventListener('dragover', (e) => {
            e.preventDefault();
            const draggingItem = guestListEl.querySelector('.dragging');
            if (!draggingItem) return;
            const siblings = [...guestListEl.querySelectorAll('.guest-item:not(.dragging)')];
            const nextSibling = siblings.find(sibling => {
                return e.clientY <= sibling.getBoundingClientRect().top + sibling.getBoundingClientRect().height / 2;
            });
            guestListEl.insertBefore(draggingItem, nextSibling);
        });

        guestListEl.addEventListener('drop', (e) => {
            e.preventDefault();
            // Reorder the guest array based on DOM positions
            const currentIds = [...guestListEl.querySelectorAll('.guest-controls button, .guest-item')].map(el => {
                const btn = el.querySelector('.btn-delete');
                return btn ? btn.getAttribute('data-id') : null;
            }).filter(Boolean);
            
            // Map original guest objects based on the new ID order
            const newGuests = [];
            const litList = guests.filter(g => g.lit); // Keep lit ones as they are or re-append
            const unlitList = guests.filter(g => !g.lit);

            // Reorder guests array
            const idOrder = [...guestListEl.querySelectorAll('.guest-item')].map(item => {
                const delBtn = item.querySelector('.btn-delete');
                if (delBtn) return delBtn.getAttribute('data-id');
                // For lit items, we can find their original ID by searching original array index
                const nameText = item.querySelector('.g-name').textContent;
                const match = guests.find(g => g.name === nameText);
                return match ? match.id : null;
            }).filter(Boolean);

            const sortedGuests = idOrder.map(id => guests.find(g => g.id === id)).filter(Boolean);
            guests = sortedGuests;
            saveState();
            updateUI();
        });
    };

    // --- Action Handlers ---

    // Touch to Light Button
    const handleTrigger = () => {
        const litCount = litWicks.length;
        if (litCount >= maxWicks) return;

        // Find next unlit guest
        const nextGuestIndex = guests.findIndex(g => !g.lit);
        if (nextGuestIndex === -1) return;

        const guest = guests[nextGuestIndex];
        guest.lit = true;
        guest.wickIndex = litCount;

        const newWickEvent = {
            wickIndex: litCount,
            name: guest.name,
            title: guest.title,
            timestamp: Date.now()
        };

        litWicks.push(newWickEvent);

        // Haptic feedback
        if (navigator.vibrate) {
            navigator.vibrate([100, 50, 100]);
        }

        // Particle effect on the controller button
        createBtnParticles();

        // Temporarily disable the button to prevent double tap accident
        triggerBtn.disabled = true;
        triggerBtn.classList.remove('active');

        saveState();
        updateUI();
        renderGuests();

        // Enable back after animation completes on display (approx 2.5 seconds)
        setTimeout(() => {
            updateUI();
        }, 2500);
    };

    // Particle Burst on Button Touch
    const createBtnParticles = () => {
        const rect = triggerBtn.getBoundingClientRect();
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        for (let i = 0; i < 30; i++) {
            const p = document.createElement('div');
            p.className = 'particle';
            const size = Math.random() * 6 + 3;
            p.style.width = `${size}px`;
            p.style.height = `${size}px`;
            p.style.left = `${centerX}px`;
            p.style.top = `${centerY}px`;
            p.style.backgroundColor = '#ffb347';
            p.style.boxShadow = '0 0 10px #ff4500';

            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 80 + 40;
            const destX = Math.cos(angle) * speed;
            const destY = Math.sin(angle) * speed;

            triggerBtn.appendChild(p);

            const anim = p.animate([
                { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 },
                { transform: `translate(calc(-50% + ${destX}px), calc(-50% + ${destY}px)) scale(0.1)`, opacity: 0 }
            ], {
                duration: 800 + Math.random() * 400,
                easing: 'ease-out',
                fill: 'forwards'
            });

            anim.onfinish = () => p.remove();
        }
    };

    // Add new guest
    addGuestBtn.addEventListener('click', () => {
        const name = newGuestNameInput.value.trim();
        const title = newGuestTitleInput.value.trim();

        if (name === '') return;

        guests.push({
            id: 'g-' + Date.now(),
            name: name,
            title: title,
            lit: false,
            wickIndex: null
        });

        newGuestNameInput.value = '';
        newGuestTitleInput.value = '';
        
        saveState();
        updateUI();
        renderGuests();
    });

    // Handle pressing Enter inside input fields
    const handleInputKey = (e) => {
        if (e.key === 'Enter') {
            addGuestBtn.click();
        }
    };
    newGuestNameInput.addEventListener('keydown', handleInputKey);
    newGuestTitleInput.addEventListener('keydown', handleInputKey);

    // Delete guest
    guestListEl.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-delete')) {
            const id = e.target.getAttribute('data-id');
            guests = guests.filter(g => g.id !== id);
            saveState();
            updateUI();
            renderGuests();
        }
    });

    // Reset defaults
    resetGuestsBtn.addEventListener('click', () => {
        if (confirm("Reset guest lineup to defaults? This will erase current edits.")) {
            loadDefaultGuests();
        }
    });

    // Reset ceremony
    resetCeremonyBtn.addEventListener('click', () => {
        if (confirm("Are you sure you want to RESET the entire ceremony? All wicks will be extinguished.")) {
            // Unlit all guests
            guests.forEach(g => {
                g.lit = false;
                g.wickIndex = null;
            });
            litWicks = [];
            
            // Broadcast reset event using origin trigger
            saveState(true, 'controller_reset');
            updateUI();
            renderGuests();
        }
    });

    // Trigger Finale Logo Reveal
    triggerFinaleBtn.addEventListener('click', () => {
        saveState(true, 'controller_finale');
    });

    // Button event listeners
    triggerBtn.addEventListener('click', handleTrigger);

    // Listen to changes from local storage (if display resets or other controller edits)
    window.addEventListener('storage', (e) => {
        if (e.key === APP_CONFIG.storageKey) {
            try {
                const state = JSON.parse(e.newValue);
                // Only sync if the change didn't originate from this controller
                if (state.origin !== 'controller') {
                    guests = state.guests || [];
                    litWicks = state.litWicks || [];
                    renderGuests();
                    updateUI();
                }
            } catch (err) {
                console.error("Error syncing storage event:", err);
            }
        }
    });

    // Initialize
    loadState();
    connectWebSocket();
});
