const pool = require("../../config/database.config");
const fs = require("fs/promises");
const path = require("path");
const { getStorageSummary, virtualNfcPayloadBytes } = require("../../services/storage.service");
const { normalizeCurrency } = require("../../config/currencies");
const { BASE_CURRENCY, getRate, convertFromLkr } = require("../../services/exchange-rate.service");
function number(value) { return Number(value || 0); }

function validateVirtualNfcImage(value, label, required) {
  if (!value) return required ? `${label} is required` : null;
  if (!/^data:image\/(?:png|jpe?g|webp);base64,[a-z0-9+/=\r\n]+$/i.test(value)) return `${label} must be a PNG, JPG, or WebP image`;
  if (value.length > 2100000) return `${label} must be smaller than 1.5 MB`;
  return null;
}

function virtualNfcDesignJson(row) {
  return {
    id:row.id,vcardId:row.vcard_id,name:row.name,frontImage:row.front_image,backImage:row.back_image,
    logoImage:row.logo_image || "",details:row.details || {},createdAt:row.created_at,updatedAt:row.updated_at,
  };
}

function readVirtualNfcDesignBody(body) {
  const details = body.details && typeof body.details === "object" && !Array.isArray(body.details) ? body.details : {};
  return {
    name:String(body.name || "").trim(),vcardId:body.vcardId ? Number(body.vcardId) : null,
    frontImage:String(body.frontImage || ""),backImage:String(body.backImage || ""),logoImage:String(body.logoImage || ""),
    details:{
      name:String(details.name || "").trim().slice(0,80),role:String(details.role || "").trim().slice(0,100),
      phone:String(details.phone || "").trim().slice(0,50),email:String(details.email || "").trim().slice(0,120),
      website:String(details.website || "").trim().slice(0,160),address:String(details.address || "").trim().slice(0,160),
      textColor:/^#[0-9a-f]{6}$/i.test(String(details.textColor || "")) ? String(details.textColor) : "#ffffff",
      position:["top-left","top-center","top-right","middle-left","middle-center","middle-right",
        "bottom-left","bottom-center","bottom-right"].includes(String(details.position))
        ? String(details.position) : "bottom-left",
    },
  };
}

exports.listVirtualNfcDesigns = async (req, res, next) => {
  try {
    const [designs,vcards] = await Promise.all([
      pool.query(`SELECT id,vcard_id,name,front_image,back_image,logo_image,details,created_at,updated_at
        FROM virtual_nfc_designs WHERE user_id=$1 ORDER BY updated_at DESC,id DESC`,[req.user.id]),
      pool.query(`SELECT id,title,description,website_url,phone,email,address
        FROM vcards WHERE user_id=$1 AND is_active=TRUE ORDER BY title,id`,[req.user.id]),
    ]);
    res.json({
      designs:designs.rows.map(virtualNfcDesignJson),
      vcards:vcards.rows.map((item)=>({id:item.id,title:item.title || `VCard #${item.id}`,role:item.description || "",
        phone:item.phone || "",email:item.email || "",websiteUrl:item.website_url || "",address:item.address || ""})),
    });
  } catch (error) { next(error); }
};

exports.storage = async (req, res, next) => {
  try {
    res.json(await getStorageSummary(pool,req.user.id));
  } catch (error) { next(error); }
};

exports.createVirtualNfcDesign = async (req, res, next) => {
  try {
    const input=readVirtualNfcDesignBody(req.body || {});
    if(!input.name || input.name.length>120)return res.status(400).json({message:"Enter a design name up to 120 characters"});
    const imageError=validateVirtualNfcImage(input.frontImage,"Front background",true)
      ||validateVirtualNfcImage(input.backImage,"Back background",true)||validateVirtualNfcImage(input.logoImage,"Logo",false);
    if(imageError)return res.status(400).json({message:imageError});
    if(input.vcardId){
      const owned=await pool.query("SELECT id FROM vcards WHERE id=$1 AND user_id=$2",[input.vcardId,req.user.id]);
      if(!owned.rowCount)return res.status(400).json({message:"Select one of your own VCards"});
    }
    const storage=await getStorageSummary(pool,req.user.id);
    if(storage.usedBytes+virtualNfcPayloadBytes(input)>storage.limitBytes){
      return res.status(413).json({message:`Your ${storage.plan.name} plan storage limit has been reached. Delete saved previews or upgrade your plan.`});
    }
    const result=await pool.query(`INSERT INTO virtual_nfc_designs(user_id,vcard_id,name,front_image,back_image,logo_image,details)
      VALUES($1,$2,$3,$4,$5,$6,$7::jsonb)
      RETURNING id,vcard_id,name,front_image,back_image,logo_image,details,created_at,updated_at`,
    [req.user.id,input.vcardId,input.name,input.frontImage,input.backImage,input.logoImage || null,JSON.stringify(input.details)]);
    res.status(201).json({message:"Virtual NFC preview saved",design:virtualNfcDesignJson(result.rows[0])});
  } catch (error) { next(error); }
};

