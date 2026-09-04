-- NFC delivery charges are configured by super admin and snapshotted on each
-- order. A zero value means that checkout is waiting for admin configuration.
INSERT INTO settings(key,value,category,description,updated_at)
VALUES ('domestic_nfc_shipping_lkr','0','billing','Flat NFC delivery charge within Sri Lanka (LKR)',NOW())
ON CONFLICT(key) DO UPDATE SET
  category=EXCLUDED.category,
  description=EXCLUDED.description;
