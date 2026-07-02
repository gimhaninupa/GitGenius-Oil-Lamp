document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const lampsContainer = document.getElementById('lampsContainer');
    const altarDisk = document.getElementById('altarDisk');
    const container = document.getElementById('ritualContainer');
    const litOverlay = document.getElementById('litOverlay');
    const revealContainer = document.getElementById('revealContainer');
    const dustContainer = document.getElementById('dustContainer');
    const guestBanner = document.getElementById('guestBanner');
    const bannerGuestName = document.getElementById('bannerGuestName');
    const bannerGuestTitle = document.getElementById('bannerGuestTitle');
    const floatingNamesContainer = document.getElementById('floatingNamesContainer');

    // Sequential Animation Queue state
    const lightingQueue = [];
    let isProcessingQueue = false;
    
    // Scale and positioning system for the 1920x1080 canvas
    const fitScreen = () => {
        const targetWidth = 1920;
        const targetHeight = 1080;
        const currentWidth = window.innerWidth;
        const currentHeight = window.innerHeight;
        
        const scaleX = currentWidth / targetWidth;
        const scaleY = currentHeight / targetHeight;
        const scale = Math.min(scaleX, scaleY);
        
        container.style.transform = `translate(-50%, -50%) scale(${scale})`;
    };
    window.addEventListener('resize', fitScreen);
    fitScreen();

    // Settings Drawer Elements
    const settingsDrawer = document.getElementById('settingsDrawer');
    const openDrawerBtn = document.getElementById('openDrawerBtn');
    const closeDrawerBtn = document.getElementById('closeDrawerBtn');
    const wicksCountInput = document.getElementById('wicksCountInput');
    const soundToggle = document.getElementById('soundToggle');
    const singleScreenToggle = document.getElementById('singleScreenToggle');
    const settingsResetBtn = document.getElementById('settingsResetBtn');
    const settingsForceFinaleBtn = document.getElementById('settingsForceFinaleBtn');
    const singleScreenTriggerBtn = document.getElementById('singleScreenTriggerBtn');
    const displayConnDot = document.getElementById('displayConnDot');
    const displayConnText = document.getElementById('displayConnText');

    // State Variables
    let currentlyLitCount = 0;
    let isRitualComplete = false;
    let totalWicks = APP_CONFIG.totalWicks;
    let soundEnabled = APP_CONFIG.soundEnabled;
    let singleScreenMode = false;
    let ws = null;
    let bannerTimeout = null;
    const inFlightWicks = new Set();

    // --- Sound Synthesis Class ---
    class SoundSynth {
        constructor() {
            this.ctx = null;
        }
        init() {
            if (!this.ctx) {
                this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            }
        }
        playChime(index) {
            if (!soundEnabled) return;
            this.init();
            if (!this.ctx || this.ctx.state === 'suspended') return;

            // Pentatonic scale frequencies starting around C4
            const scale = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25, 783.99, 880.00, 1046.50];
            const freq = scale[index % scale.length];
            const now = this.ctx.currentTime;

            // Oscillator 1 (Warm Root Tone)
            const osc1 = this.ctx.createOscillator();
            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(freq, now);

            // Oscillator 2 (Slight detune for richness)
            const osc2 = this.ctx.createOscillator();
            osc2.type = 'triangle';
            osc2.frequency.setValueAtTime(freq + 0.8, now);

            // Harmonic bell chime (Overtones)
            const bell = this.ctx.createOscillator();
            bell.type = 'sine';
            bell.frequency.setValueAtTime(freq * 3, now); // 3rd harmonic

            // Envelopes & Filters
            const gainNode = this.ctx.createGain();
            const bellGainNode = this.ctx.createGain();
            const filterNode = this.ctx.createBiquadFilter();

            filterNode.type = 'lowpass';
            filterNode.frequency.setValueAtTime(2500, now);
            filterNode.frequency.exponentialRampToValueAtTime(400, now + 1.8);

            // Main Envelope (Soft attack, slow decay)
            gainNode.gain.setValueAtTime(0, now);
            gainNode.gain.linearRampToValueAtTime(0.25, now + 0.08);
            gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 2.8);

            // Bell overtones Envelope (Quick decay)
            bellGainNode.gain.setValueAtTime(0, now);
            bellGainNode.gain.linearRampToValueAtTime(0.12, now + 0.02);
            bellGainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);

            // Connect everything
            osc1.connect(filterNode);
            osc2.connect(filterNode);
            bell.connect(bellGainNode);
            
            filterNode.connect(gainNode);
            gainNode.connect(this.ctx.destination);
            bellGainNode.connect(this.ctx.destination);

            osc1.start(now);
            osc2.start(now);
            bell.start(now);

            osc1.stop(now + 3.0);
            osc2.stop(now + 3.0);
            bell.stop(now + 1.0);
        }

        playFinale() {
            if (!soundEnabled) return;
            this.init();
            if (!this.ctx) return;
            const now = this.ctx.currentTime;

            // Riser/Crescendo sweep
            const riser = this.ctx.createOscillator();
            const riserGain = this.ctx.createGain();
            riser.type = 'triangle';
            riser.frequency.setValueAtTime(90, now);
            riser.frequency.exponentialRampToValueAtTime(450, now + 3);

            riserGain.gain.setValueAtTime(0.001, now);
            riserGain.gain.exponentialRampToValueAtTime(0.15, now + 3);

            riser.connect(riserGain);
            riserGain.connect(this.ctx.destination);

            riser.start(now);
            riser.stop(now + 3.1);

            // Majestic warm synthesizer major chord swell
            setTimeout(() => {
                const rootFreqs = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99]; // C Major
                rootFreqs.forEach((freq, idx) => {
                    const osc = this.ctx.createOscillator();
                    const gain = this.ctx.createGain();
                    
                    osc.type = (idx % 2 === 0) ? 'sine' : 'triangle';
                    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

                    gain.gain.setValueAtTime(0, this.ctx.currentTime);
                    gain.gain.linearRampToValueAtTime(0.08, this.ctx.currentTime + 0.8); // Smooth bloom
                    gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 4.5);

                    osc.connect(gain);
                    gain.connect(this.ctx.destination);
                    
                    osc.start(this.ctx.currentTime);
                    osc.stop(this.ctx.currentTime + 5.0);
                });
            }, 3000);
        }
    }

    const audio = new SoundSynth();

    // --- Altar Construction ---
    const buildAltar = () => {
        lampsContainer.innerHTML = '';
        currentlyLitCount = 0;
        isRitualComplete = false;
        
        // Remove lit class from disk & container resets
        altarDisk.classList.remove('lit');
        litOverlay.style.opacity = 0.2;
        container.classList.remove('shaking', 'destroyed');
        revealContainer.classList.remove('active');
        guestBanner.classList.remove('active');
        dustContainer.innerHTML = '';

        const center = { x: 400, y: 400 };
        const radius = 334;

        // Inject lamps dynamically based on configuration
        for (let i = 0; i < totalWicks; i++) {
            const lamp = document.createElement('div');
            lamp.className = 'lamp';
            lamp.id = `lamp-${i}`;
            lamp.style.setProperty('--i', i);
            
            // Calculate coordinates on a 334px circle centered at (400, 400)
            const angleRad = (i * 2 * Math.PI / totalWicks) - (Math.PI / 2);
            const left = Math.round(center.x + radius * Math.cos(angleRad));
            const top = Math.round(center.y + radius * Math.sin(angleRad));
            
            lamp.style.left = `${left}px`;
            lamp.style.top = `${top}px`;

            // Calculate absolute offsets relative to 1920x1080 parent
            // .altar-system starts at left: 560px, top: 140px
            const xOffset = 560 + left - 38;
            const yOffset = 140 + top - 38;

            lamp.innerHTML = `
                <div class="wick-glow" style="background-position: -${xOffset}px -${yOffset}px;"></div>
                <div class="wall-glow"></div>
                <div class="flame">
                    <div class="flame-core"></div>
                    <div class="flame-glow"></div>
                </div>
            `;
            lampsContainer.appendChild(lamp);
        }
    };



    // --- Traveling Spark Arc Animation ---
    const triggerSparkAndLight = (wickIndex, guestName, guestTitle, callback) => {
        const lamp = document.getElementById(`lamp-${wickIndex}`);
        if (!lamp || lamp.classList.contains('lit') || inFlightWicks.has(wickIndex)) return;

        // Prevent duplicate animation sparks
        inFlightWicks.add(wickIndex);

        // Sound trigger warning context user-interaction bypass
        audio.init();

        // 1. Get Source (Center Altar Disk) and Destination Coordinates
        const diskRect = altarDisk.getBoundingClientRect();
        const targetRect = lamp.getBoundingClientRect();

        const startX = diskRect.left + diskRect.width / 2;
        const startY = diskRect.top + diskRect.height / 2;
        const endX = targetRect.left + targetRect.width / 2;
        const endY = targetRect.top + targetRect.height / 2;

        // 2. Spawn traveling spark element
        const spark = document.createElement('div');
        spark.className = 'traveling-spark';
        document.body.appendChild(spark);

        const duration = 1200; // 1.2s travel time
        const startTime = performance.now();

        // High peak parabolic trajectory (curve upward)
        const ctrlX = (startX + endX) / 2;
        const ctrlY = Math.min(startY, endY) - 220;

        // Animate using quadratic Bezier curve
        const animate = (time) => {
            const elapsed = time - startTime;
            const t = Math.min(elapsed / duration, 1);

            // Bezier math
            const x = (1 - t) * (1 - t) * startX + 2 * (1 - t) * t * ctrlX + t * t * endX;
            const y = (1 - t) * (1 - t) * startY + 2 * (1 - t) * t * ctrlY + t * t * endY;

            spark.style.left = `${x}px`;
            spark.style.top = `${y}px`;

            // Spawning trails
            if (Math.random() < 0.3) {
                createTrailParticle(x, y);
            }

            if (t < 1) {
                requestAnimationFrame(animate);
            } else {
                spark.remove();
                inFlightWicks.delete(wickIndex);
                // Spark arrived: Light the wick!
                lightWick(wickIndex, guestName, guestTitle);

                // Run queue callback if present
                if (typeof callback === 'function') {
                    callback();
                }
            }
        };

        requestAnimationFrame(animate);
    };

    const createTrailParticle = (x, y) => {
        const trail = document.createElement('div');
        trail.className = 'spark-trail';
        trail.style.left = `${x}px`;
        trail.style.top = `${y}px`;
        document.body.appendChild(trail);

        const anim = trail.animate([
            { transform: 'translate(-50%, -50%) scale(1)', opacity: 0.8 },
            { transform: 'translate(-50%, -20px) scale(0.1)', opacity: 0 }
        ], { duration: 600, easing: 'ease-out' });

        anim.onfinish = () => trail.remove();
    };

    // --- Wick Lighting Ceremony ---
    const lightWick = (wickIndex, guestName, guestTitle) => {
        const lamp = document.getElementById(`lamp-${wickIndex}`);
        if (!lamp) return;

        lamp.classList.add('lit');
        currentlyLitCount++;

        // Update litOverlay opacity dynamically to build illumination on the sides of the screen
        const targetOpacity = 0.2 + 0.8 * (currentlyLitCount / totalWicks);
        litOverlay.style.opacity = targetOpacity;

        // Add lit styling to Altar Disk on the first wick light
        if (currentlyLitCount === 1) {
            altarDisk.classList.add('lit');
        }

        // Particle explosion burst on wick
        createParticles(lamp, 25);

        // Sound chime play
        audio.playChime(wickIndex);

        // Check if ceremony complete
        if (currentlyLitCount === totalWicks) {
            startCelebration();
        }
    };

    // Instant catch up lighting for page reloads / fast syncs
    const lightWickInstantly = (wickIndex) => {
        const lamp = document.getElementById(`lamp-${wickIndex}`);
        if (!lamp || lamp.classList.contains('lit')) return;

        lamp.classList.add('lit');
        currentlyLitCount++;

        // Update litOverlay opacity dynamically to build illumination on the sides of the screen
        const targetOpacity = 0.2 + 0.8 * (currentlyLitCount / totalWicks);
        litOverlay.style.opacity = targetOpacity;

        if (currentlyLitCount === 1) {
            altarDisk.classList.add('lit');
        }

        if (currentlyLitCount === totalWicks) {
            startCelebration();
        }
    };

    // --- Finale Celebration / Logo Reveal ---
    const startCelebration = () => {
        isRitualComplete = true;
        audio.playFinale();

        // Power up all vault systems smoothly
        litOverlay.style.opacity = 1.0;
        altarDisk.classList.add('lit');
    };

    // --- Particle Creators ---
    const createParticles = (parentElement, count) => {
        for (let i = 0; i < count; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle';
            const size = Math.random() * 5 + 2;
            particle.style.width = `${size}px`;
            particle.style.height = `${size}px`;

            const angle = Math.random() * Math.PI * 2;
            const distance = Math.random() * 50 + 20;
            const destX = Math.cos(angle) * distance;
            const destY = Math.sin(angle) * distance - 25; // float upward slightly

            parentElement.appendChild(particle);

            const anim = particle.animate([
                { transform: 'translate(0, 0) scale(1)', opacity: 1 },
                { transform: `translate(${destX}px, ${destY}px) scale(0.1)`, opacity: 0 }
            ], {
                duration: 1200 + Math.random() * 1000,
                easing: 'cubic-bezier(0.1, 0.8, 0.25, 1)',
                fill: 'forwards'
            });

            anim.onfinish = () => particle.remove();
        }
    };

    const createDustClouds = () => {
        for (let i = 0; i < 80; i++) {
            const dust = document.createElement('div');
            dust.className = 'dust-particle';
            const size = Math.random() * 12 + 6;
            dust.style.width = `${size}px`;
            dust.style.height = `${size}px`;
            dust.style.left = `${Math.random() * 100}%`;
            dust.style.top = `${Math.random() * 100}%`;
            dust.style.opacity = Math.random() * 0.4;
            
            dustContainer.appendChild(dust);

            dust.animate([
                { transform: 'translate(0, 0) scale(1)', opacity: 0.4 },
                { transform: `translate(${(Math.random() - 0.5) * 400}px, -800px) scale(2.2)`, opacity: 0 }
            ], {
                duration: 2500 + Math.random() * 2500,
                easing: 'ease-out',
                fill: 'forwards'
            });
        }
    };

    // --- State Synchronization (LocalStorage & WebSockets) ---
    
    // --- Sequential Animation Queue Helpers ---
    const queueWickLighting = (wickIndex, name, title) => {
        // Avoid duplicate queueing
        if (lightingQueue.some(item => item.wickIndex === wickIndex)) return;
        
        lightingQueue.push({ wickIndex, name, title });
        processLightingQueue();
    };

    const processLightingQueue = () => {
        if (isProcessingQueue) return;
        if (lightingQueue.length === 0) {
            isProcessingQueue = false;
            return;
        }

        isProcessingQueue = true;
        const nextWick = lightingQueue.shift();

        // Check if already lit
        const lamp = document.getElementById(`lamp-${nextWick.wickIndex}`);
        if (lamp && !lamp.classList.contains('lit')) {
            triggerSparkAndLight(nextWick.wickIndex, nextWick.name, nextWick.title, () => {
                // Wait a short delay before firing the next spark
                setTimeout(() => {
                    isProcessingQueue = false;
                    processLightingQueue();
                }, 600);
            });
        } else {
            isProcessingQueue = false;
            processLightingQueue();
        }
    };

    // Unified display state synchronizer
    const syncDisplayState = (state) => {
        if (!state) return;

        // 1. Check for Reset Ceremony Trigger
        if (state.origin === 'controller_reset') {
            lightingQueue.length = 0;
            isProcessingQueue = false;
            buildAltar();
            return;
        }

        // 2. Check for Force Finale
        if (state.origin === 'controller_finale' && !isRitualComplete) {
            startCelebration();
            return;
        }



        // 3. Catch up light counts
        const targetCount = state.litCount || 0;
        if (targetCount > currentlyLitCount && !isRitualComplete) {
            // Check if initial reload catch up is needed
            if (currentlyLitCount === 0 && targetCount > 1) {
                state.litWicks.forEach(w => {
                    lightWickInstantly(w.wickIndex);
                });
            } else {
                // Otherwise, queue them sequentially for smooth sparks
                state.litWicks.forEach(w => {
                    const lamp = document.getElementById(`lamp-${w.wickIndex}`);
                    if (lamp && !lamp.classList.contains('lit')) {
                        queueWickLighting(w.wickIndex, w.name, w.title);
                    }
                });
            }
        }
    };

    // Sync state locally from LocalStorage
    const syncLocalStorage = () => {
        const stored = localStorage.getItem(APP_CONFIG.storageKey);
        if (!stored) return;

        try {
            const state = JSON.parse(stored);
            
            // 1. Check and clean up local storage origin to prevent infinite loops
            if (state.origin === 'controller_reset') {
                buildAltar();
                localStorage.setItem(APP_CONFIG.storageKey, JSON.stringify({ ...state, origin: 'display_synced' }));
                return;
            }

            if (state.origin === 'controller_finale' && !isRitualComplete) {
                startCelebration();
                localStorage.setItem(APP_CONFIG.storageKey, JSON.stringify({ ...state, origin: 'display_synced' }));
                return;
            }

            // Sync using unified state handler
            syncDisplayState(state);
        } catch (e) {
            console.error("Error reading storage sync data:", e);
        }
    };

    // Connect to WebSocket Server for wireless networking
    const connectWebSocket = () => {
        const url = APP_CONFIG.getSocketUrl();
        ws = new WebSocket(url);

        ws.onopen = () => {
            displayConnDot.className = 'status-dot online';
            displayConnText.textContent = 'WiFi Sync Online';
            // Request the latest state as soon as we connect/reconnect
            ws.send(JSON.stringify({ type: 'request_state' }));
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);

                if (data.type === 'sync_state' && data.state) {
                    syncDisplayState(data.state);
                }
            } catch (err) {
                console.error("Error handling websocket payload:", err);
            }
        };

        ws.onclose = () => {
            displayConnDot.className = 'status-dot offline';
            displayConnText.textContent = 'Offline (Attempting Reconnect...)';
            setTimeout(connectWebSocket, 4000); // retry connect
        };
    };

    // --- Settings Panel Interactions ---

    const toggleDrawer = (open) => {
        if (open) {
            settingsDrawer.classList.add('open');
        } else {
            settingsDrawer.classList.remove('open');
        }
    };

    openDrawerBtn.addEventListener('click', () => toggleDrawer(true));
    closeDrawerBtn.addEventListener('click', () => toggleDrawer(false));

    // Wicks Count adjustment
    wicksCountInput.addEventListener('change', (e) => {
        let count = parseInt(e.target.value, 10);
        if (isNaN(count) || count < 1) count = 8;
        if (count > 16) count = 16;
        e.target.value = count;
        
        totalWicks = count;
        APP_CONFIG.totalWicks = count;
        buildAltar();
        
        // Reset local storage state to match new wicks
        localStorage.removeItem(APP_CONFIG.storageKey);
    });

    // Sound toggle
    soundToggle.addEventListener('change', (e) => {
        soundEnabled = e.target.checked;
        APP_CONFIG.soundEnabled = soundEnabled;
    });

    // Single screen direct touch control toggle
    singleScreenToggle.addEventListener('change', (e) => {
        singleScreenMode = e.target.checked;
        if (singleScreenMode) {
            singleScreenTriggerBtn.classList.add('visible');
        } else {
            singleScreenTriggerBtn.classList.remove('visible');
        }
    });

    // Direct single screen tap trigger
    singleScreenTriggerBtn.addEventListener('click', () => {
        const virtualLitCount = currentlyLitCount + lightingQueue.length + inFlightWicks.size;
        if (virtualLitCount >= totalWicks || isRitualComplete) return;

        const stored = localStorage.getItem(APP_CONFIG.storageKey);
        let guestsList = APP_CONFIG.defaultGuests;
        let litWicksList = [];
        try {
            if (stored) {
                const s = JSON.parse(stored);
                if (s.guests && s.guests.length > 0) guestsList = s.guests;
                litWicksList = s.litWicks || [];
            }
        } catch (e) {}

        const guest = guestsList[virtualLitCount % guestsList.length];

        queueWickLighting(virtualLitCount, guest.name, guest.title);

        const newWick = {
            wickIndex: virtualLitCount,
            name: guest.name,
            title: guest.title,
            timestamp: Date.now()
        };
        litWicksList.push(newWick);

        localStorage.setItem(APP_CONFIG.storageKey, JSON.stringify({
            litCount: virtualLitCount + 1,
            litWicks: litWicksList,
            guests: guestsList,
            timestamp: Date.now(),
            origin: 'display'
        }));
    });

    // Force finale trigger
    settingsForceFinaleBtn.addEventListener('click', () => {
        if (!isRitualComplete) {
            toggleDrawer(false);
            startCelebration();
        }
    });

    // Manual reset altar
    settingsResetBtn.addEventListener('click', () => {
        if (confirm("Reset the ceremony? This will extinguish all flames.")) {
            buildAltar();
            localStorage.removeItem(APP_CONFIG.storageKey);
        }
    });

    // --- Key Bindings & Mouse Fading ---
    window.addEventListener('keydown', (e) => {
        if (e.key.toLowerCase() === 'c') {
            // Toggle drawer
            const isOpen = settingsDrawer.classList.contains('open');
            toggleDrawer(!isOpen);
        } else if (e.key === 'Enter' || e.key === ' ') {
            // Trigger next wick (Single screen keyboard override helper)
            const virtualLitCount = currentlyLitCount + lightingQueue.length + inFlightWicks.size;
            if (virtualLitCount < totalWicks && !isRitualComplete) {
                singleScreenTriggerBtn.click();
            }
        } else if (e.key.toLowerCase() === 'r') {
            // Quick Reset shortcut
            settingsResetBtn.click();
        }
    });

    // Fade out settings button on mouse idle for clean display
    let mouseTimer = null;
    window.addEventListener('mousemove', () => {
        openDrawerBtn.style.opacity = '1';
        clearTimeout(mouseTimer);
        mouseTimer = setTimeout(() => {
            if (!settingsDrawer.classList.contains('open')) {
                openDrawerBtn.style.opacity = '0.1';
            }
        }, 3000);
    });

    // --- Initialization ---
    wicksCountInput.value = totalWicks;
    buildAltar();
    connectWebSocket();

    // Listen to storage sync events
    window.addEventListener('storage', (e) => {
        if (e.key === APP_CONFIG.storageKey) {
            syncLocalStorage();
        }
    });

    // Initial check for storage
    syncLocalStorage();
});
