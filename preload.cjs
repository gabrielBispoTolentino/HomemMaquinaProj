const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '.env') });

window.__ENV__ = {
  VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL || '',
  VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY || '',
};
