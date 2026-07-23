/**
 * Comprehensive NFC Encoding Test Suite
 * Provides detailed verification and testing utilities
 */

class EncodingTestSuite {
    /**
     * Test TLV encoding and decoding
     */
    static testTLVEncoding() {
        const results = {
            passed: 0,
            failed: 0,
            tests: []
        };

        // Test 1: Simple tag encoding
        try {
            const encoder = new TLVEncoder();
            encoder.encodeTLV('9F1A', '0840'); // Terminal Country Code
            const hex = encoder.toHex();

            if (hex === '9f1a0840') {
                results.passed++;
                results.tests.push({ name: 'Simple TLV Encoding', status: 'PASS' });
            } else {
                throw new Error(`Expected 9f1a0840, got ${hex}`);
            }
        } catch (e) {
            results.failed++;
            results.tests.push({ name: 'Simple TLV Encoding', status: 'FAIL', error: e.message });
        }

        // Test 2: Multi-tag encoding
        try {
            const encoder = new TLVEncoder();
            encoder
                .encodeTLV('9F1A', '0840')
                .encodeTLV('9F33', '03022C3C');
            const hex = encoder.toHex();

            if (hex.includes('9f1a') && hex.includes('9f33')) {
                results.passed++;
                results.tests.push({ name: 'Multi-Tag TLV Encoding', status: 'PASS' });
            } else {
                throw new Error('Multi-tag encoding failed');
            }
        } catch (e) {
            results.failed++;
            results.tests.push({ name: 'Multi-Tag TLV Encoding', status: 'FAIL', error: e.message });
        }

        // Test 3: TLV Decoding
        try {
            const decoder = new TLVDecoder('9f1a02084095f33043022c3c');
            const entries = decoder.getEntries();

            if (entries.length >= 2 && entries[0].hex === '0840') {
                results.passed++;
                results.tests.push({ name: 'TLV Decoding', status: 'PASS' });
            } else {
                throw new Error('TLV decoding produced unexpected results');
            }
        } catch (e) {
            results.failed++;
            results.tests.push({ name: 'TLV Decoding', status: 'FAIL', error: e.message });
        }

        return results;
    }

    /**
     * Test NDEF encoding
     */
    static testNDEFEncoding() {
        const results = {
            passed: 0,
            failed: 0,
            tests: []
        };

        // Test 1: Text record creation
        try {
            const record = NDEFEncoder.createTextRecord('Hello World', 'en');

            if (record && record.TNF === 0x01 && record.payload.length > 0) {
                results.passed++;
                results.tests.push({ name: 'NDEF Text Record Creation', status: 'PASS' });
            } else {
                throw new Error('Text record creation failed');
            }
        } catch (e) {
            results.failed++;
            results.tests.push({ name: 'NDEF Text Record Creation', status: 'FAIL', error: e.message });
        }

        // Test 2: URI record creation
        try {
            const record = NDEFEncoder.createUriRecord('https://example.com');

            if (record && record.TNF === 0x01 && record.payload.length > 0) {
                results.passed++;
                results.tests.push({ name: 'NDEF URI Record Creation', status: 'PASS' });
            } else {
                throw new Error('URI record creation failed');
            }
        } catch (e) {
            results.failed++;
            results.tests.push({ name: 'NDEF URI Record Creation', status: 'FAIL', error: e.message });
        }

        // Test 3: Record encoding to bytes
        try {
            const record = NDEFEncoder.createTextRecord('Test', 'en');
            const encoded = NDEFEncoder.encodeRecords([record]);

            if (encoded && encoded.length > 0) {
                results.passed++;
                results.tests.push({ name: 'NDEF Record Encoding', status: 'PASS' });
            } else {
                throw new Error('Record encoding failed');
            }
        } catch (e) {
            results.failed++;
            results.tests.push({ name: 'NDEF Record Encoding', status: 'FAIL', error: e.message });
        }

        return results;
    }

