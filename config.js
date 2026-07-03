// Virtual Oil Lamp - Central Configuration
const APP_CONFIG = {
    // Total wicks to display on the oil lamp (typically 10)
    totalWicks: 14,

    // Default list of guests who will light the wicks
    defaultGuests: [
        { name: "Hon. Chief Guest", title: "Chief Guest" },
        { name: "Mr. Gimhan Perera", title: "Director" },
        { name: "Dr. Amanda Silva", title: "Keynote Speaker" },
        { name: "Mr. K. R. Jayawardene", title: "Chairperson" },
        { name: "Mrs. Sanduni Fernando", title: "Co-Founder" },
        { name: "Mr. Rajitha Alwis", title: "Special Guest" },
        { name: "Miss Priyanthi Senanayake", title: "General Manager" },
        { name: "Mr. Dilhan Wickramasinghe", title: "Lead Engineer" },
        { name: "Prof. Malik Ranasinghe", title: "Academic Advisor" },
        { name: "Mrs. Ishara Kaluarachchi", title: "COO" },
        { name: "Dr. Nalin Perera", title: "Senior Consultant" },
        { name: "Mr. Upul Bandara", title: "VP of Engineering" },
        { name: "Mrs. Ruwani Silva", title: "CFO" },
        { name: "Mr. Suresh Gunasena", title: "Executive Director" }
    ],

    // Sound effects settings
    soundEnabled: true,

    // Storage key used for offline LocalStorage sync
    storageKey: 'virtual-oil-lamp-state',

    // WebSocket URL (used in network/Wi-Fi mode)
    getSocketUrl() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const portPart = window.location.port ? `:${window.location.port}` : '';
        return `${protocol}//${window.location.hostname}${portPart}`;
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = APP_CONFIG;
} else {
    window.APP_CONFIG = APP_CONFIG;
}
