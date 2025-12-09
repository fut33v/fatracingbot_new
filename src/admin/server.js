require('dotenv').config();
const express = require('express');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const cookieParser = require('cookie-parser');
const https = require('https');
const db = require('../models/database');
const BroadcastService = require('../services/broadcastService');
const { requireAdmin } = require('./middleware/auth');
const BOT_USERNAME = (process.env.BOT_USERNAME || 'fatracingbot').replace(/^@/, '');
const PRODUCT_WITH_IMAGES_QUERY = `
  SELECT p.*,
    COALESCE(
      json_agg(pi.url ORDER BY pi.position, pi.id) FILTER (WHERE pi.id IS NOT NULL),
      '[]'::json
    ) AS images
  FROM products p
  LEFT JOIN product_images pi ON pi.product_id = p.id
  WHERE p.id = $1
  GROUP BY p.id
`;
const PRODUCT_VARIANTS_QUERY = 'SELECT id, name, stock FROM product_variants WHERE product_id = $1 ORDER BY name';
const ALL_PRODUCTS_WITH_IMAGES_QUERY = `
  SELECT p.*,
    COALESCE(
      json_agg(pi.url ORDER BY pi.position, pi.id) FILTER (WHERE pi.id IS NOT NULL),
      '[]'::json
    ) AS images
  FROM products p
  LEFT JOIN product_images pi ON pi.product_id = p.id
  GROUP BY p.id
  ORDER BY p.created_at DESC
`;

