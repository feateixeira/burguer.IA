const fetch = require('node-fetch');

async function testConnection() {
    const establishmentId = '3fd00c89-361b-4aa1-b3c2-b638840b8c53';
    console.log('Testing connection for:', establishmentId);

    try {
        console.log('Sending request to http://localhost:3000/sessions/start...');
        const response = await fetch('http://localhost:3000/sessions/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ establishmentId })
        });

        console.log('Response status:', response.status);
        const data = await response.json();
        console.log('Response data:', data);
    } catch (error) {
        console.error('Connection failed:', error);
    }
}

testConnection();
