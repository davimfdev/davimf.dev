const { createClient } = require('@supabase/supabase-js');

try {
  const supabase = createClient('postgresql://postgres:pass@db.xyz.supabase.co:5432/postgres', 'fake-key');
  console.log("Success");
} catch (e) {
  console.error("Error:", e.message);
}