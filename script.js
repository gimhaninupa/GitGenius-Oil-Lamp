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
    // Removed Settings Elements

    // State Variables
    let currentlyLitCount = 0;
    let isRitualComplete = false;
    let totalWicks = APP_CONFIG.totalWicks;
    let soundEnabled = APP_CONFIG.soundEnabled;
    let singleScreenMode = false;
    let ws = null;
    let bannerTimeout = null;

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

    // --- Invisible Mobile Unlock Logic ---
    // Unlocks media on the very first tap anywhere on the screen
    const unlockMedia = () => {
        audio.init();
        if (audio.ctx && audio.ctx.state === 'suspended') {
            audio.ctx.resume();
        }
        
        const finaleVideo = document.getElementById('finaleVideo');
        if (finaleVideo) {
            finaleVideo.play().then(() => {
                finaleVideo.pause();
                finaleVideo.currentTime = 0;
            }).catch(e => console.log("Video unlock failed:", e));
        }
        
        // Remove listener after first interaction
        document.body.removeEventListener('click', unlockMedia);
        document.body.removeEventListener('touchstart', unlockMedia);
    };
    document.body.addEventListener('click', unlockMedia);
    document.body.addEventListener('touchstart', unlockMedia, {passive: true});
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

        // Reset door split elements
        const rightDoor = document.getElementById('rightDoor');
        if (rightDoor) rightDoor.remove();

        const mainDoor = document.getElementById('mainDoor');
        if (mainDoor) {
            mainDoor.style.clipPath = 'none';
            mainDoor.classList.remove('door-split-left');
        }
        
        const deepBg = document.getElementById('deepBackground');
        if (deepBg) deepBg.classList.remove('reveal');

        const center = { x: 400, y: 400 + (APP_CONFIG.lampCenterYOffset || 0) };
        const radius = APP_CONFIG.lampRadius || 334;

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
            const xOffset = 560 + left - 80;
            const yOffset = 140 + top - 80;

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
        
        const stationaryLitOverlay = document.getElementById('stationaryLitOverlay');
        if (stationaryLitOverlay) stationaryLitOverlay.style.opacity = targetOpacity;

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

        // 1. Power up all vault systems and central logo smoothly
        litOverlay.style.opacity = 1.0;
        const stationaryLitOverlay = document.getElementById('stationaryLitOverlay');
        if (stationaryLitOverlay) stationaryLitOverlay.style.opacity = 1.0;
        altarDisk.classList.add('lit');

        // 2. Wait 2.5 seconds for the logo light-up effect, then split the massive altar gate!
        setTimeout(() => {
            const mainGate = document.getElementById('altarGate');
            if (mainGate && !document.getElementById('altarGateRight')) {
                // Clone the entire massive circular gate (including all lit lamps)
                const rightGate = mainGate.cloneNode(true);
                rightGate.id = 'altarGateRight';
                
                // Add to DOM
                mainGate.parentNode.insertBefore(rightGate, mainGate.nextSibling);
                
                // Use a tiny 50ms delay so browser renders the clone before animating
                setTimeout(() => {
                    mainGate.classList.add('left-split', 'open');
                    rightGate.classList.add('right-split', 'open');
                    
                    // Blur the stationary background
                    document.getElementById('stationaryBg').classList.add('blur-active');
                    
                    // Reveal the deep background text
                    document.getElementById('deepBackground').classList.add('reveal');
                    
                    // Play the finale video
                    const finaleVideo = document.getElementById('finaleVideo');
                    if (finaleVideo) {
                        finaleVideo.play();
                    }
                }, 50);
            }
        }, 2500);
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
            lightWick(nextWick.wickIndex, nextWick.name, nextWick.title);
            
            // Wait a short delay before letting the next wick light up to keep it smooth
            setTimeout(() => {
                isProcessingQueue = false;
                processLightingQueue();
            }, 300);
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
            console.log('WiFi Sync Online');
            // Request the latest state as soon as we connect/reconnect
            ws.send(JSON.stringify({ type: 'request_state' }));
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);

                if (data.type === 'sync_state' && data.state) {
                    let stateObj = data.state;
                    // Decompress if it's the minified WS format
                    if (stateObj.g) {
                        stateObj = {
                            litCount: stateObj.c,
                            origin: stateObj.o,
                            timestamp: stateObj.ts,
                            guests: stateObj.g.map(g => ({
                                id: g.i,
                                name: g.n,
                                title: g.t,
                                lit: g.l === 1,
                                wickIndex: g.w
                            }))
                        };
                        stateObj.litWicks = (data.state.w || []).map(wickIndex => {
                            const guest = stateObj.guests.find(g => g.wickIndex === wickIndex);
                            return {
                                wickIndex: wickIndex,
                                name: guest ? guest.name : '',
                                title: guest ? guest.title : '',
                                timestamp: stateObj.timestamp
                            };
                        });
                    }
                    syncDisplayState(stateObj);
                }
            } catch (err) {
                console.error("Error handling websocket payload:", err);
            }
        };

        ws.onclose = () => {
            console.log('Offline (Attempting Reconnect...)');
            setTimeout(connectWebSocket, 4000); // retry connect
        };
    };

    // --- Initialization ---
    buildAltar();
    connectWebSocket();

    // Listen to storage sync events
    window.addEventListener('storage', (e) => {
        if (e.key === APP_CONFIG.storageKey) {
            syncLocalStorage();
        }
    });

    // Developer Hotkeys for live tweaking
    document.addEventListener('keydown', (e) => {
        if (e.shiftKey && e.key === 'ArrowUp') {
            APP_CONFIG.lampRadius += 2;
            buildAltar();
            console.log("New Radius:", APP_CONFIG.lampRadius);
            e.preventDefault();
        }
        if (e.shiftKey && e.key === 'ArrowDown') {
            APP_CONFIG.lampRadius -= 2;
            buildAltar();
            console.log("New Radius:", APP_CONFIG.lampRadius);
            e.preventDefault();
        }
        if (e.altKey && e.key === 'ArrowUp') {
            APP_CONFIG.lampCenterYOffset -= 2;
            buildAltar();
            console.log("New Y Offset:", APP_CONFIG.lampCenterYOffset);
            e.preventDefault();
        }
        if (e.altKey && e.key === 'ArrowDown') {
            APP_CONFIG.lampCenterYOffset += 2;
            buildAltar();
            console.log("New Y Offset:", APP_CONFIG.lampCenterYOffset);
            e.preventDefault();
        }
    });

    // Initial check for storage
    syncLocalStorage();
});