// Escape MarkdownV2 specials while preserving common formatting tokens.
// We leave *, _, [, ], (, ), ~, `, >, # intact when they are part of links/bold,
// and escape the most common offenders in free text.
function escapeMarkdownV2(text = '') {
  return text
    .replace(/([!#])/g, '\\$1')
    .replace(/\./g, '\\.')
    .replace(/-/g, '\\-')
    .replace(/\+/g, '\\+');
}

function normalizeProductImages(imagesInput, photoUrl, options = {}) {
  const { includePhoto = true } = options;
  const images = Array.isArray(imagesInput)
    ? imagesInput
        .filter(url => typeof url === 'string')
        .map(url => url.trim())
        .filter(Boolean)
    : [];

  if (includePhoto && photoUrl && !images.includes(photoUrl)) {
    images.unshift(photoUrl);
  }
  return images;
}

async function saveProductImages(client, productId, images) {
  await client.query('DELETE FROM product_images WHERE product_id = $1', [productId]);
  if (!images || images.length === 0) return;

  for (let i = 0; i < images.length; i += 1) {
    await client.query(
      'INSERT INTO product_images (product_id, url, position) VALUES ($1, $2, $3)',
      [productId, images[i], i]
    );
  }
}

async function fetchProductWithImages(productId) {
  const result = await db.query(PRODUCT_WITH_IMAGES_QUERY, [productId]);
  return result.rows[0] || null;
}

async function fetchProductVariants(productId) {
  const result = await db.query(PRODUCT_VARIANTS_QUERY, [productId]);
  return result.rows || [];
}

async function saveProductVariants(client, productId, variants = []) {
  // Clean up cart items that reference existing variants to avoid FK violations
  await client.query(
    'DELETE FROM cart_items WHERE variant_id IN (SELECT id FROM product_variants WHERE product_id = $1)',
    [productId]
  );
  await client.query('DELETE FROM product_variants WHERE product_id = $1', [productId]);
  if (!variants || variants.length === 0) return;
  for (const variant of variants) {
    if (!variant?.name) continue;
    const stock = Number.isNaN(parseInt(variant.stock, 10)) ? 0 : parseInt(variant.stock, 10);
    await client.query(
      'INSERT INTO product_variants (product_id, name, stock) VALUES ($1, $2, $3)',
      [productId, variant.name.trim(), stock]
    );
  }
}

async function fetchProductFull(productId) {
  const product = await fetchProductWithImages(productId);
  if (!product) return null;
  const variants = await fetchProductVariants(productId);
  return { ...product, variants };
}

const app = express();
const PORT = process.env.ADMIN_PORT || 3000;
const broadcastService = process.env.BOT_TOKEN ? new BroadcastService(process.env.BOT_TOKEN) : null;

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// Add request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path} - Session: ${req.session ? 'exists' : 'none'}`);
  next();
});

// Session middleware backed by DB
app.use(async (req, res, next) => {
  try {
    const sessionId = req.cookies ? req.cookies.session_id : null;
    if (!sessionId) {
      req.session = null;
      return next();
    }

    const session = await getSession(sessionId);
    req.session = session;
    next();
  } catch (error) {
    console.error('Session middleware error:', error);
    req.session = null;
    next();
  }
});

// Telegram Login Widget endpoint
app.get('/api/auth/telegram', async (req, res) => {
  try {
    const { id, first_name, last_name, username, photo_url, auth_date, hash } = req.query;
    
    // Verify the hash to ensure the request is from Telegram
    const secretKey = crypto.createHash('sha256').update(process.env.BOT_TOKEN).digest();
    const dataCheckString = Object.keys(req.query)
      .filter(key => key !== 'hash')
      .sort()
      .map(key => `${key}=${req.query[key]}`)
      .join('\n');
    
    const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
    
    // Check if hash matches and auth_date is not too old (5 minutes)
    const currentTime = Math.floor(Date.now() / 1000);
    if (calculatedHash !== hash || (currentTime - auth_date) > 300) {
      return res.status(401).json({ error: 'Invalid authentication data' });
    }
    
    // Check if user is admin (convert to integer for consistent comparison)
    const adminUserIds = process.env.ADMIN_USER_IDS ? process.env.ADMIN_USER_IDS.split(',').map(id => parseInt(id.trim())) : [];
    if (!adminUserIds.includes(parseInt(id))) {
      return res.status(403).json({ error: 'Пользователь не является администратором' });
    }
    
    // Create session
    const sessionId = crypto.randomBytes(32).toString('hex');
    const userSession = {
      id: parseInt(id),
      telegram_id: parseInt(id), // Store as integer
      first_name,
      last_name,
      username,
      photo_url
    };
    await saveSession(sessionId, userSession);
    
    // Set session cookie
    res.cookie('session_id', sessionId, { 
      httpOnly: true, 
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: 'lax'
    });
    
    console.log(`User ${first_name} logged in with session ${sessionId}`);
    
    // Redirect to admin panel
    res.redirect('/');
  } catch (error) {
    console.error('Telegram auth error:', error);
    res.status(500).json({ error: 'Ошибка аутентификации' });
  }
});

app.get('/api/auth/check', (req, res) => {
  console.log('Auth check called, session:', req.session ? 'exists' : 'none');
  if (req.session && req.session.user) {
    console.log('User authenticated:', req.session.user.first_name);
    res.json({ 
      authenticated: true,
      user: req.session.user
    });
  } else {
    console.log('User not authenticated');
    res.status(401).json({ error: 'Не авторизован' });
  }
});

app.post('/api/auth/logout', async (req, res) => {
  // Clear session
  const sessionId = req.cookies ? req.cookies.session_id : null;
  if (sessionId) {
    try {
      await deleteSession(sessionId);
    } catch (error) {
      console.error('Error deleting session during logout:', error);
    }
  }
  
  // Clear cookie
  res.clearCookie('session_id');
  res.json({ message: 'Выход выполнен успешно' });
});

// Serve the main admin panel page
app.get('/', (req, res) => {
  try {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  } catch (error) {
    console.error('Error serving index.html:', error);
    res.status(500).json({ error: 'Failed to serve index page' });
  }
});

// Serve login page
app.get('/login.html', (req, res) => {
  try {
    const loginPath = path.join(__dirname, 'public', 'login.html');
    const raw = fs.readFileSync(loginPath, 'utf8');
    const rendered = raw.replace(/__BOT_USERNAME__/g, BOT_USERNAME);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(rendered);
  } catch (error) {
    console.error('Error serving login.html:', error);
    res.status(500).json({ error: 'Failed to serve login page' });
  }
});

// Serve static assets after dynamic login rendering
app.use(express.static(path.join(__dirname, 'public')));

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    // Check database connection
    const dbResult = await db.query('SELECT NOW()');
    
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: {
        connected: true,
        time: dbResult.rows[0].now
      }
    });
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(500).json({
      status: 'error',
      error: error.message
    });
  }
});

