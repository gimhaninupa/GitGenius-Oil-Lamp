// Virtual Oil Lamp - Central Configuration
const APP_CONFIG = {
    // Total wicks to display on the oil lamp (typically 10)
    totalWicks: 18,
    lampRadius: 334, // Adjust this value (or use Shift + Up/Down arrows in browser to tweak live)
    lampCenterYOffset: 0, // Adjust this if the circle is slightly higher/lower (or use Alt + Up/Down arrows)

    // Default list of guests who will light the wicks
    defaultGuests: [
        { name: "Dr. Chameera De Silva", title: "Head of The Department of Data Science, Sri Lanka Technology Campus" },
        { name: "Mr. Nisal Gunawardhana", title: "GitHub Campus Expert, Associate Software Engineer at Olee AI, Gold Microsoft Student Ambassadors" },
        { name: "Mr. Dineth Siriwardana", title: "Mobile Engineer at Majstro, Community Lead at Microsoft IT pro community, Ex Gold Microsoft Student ambassador" },
        { name: "Mr. Kavindu Umayanga", title: "Microsoft Student Ambassador, Community Lead at Microsoft IT pro Community" },
        { name: "Mr. Induwara Lakdinu", title: "Webmaster, IEEE Student Branch Chapter of SLTC" },
        { name: "Ms. Zahra Ismail", title: "Chairperson, IEEE WIE Student Branch Affinity Group of SLTC" },
        { name: "Ms. Vimarshana Kithmini", title: "Chairperson, IEEE Computer Society Student Branch Chapter of SLTC" },
        { name: "Mr. Geeth Rangika", title: "Vice Chairperson, IEEE Computer Society Student Branch Chapter of SLTC" },
        { name: "Ms. Dureksha Arangala", title: "Secretary, IEEE Computer Society Student Branch Chapter of SLTC" },
        { name: "Ms. Chalani Kavindya", title: "Assistant Secretary, IEEE Computer Society Student Branch Chapter of SLTC" },
        { name: "Mr. Binara Yasas", title: "Webmaster, IEEE Computer Society Student Branch Chapter of SLTC" },
        { name: "Mr. Eshan Menuka", title: "Project Co-chairperson, GitGenius 2026" },
        { name: "Mr. Saneth Rasanjana", title: "Project Co-chairperson, GitGenius 2026" },
        { name: "Ms. Omaya Nayagara", title: "Project Secretary, GitGenius 2026" },
        { name: "Participant", title: "One member of the participants please come forward to light the oil lamp" },
        { name: "Guest 1", title: "Participant" },
        { name: "Guest 2", title: "Participant" },
        { name: "Guest 3", title: "Participant" }
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