    /**
     * Test EMV Track data encoding
     */
    static testEMVEncoding() {
        const results = {
            passed: 0,
            failed: 0,
            tests: []
        };

        // Test 1: Track 2 encoding
        try {
            const track2 = EMVEncoder.encodeTrack2('4111111111111111', '12/25', '123');

            if (track2 && track2.includes('4111111111111111') && track2.includes('D')) {
                results.passed++;
                results.tests.push({ name: 'EMV Track 2 Encoding', status: 'PASS', data: track2 });
            } else {
                throw new Error('Track 2 encoding failed');
            }
        } catch (e) {
            results.failed++;
            results.tests.push({ name: 'EMV Track 2 Encoding', status: 'FAIL', error: e.message });
        }

        // Test 2: Track 1 encoding
        try {
            const track1 = EMVEncoder.encodeTrack1('4111111111111111', '12/25', 'TESTER');

            if (track1 && track1.startsWith('%B') && track1.endsWith('?')) {
                results.passed++;
                results.tests.push({ name: 'EMV Track 1 Encoding', status: 'PASS' });
            } else {
                throw new Error('Track 1 encoding failed');
            }
        } catch (e) {
            results.failed++;
            results.tests.push({ name: 'EMV Track 1 Encoding', status: 'FAIL', error: e.message });
        }

        // Test 3: Track 2 parsing
        try {
            const track2 = '4111111111111111D2512D123XXXX';
            const parsed = EMVEncoder.parseTrack2(track2);

            if (parsed && parsed.pan === '4111111111111111' && parsed.expiry === '2512') {
                results.passed++;
                results.tests.push({ name: 'EMV Track 2 Parsing', status: 'PASS' });
            } else {
                throw new Error('Track 2 parsing failed');
            }
        } catch (e) {
            results.failed++;
            results.tests.push({ name: 'EMV Track 2 Parsing', status: 'FAIL', error: e.message });
        }

        return results;
    }

    /**
     * Test data validation
     */
    static testDataValidation() {
        const results = {
            passed: 0,
            failed: 0,
            tests: []
        };

        // Test 1: Valid PAN (Luhn check)
        try {
            const isValid = DataValidator.validatePAN('4111111111111111');

            if (isValid) {
                results.passed++;
                results.tests.push({ name: 'PAN Validation (Valid Card)', status: 'PASS' });
            } else {
                throw new Error('Valid PAN failed validation');
            }
        } catch (e) {
            results.failed++;
            results.tests.push({ name: 'PAN Validation (Valid Card)', status: 'FAIL', error: e.message });
        }

        // Test 2: Invalid PAN
        try {
            const isValid = DataValidator.validatePAN('4111111111111112');

            if (!isValid) {
                results.passed++;
                results.tests.push({ name: 'PAN Validation (Invalid Card)', status: 'PASS' });
            } else {
                throw new Error('Invalid PAN passed validation');
            }
        } catch (e) {
            results.failed++;
            results.tests.push({ name: 'PAN Validation (Invalid Card)', status: 'FAIL', error: e.message });
        }

        // Test 3: Expiry validation
        try {
            const futureDate = `12/2${new Date().getFullYear().toString().slice(2)}`;
            const isValid = DataValidator.validateExpiry(futureDate);

            if (isValid) {
                results.passed++;
                results.tests.push({ name: 'Expiry Validation', status: 'PASS' });
            } else {
                throw new Error('Valid expiry failed validation');
            }
        } catch (e) {
            results.failed++;
            results.tests.push({ name: 'Expiry Validation', status: 'FAIL', error: e.message });
        }

        // Test 4: CVV validation
        try {
            const isValid = DataValidator.validateCVV('123');

            if (isValid) {
                results.passed++;
                results.tests.push({ name: 'CVV Validation', status: 'PASS' });
            } else {
                throw new Error('Valid CVV failed validation');
            }
        } catch (e) {
            results.failed++;
            results.tests.push({ name: 'CVV Validation', status: 'FAIL', error: e.message });
        }

        // Test 5: Complete card data validation
        try {
            const cardData = {
                pan: '4111111111111111',
                expiry: '12/26',
                cvv: '123'
            };
            const validation = DataValidator.validateCardData(cardData);

            if (validation.valid) {
                results.passed++;
                results.tests.push({ name: 'Complete Card Data Validation', status: 'PASS' });
            } else {
                throw new Error(`Card validation failed: ${validation.errors.join(', ')}`);
            }
        } catch (e) {
            results.failed++;
            results.tests.push({ name: 'Complete Card Data Validation', status: 'FAIL', error: e.message });
        }

        return results;
    }