exports.updateVirtualNfcDesign = async (req, res, next) => {
  try {
    const designId=Number(req.params.id),input=readVirtualNfcDesignBody(req.body || {});
    if(!Number.isInteger(designId)||designId<1)return res.status(400).json({message:"Invalid preview design"});
    if(!input.name || input.name.length>120)return res.status(400).json({message:"Enter a design name up to 120 characters"});
    const imageError=validateVirtualNfcImage(input.frontImage,"Front background",true)
      ||validateVirtualNfcImage(input.backImage,"Back background",true)||validateVirtualNfcImage(input.logoImage,"Logo",false);
    if(imageError)return res.status(400).json({message:imageError});
    if(input.vcardId){
      const owned=await pool.query("SELECT id FROM vcards WHERE id=$1 AND user_id=$2",[input.vcardId,req.user.id]);
      if(!owned.rowCount)return res.status(400).json({message:"Select one of your own VCards"});
    }
    const existing=await pool.query(`SELECT name,front_image,back_image,logo_image,details
      FROM virtual_nfc_designs WHERE id=$1 AND user_id=$2`,[designId,req.user.id]);
    if(!existing.rowCount)return res.status(404).json({message:"Virtual NFC preview not found"});
    const current=existing.rows[0];
    const currentBytes=virtualNfcPayloadBytes({name:current.name,frontImage:current.front_image,
      backImage:current.back_image,logoImage:current.logo_image,details:current.details});
    const storage=await getStorageSummary(pool,req.user.id);
    if(storage.usedBytes-currentBytes+virtualNfcPayloadBytes(input)>storage.limitBytes){
      return res.status(413).json({message:`Your ${storage.plan.name} plan storage limit has been reached. Reduce image sizes, delete saved previews, or upgrade your plan.`});
    }
    const result=await pool.query(`UPDATE virtual_nfc_designs SET vcard_id=$1,name=$2,front_image=$3,back_image=$4,
      logo_image=$5,details=$6::jsonb,updated_at=NOW() WHERE id=$7 AND user_id=$8
      RETURNING id,vcard_id,name,front_image,back_image,logo_image,details,created_at,updated_at`,
    [input.vcardId,input.name,input.frontImage,input.backImage,input.logoImage || null,JSON.stringify(input.details),designId,req.user.id]);
    if(!result.rowCount)return res.status(404).json({message:"Virtual NFC preview not found"});
    res.json({message:"Virtual NFC preview updated",design:virtualNfcDesignJson(result.rows[0])});
  } catch (error) { next(error); }
};

exports.deleteVirtualNfcDesign = async (req, res, next) => {
  try {
    const designId=Number(req.params.id);
    if(!Number.isInteger(designId)||designId<1)return res.status(400).json({message:"Invalid preview design"});
    const result=await pool.query("DELETE FROM virtual_nfc_designs WHERE id=$1 AND user_id=$2 RETURNING id",[designId,req.user.id]);
    if(!result.rowCount)return res.status(404).json({message:"Virtual NFC preview not found"});
    res.json({message:"Virtual NFC preview deleted"});
  } catch (error) { next(error); }
};

