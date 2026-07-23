// Database Configuration
const DB_NAME = "NFC_RING_DB";
const DB_VERSION = 1;
const STORE_NAME = "cards";
const ENCRYPTION_KEY = "NFC_RING_SECRET_KEY_2024"; // In production, use a real key

let db;

// Initialize Database
async function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            db = request.result;
            resolve(db);
        };
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
                store.createIndex("pan", "pan", { unique: false });
                store.createIndex("timestamp", "timestamp", { unique: false });
            }
        };
    });
}

// Simple XOR Encryption (for demo purposes)
function xorEncrypt(text, key) {
    let result = "";
    for (let i = 0; i < text.length; i++) {
        const charCode = text.charCodeAt(i) ^ key.charCodeAt(i % key.length);
        result += String.fromCharCode(charCode);
    }
    return btoa(result);
}

function xorDecrypt(encrypted, key) {
    const decoded = atob(encrypted);
    let result = "";
    for (let i = 0; i < decoded.length; i++) {
        const charCode = decoded.charCodeAt(i) ^ key.charCodeAt(i % key.length);
        result += String.fromCharCode(charCode);
    }
    return result;
}

// Save Card Data (Encrypted)
async function saveCardData(cardData) {
    try {
        const db = await initDB();
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);

        // Encrypt sensitive fields
        const encryptedData = {
            id: Date.now(),
            uid: cardData.uid,
            pan: cardData.pan ? xorEncrypt(cardData.pan, ENCRYPTION_KEY) : null,
            expiry: cardData.expiry ? xorEncrypt(cardData.expiry, ENCRYPTION_KEY) : null,
            name: cardData.name ? xorEncrypt(cardData.name, ENCRYPTION_KEY) : null,
            cvc: cardData.cvc ? xorEncrypt(cardData.cvc, ENCRYPTION_KEY) : null,
            track2: cardData.track2 ? xorEncrypt(cardData.track2, ENCRYPTION_KEY) : null,
            atc: cardData.atc,
            ppse: cardData.ppse,
            app: cardData.app,
            pdol: cardData.pdol,
            timestamp: new Date().toISOString(),
            notes: cardData.notes ? xorEncrypt(cardData.notes, ENCRYPTION_KEY) : null
        };

        await store.put(encryptedData);
        await tx.done;
        showToast("Card saved successfully!", "success");
        return true;
    } catch (error) {
        showToast(`Error saving card: ${error}`, "error");
        console.error("[STORAGE] Error saving card:", error);
        return false;
    }
}

// Load All Cards (Decrypted)
async function loadAllCards() {
    try {
        const db = await initDB();
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const cards = await store.getAll();

        // Decrypt data
        return cards.map(card => ({
            ...card,
            pan: card.pan ? xorDecrypt(card.pan, ENCRYPTION_KEY) : null,
            expiry: card.expiry ? xorDecrypt(card.expiry, ENCRYPTION_KEY) : null,
            name: card.name ? xorDecrypt(card.name, ENCRYPTION_KEY) : null,
            cvc: card.cvc ? xorDecrypt(card.cvc, ENCRYPTION_KEY) : null,
            track2: card.track2 ? xorDecrypt(card.track2, ENCRYPTION_KEY) : null,
            notes: card.notes ? xorDecrypt(card.notes, ENCRYPTION_KEY) : null
        }));
    } catch (error) {
        showToast(`Error loading cards: ${error}`, "error");
        console.error("[STORAGE] Error loading cards:", error);
        return [];
    }
}

