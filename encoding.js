/**
 * NFC Encoding Library - Comprehensive TLV, NDEF, and EMV encoding utilities
 * Handles all encoding operations for NFC data transformation
 */

// ============================================================================
// TLV (Tag-Length-Value) Encoding/Decoding
// ============================================================================

class TLVEncoder {
    constructor() {
        this.data = new Uint8Array(0);
    }

    /**
     * Encode a TLV entry
     */
    encodeTLV(tag, value) {
        const tagByte = typeof tag === 'string' ? parseInt(tag, 16) : tag;
        const valueBytes = typeof value === 'string' ? this.hexToBytes(value) : new Uint8Array(value);
        const length = valueBytes.length;

        // Build TLV
        let tlv;
        if (length < 128) {
            tlv = new Uint8Array(2 + length);
            tlv[0] = tagByte;
            tlv[1] = length;
            tlv.set(valueBytes, 2);
        } else if (length < 256) {
            tlv = new Uint8Array(3 + length);
            tlv[0] = tagByte;
            tlv[1] = 0x81;
            tlv[2] = length;
            tlv.set(valueBytes, 3);
        } else {
            tlv = new Uint8Array(4 + length);
            tlv[0] = tagByte;
            tlv[1] = 0x82;
            tlv[2] = (length >> 8) & 0xFF;
            tlv[3] = length & 0xFF;
            tlv.set(valueBytes, 4);
        }

        this.data = this.concatUint8Arrays(this.data, tlv);
        return this;
    }

    /**
     * Get the encoded data
     */
    getBytes() {
        return this.data;
    }

    /**
     * Get as hex string
     */
    toHex() {
        return this.bytesToHex(this.data);
    }

    /**
     * Helper: Concatenate two Uint8Arrays
     */
    concatUint8Arrays(a, b) {
        const result = new Uint8Array(a.length + b.length);
        result.set(a, 0);
        result.set(b, a.length);
        return result;
    }

    /**
     * Helper: Convert hex string to bytes
     */
    hexToBytes(hex) {
        const bytes = new Uint8Array(hex.length / 2);
        for (let i = 0; i < hex.length; i += 2) {
            bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
        }
        return bytes;
    }

    /**
     * Helper: Convert bytes to hex string
     */
    bytesToHex(bytes) {
        return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    }
}

class TLVDecoder {
    constructor(data) {
        this.data = typeof data === 'string' ? this.hexToBytes(data) : new Uint8Array(data);
        this.offset = 0;
        this.entries = [];
        this.parse();
    }

    /**
     * Parse TLV data
     */
    parse() {
        this.offset = 0;
        this.entries = [];

        while (this.offset < this.data.length) {
            const tag = this.data[this.offset];
            this.offset++;

            if (this.offset >= this.data.length) break;

            let length = this.data[this.offset];
            this.offset++;

            if (length === 0x81 && this.offset < this.data.length) {
                length = this.data[this.offset];
                this.offset++;
            } else if (length === 0x82 && this.offset + 1 < this.data.length) {
                length = (this.data[this.offset] << 8) | this.data[this.offset + 1];
                this.offset += 2;
            }

            if (this.offset + length > this.data.length) break;

            const value = this.data.slice(this.offset, this.offset + length);
            this.offset += length;

            this.entries.push({
                tag: '0x' + tag.toString(16).padStart(2, '0').toUpperCase(),
                tagByte: tag,
                length: length,
                value: value,
                hex: this.bytesToHex(value)
            });
        }
    }

    /**
     * Get all entries
     */
    getEntries() {
        return this.entries;
    }

    /**
     * Get entry by tag
     */
    getByTag(tag) {
        const tagByte = typeof tag === 'string' ? parseInt(tag, 16) : tag;
        return this.entries.find(e => e.tagByte === tagByte);
    }

    /**
     * Helper: Convert hex string to bytes
     */
    hexToBytes(hex) {
        const bytes = new Uint8Array(hex.length / 2);
        for (let i = 0; i < hex.length; i += 2) {
            bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
        }
        return bytes;
    }

    /**
     * Helper: Convert bytes to hex string
     */
    bytesToHex(bytes) {
        return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    }
}

