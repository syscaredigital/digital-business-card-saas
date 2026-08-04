const { CURRENCY_CODES, normalizeCurrency } = require("../config/currencies");

const BASE_CURRENCY = "LKR";
const DEFAULT_API_URL = "https://api.frankfurter.dev/v2/rates?base=LKR";
const CACHE_MS = Math.max(5 * 60 * 1000, Number(process.env.EXCHANGE_RATE_CACHE_MS) || 6 * 60 * 60 * 1000);
let cache = null;
let pendingRequest = null;

function roundedMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function parseRates(payload) {
  const rates = { LKR: 1 };
  if (Array.isArray(payload)) {
    payload.forEach((row) => {
      const quote = normalizeCurrency(row && (row.quote || row.currency));
      const rate = Number(row && row.rate);
      if (quote && Number.isFinite(rate) && rate > 0) rates[quote] = rate;
    });
  } else {
    const source = payload && (payload.rates || payload.data || payload);
    if (source && typeof source === "object") {
      Object.entries(source).forEach(([code, rawRate]) => {
        const quote = normalizeCurrency(code);
        const rate = Number(rawRate && typeof rawRate === "object" ? rawRate.rate : rawRate);
        if (quote && Number.isFinite(rate) && rate > 0) rates[quote] = rate;
      });
    }
  }
  return rates;
}

async function refreshRates() {
  if (pendingRequest) return pendingRequest;
  pendingRequest = (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(process.env.EXCHANGE_RATE_API_URL || DEFAULT_API_URL, {
        headers: { Accept: "application/json", "User-Agent": "Sync-E-Card/1.0" },
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Exchange-rate provider returned HTTP ${response.status}`);
      const payload = await response.json();
      const rates = parseRates(payload);
      if (Object.keys(rates).length < 2) throw new Error("Exchange-rate provider returned no usable rates");
      const providerDate = Array.isArray(payload) ? payload[0]?.date : payload?.date;
      cache = { rates, fetchedAt: new Date().toISOString(), rateDate: providerDate || new Date().toISOString().slice(0, 10) };
      return cache;
    } finally {
      clearTimeout(timer);
      pendingRequest = null;
    }
  })();
  return pendingRequest;
}

async function getRates(options = {}) {
  const fresh = cache && Date.now() - new Date(cache.fetchedAt).getTime() < CACHE_MS;
  if (fresh && !options.force) return { ...cache, stale: false };
  try {
    return { ...(await refreshRates()), stale: false };
  } catch (error) {
    if (cache) return { ...cache, stale: true };
    error.statusCode = 503;
    error.publicMessage = "Current exchange rates are temporarily unavailable. Please try again shortly.";
    throw error;
  }
}

async function getRate(currency) {
  const code = normalizeCurrency(currency, BASE_CURRENCY);
  if (code === BASE_CURRENCY) return { currency: code, rate: 1, rateDate: new Date().toISOString().slice(0, 10), fetchedAt: new Date().toISOString(), stale: false };
  const snapshot = await getRates();
  const rate = Number(snapshot.rates[code]);
  if (!Number.isFinite(rate) || rate <= 0) {
    const error = new Error(`No current LKR exchange rate is available for ${code}`);
    error.statusCode = 422;
    error.publicMessage = error.message;
    throw error;
  }
  return { currency: code, rate, rateDate: snapshot.rateDate, fetchedAt: snapshot.fetchedAt, stale: snapshot.stale };
}

function convertFromLkr(amount, rate) {
  return roundedMoney(Number(amount || 0) * Number(rate || 0));
}

async function supportedCurrencies() {
  const snapshot = await getRates();
  return CURRENCY_CODES.filter((code) => code === BASE_CURRENCY || snapshot.rates[code]);
}

module.exports = { BASE_CURRENCY, getRates, getRate, convertFromLkr, supportedCurrencies, roundedMoney };
