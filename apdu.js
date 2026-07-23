// APDU Command Tool
let apduReader;
let apduHistory = [];

// Load history from storage
loadAPDUHistory();

// Preset Buttons
document.querySelectorAll(".preset-btn").forEach(button => {
    button.addEventListener("click", () => {
        const command = button.dataset.command;
        document.getElementById("apduCommand").value = command;
        document.getElementById("apduDescription").value = button.textContent.trim();
    });
});

// Send APDU Button
document.getElementById("sendApduBtn").addEventListener("click", sendAPDUCommand);

// Clear Button
document.getElementById("clearApduBtn").addEventListener("click", () => {
    document.getElementById("apduCommand").value = "";
    document.getElementById("apduDescription").value = "";
    document.getElementById("apduResponse").innerHTML = '<p class="apdu-placeholder">No response yet. Send a command to see results.</p>';
});

// Clear History Button
document.getElementById("clearHistoryBtn").addEventListener("click", () => {
    apduHistory = [];
    updateAPDUHistory();
    saveAPDUHistory();
});

// Cancel APDU Button
document.getElementById("cancelApduBtn").addEventListener("click", cancelAPDU);

// Send APDU Command
function sendAPDUCommand() {
    const command = document.getElementById("apduCommand").value.trim();
    const description = document.getElementById("apduDescription").value.trim();
    
    if (!command) {
        showToast("Please enter an APDU command.", "error");
        return;
    }
    
    if (!('NDEFReader' in window)) {
        showToast("WebNFC not supported in this browser.", "error");
        return;
    }
    
    showAPDUModal("Sending APDU Command...");
    updateAPDUProgress(10);
    
    apduReader = new NDEFReader();
    apduReader.scan()
        .then(() => {
            updateAPDUProgress(30);
            logMessage(`[APDU] Waiting for tag... Command: ${command}`, "apdu");
            
            apduReader.onreading = async (event) => {
                const tag = event.tag;
                updateAPDUProgress(50);
                logMessage(`[APDU] Tag detected (UID: ${arrayToHex(tag.id)})`, "apdu");
                
                try {
                    // Send APDU command
                    updateAPDUProgress(70);
                    const response = await sendAPDU(tag, command);
                    
                    // Process response
                    updateAPDUProgress(90);
                    const responseHex = arrayToHex(response);
                    const sw1 = response[response.length - 2].toString(16).padStart(2, '0');
                    const sw2 = response[response.length - 1].toString(16).padStart(2, '0');
                    const status = getAPDUStatus(sw1, sw2);
                    
                    // Display response
                    displayAPDUResponse(command, description, responseHex, sw1, sw2, status);
                    
                    // Add to history
                    apduHistory.unshift({
                        command,
                        description,
                        response: responseHex,
                        sw1,
                        sw2,
                        status,
                        timestamp: new Date().toISOString()
                    });
                    updateAPDUHistory();
                    saveAPDUHistory();
                    
                    updateAPDUProgress(100);
                    hideAPDUModal();
                    apduReader.stopScan();
                } catch (error) {
                    displayAPDUResponse(command, description, null, null, null, `Error: ${error}`);
                    hideAPDUModal();
                    apduReader.stopScan();
                }
            };
        })
        .catch((error) => {
            showToast(`Scan error: ${error}`, "error");
            hideAPDUModal();
        });
}

function cancelAPDU() {
    if (apduReader) {
        apduReader.stopScan();
    }
    hideAPDUModal();
}

function showAPDUModal(message) {
    const modal = document.getElementById("nfcModal");
    const modalText = document.getElementById("nfcModalText");
    modalText.textContent = message;
    modal.style.display = "flex";
    document.getElementById("nfcProgress").style.width = "0%";
}

function hideAPDUModal() {
    document.getElementById("nfcModal").style.display = "none";
}

function updateAPDUProgress(percent) {
    document.getElementById("nfcProgress").style.width = `${percent}%`;
}

// Send APDU command to tag
async function sendAPDU(tag, apduHex) {
    const apdu = hexToBytes(apduHex);
    const response = await tag.transceive(apdu);
    if (response.length < 2) {
        throw new Error(`APDU ${apduHex} failed (no response)`);
    }
    return response;
}

// Display APDU response
function displayAPDUResponse(command, description, responseHex, sw1, sw2, status) {
    const responseContainer = document.getElementById("apduResponse");
    
    if (responseHex) {
        responseContainer.innerHTML = `
            <div class="apdu-response-item">
                <strong>Command:</strong> <code>${command}</code>
                ${description ? `<br><strong>Description:</strong> ${description}` : ''}
            </div>
            <div class="apdu-response-item">
                <strong>Response:</strong> <code>${responseHex}</code>
            </div>
            <div class="apdu-response-item">
                <strong>SW1/SW2:</strong> <code>${sw1} ${sw2}</code>
            </div>
            <div class="apdu-response-item">
                <strong>Status:</strong> <span style="color: ${status.includes('Success') ? 'var(--success-color)' : status.includes('Error') ? 'var(--error-color)' : 'var(--warning-color)'};">${status}</span>
            </div>
        `;
    } else {
        responseContainer.innerHTML = `
            <div class="apdu-response-item" style="color: var(--error-color);">
                <strong>Error:</strong> ${status}
            </div>
        `;
    }
}

// Update APDU history
function updateAPDUHistory() {
    const historyContainer = document.getElementById("apduHistory");
    
    if (apduHistory.length === 0) {
        historyContainer.innerHTML = '<p class="apdu-placeholder">No commands sent yet.</p>';
        return;
    }
    
    historyContainer.innerHTML = apduHistory.map(item => `
        <div class="apdu-history-item">
            <div class="command">
                <strong>${item.description || item.command}</strong>
                <span style="float: right; font-size: 10px; color: var(--text-info);">${new Date(item.timestamp).toLocaleTimeString()}</span>
            </div>
            <div class="response">
                <code>${item.command}</code><br>
                <strong>Response:</strong> <code>${item.response || 'Error'}</code><br>
                <strong>Status:</strong> <span style="color: ${item.status.includes('Success') ? 'var(--success-color)' : item.status.includes('Error') ? 'var(--error-color)' : 'var(--warning-color)'};">${item.status}</span>
            </div>
        </div>
    `).join('');
}

// Save APDU history to localStorage
function saveAPDUHistory() {
    localStorage.setItem('apduHistory', JSON.stringify(apduHistory));
}

// Load APDU history from localStorage
function loadAPDUHistory() {
    const history = localStorage.getItem('apduHistory');
    if (history) {
        apduHistory = JSON.parse(history);
        updateAPDUHistory();
    }
}

// Get APDU status from SW1/SW2
function getAPDUStatus(sw1, sw2) {
    const statusMap = {
        '9000': 'Success - Command executed successfully',
        '6a82': 'Error - File not found',
        '6a81': 'Error - Function not supported',
        '6a86': 'Error - Incorrect P1/P2 parameters',
        '6985': 'Error - Conditions not satisfied (tag locked)',
        '6300': 'Error - Verification failed',
        '6a88': 'Error - Data not found',
        '6a84': 'Error - Not enough memory',
        '6a80': 'Error - Incorrect data',
        '6e00': 'Error - Class not supported'
    };
    
    const key = (sw1 + sw2).toLowerCase();
    return statusMap[key] || `Unknown status: ${sw1} ${sw2}`;
}

// Helper: Hex to Bytes
function hexToBytes(hex) {
    return new Uint8Array(hex.match(/.{1,2}/g).map(h => parseInt(h, 16)));
}

// Helper: Array to Hex
function arrayToHex(arr) {
    return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join(' ');
}
