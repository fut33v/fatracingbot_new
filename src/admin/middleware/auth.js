// Admin authentication middleware

// Check if user is authenticated and is admin
function requireAdmin(req, res, next) {
  // Check if user is authenticated
  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: 'Требуется аутентификация' });
  }
  
  // Check if user is admin
  const adminUserIds = process.env.ADMIN_USER_IDS ? process.env.ADMIN_USER_IDS.split(',').map(id => parseInt(id.trim())) : [];
  if (!adminUserIds.includes(req.session.user.telegram_id)) {
    return res.status(403).json({ error: 'Доступ запрещен. Только для администраторов.' });
  }
  
  next();
}

module.exports = {
  requireAdmin
};