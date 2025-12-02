const db = require('./database');
const Order = require('./Order');

// Create a new order
async function createOrder(orderData) {
  const query = `
    INSERT INTO orders (
      user_id, customer_name, phone, city_country, comment, total_amount
    ) VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *`;
  
  const values = [
    orderData.userId,
    orderData.customerName,
    orderData.phone,
    orderData.cityCountry,
    orderData.comment,
    orderData.totalAmount
  ];

  try {
    const result = await db.query(query, values);
    return new Order(result.rows[0]);
  } catch (error) {
    console.error('Error creating order:', error);
    throw error;
  }
}

// Get order by ID
async function getOrderById(id) {
  const query = 'SELECT * FROM orders WHERE id = $1';
  try {
    const result = await db.query(query, [id]);
    if (result.rows.length > 0) {
      return new Order(result.rows[0]);
    }
    return null;
  } catch (error) {
    console.error('Error getting order by ID:', error);
    throw error;
  }
}

// Get user's orders
async function getUserOrders(userId) {
  const query = 'SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC';
  try {
    const result = await db.query(query, [userId]);
    return result.rows.map(row => new Order(row));
  } catch (error) {
    console.error('Error getting user orders:', error);
    throw error;
  }
}

// Create order items
async function createOrderItems(orderId, cartItems) {
  const query = `
    INSERT INTO order_items (
      order_id, product_id, variant_id, quantity, price_per_unit
    ) VALUES ($1, $2, $3, $4, $5)`;
  
  try {
    for (const item of cartItems) {
      const values = [
        orderId,
        item.product_id,
        item.variant_id,
        item.quantity,
        item.product_price
      ];
      await db.query(query, values);
    }
    return true;
  } catch (error) {
    console.error('Error creating order items:', error);
    throw error;
  }
}

module.exports = {
  createOrder,
  getOrderById,
  getUserOrders,
  createOrderItems
};