// Global variables
let currentPage = "home";
let currentCardData = null;

// Initialize the app
document.addEventListener("DOMContentLoaded", () => {
    // Hide loading screen and show app
    setTimeout(() => {
        document.getElementById("loadingScreen").style.display = "none";
        document.getElementById("appContainer").style.display = "flex";
        
        // Initialize
        init();
    }, 2000);
    
    // Update time display every second
    setInterval(updateTimeDisplay, 1000);
    updateTimeDisplay();
    
    // Check online/offline status
    updateConnectionStatus();
    window.addEventListener("online", updateConnectionStatus);
    window.addEventListener("offline", updateConnectionStatus);
});

// Initialize the app
async function init() {
    logMessage("[SYSTEM] Initializing NFC Ring v2.0...", "system");
    await checkNFC();
    updateClonedCount();
    
    // Load home page by default
    loadPage("home");
    
    // Set up navigation
    document.querySelectorAll(".nav-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const page = btn.dataset.page;
            loadPage(page);
        });
    });
    
    // Set up command input for home page
    const commandInput = document.getElementById("commandInput");
    if (commandInput) {
        commandInput.addEventListener("keydown", async (event) => {
            if (event.key === "Enter") {
                const command = commandInput.value.trim().toLowerCase();
                commandInput.value = "";
                
                if (command) {
                    await processCommand(command);
                }
            }
        });
        
        // Auto-focus command input when home page is loaded
        commandInput.focus();
    }
    
    logMessage("[SYSTEM] Ready. Type 'help' for commands.", "success");
}

// Load a page
function loadPage(page) {
    currentPage = page;
    
    // Update active nav button
    document.querySelectorAll(".nav-btn").forEach(btn => {
        btn.classList.remove("active");
        if (btn.dataset.page === page) {
            btn.classList.add("active");
        }
    });
    
    // Update page title
    const titles = {
        home: "TERMINAL",
        guide: "GUIDE",
        test: "TEST",
        apdu: "APDU",
        cards: "CARDS"
    };
    document.getElementById("pageTitle").textContent = titles[page] || "NFC RING";
    
    // Load page content
    fetch(`/nfc-ring/pages/${page}.html`)
        .then(response => response.text())
        .then(html => {
            document.getElementById("pageContent").innerHTML = html;
            
            // Initialize page-specific functionality
            if (page === "home") {
                initHomePage();
            } else if (page === "test") {
                initTestPage();
            } else if (page === "apdu") {
                initAPDUPage();
            } else if (page === "cards") {
                initCardsPage();
            }
        })
        .catch(error => {
            console.error("Error loading page:", error);
            document.getElementById("pageContent").innerHTML = `
                <div class="log-container">
                    <div class="log-entry error">[ERROR] Failed to load page: ${page}</div>
                </div>
            `;
        });
}

// Initialize home page
function initHomePage() {
    const commandInput = document.getElementById("commandInput");
    if (commandInput) {
        commandInput.focus();
    }
}

// Initialize test page
function initTestPage() {
    // Test page is initialized in its own script
}

// Initialize APDU page
function initAPDUPage() {
    // APDU page is initialized in its own script
}

// Initialize cards page
function initCardsPage() {
    // Cards page is initialized in its own script
}

// Process terminal commands
async function processCommand(command) {
    const parts = command.split(" ");
    const baseCommand = parts[0];
    const args = parts.slice(1);
    
    switch (baseCommand) {
        case "help":
            showHelp();
            break;
        case "scan":
            await scanEMVCard();
            break;
        case "clone":
            await cloneToTag();
            break;
        case "test":
            await testTag();
            break;
        case "autofill":
            if (args[0] === "on") {
                toggleAutoFill(true);
            } else if (args[0] === "off") {
                toggleAutoFill(false);
            } else {
                toggleAutoFill();
            }
            break;
        case "list":
            listCards();
            break;
        case "clear":
            clearLog();
            break;
        case "generate":
            generateTestCard();
            break;
        case "manual":
            openCardModal(null);
            break;
        default:
            logMessage(`[ERROR] Unknown command: ${command}`, "error");
            logMessage("Type 'help' for available commands.", "info");
    }
}

