#!/usr/bin/env python3
import psycopg2
import sys
import os
from typing import Optional, Tuple, Any

# Database connection parameters
DB_HOST = os.environ.get('DB_HOST', 'localhost')
DB_PORT = os.environ.get('DB_PORT', '5432')
DB_NAME = os.environ.get('DB_NAME', 'fatracing_bot')
DB_USER = os.environ.get('DB_USER', 'fatracingbot')
DB_PASSWORD = os.environ.get('DB_PASSWORD', 'fatracingbot228')

def check_database():
    """Check database connection and table structure"""
    try:
        # Connect to database
        conn = psycopg2.connect(
            host=DB_HOST,
            port=DB_PORT,
            database=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD
        )
        cursor = conn.cursor()
        
        print("✅ Database connected successfully")
        
        # Check if tables exist
        tables = [
            'users', 'products', 'product_variants', 'orders', 
            'order_items', 'promo_codes', 'broadcasts', 
            'channel_membership', 'cart_items'
        ]
        
        print("\n=== TABLE EXISTENCE CHECK ===")
        for table in tables:
            try:
                cursor.execute(f"SELECT COUNT(*) FROM {table}")
                result = cursor.fetchone()
                if result is not None:
                    count = result[0]
                    print(f"✅ Table '{table}' exists with {count} rows")
                else:
                    print(f"❌ Table '{table}' check returned no results")
            except Exception as e:
                print(f"❌ Table '{table}' error: {e}")
        
        # Check users table specifically
        print("\n=== USERS TABLE CONTENT ===")
        try:
            cursor.execute("SELECT COUNT(*) FROM users")
            result = cursor.fetchone()
            if result is not None:
                user_count = result[0]
                print(f"Users table contains {user_count} rows")
                
                if user_count > 0:
                    cursor.execute("SELECT id, telegram_id, username, first_name, last_name FROM users LIMIT 5")
                    users = cursor.fetchall()
                    print("First 5 users:")
                    for user in users:
                        print(f"  - ID: {user[0]}, Telegram ID: {user[1]}, Username: {user[2]}, Name: {user[3]} {user[4]}")
                else:
                    print("No users found in the database")
            else:
                print("Users table check returned no results")
        except Exception as e:
            print(f"Error checking users table: {e}")
        
        # Close connection
        cursor.close()
        conn.close()
        
        return True
        
    except Exception as e:
        print(f"❌ Database check failed: {e}")
        return False

if __name__ == "__main__":
    success = check_database()
    sys.exit(0 if success else 1)
