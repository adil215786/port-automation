const { getDb } = require('../lib/db');
const { requireAdmin } = require('../lib/auth');
const { allowCors, hashPin, generateId, formatDateEastern } = require('../lib/utils');
const { refreshNPToken, getNPOrders } = require('../lib/numberpilot');

module.exports = async function handler(req, res) {
  allowCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const session = requireAdmin(req, res);
  if (!session) return;

  const db = getDb();
  const { action } = req.query;

  // GET: fetch admin dashboard data
  if (req.method === 'GET') {
    const [usersRes, ordersRes, configRes] = await Promise.all([
      db.from('users').select('*').order('created_at', { ascending: false }),
      db.from('orders').select('*').order('requested_at', { ascending: false }).limit(200),
      db.from('config').select('*')
    ]);

    const config = {};
    (configRes.data || []).forEach(r => { config[r.setting_name] = r.setting_value; });

    const formatOrder = o => ({
      ...o,
      requested_at_fmt: formatDateEastern(o.requested_at),
      completed_at_fmt: formatDateEastern(o.completed_at)
    });

    return res.status(200).json({
      ok: true,
      users: (usersRes.data || []).map(u => ({ ...u, pin_hash: undefined })),
      orders: (ordersRes.data || []).map(formatOrder),
      config
    });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = req.body || {};

  // Update config
  if (action === 'update_config') {
    const { product_type, allowed_area_codes } = body;

    const updates = [];
    if (product_type !== undefined) updates.push({ setting_name: 'product_type', setting_value: product_type });
    if (allowed_area_codes !== undefined) updates.push({ setting_name: 'allowed_area_codes', setting_value: allowed_area_codes });

    for (const u of updates) {
      await db.from('config').upsert(u, { onConflict: 'setting_name' });
    }

    // Log change
    await db.from('config_history').insert({
      changed_at: new Date().toISOString(),
      changed_by: session.username,
      product_type: product_type || '',
      allowed_area_codes: allowed_area_codes || ''
    });

    return res.status(200).json({ ok: true });
  }

  // Create user
  if (action === 'create_user') {
    const { username, pin, display_name, store_name, is_admin } = body;
    if (!username || !pin) return res.status(400).json({ error: 'username and pin required' });

    const userId = generateId();
    await db.from('users').insert({
      user_id: userId,
      username: username.trim().toLowerCase(),
      pin_hash: hashPin(String(pin).trim()),
      display_name: display_name || username,
      store_name: store_name || '',
      is_admin: !!is_admin,
      is_active: true,
      created_at: new Date().toISOString()
    });

    return res.status(200).json({ ok: true, user_id: userId });
  }

  // Update user
  if (action === 'update_user') {
    const { user_id, pin, display_name, store_name, is_admin, is_active } = body;
    if (!user_id) return res.status(400).json({ error: 'user_id required' });

    const updates = {};
    if (pin) updates.pin_hash = hashPin(String(pin).trim());
    if (display_name !== undefined) updates.display_name = display_name;
    if (store_name !== undefined) updates.store_name = store_name;
    if (is_admin !== undefined) updates.is_admin = !!is_admin;
    if (is_active !== undefined) updates.is_active = !!is_active;

    await db.from('users').update(updates).eq('user_id', user_id);
    return res.status(200).json({ ok: true });
  }

  // Delete user
  if (action === 'delete_user') {
    const { user_id } = body;
    if (!user_id) return res.status(400).json({ error: 'user_id required' });
    await db.from('users').update({ is_active: false }).eq('user_id', user_id);
    return res.status(200).json({ ok: true });
  }

  // Force refresh NP token
  if (action === 'refresh_token') {
    try {
      await refreshNPToken();
      return res.status(200).json({ ok: true, message: 'Token refreshed successfully' });
    } catch (err) {
      return res.status(502).json({ error: err.message });
    }
  }

  // Sync orders from NP
  if (action === 'sync_orders') {
    try {
      const orders = await getNPOrders(50);
      return res.status(200).json({ ok: true, count: orders.length, orders });
    } catch (err) {
      return res.status(502).json({ error: err.message });
    }
  }

  return res.status(400).json({ error: 'Unknown action: ' + action });
};
