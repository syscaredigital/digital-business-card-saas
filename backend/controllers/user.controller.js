// Compatibility export: HTTP routes keep their names while domains own implementation.
module.exports = Object.assign({},
  require('./user/dashboard.controller'),
  require('./user/contacts.controller'),
  require('./user/orders.controller'),
  require('./user/nfc.controller'),
  require('./user/affiliates.controller'),
  require('./user/subscriptions.controller'),
  require('./user/notifications.controller'),
  require('./user/vcards.controller'),
  require('./user/account.controller'),
  require('./user/appointments.controller')
);
