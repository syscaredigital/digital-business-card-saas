Packages have separate fixed prices for Sri Lanka (LKR), Australia (AUD), and other countries (USD). Admins set these under Subscriptions > Plans. If an AUD or USD price is missing on save, the server calculates an initial suggestion from LKR × 1.50 using reference exchange rates, rounds to two decimal places, and saves it. Existing regional prices are preserved when omitted from later updates. Free packages stay free in every region.

Billing country determines the market. Display currency only converts that market's saved price, never switches to the Sri Lankan price. For example, an Australian customer viewing LKR sees the LKR equivalent of the Australian AUD package price. AUD prices for Australia and USD prices for other countries stay fixed; prices displayed in another currency can fluctuate with reference rates. Country is declared by the customer in registration or billing; this implementation does not independently verify residence.

Deploy migration `080_regional_package_pricing.sql` through the verified migration ledger before deploying the new application. Existing databases without a ledger still require the documented historical migration review; do not fabricate a ledger or replay old migrations. Then preview and save initial regional prices from the application root:

```sh
node backend/initialize-regional-prices.js
node backend/initialize-regional-prices.js --apply
```

The initializer only fills missing regional prices. It never changes existing saved regional prices, historical payments, or subscriptions. Previous `plan_prices` rows are preserved separately because the old checkout ignored foreign amounts; those legacy rows are not silently adopted as approved regional prices. Review the resulting LKR/AUD/USD amounts in super admin before accepting international payments. A package without its region's price is shown as unavailable, and checkout is blocked.

The user dashboard shows the selected country's prices, coupons and final total. The backend recalculates prices and discounts, ignores client-supplied charge amounts, and rejects outdated totals submitted by the dashboard. A payment stores billing country, market, package name, regional price/currency, checkout currency, exchange rates, discount, final amount and billing interval. Admin approval uses the purchased interval even if the plan has since changed. Admin review cannot change a customer checkout's amount, currency, owner or subscription. Existing payments without snapshots retain their previous approval behavior.

NFC shipping remains separate from subscription pricing: card subtotal plus one domestic or international delivery fee per order, converted into the selected currency. Set both fees in super-admin billing settings. Missing or nonpositive fees block ordering. The server saves destination, shipping fee, card subtotal, exchange rate and final total. The dashboard rejects submission when its displayed price or shipping fee has changed. The 50% international package markup is not added to NFC cards or shipping.

No new tax or payment gateway behavior is introduced. Payment remains the existing bank-transfer and admin-review flow. Confirm the actual bank account can accept the advertised currencies before launch.
