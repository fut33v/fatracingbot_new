// Seed script to populate database with initial data
require('dotenv').config();
const db = require('./database');

async function seedDatabase() {
  try {
    console.log('Seeding database with initial data...');
    
    // Insert sample products
    console.log('Inserting sample products...');
    const products = [
      {
        name: 'FATRACING T-Shirt',
        description: 'Официальная футболка сообщества FATRACING. Удобная хлопковая ткань, классический крой.',
        price: 1500.00,
        currency: 'RUB',
        stock: 25
      },
      {
        name: 'FATRACING Cycling Cap',
        description: 'Кепка для велопрогулок. Легкая, быстросохнущая ткань, регулируемая затылка.',
        price: 800.00,
        currency: 'RUB',
        stock: 15
      },
      {
        name: 'FATRACING Water Bottle',
        description: 'Бутылка для воды 500мл с логотипом FATRACING. Пищевой пластик, удобная крышка.',
        price: 600.00,
        currency: 'RUB',
        stock: 30
      }
    ];
    
    for (const product of products) {
      try {
        await db.query(`
          INSERT INTO products (name, description, price, currency, stock, status)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT DO NOTHING`,
          [product.name, product.description, product.price, product.currency, product.stock, 'active']
        );
        console.log(`✅ Inserted product: ${product.name}`);
      } catch (error) {
        console.error(`❌ Error inserting product ${product.name}:`, error.message);
      }
    }
    
    // Insert sample promo codes
    console.log('Inserting sample promo codes...');
    const promos = [
      {
        partner_name: 'VELOSHOP',
        description: 'Скидка 15% на велозапчасти и аксессуары',
        code: 'FAT15',
        link: 'https://veloshop.example.com',
        status: 'active'
      },
      {
        partner_name: 'BIKEGEAR',
        description: 'Бесплатная доставка по России',
        code: 'FATFREE',
        link: 'https://bikegear.example.com',
        status: 'active'
      }
    ];
    
    for (const promo of promos) {
      try {
        await db.query(`
          INSERT INTO promo_codes (partner_name, description, code, link, status)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT DO NOTHING`,
          [promo.partner_name, promo.description, promo.code, promo.link, promo.status]
        );
        console.log(`✅ Inserted promo code: ${promo.partner_name}`);
      } catch (error) {
        console.error(`❌ Error inserting promo code ${promo.partner_name}:`, error.message);
      }
    }
    
    console.log('Database seeding completed!');
    process.exit(0);
  } catch (error) {
    console.error('Database seeding failed:', error);
    process.exit(1);
  }
}

seedDatabase();