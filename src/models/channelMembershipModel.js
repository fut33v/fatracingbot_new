const db = require('./database');
const ChannelMembership = require('./ChannelMembership');

// Record user joining the channel
async function recordUserJoin(userId) {
  // First check if user already has an active membership
  const checkQuery = 'SELECT * FROM channel_membership WHERE user_id = $1 AND leave_date IS NULL';
  const checkResult = await db.query(checkQuery, [userId]);
  
  if (checkResult.rows.length > 0) {
    // User is already subscribed, no need to create new record
    return new ChannelMembership(checkResult.rows[0]);
  }
  
  // Check if user has previous memberships
  const prevQuery = 'SELECT * FROM channel_membership WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1';
  const prevResult = await db.query(prevQuery, [userId]);
  
  if (prevResult.rows.length > 0) {
    // Update previous membership with days subscribed
    const prevMembership = new ChannelMembership(prevResult.rows[0]);
    if (prevMembership.joinDate && prevMembership.leaveDate) {
      const days = prevMembership.calculateSubscriptionDays();
      const updateQuery = 'UPDATE channel_membership SET days_subscribed = $1 WHERE id = $2';
      await db.query(updateQuery, [days, prevMembership.id]);
    }
  }
  
  // Create new membership record
  const insertQuery = 'INSERT INTO channel_membership (user_id, join_date) VALUES ($1, CURRENT_TIMESTAMP) RETURNING *';
  const result = await db.query(insertQuery, [userId]);
  return new ChannelMembership(result.rows[0]);
}

// Record user leaving the channel
async function recordUserLeave(userId) {
  // Find active membership
  const query = 'UPDATE channel_membership SET leave_date = CURRENT_TIMESTAMP WHERE user_id = $1 AND leave_date IS NULL RETURNING *';
  const result = await db.query(query, [userId]);
  
  if (result.rows.length > 0) {
    // Update days subscribed
    const membership = new ChannelMembership(result.rows[0]);
    const days = membership.calculateSubscriptionDays();
    const updateQuery = 'UPDATE channel_membership SET days_subscribed = $1 WHERE id = $2';
    await db.query(updateQuery, [days, membership.id]);
    return new ChannelMembership({...membership, daysSubscribed: days});
  }
  
  return null;
}

// Get user's channel membership
async function getUserMembership(userId) {
  const query = 'SELECT * FROM channel_membership WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1';
  const result = await db.query(query, [userId]);
  
  if (result.rows.length > 0) {
    return new ChannelMembership(result.rows[0]);
  }
  
  return null;
}

// Get total subscription days for user
async function getTotalSubscriptionDays(userId) {
  const query = 'SELECT COALESCE(SUM(days_subscribed), 0) as total_days FROM channel_membership WHERE user_id = $1';
  const result = await db.query(query, [userId]);
  return parseInt(result.rows[0].total_days);
}

module.exports = {
  recordUserJoin,
  recordUserLeave,
  getUserMembership,
  getTotalSubscriptionDays
};