// ============================================================================
// NDEF (NFC Data Exchange Format) Encoding
// ============================================================================

class NDEFEncoder {
    /**
     * Create NDEF Text Record
     */
    static createTextRecord(text, lang = 'en') {
        const textBytes = new TextEncoder().encode(text);
        const langBytes = new TextEncoder().encode(lang);

        const payload = new Uint8Array(1 + langBytes.length + textBytes.length);
        payload[0] = langBytes.length; // Language length
        payload.set(langBytes, 1);
        payload.set(textBytes, 1 + langBytes.length);

        return this.createRecord('T', payload);
    }

    /**
     * Create NDEF URI Record
     */
    static createUriRecord(uri) {
        const uriBytes = new TextEncoder().encode(uri);
        const payload = new Uint8Array(1 + uriBytes.length);
        payload[0] = 0x00; // URI prefix (none)
        payload.set(uriBytes, 1);

        return this.createRecord('U', payload);
    }

    /**
     * Create NDEF Absolute URI Record
     */
    static createAbsoluteUriRecord(uri) {
        const uriBytes = new TextEncoder().encode(uri);
        return this.createRecord('urn:nfc:wkt:U', uriBytes);
    }

    /**
     * Create custom NDEF record
     */
    static createRecord(type, payload, id = null) {
        const typeBytes = new TextEncoder().encode(type);

        const record = {
            TNF: 0x01, // NFC Forum Well-Known Type
            type: typeBytes,
            id: id ? new TextEncoder().encode(id) : new Uint8Array(0),
            payload: new Uint8Array(payload)
        };

        return record;
    }

    /**
     * Encode NDEF records to bytes
     */
    static encodeRecords(records) {
        let encoded = new Uint8Array(0);

        records.forEach((record, index) => {
            const typeLength = record.type.length;
            const idLength = record.id ? record.id.length : 0;
            const payloadLength = record.payload.length;

            // Build header
            let header = 0xD0; // MB=1, ME=0, CF=0, SR=1, IL=0, TNF=0

            if (index === records.length - 1) {
                header |= 0x10; // ME=1 (Message End)
            }

            if (idLength > 0) {
                header |= 0x08; // IL=1 (ID present)
            }

            if (payloadLength < 256) {
                header |= 0x10; // SR=1 (Short Record)
            }

            const headerBytes = new Uint8Array([
                header,
                typeLength,
                payloadLength
            ]);

            let recordBytes = headerBytes;

            if (idLength > 0) {
                recordBytes = this.concatBytes(recordBytes, new Uint8Array([idLength]));
            }

            recordBytes = this.concatBytes(recordBytes, record.type);

            if (idLength > 0) {
                recordBytes = this.concatBytes(recordBytes, record.id);
            }

            recordBytes = this.concatBytes(recordBytes, record.payload);

            encoded = this.concatBytes(encoded, recordBytes);
        });

        return encoded;
    }

    /**
     * Helper: Concatenate bytes
     */
    static concatBytes(a, b) {
        const result = new Uint8Array(a.length + b.length);
        result.set(a, 0);
        result.set(b, a.length);
        return result;
    }
}

// ============================================================================
// EMV Track Data Encoding
// ============================================================================

class EMVEncoder {
    /**
     * Encode Track 2 equivalent data from card components
     * Format: PAN[D]YYMM[D]CVVXXXX
     */
    static encodeTrack2(pan, expiry, cvv = '000') {
        // Remove any non-digits
        pan = pan.replace(/\D/g, '');
        expiry = expiry.replace(/\D/g, '');
        cvv = cvv.replace(/\D/g, '').padStart(3, '0');

        // Ensure expiry is YYMM format
        if (expiry.length === 4 && expiry.startsWith('20')) {
            // If starts with 20 (e.g., 2025), convert to YY (e.g., 25)
            expiry = expiry.slice(2);
        }

        // Construct Track 2
        const track2 = `${pan}D${expiry}D${cvv}XXXX`;
        return track2;
    }

