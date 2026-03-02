const { getDb } = require('../lib/db');
const { requireSession } = require('../lib/auth');
const { allowCors, generateId, formatDateEastern } = require('../lib/utils');
const { placeNPOrder, getProductPrice } = require('../lib/numberpilot');

module.exports = async function handler(req, res) {
  allowCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const session = requireSession(req, res);
  if (!session) return;

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { area_code } = req.body || {};
  if (!area_code) return res.status(400).json({ error: 'area_code is required' });

  const db = getDb();

  // Get config
  const { data: configRows } = await db.from('config').select('*');
  const config = {};
  (configRows || []).forEach(r => { config[r.setting_name] = r.setting_value; });

  const allowedAreaCodes = (config.allowed_area_codes || '').split(',').map(s => s.trim()).filter(Boolean);
  const productType = config.product_type || 'METRO_CUSTOM_NUMBER';

  if (allowedAreaCodes.length > 0 && !allowedAreaCodes.includes(String(area_code))) {
    return res.status(400).json({ error: `Area code ${area_code} is not allowed` });
  }

  // Check if user already ordered this area code today
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { data: existing } = await db
    .from('orders')
    .select('order_id')
    .eq('user_id', session.user_id)
    .eq('area_code', String(area_code))
    .gte('requested_at', todayStart.toISOString())
    .limit(1);

  if (existing && existing.length > 0) {
    return res.status(409).json({ error: `You already ordered area code ${area_code} today` });
  }

  const orderId = generateId();
  const requestedAt = new Date().toISOString();

  // Insert pending order
  await db.from('orders').insert({
    order_id: orderId,
    user_id: session.user_id,
    username: session.username,
    store_name: session.store_name,
    area_code: String(area_code),
    status: 'pending',
    requested_at: requestedAt
  });

  // Place order with NumberPilot
  let npResult;
  try {
    npResult = await placeNPOrder({ areaCode: area_code, productType });
  } catch (err) {
    // Mark order as failed
    await db.from('orders').update({
      status: 'failed',
      completed_at: new Date().toISOString()
    }).eq('order_id', orderId);

    return res.status(502).json({ error: 'NumberPilot order failed: ' + err.message });
  }

  // Extract result fields
  const phoneNumber = npResult.phone_number || npResult.number || npResult.did || '';
  const npOrderId = npResult.order_id || npResult.id || '';
  const itemId = npResult.item_id || npResult.item?.id || '';
  const accountId = npResult.account_id || npResult.account?.id || '';
  const pin = npResult.pin || npResult.voicemail_pin || '';
  const cost = getProductPrice(productType);

  // Update order as completed
  const completedAt = new Date().toISOString();
  await db.from('orders').update({
    np_order_id: String(npOrderId),
    item_id: String(itemId),
    status: phoneNumber ? 'completed' : 'processing',
    phone_number: phoneNumber,
    account_id: String(accountId),
    pin: String(pin),
    cost: cost,
    completed_at: completedAt
  }).eq('order_id', orderId);

  return res.status(200).json({
    ok: true,
    order: {
      order_id: orderId,
      area_code: String(area_code),
      phone_number: phoneNumber,
      np_order_id: String(npOrderId),
      account_id: String(accountId),
      pin: String(pin),
      status: phoneNumber ? 'completed' : 'processing',
      cost: cost,
      requested_at: requestedAt,
      requested_at_fmt: formatDateEastern(requestedAt)
    }
  });
};
