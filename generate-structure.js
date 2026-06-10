const fs = require("fs");
const path = require("path");

const files = [
  ".env",".env.example",".gitignore","package.json","README.md","docker-compose.yml",

  "frontend/public/index.html",
  "frontend/public/assets/css/bootstrap.min.css",
  "frontend/public/assets/css/main.css",
  "frontend/public/assets/css/dashboard.css",
  "frontend/public/assets/css/vcard.css",
  "frontend/public/assets/css/auth.css",
  "frontend/public/assets/css/responsive.css",

  "frontend/public/assets/js/bootstrap.bundle.min.js",
  "frontend/public/assets/js/main.js",
  "frontend/public/assets/js/auth.js",
  "frontend/public/assets/js/dashboard.js",
  "frontend/public/assets/js/vcard.js",
  "frontend/public/assets/js/payment.js",
  "frontend/public/assets/js/nfc.js",
  "frontend/public/assets/js/validation.js",

  "frontend/pages/website/home.html",
  "frontend/pages/website/pricing.html",
  "frontend/pages/website/nfc-cards.html",
  "frontend/pages/website/templates.html",
  "frontend/pages/website/about.html",
  "frontend/pages/website/contact.html",

  "frontend/pages/auth/login.html",
  "frontend/pages/auth/register.html",
  "frontend/pages/auth/forgot-password.html",
  "frontend/pages/auth/reset-password.html",

  "frontend/pages/super-admin/dashboard.html",
  "frontend/pages/super-admin/companies.html",
  "frontend/pages/super-admin/users.html",
  "frontend/pages/super-admin/plans.html",
  "frontend/pages/super-admin/subscriptions.html",
  "frontend/pages/super-admin/payments.html",
  "frontend/pages/super-admin/nfc-orders.html",
  "frontend/pages/super-admin/templates.html",
  "frontend/pages/super-admin/reports.html",
  "frontend/pages/super-admin/settings.html",

  "frontend/pages/company-admin/dashboard.html",
  "frontend/pages/company-admin/employees.html",
  "frontend/pages/company-admin/vcards.html",
  "frontend/pages/company-admin/create-vcard.html",
  "frontend/pages/company-admin/edit-vcard.html",
  "frontend/pages/company-admin/payments.html",
  "frontend/pages/company-admin/nfc-orders.html",
  "frontend/pages/company-admin/analytics.html",
  "frontend/pages/company-admin/settings.html",

  "frontend/pages/user/dashboard.html",
  "frontend/pages/user/my-vcard.html",
  "frontend/pages/user/edit-vcard.html",
  "frontend/pages/user/qr-code.html",
  "frontend/pages/user/nfc-request.html",
  "frontend/pages/user/payments.html",
  "frontend/pages/user/settings.html",

  "frontend/pages/public-vcard/template-one.html",
  "frontend/pages/public-vcard/template-two.html",
  "frontend/pages/public-vcard/template-three.html",
  "frontend/pages/public-vcard/profile.html",

  "frontend/components/navbar.html",
  "frontend/components/sidebar.html",
  "frontend/components/footer.html",
  "frontend/components/modals.html",
  "frontend/components/alerts.html",

  "frontend/layouts/website-layout.html",
  "frontend/layouts/admin-layout.html",
  "frontend/layouts/user-layout.html",

  "backend/server.js",
  "backend/app.js",

  "backend/routes/auth.routes.js",
  "backend/routes/super-admin.routes.js",
  "backend/routes/company-admin.routes.js",
  "backend/routes/user.routes.js",
  "backend/routes/company.routes.js",
  "backend/routes/vcard.routes.js",
  "backend/routes/template.routes.js",
  "backend/routes/nfc.routes.js",
  "backend/routes/payment.routes.js",
  "backend/routes/subscription.routes.js",
  "backend/routes/analytics.routes.js",
  "backend/routes/public.routes.js",

  "backend/controllers/auth.controller.js",
  "backend/controllers/superAdmin.controller.js",
  "backend/controllers/companyAdmin.controller.js",
  "backend/controllers/user.controller.js",
  "backend/controllers/company.controller.js",
  "backend/controllers/vcard.controller.js",
  "backend/controllers/template.controller.js",
  "backend/controllers/nfc.controller.js",
  "backend/controllers/payment.controller.js",
  "backend/controllers/subscription.controller.js",
  "backend/controllers/analytics.controller.js",
  "backend/controllers/public.controller.js",

  "backend/models/User.js",
  "backend/models/Company.js",
  "backend/models/Role.js",
  "backend/models/Permission.js",
  "backend/models/Plan.js",
  "backend/models/Subscription.js",
  "backend/models/VCard.js",
  "backend/models/VCardTemplate.js",
  "backend/models/NFCOrder.js",
  "backend/models/Payment.js",
  "backend/models/Invoice.js",
  "backend/models/QRCode.js",
  "backend/models/ActivityLog.js",
  "backend/models/Notification.js",

  "backend/middlewares/auth.middleware.js",
  "backend/middlewares/role.middleware.js",
  "backend/middlewares/tenant.middleware.js",
  "backend/middlewares/subscription.middleware.js",
  "backend/middlewares/upload.middleware.js",
  "backend/middlewares/validation.middleware.js",
  "backend/middlewares/error.middleware.js",

  "backend/services/auth.service.js",
  "backend/services/email.service.js",
  "backend/services/qr.service.js",
  "backend/services/nfc.service.js",
  "backend/services/payment.service.js",
  "backend/services/subscription.service.js",
  "backend/services/analytics.service.js",
  "backend/services/notification.service.js",

  "backend/validators/auth.validator.js",
  "backend/validators/company.validator.js",
  "backend/validators/user.validator.js",
  "backend/validators/vcard.validator.js",
  "backend/validators/payment.validator.js",
  "backend/validators/nfc.validator.js",

  "backend/helpers/response.helper.js",
  "backend/helpers/slug.helper.js",
  "backend/helpers/file.helper.js",
  "backend/helpers/date.helper.js",
  "backend/helpers/logger.helper.js",

  "backend/jobs/subscription-expiry.job.js",
  "backend/jobs/payment-reminder.job.js",
  "backend/jobs/email-notification.job.js",

  "database/migrations/001_create_roles_table.sql",
  "database/migrations/002_create_permissions_table.sql",
  "database/migrations/003_create_users_table.sql",
  "database/migrations/004_create_companies_table.sql",
  "database/migrations/005_create_plans_table.sql",
  "database/migrations/006_create_subscriptions_table.sql",
  "database/migrations/007_create_vcard_templates_table.sql",
  "database/migrations/008_create_vcards_table.sql",
  "database/migrations/009_create_qrcodes_table.sql",
  "database/migrations/010_create_nfc_orders_table.sql",
  "database/migrations/011_create_payments_table.sql",
  "database/migrations/012_create_invoices_table.sql",
  "database/migrations/013_create_notifications_table.sql",
  "database/migrations/014_create_activity_logs_table.sql",
  "database/migrations/015_create_settings_table.sql",

  "database/seeders/roles.seed.sql",
  "database/seeders/permissions.seed.sql",
  "database/seeders/plans.seed.sql",
  "database/seeders/templates.seed.sql",

  "config/app.config.js",
  "config/database.config.js",
  "config/mail.config.js",
  "config/storage.config.js",
  "config/roles.config.js",
  "config/permissions.config.js",
  "config/security.config.js",

  "logs/app.log",
  "logs/error.log",
  "logs/payment.log",
  "logs/audit.log",
  "logs/access.log",

  "tests/auth.test.js",
  "tests/company.test.js",
  "tests/user.test.js",
  "tests/vcard.test.js",
  "tests/payment.test.js",
  "tests/nfc.test.js",

  "docs/requirements.md",
  "docs/database-schema.md",
  "docs/api-documentation.md",
  "docs/user-guide.md",
  "docs/deployment-guide.md"
];

const folders = [
  "frontend/public/assets/images",
  "frontend/public/assets/icons",
  "frontend/public/assets/fonts",
  "database/functions",
  "database/triggers",
  "database/backups",
  "storage/company-assets",
  "storage/user-avatars",
  "storage/vcard-images",
  "storage/qr-codes",
  "storage/payment-proofs",
  "storage/nfc-orders",
  "storage/invoices",
  "storage/exports",
  "storage/backups"
];

folders.forEach(folder => fs.mkdirSync(folder, { recursive: true }));

files.forEach(file => {
  const dir = path.dirname(file);
  fs.mkdirSync(dir, { recursive: true });

  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, "");
  }
});

console.log("✅ All folders and files created successfully!");