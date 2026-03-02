const { getDb } = require('../lib/db');
const { requireSession } = require('../lib/auth');
const { allowCors, getTodayEastern, formatDateEastern } = require('../lib/utils');

module.exports = async function handler(req, res) {
  allowCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const session = requireSession(req, res);
  if (!session) return;

  const db = getDb();

  // Get config (allowed area codes, product type)
  const { data: configRows } = await db.from('config').select('*');
  const config = {};
  (configRows || []).forEach(r => { config[r.setting_name] = r.setting_value; });

  const allowedAreaCodes = (config.allowed_area_codes || '').split(',').map(s => s.trim()).filter(Boolean);
  const productType = config.product_type || 'METRO_CUSTOM_NUMBER';

  // Get today's orders for this user
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { data: todayOrders } = await db
    .from('orders')
    .select('*')
    .eq('user_id', session.user_id)
    .gte('requested_at', todayStart.toISOString())
    .order('requested_at', { ascending: false });

  // Get recent orders (last 30 days)
  const monthAgo = new Date();
  monthAgo.setDate(monthAgo.getDate() - 30);

  const { data: recentOrders } = await db
    .from('orders')
    .select('*')
    .eq('user_id', session.user_id)
    .gte('requested_at', monthAgo.toISOString())
    .order('requested_at', { ascending: false })
    .limit(50);

  const formatOrder = o => ({
    ...o,
    requested_at_fmt: formatDateEastern(o.requested_at),
    completed_at_fmt: formatDateEastern(o.completed_at)
  });

  return res.status(200).json({
    ok: true,
    user: {
      display_name: session.display_name,
      store_name: session.store_name,
      is_admin: session.is_admin
    },
    config: { allowedAreaCodes, productType },
    todayOrders: (todayOrders || []).map(formatOrder),
    recentOrders: (recentOrders || []).map(formatOrder),
    today: getTodayEastern()
  });
};
