const { number, percentChange } = require('../../helpers/metrics.helper');
const pool = require("../../config/database.config");
exports.getAnalytics = async (req, res, next) => {
  const days = Number(req.query.days || 30);
  if (![7, 30, 90, 365].includes(days)) return res.status(400).json({ message: "Analytics range must be 7, 30, 90, or 365 days" });
  try {
    const [summaryResult, previousResult, seriesResult, sourcesResult, cardsResult, platformResult] = await Promise.all([
      pool.query(`SELECT
        COUNT(*) FILTER (WHERE event_type IN ('vcard_view','qr_scan'))::bigint page_views,
        COUNT(*) FILTER (WHERE event_type='link_click')::bigint clicks,
        COUNT(*) FILTER (WHERE event_type='share')::bigint shares,
        (SELECT COUNT(*) FROM contacts WHERE contacted_at>=CURRENT_DATE-($1::integer-1))::bigint contact_requests
        FROM vcard_events WHERE occurred_at>=CURRENT_DATE-($1::integer-1)`,[days]),
      pool.query(`SELECT
        COUNT(*) FILTER (WHERE event_type IN ('vcard_view','qr_scan'))::bigint page_views,
        COUNT(*) FILTER (WHERE event_type='link_click')::bigint clicks,
        COUNT(*) FILTER (WHERE event_type='share')::bigint shares,
        (SELECT COUNT(*) FROM contacts WHERE contacted_at>=CURRENT_DATE-($1::integer*2-1) AND contacted_at<CURRENT_DATE-($1::integer-1))::bigint contact_requests
        FROM vcard_events
        WHERE occurred_at>=CURRENT_DATE-($1::integer*2-1) AND occurred_at<CURRENT_DATE-($1::integer-1)`,[days]),
      pool.query(`SELECT d.day::date date,
        COUNT(e.id) FILTER (WHERE e.event_type IN ('vcard_view','qr_scan'))::bigint page_views,
        COUNT(e.id) FILTER (WHERE e.event_type='link_click')::bigint clicks,
        COUNT(e.id) FILTER (WHERE e.event_type='share')::bigint shares,
        (SELECT COUNT(*) FROM contacts c WHERE c.contacted_at>=d.day AND c.contacted_at<d.day+INTERVAL '1 day')::bigint contacts
        FROM GENERATE_SERIES(CURRENT_DATE-($1::integer-1),CURRENT_DATE,INTERVAL '1 day') d(day)
        LEFT JOIN vcard_events e ON e.occurred_at>=d.day AND e.occurred_at<d.day+INTERVAL '1 day'
        GROUP BY d.day ORDER BY d.day`,[days]),
      pool.query(`SELECT COALESCE(NULLIF(TRIM(source),''),'Direct') source,COUNT(*)::int count FROM contacts WHERE contacted_at>=NOW()-($1::integer*INTERVAL '1 day') GROUP BY 1 ORDER BY count DESC LIMIT 8`,[days]),
      pool.query(`SELECT v.id,COALESCE(NULLIF(v.title,''),'Untitled card') title,u.name owner,
        COUNT(DISTINCT e.id) FILTER (WHERE e.event_type IN ('vcard_view','qr_scan'))::bigint views,
        COUNT(DISTINCT e.id) FILTER (WHERE e.event_type='link_click')::bigint clicks,
        COUNT(DISTINCT ct.id)::bigint contacts
        FROM vcards v
        LEFT JOIN users u ON u.id=v.user_id
        LEFT JOIN vcard_events e ON e.vcard_id=v.id AND e.occurred_at>=CURRENT_DATE-($1::integer-1)
        LEFT JOIN contacts ct ON ct.vcard_id=v.id AND ct.contacted_at>=CURRENT_DATE-($1::integer-1)
        GROUP BY v.id,u.name ORDER BY views DESC,clicks DESC,contacts DESC LIMIT 8`,[days]),
      pool.query(`SELECT
        (SELECT COUNT(*) FROM users WHERE created_at>=NOW()-($1::integer*INTERVAL '1 day'))::int new_users,
        (SELECT COUNT(*) FROM vcards WHERE created_at>=NOW()-($1::integer*INTERVAL '1 day'))::int new_vcards,
        (SELECT COUNT(*) FROM contacts WHERE contacted_at>=NOW()-($1::integer*INTERVAL '1 day'))::int contacts,
        (SELECT COUNT(*) FROM vcard_events WHERE event_type='qr_scan' AND occurred_at>=NOW()-($1::integer*INTERVAL '1 day'))::int qr_scans`,[days]),
    ]);
    const current=summaryResult.rows[0],previous=previousResult.rows[0];
    const metric=(key)=>({ value:number(current[key]), change:percentChange(current[key],previous[key]) });
    const views=number(current.page_views),clicks=number(current.clicks),contacts=number(current.contact_requests);
    res.json({ rangeDays:days,generatedAt:new Date().toISOString(),metrics:{pageViews:metric("page_views"),clicks:metric("clicks"),shares:metric("shares"),contactRequests:metric("contact_requests"),clickRate:views?Number((clicks/views*100).toFixed(1)):0,contactRate:views?Number((contacts/views*100).toFixed(1)):0},series:seriesResult.rows.map((r)=>({date:r.date,pageViews:number(r.page_views),clicks:number(r.clicks),shares:number(r.shares),contacts:number(r.contacts)})),sources:sourcesResult.rows.map((r)=>({source:r.source,count:Number(r.count)})),topCards:cardsResult.rows.map((r)=>({id:r.id,title:r.title,owner:r.owner||"Unknown user",views:number(r.views),clicks:number(r.clicks),contacts:number(r.contacts)})),platform:platformResult.rows[0]});
  } catch(error){next(error);}
};

