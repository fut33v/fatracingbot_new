const db = require('./database');
const Product = require('./Product');

// Get all active products
async function getActiveProducts() {
  const query = 'SELECT * FROM products WHERE status = $1 ORDER BY created_at DESC';
  try {
    const result = await db.query(query, ['active']);
    return result.rows.map(row => new Product(row));
  } catch (error) {
    console.error('Error getting active products:', error);
    throw error;
  }
}

// Get product by ID
async function getProductById(id) {
  const query = 'SELECT * FROM products WHERE id = $1';
  try {
    const result = await db.query(query, [id]);
    if (result.rows.length > 0) {
      return new Product(result.rows[0]);
    }
    return null;
  } catch (error) {
    console.error('Error getting product by ID:', error);
    throw error;
  }
}

// Get product variants
async function getProductVariants(productId) {
  const query = 'SELECT * FROM product_variants WHERE product_id = $1 ORDER BY name';
  try {
    const result = await db.query(query, [productId]);
    return result.rows;
  } catch (error) {
    console.error('Error getting product variants:', error);
    throw error;
  }
}

module.exports = {
  getActiveProducts,
  getProductById,
  getProductVariants
};