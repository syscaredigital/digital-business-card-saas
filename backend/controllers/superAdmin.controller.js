// Stable route exports; implementation is grouped by business domain.
module.exports = Object.assign({},
  require('./super-admin/dashboard.controller'),
  require('./super-admin/users.controller'),
  require('./super-admin/vcards.controller'),
  require('./super-admin/nfc.controller'),
  require('./super-admin/subscriptions.controller'),
  require('./super-admin/payments.controller'),
  require('./super-admin/transactions.controller'),
  require('./super-admin/payouts.controller'),
  require('./super-admin/withdrawals.controller'),
  require('./super-admin/affiliates.controller'),
  require('./super-admin/coupons.controller'),
  require('./super-admin/analytics.controller'),
  require('./super-admin/reports.controller'),
  require('./super-admin/settings.controller'),
  require('./super-admin/logs.controller')
);
