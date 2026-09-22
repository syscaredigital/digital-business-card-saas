const { runCli } = require('./migrate');
const action = process.argv[2];
if (!['migrate','seed','setup'].includes(action)) {
  console.error('Usage: node database/run-db.js [migrate|seed|setup]');
  process.exitCode=1;
} else {
  // Seeding uses the minimal idempotent registration seed, not sample business data.
  runCli(action==='setup' ? ['--seed'] : action==='seed' ? ['--verify','--seed'] : []);
}
