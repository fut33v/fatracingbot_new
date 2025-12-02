const db = require('./database');

// Add item to cart
async function addToCart(userId, productId, variantId = null, quantity = 1) {
  // First, check if this item is already in the cart
  const checkQuery = 'SELECT id, quantity FROM cart_items WHERE user_id = $1 AND product_id = $2 AND (variant_id = $3 OR (variant_id IS NULL AND $3 IS NULL))';
  const checkResult = await db.query(checkQuery, [userId, productId, variantId]);
  
  if (checkResult.rows.length > 0) {
    // Update existing cart item
    const updateQuery = 'UPDATE cart_items SET quantity = quantity + $1, added_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *';
    return await db.query(updateQuery, [quantity, checkResult.rows[0].id]);
  } else {
    // Insert new cart item
    const insertQuery = 'INSERT INTO cart_items (user_id, product_id, variant_id, quantity) VALUES ($1, $2, $3, $4) RETURNING *';
    return await db.query(insertQuery, [userId, productId, variantId, quantity]);
  }
}

// Get user's cart items
async function getCartItems(userId) {
  const query = `
    SELECT 
      ci.id,
      ci.quantity,
      p.id as product_id,
      p.name as product_name,
      p.price as product_price,
      p.currency as product_currency,
      pv.name as variant_name
    FROM cart_items ci
    JOIN products p ON ci.product_id = p.id
    LEFT JOIN product_variants pv ON ci.variant_id = pv.id
    WHERE ci.user_id = $1
    ORDER BY ci.added_at`;
  
  try {
    const result = await db.query(query, [userId]);
    return result.rows;
  } catch (error) {
    console.error('Error getting cart items:', error);
    throw error;
  }
}

// Remove item from cart
async function removeFromCart(cartItemId, userId) {
  const query = 'DELETE FROM cart_items WHERE id = $1 AND user_id = $2';
  try {
    const result = await db.query(query, [cartItemId, userId]);
    return result.rowCount > 0;
  } catch (error) {
    console.error('Error removing item from cart:', error);
    throw error;
  }
}

// Clear user's cart
async function clearCart(userId) {
  const query = 'DELETE FROM cart_items WHERE user_id = $1';
  try {
    const result = await db.query(query, [userId]);
    return result.rowCount;
  } catch (error) {
    console.error('Error clearing cart:', error);
    throw error;
  }
}

// Get cart total
async function getCartTotal(userId) {
  const query = `
    SELECT SUM(p.price * ci.quantity) as total
    FROM cart_items ci
    JOIN products p ON ci.product_id = p.id
    WHERE ci.user_id = $1`;
  
  try {
    const result = await db.query(query, [userId]);
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