// Dashboard statistics
app.get('/api/dashboard/stats', requireAdmin, async (req, res) => {
  try {
    console.log('Dashboard stats requested by user:', req.session.user.first_name);
    
    // Users
    const totalUsersResult = await db.query('SELECT COUNT(*) as count FROM users');
    const totalUsers = parseInt(totalUsersResult.rows[0].count);
    const activeUsersResult = await db.query('SELECT COUNT(*) as count FROM users WHERE is_blocked = FALSE');
    const activeUsers = parseInt(activeUsersResult.rows[0].count);
    const blockedResult = await db.query('SELECT COUNT(*) as count FROM users WHERE is_blocked = TRUE');
    const blockedUsers = parseInt(blockedResult.rows[0].count);
    const consentUsers = activeUsers; // legacy field for UI; equals active users
    
    // Get new orders
    const ordersResult = await db.query('SELECT COUNT(*) as count FROM orders WHERE status = $1', ['new']);
    const newOrders = parseInt(ordersResult.rows[0].count);
    
    // Get total revenue (simplified)
    const revenueResult = await db.query('SELECT COALESCE(SUM(total_amount), 0) as total FROM orders WHERE status != $1', ['cancelled']);
    const totalRevenue = parseFloat(revenueResult.rows[0].total);
    const confirmedRevenueResult = await db.query('SELECT COALESCE(SUM(total_amount), 0) as total FROM orders WHERE payment_confirmed = TRUE');
    const confirmedRevenue = parseFloat(confirmedRevenueResult.rows[0].total);
    const costResult = await db.query(
      `SELECT COALESCE(SUM((p.cost + CASE WHEN p.shipping_included THEN p.shipping_cost ELSE 0 END) * oi.quantity), 0) as total_cost
       FROM order_items oi
       JOIN products p ON oi.product_id = p.id
       JOIN orders o ON oi.order_id = o.id
       WHERE o.payment_confirmed = TRUE`
    );
    const confirmedCost = parseFloat(costResult.rows[0].total_cost);
    const tax = (confirmedRevenue || 0) * 0.06;
    const netProfit = (confirmedRevenue || 0) - (confirmedCost || 0) - tax;
    
    res.json({
      totalUsers,
      activeUsers,
      consentUsers,
      blockedUsers,
      newOrders,
      totalRevenue: confirmedRevenue || totalRevenue,
      totalCost: confirmedCost || 0,
      tax: tax || 0,
      netProfit
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({
      error: 'Failed to fetch dashboard statistics'
    });
  }
});

// Get all products
app.get('/api/products', requireAdmin, async (req, res) => {
  try {
    console.log('Products requested by user:', req.session.user.first_name);
    
    const result = await db.query(ALL_PRODUCTS_WITH_IMAGES_QUERY);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({
      error: 'Failed to fetch products'
    });
  }
});

// Get product by ID
app.get('/api/products/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const product = await fetchProductFull(id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(product);
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({
      error: 'Failed to fetch product'
    });
  }
});

