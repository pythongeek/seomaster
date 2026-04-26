// Supabase compatibility layer — now powered by Neon PostgreSQL
// If you were using Supabase, you can swap back by installing @supabase/supabase-js
// and using createClient. This version uses Neon (free serverless PostgreSQL).

export { sql, checkConnection } from './database';
export { query } from './database';
