const { createClient } = require('@supabase/supabase-js');

const supabaseUrl =
	process.env.SUPABASE_URL || 'https://lhhnpfxbpoecsuvmdxux.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseServiceKey) {
	console.error('❌ SUPABASE_ANON_KEY environment variable is required');
	process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

module.exports = supabase;