// Create a new product
app.post('/api/products', requireAdmin, async (req, res) => {
  try {
    const {
      name,
      description,
      price,
      cost,
      shipping_included,
      shipping_cost,
      currency,
      stock,
      photo_url,
      size_guide_url,
      gender_required,
      questions,
      images,
      variants,
      status,
      is_preorder,
      preorder_end_date,
      estimated_delivery_date
    } = req.body;
    const normalizedImages = normalizeProductImages(images, photo_url, { includePhoto: true });
    const coverUrl = normalizedImages[0] || photo_url || null;
    const normalizedQuestions = Array.isArray(questions) ? questions.filter(Boolean) : [];
    const questionsJson = JSON.stringify(normalizedQuestions);
    const client = await db.getClient();

    try {
      await client.query('BEGIN');
      const insertResult = await client.query(
        `INSERT INTO products (name, description, price, cost, shipping_included, shipping_cost, currency, photo_url, size_guide_url, gender_required, questions, stock, is_preorder, preorder_end_date, estimated_delivery_date, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12, $13, $14, $15, $16) RETURNING id`,
        [
          name,
          description,
          price,
          cost || 0,
          shipping_included === true,
          shipping_cost || 0,
          currency || 'RUB',
          coverUrl,
          size_guide_url || null,
          gender_required === true,
          questionsJson,
          stock || 0,
          is_preorder === true,
          preorder_end_date || null,
          estimated_delivery_date || null,
          status || 'active',
        ]
      );

      const productId = insertResult.rows[0].id;
      await saveProductImages(client, productId, normalizedImages);
      await saveProductVariants(client, productId, variants);
      await client.query('COMMIT');

      const created = await fetchProductFull(productId);
      res.json(created || insertResult.rows[0]);
    } catch (dbError) {
      await client.query('ROLLBACK');
      throw dbError;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({
      error: 'Failed to create product'
    });
  }
});

// Update a product
app.put('/api/products/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      price,
      cost,
      shipping_included,
      shipping_cost,
      currency,
      stock,
      photo_url,
      size_guide_url,
      gender_required,
      questions,
      images,
      variants,
      status,
      is_preorder,
      preorder_end_date,
      estimated_delivery_date
    } = req.body;

    const existing = await fetchProductFull(id);
    if (!existing) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const includeExistingCover = images === undefined;
    const normalizedImages = images === undefined
      ? normalizeProductImages(existing.images || [], photo_url || existing.photo_url, { includePhoto: true })
      : normalizeProductImages(images, null, { includePhoto: false });
    const coverUrl = normalizedImages[0] || (includeExistingCover ? (photo_url || existing.photo_url || null) : null);
    const normalizedQuestions = questions === undefined
      ? (Array.isArray(existing.questions) ? existing.questions.filter(Boolean) : [])
      : (Array.isArray(questions) ? questions.filter(Boolean) : []);
    const questionsJson = JSON.stringify(normalizedQuestions);
    const client = await db.getClient();

    try {
      await client.query('BEGIN');
      const result = await client.query(
        `UPDATE products
         SET name = $1, description = $2, price = $3, cost = $4, shipping_included = $5, shipping_cost = $6, currency = $7, stock = $8, photo_url = $9, size_guide_url = $10, gender_required = $11, questions = $12::jsonb, status = $13, is_preorder = $14,
             preorder_end_date = $15, estimated_delivery_date = $16, updated_at = CURRENT_TIMESTAMP
         WHERE id = $17 RETURNING id`,
        [
          name,
          description,
          price,
          cost || 0,
          shipping_included === true,
          shipping_cost || 0,
          currency,
          stock,
          coverUrl,
          size_guide_url || null,
          gender_required === true,
          questionsJson,
          status,
          is_preorder === true,
          preorder_end_date || null,
          estimated_delivery_date || null,
          id
        ]
      );

      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({
          error: 'Product not found'
        });
      }

      await saveProductImages(client, id, normalizedImages);
      await saveProductVariants(client, id, variants);
      await client.query('COMMIT');

      const updated = await fetchProductFull(id);
      res.json(updated || { ...existing, photo_url: coverUrl, images: normalizedImages, variants });
    } catch (dbError) {
      await client.query('ROLLBACK');
      throw dbError;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({
      error: 'Failed to update product'
    });
  }
});

// Delete a product
app.delete('/api/products/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await db.query('DELETE FROM products WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Product not found'
      });
    }
    
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({
      error: 'Failed to delete product'
    });
  }
});

// Get all promo codes
app.get('/api/promos', requireAdmin, async (req, res) => {
  try {
    console.log('Promos requested by user:', req.session.user.first_name);
    
    const result = await db.query('SELECT * FROM promo_codes ORDER BY partner_name');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching promo codes:', error);
    res.status(500).json({
      error: 'Failed to fetch promo codes'
    });
  }
});

// Create a new promo code
app.post('/api/promos', requireAdmin, async (req, res) => {
  try {
    const { partner_name, description, code, link, start_date, end_date, status } = req.body;
    
    const result = await db.query(
      'INSERT INTO promo_codes (partner_name, description, code, link, start_date, end_date, status) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [partner_name, description, code, link, start_date || null, end_date || null, status || 'active']
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating promo code:', error);
    res.status(500).json({
      error: 'Failed to create promo code'
    });
  }
});

// Update a promo code
app.put('/api/promos/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { partner_name, description, code, link, start_date, end_date, status } = req.body;
    
    const result = await db.query(
      'UPDATE promo_codes SET partner_name = $1, description = $2, code = $3, link = $4, start_date = $5, end_date = $6, status = $7, updated_at = CURRENT_TIMESTAMP WHERE id = $8 RETURNING *',
      [partner_name, description, code, link, start_date, end_date, status, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Promo code not found'
      });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating promo code:', error);
    res.status(500).json({
      error: 'Failed to update promo code'
    });
  }
});

// Delete a promo code
app.delete('/api/promos/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await db.query('DELETE FROM promo_codes WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Promo code not found'
      });
    }
    
    res.json({ message: 'Promo code deleted successfully' });
  } catch (error) {
    console.error('Error deleting promo code:', error);
    res.status(500).json({
      error: 'Failed to delete promo code'
    });
  }
});

// Get all orders
app.get('/api/orders', requireAdmin, async (req, res) => {
  try {
    console.log('Orders requested by user:', req.session.user.first_name);
    
    const { status } = req.query;
    let query = `
      SELECT o.*, u.first_name, u.last_name, u.username
      FROM orders o
      JOIN users u ON o.user_id = u.id`;
    const params = [];
    
    if (status) {
      query += ' WHERE o.status = $1';
      params.push(status);
    }
    
    query += ' ORDER BY o.created_at DESC';
    
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({
      error: 'Failed to fetch orders'
    });
  }
});

