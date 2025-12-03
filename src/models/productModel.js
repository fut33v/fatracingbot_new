const db = require('./database');
const Product = require('./Product');

// Get all active products
async function getActiveProducts() {
  const query = `
    SELECT p.*,
      COALESCE(
        json_agg(pi.url ORDER BY pi.position, pi.id) FILTER (WHERE pi.id IS NOT NULL),
        '[]'::json
      ) AS images
    FROM products p
    LEFT JOIN product_images pi ON pi.product_id = p.id
    WHERE p.status = $1
    GROUP BY p.id
    ORDER BY p.created_at DESC
  `;
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
  const query = `
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
