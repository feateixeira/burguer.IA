const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function getEstablishment() {
    const { data, error } = await supabase
        .from('establishments')
        .select('id')
        .limit(1);

    if (error) {
        console.error('ERROR:', error);
    } else if (data && data.length > 0) {
        console.log('ID:' + data[0].id);
    } else {
        console.log('NO_DATA');
    }
}

getEstablishment();