exports.nfcStore = async (req, res, next) => {
  try {
    const [products, orders, vcards, settingsResult, userResult] = await Promise.all([
      pool.query(`SELECT id,name,price,description,front_image,back_image,category
        FROM nfc_products WHERE is_active=TRUE ORDER BY category,price,name`),
      pool.query(`SELECT o.id,o.nfc_product_id,o.vcard_id,o.quantity,o.amount,o.currency,o.status,
          o.subtotal_lkr,o.shipping_cost_lkr,o.shipping_cost,o.destination_country,o.exchange_rate,o.exchange_rate_date,
          o.payment_status,o.payment_method,o.transaction_number,o.shipping_address,o.tracking_number,
          o.admin_note,o.ordered_at,o.updated_at,p.name product_name,p.front_image,v.title vcard_title
        FROM nfc_orders o LEFT JOIN nfc_products p ON p.id=o.nfc_product_id
        LEFT JOIN vcards v ON v.id=o.vcard_id WHERE o.user_id=$1 ORDER BY o.ordered_at DESC`, [req.user.id]),
      pool.query(`SELECT id,title,description,website_url,phone,email,address
        FROM vcards WHERE user_id=$1 AND is_active=TRUE ORDER BY title,id`, [req.user.id]),
      pool.query(`SELECT key,value FROM settings WHERE key=ANY($1::text[])`, [["default_currency","bank_name","bank_account_name","bank_account_number","bank_branch","bank_swift_code","domestic_nfc_shipping_lkr","international_nfc_shipping_lkr"]]),
      pool.query("SELECT name,email,phone,preferred_currency FROM users WHERE id=$1", [req.user.id]),
    ]);
    const settings = Object.fromEntries(settingsResult.rows.map((row) => [row.key, row.value || ""]));
    const currency = normalizeCurrency(userResult.rows[0]?.preferred_currency, BASE_CURRENCY);
    const exchange = await getRate(currency);
    const domesticShippingLkr = number(settings.domestic_nfc_shipping_lkr);
    const internationalShippingLkr = number(settings.international_nfc_shipping_lkr);
    res.json({
      currency, baseCurrency: BASE_CURRENCY, exchangeRate: exchange.rate, rateDate: exchange.rateDate, ratesStale: exchange.stale,
      domesticShippingLkr,
      domesticShipping: convertFromLkr(domesticShippingLkr, exchange.rate),
      domesticShippingConfigured: domesticShippingLkr > 0,
      internationalShippingLkr,
      internationalShipping: convertFromLkr(internationalShippingLkr, exchange.rate),
      internationalShippingConfigured: internationalShippingLkr > 0,
      bankDetails: { bankName: settings.bank_name || "", accountName: settings.bank_account_name || "",
        accountNumber: settings.bank_account_number || "", branch: settings.bank_branch || "", swiftCode: settings.bank_swift_code || "" },
      products: products.rows.map((item) => ({ id:item.id,name:item.name,basePrice:number(item.price),price:convertFromLkr(item.price, exchange.rate),description:item.description || "",
        frontImage:item.front_image,backImage:item.back_image,category:item.category || "essential" })),
      vcards: vcards.rows.map((item) => ({ id:item.id,title:item.title || userResult.rows[0]?.name || `VCard #${item.id}`,
        role:item.description || "",email:item.email || userResult.rows[0]?.email || "",
        phone:item.phone || userResult.rows[0]?.phone || "",websiteUrl:item.website_url || "",address:item.address || "" })),
      orders: orders.rows.map((item) => ({ id:item.id,productId:item.nfc_product_id,vcardId:item.vcard_id,
        productName:item.product_name || "NFC card",productImage:item.front_image || null,vcardTitle:item.vcard_title || null,
        quantity:number(item.quantity),amount:number(item.amount),currency:item.currency || "LKR",status:item.status,
        subtotalLkr:number(item.subtotal_lkr),shippingCostLkr:number(item.shipping_cost_lkr),shippingCost:number(item.shipping_cost),
        destinationCountry:item.destination_country || "LK",exchangeRate:number(item.exchange_rate),exchangeRateDate:item.exchange_rate_date,
        paymentStatus:item.payment_status || "pending",paymentMethod:item.payment_method,transactionNumber:item.transaction_number,
        shippingAddress:item.shipping_address,trackingNumber:item.tracking_number,adminNote:item.admin_note,
        orderedAt:item.ordered_at,updatedAt:item.updated_at })),
    });
  } catch (error) { next(error); }
};

