const db = require('./database');
const PromoCode = require('./PromoCode');

// Get all active promo codes
async function getActivePromoCodes() {
  const query = 'SELECT * FROM promo_codes WHERE status = $1 ORDER BY partner_name';
  try {
    const result = await db.query(query, ['active']);
    return result.rows.map(row => new PromoCode(row));
  } catch (error) {
    console.error('Error getting active promo codes:', error);
    throw error;
  }
}

// Get promo code by ID
async function getPromoCodeById(id) {
  const query = 'SELECT * FROM promo_codes WHERE id = $1';
  try {
    const result = await db.query(query, [id]);
    if (result.rows.length > 0) {
      return new PromoCode(result.rows[0]);
    }
    return null;
  } catch (error) {
    console.error('Error getting promo code by ID:', error);
    throw error;
  }
}

module.exports = {
  getActivePromoCodes,
  getPromoCodeById
};