    /**
     * Encode Track 1 data from card components
     * Format: %B[PAN]^[CARDHOLDER]/[SURNAME]^[YYMM][CVV]XXXXXXXX?
     */
    static encodeTrack1(pan, expiry, cardholderName = 'CARDHOLDER') {
        pan = pan.replace(/\D/g, '');
        expiry = expiry.replace(/\D/g, '');

        // Ensure expiry is YYMM format
        if (expiry.length === 4 && expiry.startsWith('20')) {
            expiry = expiry.slice(2);
        }

        // Parse cardholder name
        const nameParts = cardholderName.split('/');
        const surname = nameParts[0] || 'CARDHOLDER';
        const firstName = nameParts[1] || '';

        // Construct Track 1
        const track1 = `%B${pan}^${surname}/${firstName}^${expiry}000XXXXXXXX?`;
        return track1;
    }

    /**
     * Parse Track 2 data
     */
    static parseTrack2(track2) {
        const pattern = /^(\d+)D(\d{4})D(\d{3})(.*)$/;
        const match = track2.match(pattern);

        if (!match) {
            return null;
        }

        return {
            pan: match[1],
            expiry: match[2],
            cvv: match[3],
            extra: match[4]
        };
    }
}

// ============================================================================
// Data Validation
// ============================================================================

class DataValidator {
    /**
     * Validate PAN (Luhn algorithm)
     */
    static validatePAN(pan) {
        pan = pan.replace(/\D/g, '');

        if (pan.length < 13 || pan.length > 19) {
            return false;
        }

        let sum = 0;
        let isEven = false;

        for (let i = pan.length - 1; i >= 0; i--) {
            let digit = parseInt(pan[i]);

            if (isEven) {
                digit *= 2;
                if (digit > 9) {
                    digit -= 9;
                }
            }

            sum += digit;
            isEven = !isEven;
        }

        return sum % 10 === 0;
    }

    /**
     * Validate expiry date
     */
    static validateExpiry(expiry) {
        const pattern = /^(0[1-9]|1[0-2])\/\d{2,4}$/;
        if (!pattern.test(expiry)) {
            return false;
        }

        const [month, year] = expiry.split('/');
        const fullYear = year.length === 2 ? parseInt('20' + year) : parseInt(year);
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1;

        if (fullYear < currentYear) {
            return false;
        }

        if (fullYear === currentYear && parseInt(month) < currentMonth) {
            return false;
        }

        return true;
    }

    /**
     * Validate CVV
     */
    static validateCVV(cvv) {
        const pattern = /^[0-9]{3,4}$/;
        return pattern.test(cvv.replace(/\D/g, ''));
    }

    /**
     * Check if data looks like valid card data
     */
    static validateCardData(cardData) {
        const errors = [];

        if (!this.validatePAN(cardData.pan)) {
            errors.push('Invalid PAN (failed Luhn check)');
        }

        if (!this.validateExpiry(cardData.expiry)) {
            errors.push('Invalid or expired expiry date');
        }

        if (cardData.cvv && !this.validateCVV(cardData.cvv)) {
            errors.push('Invalid CVV');
        }

        return {
            valid: errors.length === 0,
            errors: errors
        };
    }
}

// ============================================================================
// Hex Utilities
// ============================================================================

class HexUtils {
    /**
     * Convert hex string to byte array
     */
    static hexToBytes(hex) {
        const bytes = new Uint8Array(hex.length / 2);
        for (let i = 0; i < hex.length; i += 2) {
            bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
        }
        return bytes;
    }

    /**
     * Convert byte array to hex string
     */
    static bytesToHex(bytes) {
        return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    /**
     * Convert byte array to hex string with spaces
     */
    static bytesToHexSpaced(bytes) {
        return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join(' ');
    }

    /**
     * Convert string to hex
     */
    static stringToHex(str) {
        return Array.from(str).map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join('');
    }

    /**
     * Convert hex to string
     */
    static hexToString(hex) {
        let str = '';
        for (let i = 0; i < hex.length; i += 2) {
            str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
        }
        return str;
    }
}

// Export for global use
if (typeof window !== 'undefined') {
    window.TLVEncoder = TLVEncoder;
    window.TLVDecoder = TLVDecoder;
    window.NDEFEncoder = NDEFEncoder;
    window.EMVEncoder = EMVEncoder;
    window.DataValidator = DataValidator;
    window.HexUtils = HexUtils;
}