// Update order status
app.put('/api/orders/:id/status', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    const result = await db.query(
      'UPDATE orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [status, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Order not found'
      });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({
      error: 'Failed to update order status'
    });
  }
});

// Delete order
app.delete('/api/orders/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query('DELETE FROM orders WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    res.json({ message: 'Order deleted successfully' });
  } catch (error) {
    console.error('Error deleting order:', error);
    res.status(500).json({ error: 'Failed to delete order' });
  }
});

// Get order by ID with user info
app.get('/api/orders/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      `SELECT o.*, u.first_name, u.last_name, u.username, u.telegram_id
       FROM orders o
       JOIN users u ON o.user_id = u.id
       WHERE o.id = $1`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    const order = result.rows[0];

    // fetch items with product/variant info
    const itemsResult = await db.query(
      `SELECT oi.id,
              oi.product_id,
              p.name AS product_name,
              oi.variant_id,
              pv.name AS variant_name,
              oi.gender,
              oi.question_answers,
              oi.quantity,
              oi.price_per_unit
       FROM order_items oi
       LEFT JOIN products p ON oi.product_id = p.id
       LEFT JOIN product_variants pv ON oi.variant_id = pv.id
       WHERE oi.order_id = $1
       ORDER BY oi.id`,
      [id]
    );
    order.items = itemsResult.rows;
    res.json(order);
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

// Create Yandex Delivery request for order
app.post('/api/orders/:id/delivery-request', requireAdmin, async (req, res) => {
  const token = process.env.YANDEX_DELIVERY_TOKEN;
  const sourcePlatformId = process.env.YANDEX_SOURCE_PLATFORM_ID;

  if (!token) {
    return res.status(400).json({ error: 'YANDEX_DELIVERY_TOKEN is not configured' });
  }
  if (!sourcePlatformId) {
    return res.status(400).json({ error: 'YANDEX_SOURCE_PLATFORM_ID is not configured' });
  }

  try {
    const { id } = req.params;
    const orderResult = await db.query(
      `SELECT o.*, u.first_name, u.last_name, u.username, u.telegram_id
       FROM orders o
       JOIN users u ON o.user_id = u.id
       WHERE o.id = $1`,
      [id]
    );
    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    const order = orderResult.rows[0];

    if (!order.delivery_pickup_id) {
      return res.status(400).json({ error: 'У заказа нет выбранного ПВЗ (delivery_pickup_id)' });
    }

    const payload = buildDeliveryPayload(order, sourcePlatformId);
    const offerResponse = await callYandexDelivery(
      '/api/b2b/platform/offers/create?send_unix=false',
      payload,
      token
    );

    const offer = pickCheapestOffer(offerResponse?.offers || []);
    if (offer?.offer_id) {
      payload.offer_id = offer.offer_id;
    }

    const requestResponse = await callYandexDelivery(
      '/api/b2b/platform/request/create?send_unix=false',
      payload,
      token,
      { 'Accept-Language': 'ru' }
    );

    const requestId = requestResponse?.id || requestResponse?.request_id || null;
    const offerId = offer?.offer_id || null;

    await db.query(
      `UPDATE orders SET delivery_offer_id = $1, delivery_request_id = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
      [offerId, requestId, id]
    );

    res.json({
      delivery_offer_id: offerId,
      delivery_request_id: requestId,
      offer,
      offer_response: offerResponse,
      request_response: requestResponse
    });
  } catch (error) {
    console.error('Error creating delivery request:', error);
    res.status(500).json({ error: error.message || 'Failed to create delivery request' });
  }
});

// Confirm payment
app.put('/api/orders/:id/payment', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { confirmed } = req.body;
    const isConfirmed = confirmed === false ? false : true;
    const result = await db.query(
      `UPDATE orders
       SET payment_confirmed = $1,
           payment_confirmed_at = CASE WHEN $1 THEN CURRENT_TIMESTAMP ELSE NULL END,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [isConfirmed, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Notify user about payment confirmation
    if (isConfirmed && broadcastService) {
      try {
        const order = result.rows[0];
        const userResult = await db.query('SELECT telegram_id FROM users WHERE id = $1', [order.user_id]);
        const telegramId = userResult.rows?.[0]?.telegram_id;
        if (telegramId) {
          const message = [
            `✅ Оплата по заказу #${order.id} подтверждена!`,
            'Скоро свяжемся для уточнения деталей.',
            'Если остались вопросы — @fatracing_manager.'
          ].join('\n');
          await broadcastService.sendMessageToUser(telegramId, message);
        }
      } catch (notifyError) {
        console.error('Failed to notify user about payment confirmation:', notifyError);
      }
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error confirming payment:', error);
    res.status(500).json({ error: 'Failed to update payment status' });
  }
});

