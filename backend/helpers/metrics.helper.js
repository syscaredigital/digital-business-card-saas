function number(value) {
  return Number(value || 0);
}

function percentChange(current, previous) {
  const currentValue = number(current);
  const previousValue = number(previous);
  if (!previousValue) return currentValue ? 100 : 0;
  return Number((((currentValue - previousValue) / previousValue) * 100).toFixed(1));
}

module.exports = { number, percentChange };
