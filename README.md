# FATRACING Bot

Telegram bot for the FATRACING cycling community.

## Features

- 🛒 Merch shop with product catalog and cart functionality
- 🎁 Partner promo codes
- 📊 User statistics (channel subscription tracking)
- ℹ️ Project information
- 📨 Broadcast system
- 📋 Admin panel (in development)

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables:**
   Copy [.env.example](.env.example) to [.env](.env) and fill in the values:
   - `BOT_TOKEN` - Your Telegram bot token from [@BotFather](https://t.me/BotFather)
   - `FATRACING_CHANNEL_ID` - Your Telegram channel ID
   - `ADMIN_USER_IDS` - Comma-separated list of admin Telegram user IDs
   - `FEATURE_ENABLE_YANDEX_PVZ` - Set to `true` to enable выбор ПВЗ через API Яндекса; leave unset/false to запросить адрес текстом
   - Database configuration parameters

3. **Set up the database:**
   Create a PostgreSQL database and run the schema from [src/models/schema.sql](src/models/schema.sql):
   ```bash
   psql -U your_username -d your_database -f src/models/schema.sql
   ```

4. **Run the bot:**
   ```bash
   # Development mode with auto-restart
   npm run dev
   
   # Production mode
   npm start
   ```

## Docker Deployment

The project includes Docker Compose configuration for easy deployment:

1. **Configure environment variables:**
   Edit the [.env](.env) file with your configuration

2. **Build and start services:**
   ```bash
   # Build the Docker images
   npm run docker:build
   
   # Start all services
   npm run docker:up
   
   # Or combine both commands
   npm run docker:up --build
   ```

3. **Access the admin panel:**
   Open http://localhost:3004 in your browser

4. **View logs:**
   ```bash
   npm run docker:logs
   ```

5. **Stop services:**
   ```bash
   npm run docker:down
   ```

## Database Schema

The bot uses PostgreSQL with the following tables:
- `users` - Telegram users
- `products` - Merchandise items
- `product_variants` - Product sizes/variants
- `orders` - User orders
- `order_items` - Items in orders
- `promo_codes` - Partner discount codes
- `broadcasts` - Mass messages
- `channel_membership` - Channel subscription tracking
- `cart_items` - Temporary cart storage

## Development

### Project Structure
```
src/
├── bot/          # Telegram bot implementation
├── models/       # Database models and queries
├── controllers/  # Business logic (to be implemented)
├── admin/        # Admin panel (to be implemented)
└── utils/        # Utility functions (to be implemented)
```

### Adding New Features

1. Create new model files in [src/models/](src/models/) for new entities
2. Add new routes/actions in [src/bot/index.js](src/bot/index.js)
3. Update the database schema in [src/models/schema.sql](src/models/schema.sql) if needed

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License.
