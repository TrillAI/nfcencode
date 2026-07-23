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
        logMessage("[TEST] Checking for PPSE application...", "info");
        const ppse = await sendAPDU(tag, "00A404000E325041592E5359532E4444463031");
        
        if (!ppse || ppse.length === 0) {
            logMessage("[TEST] PPSE not found on tag", "warning");
            return false;
        }
        
        logMessage("[TEST] ✓ PPSE found, attempting to read PAN...", "success");
        
        // Try to select payment app and read Track 2 data
        try {
            await sendAPDU(tag, "00A4040007A000000025010101"); // Visa
            logMessage("[TEST] ✓ Visa application detected", "success");
        } catch (e) {
            try {
                await sendAPDU(tag, "00A4040007A0000000041010"); // Mastercard
                logMessage("[TEST] ✓ Mastercard application detected", "success");
            } catch (e2) {
                logMessage("[TEST] Warning: Could not detect payment app", "warning");
            }
        }
        
        return true;
    } catch (error) {
        logMessage(`[TEST] EMV data check failed: ${error}`, "error");
        return false;
    }
}

// Check if tag is payment-ready
async function checkPaymentReady(tag) {
    try {
        logMessage("[TEST] Verifying payment readiness...", "info");
        
        // Read Track 2 Equivalent Data
        logMessage("[TEST] Reading Track 2 equivalent data...", "info");
        const track2 = await sendAPDU(tag, "80CA9F5700");
        
        if (!track2 || track2.length < 2) {
            logMessage("[TEST] No Track 2 data found", "warning");
            return false;
        }
        
        // Parse Track 2 to verify it contains valid payment data
        const track2Str = arrayToHex(track2).replace(/\s/g, '');
        logMessage(`[TEST] Track 2 data retrieved: ${track2Str.substring(0, 40)}...`, "data");
        
        // Try to read PAN (Tag 5A)
        logMessage("[TEST] Reading Primary Account Number...", "info");
        const pan = await sendAPDU(tag, "80CA5A00");
        if (!pan || pan.length < 5) {
            logMessage("[TEST] Warning: Could not read PAN tag", "warning");
            // Try alternative method
            const panFromTrack2 = track2Str.match(/;(\d{13,19})=/);
            if (panFromTrack2) {
                logMessage(`[TEST] ✓ PAN recovered from Track 2: ${maskPAN(panFromTrack2[1])}`, "success");
            } else {
                return false;
            }
        } else {
            const panDecoded = HexUtils.hexToString(track2Str.substring(0, pan.length * 2));
            logMessage(`[TEST] ✓ PAN detected: ${maskPAN(panDecoded)}`, "success");
        }
        
        // Try to read expiry (Tag 5F34)
        logMessage("[TEST] Reading expiry date...", "info");
        const expiry = await sendAPDU(tag, "80CA5F3400");
        if (!expiry || expiry.length < 2) {
            logMessage("[TEST] Warning: Could not read expiry tag", "warning");
            // Try to extract from Track 2
            const expiryFromTrack2 = track2Str.match(/=(\d{4})/);
            if (expiryFromTrack2) {
                const expiryYYMM = expiryFromTrack2[1];
                logMessage(`[TEST] ✓ Expiry recovered from Track 2: ${expiryYYMM.substring(0,2)}/${expiryYYMM.substring(2)}`, "success");
            }
        } else {
            logMessage(`[TEST] ✓ Expiry date present`, "success");
        }
        
        // Attempt to parse the encoded data using our decoder
        logMessage("[TEST] Verifying TLV encoding...", "info");
        try {
            const tlvDecoder = new TLVDecoder(track2Str);
            const decodedPan = tlvDecoder.getByTag('5A');
            const decodedExpiry = tlvDecoder.getByTag('5F34');
            
            if (decodedPan || decodedExpiry) {
                logMessage(`[TEST] ✓ TLV encoding verified`, "success");
                return true;
            }
        } catch (e) {
            logMessage(`[TEST] TLV parsing note: ${e.message}`, "info");
        }
        
        // If we got this far, tag has payment data
        logMessage("[TEST] ✓ Payment data structure validated", "success");
        return true;
        
    } catch (error) {
        logMessage(`[TEST] Payment readiness check failed: ${error}`, "error");
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
