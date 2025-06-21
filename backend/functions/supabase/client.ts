import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lhhnpfxbpoecsuvmdxux.supabase.co';
const supabaseKey =
	process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;

if (!supabaseKey) {
	throw new Error(
		'Missing Supabase key. Please set NEXT_PUBLIC_SUPABASE_ANON_KEY or SUPABASE_KEY environment variable.'
	);
}

const supabase = createClient(supabaseUrl, supabaseKey);

export default supabase;
