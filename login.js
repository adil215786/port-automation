const { getDb } = require('../lib/db');
const { hashPin } = require('../lib/utils');
const { setSessionCookie, clearSessionCookie } = require('../lib/auth');
const { allowCors } = require('../lib/utils');

module.exports = async function handler(req, res) {
  allowCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'DELETE') {
    clearSessionCookie(res);
    return res.status(200).json({ ok: true });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { username, pin } = req.body || {};
  if (!username || !pin) return res.status(400).json({ error: 'Username and PIN required' });

  const db = getDb();
  const { data: users, error } = await db
    .from('users')
    .select('*')
    .ilike('username', username.trim())
    .eq('is_active', true)
    .limit(1);

  if (error) return res.status(500).json({ error: 'Database error' });
  if (!users || users.length === 0) return res.status(401).json({ error: 'Invalid username or PIN' });

  const user = users[0];
  const pinHash = hashPin(String(pin).trim());

  if (user.pin_hash !== pinHash) return res.status(401).json({ error: 'Invalid username or PIN' });

  setSessionCookie(res, {
    user_id: user.user_id,
    username: user.username,
    display_name: user.display_name,
    store_name: user.store_name,
    is_admin: user.is_admin
  });

  return res.status(200).json({
    ok: true,
    user: {
      display_name: user.display_name,
      store_name: user.store_name,
      is_admin: user.is_admin
    }
  });
};