// Get all users
app.get('/api/users', requireAdmin, async (req, res) => {
  try {
    console.log('Users requested by user:', req.session.user.first_name);
    
    const { consent } = req.query;
    let query = 'SELECT * FROM users';
    const params = [];
    
    if (consent === 'true') {
      query += ' WHERE consent_to_broadcast = TRUE';
    } else if (consent === 'false') {
      query += ' WHERE consent_to_broadcast = FALSE';
    }
    
    query += ' ORDER BY created_at DESC';
    
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      error: 'Failed to fetch users'
    });
  }
});

// Get user by id
app.get('/api/users/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query('SELECT * FROM users WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Get all broadcasts
app.get('/api/broadcasts', requireAdmin, async (req, res) => {
  try {
    console.log('Broadcasts requested by user:', req.session.user.first_name);
    
    const result = await db.query('SELECT * FROM broadcasts ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching broadcasts:', error);
    res.status(500).json({
      error: 'Failed to fetch broadcasts'
    });
  }
});

// Get broadcast by id
app.get('/api/broadcasts/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const broadcastId = parseInt(id, 10);
    if (!broadcastId) {
      return res.status(400).json({ error: 'Invalid broadcast id' });
    }

    const result = await db.query('SELECT * FROM broadcasts WHERE id = $1', [broadcastId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Broadcast not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching broadcast:', error);
    res.status(500).json({ error: 'Failed to fetch broadcast' });
  }
});

// Upload image and return public URL
app.post('/api/uploads', requireAdmin, async (req, res) => {
  try {
    const { name, data } = req.body || {};
    if (!data) {
      return res.status(400).json({ error: 'Файл не передан' });
    }

    const match = data.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!match) {
      return res.status(400).json({ error: 'Неверный формат файла' });
    }

    const mime = match[1];
    const base64 = match[2];
    const allowed = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/gif': 'gif'
    };

    if (!allowed[mime]) {
      return res.status(400).json({ error: 'Поддерживаются только изображения (jpg, png, webp, gif)' });
    }

    const uploadDir = path.join(__dirname, 'public', 'uploads');
    fs.mkdirSync(uploadDir, { recursive: true });

    const ext = allowed[mime];
    const safeName = (name || 'upload').replace(/[^a-zA-Z0-9._-]/g, '');
    const fileName = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}-${safeName || 'file'}.${ext}`;
    const filePath = path.join(uploadDir, fileName);

    fs.writeFileSync(filePath, Buffer.from(base64, 'base64'));

    const publicBase = getPublicBaseUrl();
    const url = `${publicBase}/uploads/${fileName}`;

    console.log(`Upload saved: ${filePath}, url: ${url}`);

    res.json({ url });
  } catch (error) {
    console.error('Error uploading image:', error);
    res.status(500).json({ error: 'Ошибка загрузки изображения' });
  }
});

// Create a new broadcast
app.post('/api/broadcasts', requireAdmin, async (req, res) => {
  try {
    const { title, content, photo_url, buttons, target_segment, use_markdown } = req.body;
    
    const result = await db.query(
      'INSERT INTO broadcasts (title, content, photo_url, buttons, target_segment, use_markdown, status) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [title, content, photo_url || null, JSON.stringify(buttons) || null, target_segment || 'consent', use_markdown === true, 'draft']
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating broadcast:', error);
    res.status(500).json({
      error: 'Failed to create broadcast'
    });
  }
});

// Update broadcast status
app.put('/api/broadcasts/:id/status', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const broadcastId = parseInt(id, 10);
    const allowedStatuses = ['draft', 'sending', 'sent', 'failed'];

    if (!broadcastId || !allowedStatuses.includes(status)) {
      return res.status(400).json({
        error: 'Invalid broadcast status update'
      });
    }
    
    const existing = await db.query('SELECT * FROM broadcasts WHERE id = $1', [broadcastId]);
    if (existing.rows.length === 0) {
      return res.status(404).json({
        error: 'Broadcast not found'
      });
    }

    const broadcast = existing.rows[0];
    
    if (status !== 'sending') {
      const result = await db.query(
        'UPDATE broadcasts SET status = $1 WHERE id = $2 RETURNING *',
        [status, broadcastId]
      );
      return res.json(result.rows[0]);
    }

    if (!broadcastService) {
      return res.status(500).json({
        error: 'BOT_TOKEN is not configured for broadcasting'
      });
    }

    if (broadcast.status === 'sent') {
      return res.status(400).json({
        error: 'Broadcast has already been sent'
      });
    }

    // Mark as sending before dispatch to avoid duplicate triggers
    await db.query(
      'UPDATE broadcasts SET status = $1 WHERE id = $2',
      ['sending', broadcastId]
    );

    const buttons = normalizeButtons(broadcast.buttons);
    let messageText = broadcast.title ? `${broadcast.title}\n\n${broadcast.content}` : broadcast.content;
    if (broadcast.use_markdown) {
      messageText = escapeMarkdownV2(messageText);
    }
    const sendResult = await broadcastService.sendBroadcast(messageText, {
      photoUrl: broadcast.photo_url,
      buttons,
      targetSegment: broadcast.target_segment || 'consent',
      parseMode: broadcast.use_markdown ? 'MarkdownV2' : null
    });

    const sentCount = sendResult.sentCount || 0;
    const failedCount = sendResult.failedCount || 0;
    const finalStatus = sendResult.success ? 'sent' : 'failed';

    const result = await db.query(
      'UPDATE broadcasts SET status = $1, sent_count = $2, failed_count = $3, sent_at = CURRENT_TIMESTAMP WHERE id = $4 RETURNING *',
      [finalStatus, sentCount, failedCount, broadcastId]
    );
    
    res.json({
      ...result.rows[0],
      total_users: sendResult.totalUsers || 0,
      error: sendResult.error
    });
  } catch (error) {
    console.error('Error updating broadcast status:', error);
    if (req.params?.id) {
      try {
        await db.query(
          'UPDATE broadcasts SET status = $1 WHERE id = $2',
          ['failed', parseInt(req.params.id, 10)]
        );
      } catch (dbError) {
        console.error('Error marking broadcast as failed:', dbError);
      }
    }
    res.status(500).json({
      error: 'Failed to update broadcast status'
    });
  }
});

// Delete broadcast
app.delete('/api/broadcasts/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const broadcastId = parseInt(id, 10);
    if (!broadcastId) {
      return res.status(400).json({ error: 'Invalid broadcast id' });
    }

    const existing = await db.query('SELECT * FROM broadcasts WHERE id = $1', [broadcastId]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Broadcast not found' });
    }

    await db.query('DELETE FROM broadcasts WHERE id = $1', [broadcastId]);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting broadcast:', error);
    res.status(500).json({ error: 'Failed to delete broadcast' });
  }
});

function normalizeButtons(buttons) {
  if (!buttons) return null;
  if (Array.isArray(buttons)) return buttons;
  
  try {
    const parsed = typeof buttons === 'string' ? JSON.parse(buttons) : buttons;
    return Array.isArray(parsed) ? parsed : null;
  } catch (error) {
    console.warn('Failed to parse broadcast buttons JSON:', error);
    return null;
  }
}

function buildInterval(dayOffset, fromHour, toHour) {
  const from = new Date();
  from.setUTCDate(from.getUTCDate() + dayOffset);
  from.setUTCHours(fromHour, 0, 0, 0);

  const to = new Date(from);
  to.setUTCHours(toHour, 0, 0, 0);

  return {
    from: from.toISOString(),
    to: to.toISOString()
  };
}

function buildDeliveryPayload(order, sourcePlatformId) {
  const sourceInterval = buildInterval(0, 9, 18);
  const destinationInterval = buildInterval(1, 9, 21);
  const recipientFirstName = order.customer_name || order.first_name || 'Получатель';
  const recipientLastName = order.last_name || order.username || '';
  const sourceOperatorId = process.env.YANDEX_SOURCE_OPERATOR_ID || sourcePlatformId;

  return {
    info: {
      operator_request_id: `ORDER-${order.id}`,
      comment: order.comment || 'Заявка из админки FATRACING'
    },
    source: {
      platform_station: {
        platform_id: sourcePlatformId,
        operator_station_id: sourceOperatorId
      },
      interval_utc: sourceInterval
    },
    destination: {
      type: 'platform_station',
      platform_station: {
        platform_id: order.delivery_pickup_id,
        operator_station_id: order.delivery_pickup_id
      },
      interval_utc: destinationInterval
    },
    items: [
      {
        count: 1,
        name: `Заказ #${order.id}`,
        article: `ORDER-${order.id}`,
        place_barcode: `BOX-${order.id}`,
        billing_details: {
          inn: process.env.BILLING_INN || '7707083893',
          nds: 20,
          unit_price: 1,
          assessed_unit_price: 1
        },
        physical_dims: {
          dx: 30,
          dy: 20,
          dz: 5,
          predefined_volume: 0
        },
        cargo_types: ['80'],
        fitting: false
      }
    ],
    places: [
      {
        barcode: `BOX-${order.id}`,
        description: order.delivery_pickup_address || 'Маленькая посылка',
        physical_dims: {
          weight_gross: 500,
          dx: 30,
          dy: 20,
          dz: 5,
          predefined_volume: 0
        }
      }
    ],
    billing_info: {
      payment_method: 'already_paid',
      delivery_cost: 0,
      variable_delivery_cost_for_recipient: []
    },
    recipient_info: {
      first_name: recipientFirstName,
      last_name: recipientLastName,
      phone: order.phone || '+79990000000',
      email: order.username ? `${order.username}@telegram.local` : 'user@example.com'
    },
    last_mile_policy: 'self_pickup',
    particular_items_refuse: false,
    forbid_unboxing: false
  };
}

