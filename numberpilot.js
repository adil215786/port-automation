const fetch = require('node-fetch');
const { getDb } = require('./db');

const NP_BASE = 'https://api.numberpilot.com';
const TOKEN_VALID_HOURS = 20; // refresh before 24hr expiry

async function getNPToken() {
  const db = getDb();

  // Check stored token
  const { data: rows } = await db.from('auth').select('*').limit(1);
  const row = rows && rows[0];

  if (row && row.np_token && row.token_obtained_at) {
    const obtained = new Date(row.token_obtained_at);
    const ageHours = (Date.now() - obtained.getTime()) / (1000 * 60 * 60);
    if (ageHours < TOKEN_VALID_HOURS) {
      return row.np_token;
    }
  }

  // Need fresh token
  return await refreshNPToken();
}

async function refreshNPToken() {
  const db = getDb();

  const response = await fetch(`${NP_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: process.env.NP_USERNAME,
      password: process.env.NP_PASSWORD
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`NP login failed: ${response.status} ${text}`);
  }

  const data = await response.json();
  const token = data.token || data.access_token || data.data?.token;
  if (!token) throw new Error('No token in NP login response: ' + JSON.stringify(data));

  // Upsert into auth table (always keep just one row)
  await db.from('auth').upsert({
    id: 1,
    np_token: token,
    token_obtained_at: new Date().toISOString()
  }, { onConflict: 'id' });

  return token;
}

async function placeNPOrder({ areaCode, productType }) {
  const token = await getNPToken();

  const body = {
    product_type: productType,
    area_code: areaCode
  };

  const response = await fetch(`${NP_BASE}/orders/numbers/new_order`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`NP order failed: ${response.status} ${text}`);
  }

  const orderData = await response.json();

  // NP does not return order_id directly, so we match via get_orders
  await new Promise(r => setTimeout(r, 2000)); // wait 2s for NP to process

  const matched = await matchNewOrder(token, areaCode, productType);
  return matched || orderData;
}

async function matchNewOrder(token, areaCode, productType) {
  const response = await fetch(`${NP_BASE}/orders/numbers/get_orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ limit: 5 })
  });

  if (!response.ok) return null;

  const data = await response.json();
  const orders = data.orders || data.data || [];

  // Find most recent order matching area code + product type
  const match = orders.find(o => {
    const ac = String(o.area_code || o.areaCode || '');
    const pt = String(o.product_type || o.productType || '');
    return ac === String(areaCode) && pt.toLowerCase().includes(productType.toLowerCase().split('_')[0].toLowerCase());
  });

  return match || orders[0] || null;
}

async function getNPOrders(limit = 20) {
  const token = await getNPToken();

  const response = await fetch(`${NP_BASE}/orders/numbers/get_orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ limit })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`NP get_orders failed: ${response.status} ${text}`);
  }

  const data = await response.json();
  return data.orders || data.data || [];
}

const PRODUCT_PRICES = {
  BOOST_CUSTOM_NUMBER: 12,
  METRO_CUSTOM_NUMBER: 12,
  TM_CUSTOM_NUMBER: 12,
  VZ_CUSTOM_NUMBER: 15,
  ATT_CUSTOM_NUMBER: 14
};

function getProductPrice(productType) {
  return PRODUCT_PRICES[productType] || 12;
}

module.exports = { getNPToken, refreshNPToken, placeNPOrder, getNPOrders, getProductPrice };
