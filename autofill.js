// Auto-fill functionality
let autoFillEnabled = false;

// Toggle auto-fill
function toggleAutoFill(enable) {
    if (enable === undefined) {
        autoFillEnabled = !autoFillEnabled;
    } else {
        autoFillEnabled = enable;
    }
    
    const status = autoFillEnabled ? "ENABLED" : "DISABLED";
    logMessage(`[AUTOFILL] Status: ${status}`, autoFillEnabled ? "success" : "warning");

    if (autoFillEnabled) {
        document.addEventListener("focusin", handleFocusIn);
        logMessage("[AUTOFILL] Listening for payment form fields...", "info");
    } else {
        document.removeEventListener("focusin", handleFocusIn);
    }
}

// Handle focus on payment form fields
async function handleFocusIn(event) {
    if (!autoFillEnabled) return;

    const field = event.target;
    if (!isPaymentFormField(field)) return;

    const cards = await loadAllCards();
    if (cards.length === 0) {
        logMessage("[AUTOFILL] No cloned cards found.", "warning");
        return;
    }

    // Use the most recent card
    const card = cards[cards.length - 1];
    logMessage(`[AUTOFILL] Auto-filling with card (PAN: ${maskPAN(card.pan)})`, "info");
    autoFillField(field, card);
}

// Check if element is a payment form field
function isPaymentFormField(element) {
    if (!(element instanceof HTMLInputElement)) return false;

    const paymentKeywords = [
        "card", "cc", "credit", "debit", "pan",
        "cvc", "cv2", "cid", "expiry", "exp",
        "number", "cardnumber", "card_number"
    ];

    const value = element.name?.toLowerCase() ||
                  element.id?.toLowerCase() ||
                  element.placeholder?.toLowerCase() ||
                  element.className?.toLowerCase() ||
                  element.autocomplete?.toLowerCase() ||
                  "";

    return paymentKeywords.some(keyword => value.includes(keyword));
}

// Auto-fill a field
function autoFillField(field, cardData) {
    const fieldName = field.name?.toLowerCase() ||
                      field.id?.toLowerCase() ||
                      field.placeholder?.toLowerCase() ||
                      "";

    if (fieldName.includes("card") || fieldName.includes("pan") || fieldName.includes("number")) {
        field.value = cardData.pan || "";
    } else if (fieldName.includes("expiry") || fieldName.includes("exp")) {
        field.value = cardData.expiry || "";
    } else if (fieldName.includes("cvc") || fieldName.includes("cv2") || fieldName.includes("cid")) {
        field.value = cardData.cvc || "123"; // Default CVC
    }
}

// Mask PAN for display
function maskPAN(pan) {
    if (!pan || pan.length < 4) return pan;
    return pan.slice(0, 4) + "****" + pan.slice(-4);
}