function getOfferPrice(offer) {
  if (!offer) return Number.POSITIVE_INFINITY;
  if (offer.total_price !== undefined) return Number(offer.total_price);
  if (offer.total !== undefined) return Number(offer.total);
  if (offer.price !== undefined) return Number(offer.price);
  return Number.POSITIVE_INFINITY;
}

function pickCheapestOffer(offers) {
  if (!Array.isArray(offers) || offers.length === 0) return null;
  return offers.reduce((best, current) => {
    const bestPrice = getOfferPrice(best);
    const currentPrice = getOfferPrice(current);
    return currentPrice < bestPrice ? current : best;
  });
}

function callYandexDelivery(path, payload, token, extraHeaders = {}) {
  const data = JSON.stringify(payload);
  const url = new URL(`https://b2b-authproxy.taxi.yandex.net${path}`);

  const options = {
    method: 'POST',
    hostname: url.hostname,
    path: `${url.pathname}${url.search}`,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'Content-Length': Buffer.byteLength(data),
      ...extraHeaders
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (resp) => {
      let body = '';
      resp.on('data', (chunk) => { body += chunk; });
      resp.on('end', () => {
        if (resp.statusCode >= 400) {
          return reject(new Error(`Yandex API error ${resp.statusCode}: ${body}`));
        }
        try {
          resolve(JSON.parse(body || '{}'));
        } catch (err) {
          reject(err);
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.write(data);
    req.end();
  });
}

function getPublicBaseUrl() {
  if (process.env.PUBLIC_BASE_URL) return process.env.PUBLIC_BASE_URL.replace(/\/$/, '');
  if (process.env.ADMIN_PUBLIC_URL) return process.env.ADMIN_PUBLIC_URL.replace(/\/$/, '');
  // Fallback to external mapped port in docker-compose (3004) to be reachable from host; override in env for production
  return `http://localhost:3004`;
}

async function ensureSessionTable() {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS admin_sessions (
        session_id VARCHAR(128) PRIMARY KEY,
        user_data JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_admin_sessions_created_at ON admin_sessions(created_at);
    `);
  } catch (error) {
    console.error('Error ensuring admin_sessions table:', error);
  }
}

async function getSession(sessionId) {
  const result = await db.query(
    'SELECT user_data, created_at FROM admin_sessions WHERE session_id = $1 AND created_at > NOW() - INTERVAL \'24 hours\'',
    [sessionId]
  );
  if (result.rows.length === 0) return null;
  return {
    user: result.rows[0].user_data,
    createdAt: new Date(result.rows[0].created_at).getTime()
  };
}

async function saveSession(sessionId, user) {
  await db.query(
    `INSERT INTO admin_sessions (session_id, user_data) VALUES ($1, $2)
     ON CONFLICT (session_id) DO UPDATE SET user_data = EXCLUDED.user_data, created_at = CURRENT_TIMESTAMP`,
    [sessionId, user]
  );
}

async function deleteSession(sessionId) {
  await db.query('DELETE FROM admin_sessions WHERE session_id = $1', [sessionId]);
}

// Ensure session table exists on startup
ensureSessionTable();

// API routes will be added here

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ FATRACING Admin Panel running on port ${PORT}`);
});
