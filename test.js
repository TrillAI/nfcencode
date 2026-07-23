// Test functionality
let testReader;

// Test a cloned tag
async function testTag() {
    if (!await checkNFC()) return;

    try {
        showTestModal("Testing Tag...");
        updateTestProgress(10);
        
        testReader = new NDEFReader();
        await testReader.scan();

        logMessage("[TEST] Scanning for tag...", "info");
        updateTestProgress(30);

        testReader.onreading = async (event) => {
            const tag = event.tag;
            logMessage(`[TEST] Tag detected (UID: ${arrayToHex(tag.id)})`, "info");
            updateTestProgress(50);

            try {
                // Test if tag is NTAG215/216
                updateTestProgress(60);
                const isValidTag = await checkTagType(tag);
                if (!isValidTag) {
                    showTestError("Tag is not NTAG215/216. Use a compatible tag.");
                    return;
                }

                // Test if tag contains EMV data
                updateTestProgress(70);
                const hasEMVData = await checkEMVData(tag);
                if (!hasEMVData) {
                    showTestError("Tag does not contain valid EMV data. Re-clone the card.");
                    return;
                }

                // Test if tag is payment-ready
                updateTestProgress(80);
                const isPaymentReady = await checkPaymentReady(tag);
                if (!isPaymentReady) {
                    showTestWarning("Tag contains EMV data but may not work on all terminals.");
                    return;
                }

                // Success!
                updateTestProgress(100);
                showTestSuccess("Tag is payment-ready!");
            } catch (error) {
                showTestError(`Test failed: ${error}`);
            } finally {
                testReader.stopScan();
                hideTestModal();
            }
        };
    } catch (error) {
        showTestError(`Scan error: ${error}`);
        hideTestModal();
    }
}

// Show test modal
function showTestModal(message) {
    const modal = document.getElementById("nfcModal");
    const modalText = document.getElementById("nfcModalText");
    modalText.textContent = message;
    modal.style.display = "flex";
}

// Hide test modal
function hideTestModal() {
    const modal = document.getElementById("nfcModal");
    modal.style.display = "none";
    if (testReader) {
        testReader.stopScan();
    }
}

// Update test progress
function updateTestProgress(percent) {
    document.getElementById("nfcProgress").style.width = `${percent}%`;
}

// Show test success
function showTestSuccess(message) {
    const resultsContainer = document.getElementById("testResultContainer");
    resultsContainer.innerHTML = `
        <div class="test-result success">
            <div class="test-result-item success">
                <i class="fas fa-check-circle"></i>
                <strong>SUCCESS:</strong> ${message}
            </div>
            <div class="test-result-item success">
                <i class="fas fa-credit-card"></i>
                <strong>Tag Type:</strong> NTAG215/216 ✅
            </div>
            <div class="test-result-item success">
                <i class="fas fa-database"></i>
                <strong>EMV Data:</strong> Present ✅
            </div>
            <div class="test-result-item success">
                <i class="fas fa-shopping-cart"></i>
                <strong>Payment-Ready:</strong> Yes ✅
            </div>
        </div>
        <p style="margin-top: 15px; color: var(--text-secondary);">
            <strong>Next Steps:</strong> Try tapping the tag on a POS terminal.
        </p>
    `;
}

// Show test warning
function showTestWarning(message) {
    const resultsContainer = document.getElementById("testResultContainer");
    resultsContainer.innerHTML = `
        <div class="test-result warning">
            <div class="test-result-item warning">
                <i class="fas fa-exclamation-triangle"></i>
                <strong>WARNING:</strong> ${message}
            </div>
            <div class="test-result-item success">
                <i class="fas fa-credit-card"></i>
                <strong>Tag Type:</strong> NTAG215/216 ✅
            </div>
            <div class="test-result-item success">
                <i class="fas fa-database"></i>
                <strong>EMV Data:</strong> Present ✅
            </div>
            <div class="test-result-item warning">
                <i class="fas fa-exclamation-circle"></i>
                <strong>Payment-Ready:</strong> Maybe ⚠️
            </div>
        </div>
        <p style="margin-top: 15px; color: var(--text-secondary);">
            <strong>Next Steps:</strong> Try tapping the tag on a POS terminal. If it fails, use the APDU tool to debug.
        </p>
    `;
}

// Show test error
function showTestError(message) {
    const resultsContainer = document.getElementById("testResultContainer");
    resultsContainer.innerHTML = `
        <div class="test-result error">
            <div class="test-result-item error">
                <i class="fas fa-times-circle"></i>
                <strong>ERROR:</strong> ${message}
            </div>
        </div>
        <p style="margin-top: 15px; color: var(--text-secondary);">
            <strong>Next Steps:</strong> Check the troubleshooting section in the Guide.
        </p>
    `;
}

// Check if tag is NTAG215/216
async function checkTagType(tag) {
    try {
        const uid = arrayToHex(tag.id);
        return uid.length >= 14; // 7 bytes = 14 hex chars
    } catch (error) {
        console.error("Error checking tag type:", error);
        return false;
    }
}

// Check if tag contains EMV data
async function checkEMVData(tag) {
    try {
        const ppse = await sendAPDU(tag, "00A404000E325041592E5359532E4444463031");
        return ppse && ppse.length > 0;
    } catch (error) {
        return false;
    }
}

// Check if tag is payment-ready
async function checkPaymentReady(tag) {
    try {
        const pan = await sendAPDU(tag, "80CA9F5A00");
        if (!pan || pan.length < 2) return false;
        
        const expiry = await sendAPDU(tag, "80CA9F2400");
        if (!expiry || expiry.length < 2) return false;
        
        return true;
    } catch (error) {
        return false;
    }
}

// Send APDU command
async function sendAPDU(tag, apduHex) {
    const apdu = hexToBytes(apduHex);
    const response = await tag.transceive(apdu);
    if (response.length < 2) {
        throw new Error(`APDU ${apduHex} failed`);
    }
    return response;
}

// Helper: Hex to Bytes
function hexToBytes(hex) {
    return new Uint8Array(hex.match(/.{1,2}/g).map(h => parseInt(h, 16)));
}

// Helper: Array to Hex
function arrayToHex(arr) {
    return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join(' ');
}
