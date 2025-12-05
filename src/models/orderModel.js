const db = require('./database');
const Order = require('./Order');

// Create a new order
async function createOrder(orderData) {
  // Resolve internal user id for FK
  const userResult = await db.query('SELECT id FROM users WHERE telegram_id = $1', [orderData.userId]);
  const dbUserId = userResult.rows[0]?.id;
  if (!dbUserId) {
    const err = new Error('user_not_found');
    err.code = 'USER_NOT_FOUND';
    throw err;
  }

  const query = `
    INSERT INTO orders (
      user_id, customer_name, phone, city_country, comment, total_amount, payment_proof_url, payment_confirmed,
      delivery_geo_id, delivery_pickup_id, delivery_pickup_address
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, FALSE, $8, $9, $10)
    RETURNING *`;
  
  const values = [
    dbUserId,
    orderData.customerName,
    orderData.phone,
    orderData.cityCountry,
    orderData.comment,
    orderData.totalAmount,
    orderData.paymentProofUrl || null,
    orderData.deliveryGeoId || null,
    orderData.deliveryPickupId || null,
    orderData.deliveryPickupAddress || null
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

async function getLatestOrderForUser(telegramId) {
  const query = `
    SELECT o.*
    FROM orders o
    JOIN users u ON o.user_id = u.id
    WHERE u.telegram_id = $1
    ORDER BY o.created_at DESC
    LIMIT 1
  `;
  try {
    const result = await db.query(query, [telegramId]);
    if (result.rows.length > 0) {
      return new Order(result.rows[0]);
    }
    return null;
  } catch (error) {
    console.error('Error getting latest order for user:', error);
    throw error;
  }
}

async function getOrdersWithItemsByTelegramId(telegramId) {
  const userResult = await db.query('SELECT id FROM users WHERE telegram_id = $1', [telegramId]);
  const dbUserId = userResult.rows[0]?.id;
  if (!dbUserId) {
    return [];
  }

  const ordersResult = await db.query(
    'SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC',
    [dbUserId]
  );
  const orders = ordersResult.rows.map(row => new Order(row));
  const orderIds = orders.map(order => order.id);

  if (orderIds.length === 0) {
    return orders;
  }

  const itemsResult = await db.query(
    `
      SELECT oi.*, p.name AS product_name, p.is_preorder, p.currency, pv.name AS variant_name
      FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.id
      LEFT JOIN product_variants pv ON oi.variant_id = pv.id
      WHERE oi.order_id = ANY($1::int[])
      ORDER BY oi.order_id, oi.id
    `,
    [orderIds]
  );

  const itemsByOrder = {};
  for (const row of itemsResult.rows) {
    const item = {
      id: row.id,
      orderId: row.order_id,
      productId: row.product_id,
      variantId: row.variant_id,
      gender: row.gender,
      quantity: row.quantity,
      pricePerUnit: parseFloat(row.price_per_unit),
      productName: row.product_name || 'Товар',
      variantName: row.variant_name,
      isPreorder: row.is_preorder || false,
      currency: row.currency || 'RUB'
    };
    itemsByOrder[item.orderId] = itemsByOrder[item.orderId] || [];
    itemsByOrder[item.orderId].push(item);
  }

  return orders.map(order => {
    order.items = itemsByOrder[order.id] || [];
    return order;
  });
}

// Create order items
async function createOrderItems(orderId, cartItems) {
  const query = `
    INSERT INTO order_items (
      order_id, product_id, variant_id, gender, quantity, price_per_unit
    ) VALUES ($1, $2, $3, $4, $5, $6)`;
  
  try {
    for (const item of cartItems) {
      const values = [
        orderId,
        item.product_id,
        item.variant_id,
        item.gender || null,
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
  getLatestOrderForUser,
  getOrdersWithItemsByTelegramId,
  createOrderItems
};
