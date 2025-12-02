const db = require('./database');
const User = require('./User');

// Create or update a user based on Telegram data
async function upsertUser(telegramUser) {
  const query = `
    INSERT INTO users (
      telegram_id, username, first_name, last_name, language_code, is_bot,
      is_premium, added_to_attachment_menu, can_join_groups,
      can_read_all_group_messages, supports_inline_queries, last_interaction
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP)
    ON CONFLICT (telegram_id) 
    DO UPDATE SET
      username = EXCLUDED.username,
      first_name = EXCLUDED.first_name,
      last_name = EXCLUDED.last_name,
      language_code = EXCLUDED.language_code,
      is_bot = EXCLUDED.is_bot,
      is_premium = EXCLUDED.is_premium,
      added_to_attachment_menu = EXCLUDED.added_to_attachment_menu,
      can_join_groups = EXCLUDED.can_join_groups,
      can_read_all_group_messages = EXCLUDED.can_read_all_group_messages,
      supports_inline_queries = EXCLUDED.supports_inline_queries,
      last_interaction = CURRENT_TIMESTAMP,
      is_blocked = FALSE
    RETURNING *`;
  
  const values = [
    telegramUser.id,
    telegramUser.username,
    telegramUser.first_name,
    telegramUser.last_name,
    telegramUser.language_code,
    telegramUser.is_bot || false,
    telegramUser.is_premium || false,
    telegramUser.added_to_attachment_menu || false,
    telegramUser.can_join_groups || false,
    telegramUser.can_read_all_group_messages || false,
    telegramUser.supports_inline_queries || false
  ];

  try {
    const result = await db.query(query, values);
    return new User(result.rows[0]);
  } catch (error) {
    console.error('Error upserting user:', error);
    throw error;
  }
}

// Get user by Telegram ID
async function getUserByTelegramId(telegramId) {
  const query = 'SELECT * FROM users WHERE telegram_id = $1';
  try {
    const result = await db.query(query, [telegramId]);
    if (result.rows.length > 0) {
      return new User(result.rows[0]);
    }
    return null;
  } catch (error) {
    console.error('Error getting user by Telegram ID:', error);
    throw error;
  }
}

// Update user's broadcast consent
async function updateUserConsent(telegramId, consent) {
  const query = 'UPDATE users SET consent_to_broadcast = $1, updated_at = CURRENT_TIMESTAMP WHERE telegram_id = $2 RETURNING *';
  try {
    const result = await db.query(query, [consent, telegramId]);
    if (result.rows.length > 0) {
      return new User(result.rows[0]);
    }
    return null;
  } catch (error) {
    console.error('Error updating user consent:', error);
    throw error;
  }
}

// Get all users who consented to broadcast
async function getUsersWithBroadcastConsent() {
  const query = 'SELECT * FROM users WHERE consent_to_broadcast = TRUE AND is_blocked = FALSE';
  try {
    const result = await db.query(query);
    return result.rows.map(row => new User(row));
  } catch (error) {
    console.error('Error getting users with broadcast consent:', error);
    throw error;
  }
}

// Get all active (not blocked) users
async function getActiveUsers() {
  const query = 'SELECT * FROM users WHERE is_blocked = FALSE';
  try {
    const result = await db.query(query);
    return result.rows.map(row => new User(row));
  } catch (error) {
    console.error('Error getting active users:', error);
    throw error;
  }
}

// Mark user as blocked
async function markUserAsBlocked(telegramId) {
  const query = 'UPDATE users SET is_blocked = TRUE, updated_at = CURRENT_TIMESTAMP WHERE telegram_id = $1 RETURNING *';
  try {
    const result = await db.query(query, [telegramId]);
    if (result.rows.length > 0) {
      return new User(result.rows[0]);
    }
    return null;
  } catch (error) {
    console.error('Error marking user as blocked:', error);
    throw error;
  }
}

module.exports = {
  upsertUser,
  getUserByTelegramId,
  updateUserConsent,
  getUsersWithBroadcastConsent,
  getActiveUsers,
  markUserAsBlocked
};
