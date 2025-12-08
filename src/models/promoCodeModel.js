const db = require('./database');
const PromoCode = require('./PromoCode');

// Get all active promo codes that are within validity window
async function getActivePromoCodes() {
  const query = `
    SELECT * FROM promo_codes
    WHERE status = $1
      AND (start_date IS NULL OR start_date <= NOW())
      AND (end_date IS NULL OR end_date >= NOW())
    ORDER BY partner_name
  `;
  try {
    const result = await db.query(query, ['active']);
    return result.rows.map(row => new PromoCode(row)).filter(promo => promo.isActive());
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
      const promo = new PromoCode(result.rows[0]);
      return promo.isActive() ? promo : null;
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
