Super-admin revenue is reported in LKR. The dashboard combines approved/completed subscription and manual-payment receipts with approved NFC orders, including delivery charges. Pending and rejected payments are excluded. Transaction ledger copies of these receipts are not counted again.

This is gross receipts expressed in LKR, not profit or a bank-settlement reconciliation. Bank fees, commissions, taxes, expenses, and refunds need separate reconciliation.

New foreign-currency subscription payments store their checkout conversion rate. NFC sales use the rate recorded on the order. The reporting rate is LKR per unit of the sale currency, so `LKR amount = original amount × LKR per unit`. For example, USD 10 at LKR 300 per USD is LKR 3,000. Saved conversions do not change when the live rate changes.

Use **Download LKR revenue CSV** on the super-admin dashboard, or create a Revenue ledger report. The CSV includes the original amount/currency, LKR amount, conversion rate, rate date, and conversion basis. The `amount_lkr` column can be summed in Excel or Google Sheets.

Migration 064 adds the reporting view and conversion snapshots. After importing an existing database, run:

```sh
node database/run-single-migration.js 064_add_lkr_revenue_reporting.sql
node backend/backfill-revenue.js
```

The backfill uses an existing checkout snapshot where available. If an older foreign-currency sale has no historical rate, it saves the available current rate and explicitly marks the conversion `estimated_current`. The dashboard discloses estimates; the CSV identifies the affected rows. This is an estimate, not a reconstructed historical settlement rate. If no conversion can be obtained, the dashboard shows the total as unavailable rather than silently adding incompatible currencies. The export leaves the unresolved LKR amount blank.
