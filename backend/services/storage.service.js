const DEFAULT_STORAGE_LIMIT_MB = 50;

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function getStorageSummary(db, userId) {
  const [planResult, usageResult] = await Promise.all([
    db.query(
      `SELECT p.id,p.name,p.storage_limit_mb
       FROM subscriptions s JOIN plans p ON p.id=s.plan_id
       WHERE s.user_id=$1 AND s.status='active' AND s.start_date<=CURRENT_DATE
         AND (s.end_date IS NULL OR s.end_date>=CURRENT_DATE)
       ORDER BY s.updated_at DESC,s.id DESC LIMIT 1`,
      [userId]
    ),
    db.query(
      `SELECT
        COALESCE((SELECT SUM(
          OCTET_LENGTH(COALESCE(d.front_image,''))+
          OCTET_LENGTH(COALESCE(d.back_image,''))+
          OCTET_LENGTH(COALESCE(d.logo_image,''))+
          OCTET_LENGTH(COALESCE(d.details::text,''))+
          OCTET_LENGTH(COALESCE(d.name,''))
        ) FROM virtual_nfc_designs d WHERE d.user_id=$1),0)::bigint AS virtual_nfc_bytes,
        COALESCE((SELECT SUM(OCTET_LENGTH(ROW_TO_JSON(v)::text))
          FROM vcards v WHERE v.user_id=$1),0)::bigint AS vcard_bytes,
        COALESCE((SELECT SUM(OCTET_LENGTH(ROW_TO_JSON(b)::text))
          FROM business_cards b WHERE b.user_id=$1),0)::bigint AS business_card_bytes,
        COALESCE((SELECT SUM(OCTET_LENGTH(COALESCE(g.image_url,''))+
          OCTET_LENGTH(COALESCE(g.title,''))+OCTET_LENGTH(COALESCE(g.caption,'')))
          FROM card_gallery g JOIN business_cards b ON b.id=g.business_card_id
          WHERE b.user_id=$1),0)::bigint AS gallery_bytes,
        COALESCE((SELECT SUM(OCTET_LENGTH(ROW_TO_JSON(l)::text))
          FROM card_social_links l JOIN business_cards b ON b.id=l.business_card_id
          WHERE b.user_id=$1),0)::bigint AS social_bytes,
        COALESCE((SELECT SUM(OCTET_LENGTH(COALESCE(q.image_url,'')))
          FROM qrcodes q JOIN vcards v ON v.id=q.vcard_id WHERE v.user_id=$1),0)::bigint AS qr_bytes,
        COALESCE((SELECT OCTET_LENGTH(COALESCE(u.avatar_url,'')) FROM users u WHERE u.id=$1),0)::bigint AS profile_bytes`,
      [userId]
    ),
  ]);
  let plan = planResult.rows[0];
  if (!plan) {
    const fallback = await db.query(
      `SELECT id,name,storage_limit_mb FROM plans
       WHERE status='active' ORDER BY CASE WHEN LOWER(name)='free' THEN 0 ELSE 1 END,price,id LIMIT 1`
    );
    plan = fallback.rows[0] || { id:null,name:"Free",storage_limit_mb:DEFAULT_STORAGE_LIMIT_MB };
  }
  const usage = usageResult.rows[0] || {};
  const categories = [
    { key:"virtualNfc",label:"Custom NFC previews",bytes:number(usage.virtual_nfc_bytes) },
    { key:"vcards",label:"VCards",bytes:number(usage.vcard_bytes) },
    { key:"businessCards",label:"Business cards",bytes:number(usage.business_card_bytes) },
    { key:"gallery",label:"Gallery",bytes:number(usage.gallery_bytes) },
    { key:"social",label:"Social links",bytes:number(usage.social_bytes) },
    { key:"qrCodes",label:"QR codes",bytes:number(usage.qr_bytes) },
    { key:"profile",label:"Profile image",bytes:number(usage.profile_bytes) },
  ];
  const usedBytes = categories.reduce((sum,item)=>sum+item.bytes,0);
  const limitMb = Math.max(0,number(plan.storage_limit_mb));
  const limitBytes = limitMb*1024*1024;
  return {
    plan:{id:plan.id,name:plan.name || "Free"},
    limitMb,limitBytes,usedBytes,
    availableBytes:Math.max(0,limitBytes-usedBytes),
    percentage:limitBytes ? Math.min(100,(usedBytes/limitBytes)*100) : (usedBytes ? 100 : 0),
    categories,
  };
}

function virtualNfcPayloadBytes(input) {
  return Buffer.byteLength(input.frontImage || "")+
    Buffer.byteLength(input.backImage || "")+
    Buffer.byteLength(input.logoImage || "")+
    Buffer.byteLength(JSON.stringify(input.details || {}))+
    Buffer.byteLength(input.name || "");
}

module.exports = { getStorageSummary, virtualNfcPayloadBytes };
