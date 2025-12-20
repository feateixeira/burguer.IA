
// Mock logic fro normalizePhoneBRToE164 based on src/utils/phoneNormalizer.ts
function normalizePhoneBRToE164(phone) {
    if (!phone) return '';
    let digits = phone.replace(/\D/g, '');
    if (!digits) return '';
    while (digits.startsWith('0') && digits.length > 1) {
        digits = digits.substring(1);
    }
    if (digits.startsWith('55')) {
        if (digits.length === 13 || digits.length === 14) return digits;
        if (digits.length === 12) return digits.substring(0, 4) + '9' + digits.substring(4);
        if (digits.length === 11) {
            if (digits.substring(2, 3) !== '9') return digits.substring(0, 4) + '9' + digits.substring(4);
            return digits;
        }
        return digits.substring(0, 14);
    }
    if (digits.length === 10) return '55' + digits;
    if (digits.length === 11) {
        if (digits[2] === '9') return '55' + digits;
        else return '55' + digits;
    }
    if (digits.length >= 8 && digits.length <= 9) {
        if (digits.length === 8) return '55119' + digits;
        return '5511' + digits;
    }
    if (digits.length >= 10) return '55' + digits;
    return '';
}

const testKeys = [
    { type: 'phone', value: '61999133181' }, // User case
    { type: 'phone', value: '+5561993709608' }, // Working case
    { type: 'random', value: '+5561999098562' }, // Weird case
    { type: 'celular', value: '(11) 99999-9999' } // Variation
];

console.log('--- Testing Normalization ---');

testKeys.forEach(t => {
    let normalizedPixKey = t.value;
    const type = t.type.toLowerCase();

    console.log(`\nOriginal: [${type}] ${normalizedPixKey}`);

    if (['phone', 'celular', 'telefone', 'tel'].includes(type)) {
        if (!normalizedPixKey.startsWith('+')) {
            const norm = normalizePhoneBRToE164(normalizedPixKey);
            console.log(`  -> normalizePhoneBRToE164 returns: "${norm}"`);
            if (norm) {
                normalizedPixKey = `+${norm}`;
            }
        } else {
            console.log(`  -> Already starts with +, skipping norm.`);
        }
    } else {
        console.log(`  -> Type not in list, skipping norm.`);
    }

    console.log(`  -> Final Key: ${normalizedPixKey}`);

    // Simulate payload Gen
    let cleanKey = normalizedPixKey.trim();
    if (cleanKey.startsWith('+')) cleanKey = cleanKey.substring(1);
    console.log(`  -> Payload Gen Key: ${cleanKey}`);

    if (cleanKey === '5561999133181') console.log('  -> MATCHES EXPECTED for 61999133181');
});
