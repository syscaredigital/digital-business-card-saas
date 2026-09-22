const pool = require('../backend/config/database.config');
(async () => {
  const [columns,constraints,indexes,migrations,duplicates] = await Promise.all([
    pool.query("SELECT table_name,column_name,data_type,is_nullable,column_default FROM information_schema.columns WHERE table_schema=current_schema() ORDER BY table_name,ordinal_position"),
    pool.query("SELECT c.relname table_name,con.conname constraint_name,pg_get_constraintdef(con.oid) definition FROM pg_constraint con JOIN pg_class c ON c.oid=con.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=current_schema() ORDER BY c.relname,con.conname"),
    pool.query("SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname=current_schema() ORDER BY tablename,indexname"),
    pool.query('SELECT name,checksum,applied_at FROM schema_migrations ORDER BY name'),
    pool.query("SELECT payment_id,COUNT(*)::int count FROM transactions WHERE payment_id IS NOT NULL AND transaction_type='cash_payment' GROUP BY payment_id HAVING COUNT(*)>1")
  ]);
  console.log(JSON.stringify({generatedAt:new Date().toISOString(),columns:columns.rows,constraints:constraints.rows,indexes:indexes.rows,migrations:migrations.rows,duplicateManualTransactions:duplicates.rows},null,2));
})().catch(error=>{console.error(error.code || error.message);process.exitCode=1;}).finally(()=>pool.end());
