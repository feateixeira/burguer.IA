
// Mock of src/utils/phoneNormalizer.ts
function normalizePhoneBRToE164(phone: string): string {
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

// Mock of src/utils/pixQrCode.ts
const generatePixPayload = (key: string, name: string, amount: number): string => {
    if (!key || !key.trim()) {
        throw new Error('Chave PIX não pode estar vazia');
    }

    // Sanitizar nome (máximo 25 caracteres, apenas alfanuméricos e espaços)
    const sanitizedName = name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove acentos
        .replace(/[^a-zA-Z0-9\s]/g, '') // Remove caracteres especiais
        .slice(0, 25)
        .trim()
        .toUpperCase();

    if (!sanitizedName) {
        throw new Error('Nome do estabelecimento inválido');
    }

    if (amount <= 0 || amount > 999999.99) {
        throw new Error('Valor inválido');
    }

    const amountStr = amount.toFixed(2);
    let cleanKey = key.trim();
    if (cleanKey.startsWith('+')) {
        cleanKey = cleanKey.substring(1);
    }

    if (!cleanKey) {
        throw new Error('Chave PIX inválida após normalização');
    }

    const tag = (id: string, value: string) => `${id}${value.length.toString().padStart(2, '0')}${value}`;

    const gui = tag('00', 'br.gov.bcb.pix');
    const keyField = tag('01', cleanKey);
    const mai = tag('26', `${gui}${keyField}`);
    const additional = tag('62', tag('05', '***'));

    const payloadNoCRC = [
        tag('00', '01'),
        tag('01', '11'),
        mai,
        tag('52', '0000'),
        tag('53', '986'),
        tag('54', amountStr),
        tag('58', 'BR'),
        tag('59', sanitizedName),
        tag('60', 'SAO PAULO'),
        additional,
        '6304',
    ].join('');

    const crc16 = (str: string) => {
        let crc = 0xffff;
        for (let i = 0; i < str.length; i++) {
            crc ^= str.charCodeAt(i) << 8;
            for (let j = 0; j < 8; j++) {
                if ((crc & 0x8000) !== 0) crc = (crc << 1) ^ 0x1021;
                else crc <<= 1;
                crc &= 0xffff;
            }
        }
        return crc.toString(16).toUpperCase().padStart(4, '0');
    };

    const crc = crc16(payloadNoCRC);
    return payloadNoCRC + crc;
};

// --- SIMULATION ---

const runTest = (inputType: string, inputValue: string, holderName: string) => {
    console.log(`Testing: Type=[${inputType}] Value=[${inputValue}] Name=[${holderName}]`);
    try {
        let normalizedPixKey = inputValue;
        const type = inputType?.toLowerCase().trim() || '';

        // Exact logic from my fix
        if (['phone', 'celular', 'telefone', 'tel'].includes(type) && normalizedPixKey) {
            const normalized = normalizePhoneBRToE164(normalizedPixKey);
            if (normalized) {
                normalizedPixKey = `+${normalized}`;
                console.log(` Normalized -> ${normalizedPixKey}`);
            } else {
                console.log(` Normalization returned empty!`);
            }
        } else {
            console.log(` Skipping normalization (Type mismatch or empty)`);
        }

        const payload = generatePixPayload(normalizedPixKey, holderName, 10.00);
        console.log(" SUCCESS: Payload generated.");
        console.log(" Payload Preview: " + payload.substring(0, 50) + "...");

    } catch (e: any) {
        console.error(" CRASHED: " + e.message);
    }
    console.log("-".repeat(20));
}

// Cases
runTest('phone', '61999133181', 'Na Brasa'); // Should pass
runTest('celular', '61999133181', 'Na Brasa'); // Should pass
runTest('phone', '61999133181', 'Na Brasa 🔥'); // Emojis?
runTest('phone', '61999133181', '@@@'); // Special chars only? -> Should FAIL name
runTest('phone', '', 'Na Brasa'); // Empty key -> Should FAIL key
runTest('phone', '   ', 'Na Brasa'); // Spaced key -> Should FAIL key
runTest('phone', 'invalid', 'Na Brasa'); // Invalid phone?