// Show help
function showHelp() {
    logMessage("[HELP] Available commands:", "info");
    logMessage("  - scan: Scan an EMV card", "info");
    logMessage("  - clone: Clone card data to NTAG215/216", "info");
    logMessage("  - test: Test a cloned tag", "info");
    logMessage("  - autofill on: Enable auto-fill for payment forms", "info");
    logMessage("  - autofill off: Disable auto-fill", "info");
    logMessage("  - list: List all saved cards", "info");
    logMessage("  - generate: Generate a test card for encoding", "info");
    logMessage("  - manual: Manually enter card data", "info");
    logMessage("  - clear: Clear the terminal log", "info");
    logMessage("  - help: Show this help message", "info");
}

// List all saved cards
async function listCards() {
    const cards = await loadAllCards();
    if (cards.length === 0) {
        logMessage("[STORAGE] No cards found.", "warning");
        return;
    }
    
    logMessage(`[STORAGE] Found ${cards.length} saved card(s):`, "info");
    cards.forEach((card, index) => {
        logMessage(`  ${index + 1}. ${card.name || 'Unnamed Card'} (PAN: ${maskPAN(card.pan)}, Expiry: ${card.expiry})`, "data");
    });
}

// Clear the log
function clearLog() {
    const logContainer = document.getElementById("logContainer");
    logContainer.innerHTML = '';
    logMessage("[SYSTEM] Log cleared.", "system");
}

// Generate a test card
function generateTestCard() {
    const testCards = [
        { pan: "4111111111111111", expiry: "12/25", name: "Visa Test Card", cvc: "123" },
        { pan: "5555555555554444", expiry: "12/25", name: "Mastercard Test Card", cvc: "123" },
        { pan: "378282246310005", expiry: "12/25", name: "Amex Test Card", cvc: "1234" },
        { pan: "6011111111111117", expiry: "12/25", name: "Discover Test Card", cvc: "123" }
    ];
    
    const randomIndex = Math.floor(Math.random() * testCards.length);
    const card = testCards[randomIndex];
    
    // Save the test card
    saveCardData({
        ...card,
        uid: generateUID(),
        notes: "Test card generated by NFC Ring"
    });
    
    logMessage(`[GENERATE] Test card generated (PAN: ${card.pan}, Expiry: ${card.expiry})`, "success");
    logMessage("[STORAGE] Card saved successfully!", "success");
}

// Log a message to the terminal
function logMessage(message, type = "system") {
    const logContainer = document.getElementById("logContainer");
    if (!logContainer) return;
    
    const logEntry = document.createElement("div");
    logEntry.className = `log-entry ${type}`;
    logEntry.textContent = message;
    logContainer.appendChild(logEntry);
    logContainer.scrollTop = logContainer.scrollHeight;
}

// Show toast notification
function showToast(message, type = "info") {
    const toastContainer = document.getElementById("toastContainer");
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);
    
    // Remove toast after 3 seconds
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// Update time display
function updateTimeDisplay() {
    const now = new Date();
    const timeString = now.toLocaleTimeString();
    document.getElementById("timeDisplay").textContent = `[${timeString}]`;
}

// Update connection status
function updateConnectionStatus() {
    const status = navigator.onLine ? "[ONLINE]" : "[OFFLINE]";
    document.getElementById("connectionStatus").textContent = status;
}

// Mask PAN for display
function maskPAN(pan) {
    if (!pan || pan.length < 4) return pan;
    return pan.slice(0, 4) + "****" + pan.slice(-4);
}

// Generate random UID
function generateUID() {
    const bytes = new Uint8Array(4);
    window.crypto.getRandomValues(bytes);
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join(' ').toUpperCase();
}
