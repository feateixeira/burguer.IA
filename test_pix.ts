
import { generatePixPayload } from './src/utils/pixQrCode';
import { normalizePhoneBRToE164 } from './src/utils/phoneNormalizer';

console.log('--- TEST: PIX Phone Payload ---');

const testCases = [
    { input: '(11) 99999-9999', description: 'Standard SP Cell' },
    { input: '11999999999', description: 'Plain Digits SP Cell' },
    { input: '+5511999999999', description: 'E164 with Plus' },
    { input: '5511999999999', description: 'E164 without Plus' },
];

testCases.forEach(({ input, description }) => {
    console.log(`\nCase: ${description}`);
    console.log(`Input: "${input}"`);

    // Simulate usage in PixPaymentModal
    let pixKey = input;
    // logic from modal
    if (!pixKey.startsWith('+')) {
        const normalized = normalizePhoneBRToE164(pixKey);
        if (normalized) {
            pixKey = `+${normalized}`;
            console.log(`Normalized to: "${pixKey}"`);
        } else {
            console.log('FAILED to normalize');
        }
    } else {
        console.log('Already starts with +, using as is');
    }

    try {
        const payload = generatePixPayload(pixKey, 'Test Merchant', 1.00);
        console.log('Payload generated successfully');

        // Extract Key from Payload (ID 26 -> ID 01)
        // ID 26 is Merchant Account Info
        // It starts with '0014br.gov.bcb.pix'
        // Then '01' + length + Key

        const maIndex = payload.indexOf('0014br.gov.bcb.pix');
        if (maIndex !== -1) {
            const rest = payload.substring(maIndex + 18); // 00 + 02 length + value
            if (rest.startsWith('01')) {
                const len = parseInt(rest.substring(2, 4));
                const keyInPayload = rest.substring(4, 4 + len);
                console.log(`Key inside Payload: "${keyInPayload}"`);

                if (keyInPayload.includes('+')) {
                    console.error('ERROR: Key in payload contains "+". This is invalid for PIX phones.');
                } else if (!keyInPayload.startsWith('55')) {
                    console.error('ERROR: Key in payload missing Country Code 55?');
                } else {
                    console.log('SUCCESS: Key format looks correct (55...)');
                }
            }
        }

    } catch (e: any) {
        console.error('ERROR generating payload:', e.message);
    }
});
