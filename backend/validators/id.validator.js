function positiveIntegerParam(req) {
  const rawId = String(req.params.id || "");
  if (!/^\d+$/.test(rawId)) return null;
  const id = Number(rawId);
  return Number.isSafeInteger(id) && id > 0 && id <= 2147483647 ? id : null;
}


module.exports = { positiveIntegerParam };
