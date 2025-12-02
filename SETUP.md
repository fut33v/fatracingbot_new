# FATRACING Bot Setup Guide

## Prerequisites

1. Node.js (version 14 or higher)
2. PostgreSQL database
3. Telegram Bot Token (from [@BotFather](https://t.me/BotFather))
4. Telegram Channel ID (optional, for membership tracking)

## Installation

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd fatracing_bot
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables:**
   Copy [.env.example](.env.example) to [.env](.env) and fill in the values:
   ```bash
   cp .env.example .env
   ```
   
   Edit [.env](.env) with your configuration:
   - `BOT_TOKEN` - Your Telegram bot token
   - `FATRACING_CHANNEL_ID` - Your Telegram channel ID (optional)
   - `ADMIN_USER_IDS` - Comma-separated list of admin Telegram user IDs
   - Database configuration parameters

4. **Set up the database:**
   Create a PostgreSQL database and run the initialization script:
   ```bash
   npm run init-db
   ```

5. **Seed the database with sample data (optional):**
   ```bash
   npm run seed
   ```

## Running the Application

### Development Mode

1. **Run the bot only:**
   ```bash
   npm run dev
   ```

2. **Run the admin panel only:**
   ```bash
   npm run dev:admin
   ```

3. **Run both bot and admin panel:**
   ```bash
   npm run start-all
   ```

### Production Mode

1. **Run the bot only:**
   ```bash
   npm start
   ```

2. **Run the admin panel only:**
   ```bash
   npm run start:admin
   ```

3. **Run both bot and admin panel:**
   ```bash
   npm run start-all
   ```

## Testing the Database

To test the database connection and schema:
```bash
npm run test:db
```

## Admin Panel Access

The admin panel is available at:
```
http://localhost:3000
```

Note: The current implementation only allows access from localhost for security reasons. In a production environment, you should implement proper authentication.

## Project Structure

```
src/
├── bot/          # Telegram bot implementation
│   └── index.js  # Main bot file
├── admin/        # Admin panel
│   ├── server.js # Admin server
│   ├── public/   # Static files
│   └── middleware/ # Authentication middleware
├── models/       # Database models and queries
├── services/     # Business services
├── utils/        # Utility functions
└── startAll.js   # Script to start both bot and admin
```

## API Endpoints

### Admin API

All admin API endpoints are protected and only accessible from localhost.

- `GET /api/health` - Health check
- `GET /api/dashboard/stats` - Dashboard statistics
- `GET /api/products` - Get all products
- `POST /api/products` - Create a product
- `PUT /api/products/:id` - Update a product
- `DELETE /api/products/:id` - Delete a product
- `GET /api/promos` - Get all promo codes
- `POST /api/promos` - Create a promo code
- `PUT /api/promos/:id` - Update a promo code
- `DELETE /api/promos/:id` - Delete a promo code
- `GET /api/orders` - Get all orders
- `PUT /api/orders/:id/status` - Update order status
- `GET /api/users` - Get all users
- `GET /api/broadcasts` - Get all broadcasts
- `POST /api/broadcasts` - Create a broadcast
- `PUT /api/broadcasts/:id/status` - Update broadcast status

## Troubleshooting

### Database Connection Issues

1. Ensure PostgreSQL is running
2. Verify database credentials in [.env](.env)
3. Check that the database exists and is accessible

### Bot Not Responding

1. Verify the bot token is correct
2. Check that the bot is not blocked by Telegram
3. Ensure the bot is added to any channels it needs to monitor

### Admin Panel Not Accessible

1. Ensure the admin panel is running
2. Check that you're accessing from localhost
3. Verify the port configuration in [.env](.env)