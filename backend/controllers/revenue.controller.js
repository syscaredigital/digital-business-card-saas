const pool = require('../config/database.config');
exports.exportCsv = async (req, res, next) => {
  try {
    const result = await pool.query(`SELECT source_type,source_id,received_at,amount AS original_amount,currency AS original_currency,
      lkr_per_unit,rate_date,amount_lkr,conversion_basis FROM revenue_lkr_entries ORDER BY received_at DESC,source_type,source_id`);
    const fields = ['source_type','source_id','received_at','original_amount','original_currency','lkr_per_unit','rate_date','amount_lkr','conversion_basis'];
    const cell = value => {
      let text = value instanceof Date ? value.toISOString() : String(value == null ? '' : value);
      if (/^[=+@\-\t\r]/.test(text)) text = "'" + text;
      return '"' + text.replace(/"/g, '""') + '"';
    };
    const lines = [fields.join(','), ...result.rows.map(row => fields.map(field => cell(row[field])).join(','))];
    res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="revenue-lkr.csv"', 'Cache-Control': 'no-store' }).send('\uFEFF' + lines.join('\r\n'));
  } catch (error) { next(error); }
};
