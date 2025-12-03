#!/usr/bin/env python3
import sys
import os
import time

# Database connection parameters
DB_HOST = os.environ.get('DB_HOST', 'localhost')
DB_PORT = os.environ.get('DB_PORT', '5432')
DB_NAME = os.environ.get('DB_NAME', 'fatracing_bot')
DB_USER = os.environ.get('DB_USER', 'fatracingbot')
DB_PASSWORD = os.environ.get('DB_PASSWORD', 'fatracingbot228')

def connect_to_db():
    """Establish database connection with retries"""
    max_retries = 10
    for i in range(max_retries):
        try:
            # Import psycopg2 - suppress linter warning as it's installed in Docker
            import psycopg2  # pylint: disable=import-error
            conn = psycopg2.connect(
                host=DB_HOST,
                port=DB_PORT,
                database=DB_NAME,
                user=DB_USER,
                password=DB_PASSWORD
            )
            print("✅ Database connected successfully")
            return conn
        except Exception as e:
            print(f"⚠️  Database connection attempt {i+1}/{max_retries} failed: {e}")
            if i < max_retries - 1:
                time.sleep(2)
            else:
                print("❌ Failed to connect to database after retries")
                raise

def init_database():
    """Initialize the database with schema"""
    try:
        # Connect to database
        conn = connect_to_db()
        if conn is None:
            return False
            
        cursor = conn.cursor()
        if cursor is None:
            conn.close()
            return False
        
        # Check if tables already exist
        cursor.execute("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'users')")
        result = cursor.fetchone()
        if result is None:
            cursor.close()
            conn.close()
            return False
            
        users_table_exists = result[0]
        
        if users_table_exists:
            # Apply schema updates when tables already exist
            cursor.execute("""
                ALTER TABLE broadcasts
                ADD COLUMN IF NOT EXISTS use_markdown BOOLEAN DEFAULT FALSE
            """)
            conn.commit()
            print("✅ Database tables already exist, skipping initialization")
            cursor.close()
            conn.close()
            return True
        
        # Create tables
        print("Creating tables...")
        
        # Users table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                telegram_id BIGINT UNIQUE NOT NULL,
                username VARCHAR(255),
                first_name VARCHAR(255),
                last_name VARCHAR(255),
                language_code VARCHAR(10),
                is_bot BOOLEAN DEFAULT FALSE,
                is_premium BOOLEAN DEFAULT FALSE,
                added_to_attachment_menu BOOLEAN DEFAULT FALSE,
                can_join_groups BOOLEAN DEFAULT FALSE,
                can_read_all_group_messages BOOLEAN DEFAULT FALSE,
                supports_inline_queries BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_interaction TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                is_blocked BOOLEAN DEFAULT FALSE,
                consent_to_broadcast BOOLEAN DEFAULT FALSE,
                temp_verification_code VARCHAR(10),
                temp_code_expires TIMESTAMP
            )
        """)
        
        # Products table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS products (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                price DECIMAL(10, 2) NOT NULL,
                cost DECIMAL(10, 2) DEFAULT 0,
                shipping_included BOOLEAN DEFAULT FALSE,
                shipping_cost DECIMAL(10, 2) DEFAULT 0,
                currency VARCHAR(3) DEFAULT 'RUB',
                photo_url VARCHAR(512),
                stock INTEGER DEFAULT 0,
                is_preorder BOOLEAN DEFAULT FALSE,
                preorder_end_date DATE,
                estimated_delivery_date DATE,
                status VARCHAR(20) DEFAULT 'active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Product variants table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS product_variants (
                id SERIAL PRIMARY KEY,
                product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
                name VARCHAR(100) NOT NULL,
                stock INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Orders table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS orders (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                status VARCHAR(20) DEFAULT 'new',
                customer_name VARCHAR(255),
                phone VARCHAR(20),
                city_country VARCHAR(255),
                comment TEXT,
                total_amount DECIMAL(10, 2),
                payment_proof_url TEXT,
                payment_confirmed BOOLEAN DEFAULT FALSE,
                payment_confirmed_at TIMESTAMP,
                delivery_geo_id INTEGER,
                delivery_pickup_id TEXT,
                delivery_pickup_address TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Order items table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS order_items (
                id SERIAL PRIMARY KEY,
                order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
                product_id INTEGER REFERENCES products(id),
                variant_id INTEGER REFERENCES product_variants(id),
                quantity INTEGER NOT NULL,
                price_per_unit DECIMAL(10, 2) NOT NULL
            )
        """)
        
        # Promo codes table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS promo_codes (
                id SERIAL PRIMARY KEY,
                partner_name VARCHAR(255) NOT NULL,
                description TEXT,
                code VARCHAR(100) NOT NULL,
                link VARCHAR(512),
                start_date TIMESTAMP,
                end_date TIMESTAMP,
                status VARCHAR(20) DEFAULT 'active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Broadcasts table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS broadcasts (
                id SERIAL PRIMARY KEY,
                title VARCHAR(255),
                content TEXT NOT NULL,
                photo_url VARCHAR(512),
                buttons JSONB,
                use_markdown BOOLEAN DEFAULT FALSE,
                status VARCHAR(20) DEFAULT 'draft',
                target_segment VARCHAR(50),
                sent_count INTEGER DEFAULT 0,
                failed_count INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                sent_at TIMESTAMP
            )
        """)

        # Ensure new columns exist when upgrading existing DBs
        cursor.execute("""
            ALTER TABLE broadcasts
            ADD COLUMN IF NOT EXISTS use_markdown BOOLEAN DEFAULT FALSE
        """)
        cursor.execute("""
            ALTER TABLE products
            ADD COLUMN IF NOT EXISTS is_preorder BOOLEAN DEFAULT FALSE
        """)
        cursor.execute("""
            ALTER TABLE products
            ADD COLUMN IF NOT EXISTS preorder_end_date DATE
        """)
        cursor.execute("""
            ALTER TABLE products
            ADD COLUMN IF NOT EXISTS estimated_delivery_date DATE
        """)
        cursor.execute("""
            ALTER TABLE products
            ADD COLUMN IF NOT EXISTS cost DECIMAL(10, 2) DEFAULT 0
        """)
        cursor.execute("""
            ALTER TABLE products
            ADD COLUMN IF NOT EXISTS shipping_included BOOLEAN DEFAULT FALSE
        """)
        cursor.execute("""
            ALTER TABLE products
            ADD COLUMN IF NOT EXISTS shipping_cost DECIMAL(10, 2) DEFAULT 0
        """)
        cursor.execute("""
            ALTER TABLE orders
            ADD COLUMN IF NOT EXISTS payment_proof_url TEXT
        """)
        cursor.execute("""
            ALTER TABLE orders
            ADD COLUMN IF NOT EXISTS payment_confirmed BOOLEAN DEFAULT FALSE
        """)
        cursor.execute("""
            ALTER TABLE orders
            ADD COLUMN IF NOT EXISTS payment_confirmed_at TIMESTAMP
        """)
        cursor.execute("""
            ALTER TABLE orders
            ADD COLUMN IF NOT EXISTS delivery_geo_id INTEGER
        """)
        cursor.execute("""
            ALTER TABLE orders
            ADD COLUMN IF NOT EXISTS delivery_pickup_id TEXT
        """)
        cursor.execute("""
            ALTER TABLE orders
            ADD COLUMN IF NOT EXISTS delivery_pickup_address TEXT
        """)
        
        # Channel membership tracking
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS channel_membership (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                join_date TIMESTAMP,
                leave_date TIMESTAMP,
                days_subscribed INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Cart items table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS cart_items (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                product_id INTEGER REFERENCES products(id),
                variant_id INTEGER REFERENCES product_variants(id),
                quantity INTEGER NOT NULL DEFAULT 1,
                added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Commit table creation
        conn.commit()
        print("✅ Tables created successfully")
        
        # Create indexes
        print("Creating indexes...")
        
        # Check if indexes already exist
        cursor.execute("SELECT EXISTS (SELECT FROM pg_indexes WHERE indexname = 'idx_users_telegram_id')")
        result = cursor.fetchone()
        if result is None:
            cursor.close()
            conn.close()
            return False
            
        index_exists = result[0]
        
        if not index_exists:
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_products_status ON products(status)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_promo_codes_status ON promo_codes(status)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_channel_membership_user_id ON channel_membership(user_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_cart_items_user_id ON cart_items(user_id)")
            
            # Commit index creation
            conn.commit()
            print("✅ Indexes created successfully")
        else:
            print("✅ Indexes already exist, skipping creation")
        
        # Close connection
        cursor.close()
        conn.close()
        
        print("🎉 Database initialization completed!")
        return True
        
    except Exception as e:
        print(f"❌ Database initialization failed: {e}")
        return False

if __name__ == "__main__":
    success = init_database()
    sys.exit(0 if success else 1)
