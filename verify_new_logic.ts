
import { generatePixPayload } from './src/utils/pixQrCode';

console.log('--- Verifying New PIX Implementation ---');

const cases = [
    { key: '61999133181', name: 'Na Brasa', amount: 10, desc: 'Phone No Prefix' },
    { key: '+5561993709608', name: 'Standard', amount: 50.50, desc: 'Standard E164' },
    { key: 'random@key.com', name: 'Email Key', amount: 100, desc: 'Email' },
    { key: '12345678909', name: 'CPF Multi', amount: 12.00, desc: 'CPF' },
    { key: '61999133181', name: '@@@ Invalid Name', amount: 10, desc: 'Invalid Name Fallback' },
    { key: '11999999999', name: 'SP Phone', amount: 1, desc: 'SP Phone No 55' }
];

cases.forEach(c => {
    try {
        console.log(`\nCase: ${c.desc}`);
        const payload = generatePixPayload(c.key, c.name, c.amount);
        console.log(`Payload: ${payload.substring(0, 60)}...`);
        console.log('SUCCESS ✅');

        // Basic Checks
        if (!payload.includes('br.gov.bcb.pix')) console.error('FAIL: Missing GUI');
        if (c.desc === 'Invalid Name Fallback' && !payload.includes('ESTABELECIMENTO')) console.error('FAIL: Fallback Name not used');
        if ((c.desc === 'Phone No Prefix' || c.desc === 'SP Phone No 55') && !payload.includes('5561') && !payload.includes('5511')) console.error('FAIL: Phone country code not added');

    } catch (e: any) {
        console.error(`CRASH ❌: ${e.message}`);
    }
});