// Load Single Card by ID
async function loadCardById(id) {
    try {
        const db = await initDB();
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const card = await store.get(id);

        if (!card) return null;

        // Decrypt data
        return {
            ...card,
            pan: card.pan ? xorDecrypt(card.pan, ENCRYPTION_KEY) : null,
            expiry: card.expiry ? xorDecrypt(card.expiry, ENCRYPTION_KEY) : null,
            name: card.name ? xorDecrypt(card.name, ENCRYPTION_KEY) : null,
            cvc: card.cvc ? xorDecrypt(card.cvc, ENCRYPTION_KEY) : null,
            track2: card.track2 ? xorDecrypt(card.track2, ENCRYPTION_KEY) : null,
            notes: card.notes ? xorDecrypt(card.notes, ENCRYPTION_KEY) : null
        };
    } catch (error) {
        showToast(`Error loading card: ${error}`, "error");
        console.error("[STORAGE] Error loading card:", error);
        return null;
    }
}

// Delete Card
async function deleteCardData(id) {
    try {
        const db = await initDB();
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        await store.delete(id);
        await tx.done;
        showToast("Card deleted successfully!", "success");
        return true;
    } catch (error) {
        showToast(`Error deleting card: ${error}`, "error");
        console.error("[STORAGE] Error deleting card:", error);
        return false;
    }
}

// Update Card
async function updateCard(id, updates) {
    try {
        const db = await initDB();
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        const card = await store.get(id);

        if (!card) {
            throw new Error("Card not found");
        }

        // Apply updates (encrypt sensitive fields)
        const updatedCard = {
            ...card,
            ...updates,
            pan: updates.pan ? xorEncrypt(updates.pan, ENCRYPTION_KEY) : card.pan,
            expiry: updates.expiry ? xorEncrypt(updates.expiry, ENCRYPTION_KEY) : card.expiry,
            name: updates.name ? xorEncrypt(updates.name, ENCRYPTION_KEY) : card.name,
            cvc: updates.cvc ? xorEncrypt(updates.cvc, ENCRYPTION_KEY) : card.cvc,
            track2: updates.track2 ? xorEncrypt(updates.track2, ENCRYPTION_KEY) : card.track2,
            notes: updates.notes ? xorEncrypt(updates.notes, ENCRYPTION_KEY) : card.notes,
            timestamp: new Date().toISOString()
        };

        await store.put(updatedCard);
        await tx.done;
        showToast("Card updated successfully!", "success");
        return true;
    } catch (error) {
        showToast(`Error updating card: ${error}`, "error");
        console.error("[STORAGE] Error updating card:", error);
        return false;
    }
}

// Count Cards
async function countCards() {
    try {
        const cards = await loadAllCards();
        return cards.length;
    } catch (error) {
        console.error("[STORAGE] Error counting cards:", error);
        return 0;
    }
}

// Export All Cards (Encrypted JSON)
async function exportCards() {
    try {
        const cards = await loadAllCards();
        const encryptedCards = cards.map(card => ({
            ...card,
            pan: card.pan ? xorEncrypt(card.pan, ENCRYPTION_KEY) : null,
            expiry: card.expiry ? xorEncrypt(card.expiry, ENCRYPTION_KEY) : null,
            name: card.name ? xorEncrypt(card.name, ENCRYPTION_KEY) : null,
            cvc: card.cvc ? xorEncrypt(card.cvc, ENCRYPTION_KEY) : null,
            track2: card.track2 ? xorEncrypt(card.track2, ENCRYPTION_KEY) : null,
            notes: card.notes ? xorEncrypt(card.notes, ENCRYPTION_KEY) : null
        }));
        return JSON.stringify(encryptedCards, null, 2);
    } catch (error) {
        showToast(`Error exporting cards: ${error}`, "error");
        console.error("[STORAGE] Error exporting cards:", error);
        return null;
    }
}

// Import Cards (Encrypted JSON)
async function importCards(jsonData) {
    try {
        const cards = JSON.parse(jsonData);
        const db = await initDB();
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);

        for (const card of cards) {
            await store.put(card);
        }

        await tx.done;
        showToast(`Imported ${cards.length} cards successfully!`, "success");
        return true;
    } catch (error) {
        showToast(`Error importing cards: ${error}`, "error");
        console.error("[STORAGE] Error importing cards:", error);
        return false;
    }
}
