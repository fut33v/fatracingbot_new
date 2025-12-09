const db = require('./database');

// Add item to cart
async function addToCart(userId, productId, variantId = null, quantity = 1, gender = null, questionAnswers = null) {
  const userRow = await db.query('SELECT id FROM users WHERE telegram_id = $1', [userId]);
  const dbUserId = userRow.rows[0]?.id;
  if (!dbUserId) {
    throw new Error('user_not_found');
  }

  const answers = Array.isArray(questionAnswers) && questionAnswers.length ? questionAnswers : null;
  const answersJson = answers ? JSON.stringify(answers) : null;

  // If there are answers, treat as unique item; otherwise try to merge
  if (!answers) {
    const checkQuery = `
      SELECT id, quantity FROM cart_items
      WHERE user_id = $1
        AND product_id = $2
        AND (variant_id = $3 OR (variant_id IS NULL AND $3 IS NULL))
        AND (gender = $4 OR (gender IS NULL AND $4 IS NULL))
        AND (question_answers IS NULL)
    `;
    const checkResult = await db.query(checkQuery, [dbUserId, productId, variantId, gender]);
    
    if (checkResult.rows.length > 0) {
      const updateQuery = 'UPDATE cart_items SET quantity = quantity + $1, added_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *';
      return await db.query(updateQuery, [quantity, checkResult.rows[0].id]);
    }
  }

  const insertQuery = `
    INSERT INTO cart_items (user_id, product_id, variant_id, gender, question_answers, quantity)
    VALUES ($1, $2, $3, $4, $5::jsonb, $6) RETURNING *
  `;
  return await db.query(insertQuery, [dbUserId, productId, variantId, gender, answersJson, quantity]);
}

// Get user's cart items
async function getCartItems(userId) {
  const userRow = await db.query('SELECT id FROM users WHERE telegram_id = $1', [userId]);
  const dbUserId = userRow.rows[0]?.id;
  if (!dbUserId) return [];

  const query = `
    SELECT 
      ci.id,
      ci.quantity,
      ci.gender,
      ci.question_answers,
      p.id as product_id,
      p.name as product_name,
      p.price as product_price,
      p.currency as product_currency,
      p.is_preorder as is_preorder,
      pv.name as variant_name
    FROM cart_items ci
    JOIN products p ON ci.product_id = p.id
    LEFT JOIN product_variants pv ON ci.variant_id = pv.id
    WHERE ci.user_id = $1
    ORDER BY ci.added_at`;
  
  try {
    const result = await db.query(query, [dbUserId]);
    return result.rows;
  } catch (error) {
    console.error('Error getting cart items:', error);
    throw error;
  }
}

// Remove item from cart
async function removeFromCart(cartItemId, userId) {
  const userRow = await db.query('SELECT id FROM users WHERE telegram_id = $1', [userId]);
  const dbUserId = userRow.rows[0]?.id;
  if (!dbUserId) return false;

  const query = 'DELETE FROM cart_items WHERE id = $1 AND user_id = $2';
  try {
    const result = await db.query(query, [cartItemId, dbUserId]);
    return result.rowCount > 0;
  } catch (error) {
    console.error('Error removing item from cart:', error);
    throw error;
  }
}

// Clear user's cart
async function clearCart(userId) {
  const userRow = await db.query('SELECT id FROM users WHERE telegram_id = $1', [userId]);
  const dbUserId = userRow.rows[0]?.id;
  if (!dbUserId) return 0;

  const query = 'DELETE FROM cart_items WHERE user_id = $1';
  try {
    const result = await db.query(query, [dbUserId]);
    return result.rowCount;
  } catch (error) {
    console.error('Error clearing cart:', error);
    throw error;
  }
}

// Get cart total
async function getCartTotal(userId) {
  const userRow = await db.query('SELECT id FROM users WHERE telegram_id = $1', [userId]);
  const dbUserId = userRow.rows[0]?.id;
  if (!dbUserId) return 0;

  const query = `
    SELECT SUM(p.price * ci.quantity) as total
    FROM cart_items ci
    JOIN products p ON ci.product_id = p.id
    WHERE ci.user_id = $1`;
  
  try {
    const result = await db.query(query, [dbUserId]);
    return result.rows[0]?.total || 0;
  } catch (error) {
    console.error('Error calculating cart total:', error);
    throw error;
  }
}

module.exports = {
  addToCart,
  getCartItems,
  removeFromCart,
  clearCart,
  getCartTotal
};
