// Compatibility entry point: all migrations use the checksum ledger.
require('../database/migrate').runCli();
