const jwt = require('jsonwebtoken');
const cookie = require('cookie');

const COOKIE_NAME = 'pa_session';
const EXPIRY_SECONDS = 12 * 60 * 60; // 12 hours

function signToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: EXPIRY_SECONDS });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (e) {
    return null;
  }
}

function setSessionCookie(res, payload) {
  const token = signToken(payload);
  res.setHeader('Set-Cookie', cookie.serialize(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.APP_ENV === 'production',
    sameSite: 'strict',
    maxAge: EXPIRY_SECONDS,
    path: '/'
  }));
  return token;
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', cookie.serialize(COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.APP_ENV === 'production',
    sameSite: 'strict',
    maxAge: 0,
    path: '/'
  }));
}

function getSessionFromRequest(req) {
  const cookies = cookie.parse(req.headers.cookie || '');
  const token = cookies[COOKIE_NAME];
  if (!token) return null;
  return verifyToken(token);
}

function requireSession(req, res) {
  const session = getSessionFromRequest(req);
  if (!session) {
    res.status(401).json({ error: 'Not authenticated' });
    return null;
  }
  return session;
}

function requireAdmin(req, res) {
  const session = requireSession(req, res);
  if (!session) return null;
  if (!session.is_admin) {
    res.status(403).json({ error: 'Admin access required' });
    return null;
  }
  return session;
}

module.exports = {
  setSessionCookie,
  clearSessionCookie,
  getSessionFromRequest,
  requireSession,
  requireAdmin
};