    /**
     * Test hex utilities
     */
    static testHexUtils() {
        const results = {
            passed: 0,
            failed: 0,
            tests: []
        };

        // Test 1: Hex to bytes
        try {
            const bytes = HexUtils.hexToBytes('48656C6C6F');
            const hex = HexUtils.bytesToHex(bytes);

            if (hex.toLowerCase() === '48656c6c6f') {
                results.passed++;
                results.tests.push({ name: 'Hex to Bytes and Back', status: 'PASS' });
            } else {
                throw new Error('Hex conversion failed');
            }
        } catch (e) {
            results.failed++;
            results.tests.push({ name: 'Hex to Bytes and Back', status: 'FAIL', error: e.message });
        }

        // Test 2: String to hex
        try {
            const hex = HexUtils.stringToHex('Hello');

            if (hex.toLowerCase() === '48656c6c6f') {
                results.passed++;
                results.tests.push({ name: 'String to Hex', status: 'PASS' });
            } else {
                throw new Error('String to hex conversion failed');
            }
        } catch (e) {
            results.failed++;
            results.tests.push({ name: 'String to Hex', status: 'FAIL', error: e.message });
        }

        // Test 3: Hex to string
        try {
            const str = HexUtils.hexToString('48656c6c6f');

            if (str === 'Hello') {
                results.passed++;
                results.tests.push({ name: 'Hex to String', status: 'PASS' });
            } else {
                throw new Error('Hex to string conversion failed');
            }
        } catch (e) {
            results.failed++;
            results.tests.push({ name: 'Hex to String', status: 'FAIL', error: e.message });
        }

        return results;
    }

    /**
     * Run all tests
     */
    static runAllTests() {
        const allResults = {
            timestamp: new Date().toISOString(),
            totalTests: 0,
            totalPassed: 0,
            totalFailed: 0,
            categories: {
                tlv: this.testTLVEncoding(),
                ndef: this.testNDEFEncoding(),
                emv: this.testEMVEncoding(),
                validation: this.testDataValidation(),
                hex: this.testHexUtils()
            }
        };

        // Calculate totals
        Object.values(allResults.categories).forEach(category => {
            allResults.totalTests += category.passed + category.failed;
            allResults.totalPassed += category.passed;
            allResults.totalFailed += category.failed;
        });

        return allResults;
    }

    /**
     * Get test report as formatted string
     */
    static getTestReport(results) {
        let report = '\n=== NFC ENCODING TEST REPORT ===\n';
        report += `Timestamp: ${results.timestamp}\n`;
        report += `Total Tests: ${results.totalTests}\n`;
        report += `Passed: ${results.totalPassed} ✓\n`;
        report += `Failed: ${results.totalFailed} ✗\n`;
        report += `Success Rate: ${((results.totalPassed / results.totalTests) * 100).toFixed(2)}%\n\n`;

        Object.entries(results.categories).forEach(([category, categoryResults]) => {
            report += `\n[${category.toUpperCase()}]\n`;
            report += `  Passed: ${categoryResults.passed}, Failed: ${categoryResults.failed}\n`;
            categoryResults.tests.forEach(test => {
                const status = test.status === 'PASS' ? '✓' : '✗';
                report += `  ${status} ${test.name}`;
                if (test.error) {
                    report += ` - ${test.error}`;
                }
                report += '\n';
            });
        });

        return report;
    }
}

// Export for global use
if (typeof window !== 'undefined') {
    window.EncodingTestSuite = EncodingTestSuite;
}
