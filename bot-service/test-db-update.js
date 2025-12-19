require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function testUpdate() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

    // Hardcoded ID from logs/previous context or fetch dynamic
    const establishmentId = '3fd00c89-361b-4aa1-b3c2-b638840b8c53';

    console.log('Testing update for Establishment:', establishmentId);
    console.log('Using Key type:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SERVICE_ROLE' : 'ANON');

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data, error } = await supabase
        .from('establishments')
        .update({ whatsapp_status: 'testing_write' })
        .eq('id', establishmentId)
        .select();

    if (error) {
        console.error('Update FAILED:', error);
    } else {
        console.log('Update SUCCESS:', data);
    }
}

testUpdate();
