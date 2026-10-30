const { getRate, convertFromLkr } = require('./exchange-rate.service');

const COUNTRY_CODES = 'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'.split(' ');
function normalizeCountry(value) {
  const code = String(value || '').trim().toUpperCase();
  return COUNTRY_CODES.includes(code) ? code : null;
}
function marketFor(country) {
  return country === 'LK' ? { market: 'LK', currency: 'LKR' }
    : country === 'AU' ? { market: 'AU', currency: 'AUD' }
      : { market: 'INTL', currency: 'USD' };
}
function pricingError(message) { return Object.assign(new Error(message), { status: 409 }); }
async function quotePackage(db, plan, country, currency, rateProvider = getRate) {
  if (!normalizeCountry(country)) throw pricingError('Select a valid billing country');
  const market = marketFor(country);
  let regionalAmount = Number(plan.price);
  if (market.currency !== 'LKR' && regionalAmount !== 0) {
    const result = await db.query('SELECT amount FROM package_regional_prices WHERE plan_id=$1 AND currency=$2', [plan.id, market.currency]);
    if (!result.rowCount) throw pricingError('Package pricing for this region is not configured. Please contact support.');
    regionalAmount = Number(result.rows[0].amount);
    if (!(regionalAmount > 0)) throw pricingError('Paid package regional pricing must be greater than zero');
  }
  const exchange = await rateProvider(currency);
  const regionalRate = market.currency === currency ? exchange : await rateProvider(market.currency);
  const amount = market.currency === currency ? regionalAmount : convertFromLkr(regionalAmount / regionalRate.rate, exchange.rate);
  return { amount, currency, billingCountry: country, market: market.market,
    regionalCurrency: market.currency, regionalAmount, billingInterval: plan.billing_interval,
    planId: plan.id, planName: plan.name, exchangeRate: exchange.rate, exchangeRateDate: exchange.rateDate,
    regionalExchangeRate: regionalRate.rate, quotedAt: new Date().toISOString() };
}
// Save the initial +50% suggestions once. Subsequent edits preserve fixed prices.
async function completeRegionalPrices(prices, rateProvider = getRate) {
  const result = { ...prices };
  for (const currency of ['AUD', 'USD']) {
    if (Number(prices.LKR) === 0) result[currency] = 0;
    else if (result[currency] === undefined) {
      const exchange = await rateProvider(currency);
      result[currency] = convertFromLkr(Number(prices.LKR) * 1.5, exchange.rate);
    }
    if (Number(prices.LKR) > 0 && !(result[currency] > 0)) throw pricingError('Paid packages require positive AUD and USD prices');
  }
  return result;
}
module.exports = { COUNTRY_CODES, normalizeCountry, marketFor, quotePackage, completeRegionalPrices };