exports.placeNfcOrder = async (req, res, next) => {
  const productId = Number(req.body.productId);
  const vcardId = Number(req.body.vcardId);
  const quantity = Number(req.body.quantity);
  const transactionNumber = String(req.body.transactionNumber || "").trim();
  const shippingAddress = String(req.body.shippingAddress || "").trim();
  const destinationCountry = String(req.body.destinationCountry || "").trim().toUpperCase();
  const uploadedPath = req.file?.path;
  const discardUpload = () => uploadedPath ? fs.unlink(uploadedPath).catch(() => {}) : Promise.resolve();
  if (!req.file) return res.status(400).json({ message: "Upload your bank payment slip" });
  if (!Number.isInteger(productId) || productId < 1) { await discardUpload(); return res.status(400).json({ message: "Select a valid NFC card" }); }
  if (!Number.isInteger(vcardId) || vcardId < 1) { await discardUpload(); return res.status(400).json({ message: "Select the VCard to link" }); }
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) { await discardUpload(); return res.status(400).json({ message: "Order between 1 and 100 NFC cards" }); }
  if (!/^[A-Za-z0-9][A-Za-z0-9._/# -]{2,254}$/.test(transactionNumber)) { await discardUpload(); return res.status(400).json({ message: "Enter a valid transaction number" }); }
  if (shippingAddress.length < 10 || shippingAddress.length > 2000) { await discardUpload(); return res.status(400).json({ message: "Enter a complete shipping address" }); }
  if (!/^[A-Z]{2}$/.test(destinationCountry)) { await discardUpload(); return res.status(400).json({ message: "Select a valid destination country" }); }
  let client;
  try {
    client = await pool.connect(); await client.query("BEGIN");
    const productResult = await client.query("SELECT id,name,price FROM nfc_products WHERE id=$1 AND is_active=TRUE FOR SHARE", [productId]);
    const vcardResult = await client.query("SELECT id,title FROM vcards WHERE id=$1 AND user_id=$2 AND is_active=TRUE FOR SHARE", [vcardId,req.user.id]);
    const [currencyResult, shippingResult] = await Promise.all([
      client.query("SELECT preferred_currency FROM users WHERE id=$1", [req.user.id]),
      client.query("SELECT key,value FROM settings WHERE key=ANY($1::text[])", [["domestic_nfc_shipping_lkr","international_nfc_shipping_lkr"]]),
    ]);
    if (!productResult.rowCount || !vcardResult.rowCount) { await client.query("ROLLBACK"); await discardUpload(); return res.status(400).json({ message: "The selected NFC card or VCard is unavailable" }); }
    const duplicate = await client.query("SELECT id FROM nfc_orders WHERE LOWER(transaction_number)=LOWER($1)", [transactionNumber]);
    if (duplicate.rowCount) { await client.query("ROLLBACK"); await discardUpload(); return res.status(409).json({ message: "This transaction number has already been submitted" }); }
    const product = productResult.rows[0];
    const subtotalLkr = number(product.price) * quantity;
    const shippingSettings = Object.fromEntries(shippingResult.rows.map((row) => [row.key, row.value]));
    const shippingCostLkr = destinationCountry === "LK"
      ? number(shippingSettings.domestic_nfc_shipping_lkr)
      : number(shippingSettings.international_nfc_shipping_lkr);
    if (shippingCostLkr <= 0) {
      await client.query("ROLLBACK"); await discardUpload();
      return res.status(409).json({ message: `${destinationCountry === "LK" ? "Domestic" : "International"} NFC delivery fee has not been configured by the super admin yet` });
    }
    const currency = normalizeCurrency(currencyResult.rows[0]?.preferred_currency, BASE_CURRENCY);
    const exchange = await getRate(currency);
    const subtotal = convertFromLkr(subtotalLkr, exchange.rate);
    const shippingCost = convertFromLkr(shippingCostLkr, exchange.rate);
    const amount = Math.round((subtotal + shippingCost + Number.EPSILON) * 100) / 100;
    const proofUrl = `/uploads/payment-slips/${req.file.filename}`;
    const result = await client.query(`INSERT INTO nfc_orders(user_id,nfc_product_id,vcard_id,quantity,amount,currency,status,
      shipping_address,destination_country,subtotal_lkr,shipping_cost_lkr,shipping_cost,exchange_rate,exchange_rate_date,
      payment_method,payment_status,transaction_number,proof_url)
      VALUES($1,$2,$3,$4,$5,$6,'pending',$7,$8,$9,$10,$11,$12,$13,'bank_transfer','pending',$14,$15)
      RETURNING id,amount,currency,status,payment_status,ordered_at`,
      [req.user.id,productId,vcardId,quantity,amount,currency,shippingAddress,destinationCountry,subtotalLkr,shippingCostLkr,shippingCost,exchange.rate,exchange.rateDate,transactionNumber,proofUrl]);
    await client.query(`INSERT INTO notifications(user_id,title,message,type)
      SELECT u.id,'NFC payment awaiting review',$1,'billing' FROM users u JOIN roles r ON r.id=u.role_id WHERE r.name='super_admin'`,
      [`${req.user.name} ordered ${quantity} × ${product.name} and submitted transaction ${transactionNumber}.`]);
    await client.query(`INSERT INTO notifications(user_id,title,message,type) VALUES($1,'NFC order submitted',$2,'billing')`,
      [req.user.id,`Order #${result.rows[0].id} is waiting for payment approval.`]);
    await client.query("COMMIT");
    res.status(201).json({ order:result.rows[0],message:"NFC order and payment slip submitted for approval" });
  } catch (error) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    await discardUpload();
    if (error.code === "23505") return res.status(409).json({ message:"This transaction number has already been submitted" });
    next(error);
  } finally { if (client) client.release(); }
};

