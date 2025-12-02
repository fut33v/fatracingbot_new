// Service for sending broadcasts to users
const UserModel = require('../models/userModel');
const { Telegraf } = require('telegraf');
const path = require('path');
const fs = require('fs');

class BroadcastService {
  constructor(botToken) {
    this.bot = new Telegraf(botToken);
  }

  async getTargetUsers(targetSegment) {
    const segment = (targetSegment || 'consent').toLowerCase();
    if (segment === 'all') {
      return UserModel.getActiveUsers();
    }
    return UserModel.getUsersWithBroadcastConsent();
  }

  async sendBroadcast(message, { photoUrl = null, buttons = null, targetSegment = 'consent', parseMode = null } = {}) {
    try {
      const users = await this.getTargetUsers(targetSegment);
      if (!users || users.length === 0) {
        console.warn(`Broadcast skipped: no users in segment "${targetSegment}"`);
        return {
          success: false,
          error: `Нет пользователей в сегменте "${targetSegment}"`,
          sentCount: 0,
          failedCount: 0,
          totalUsers: 0
        };
      }
      return this.sendToUsers(users, message, photoUrl, buttons, parseMode);
    } catch (error) {
      console.error('Error preparing broadcast:', error);
      return {
        success: false,
        error: error.message,
        sentCount: 0,
        failedCount: 0,
        totalUsers: 0
      };
    }
  }

  // Send broadcast to all users with consent
  async sendBroadcastToAll(message, photoUrl = null, buttons = null, parseMode = null) {
    return this.sendBroadcast(message, { photoUrl, buttons, targetSegment: 'consent', parseMode });
  }

  async sendToUsers(users, message, photoUrl = null, buttons = null, parseMode = null) {
    try {
      let successCount = 0;
      let failCount = 0;

      for (const user of users) {
        try {
          await this.sendMessageToUser(user.telegramId, message, photoUrl, buttons, parseMode);
          successCount++;
        } catch (error) {
          console.error(`Failed to send message to user ${user.telegramId}:`, error);
          failCount++;
        }
      }

      return {
        success: true,
        sentCount: successCount,
        failedCount: failCount,
        totalUsers: users.length
      };
    } catch (error) {
      console.error('Error sending broadcast:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Send message to a single user
  async sendMessageToUser(telegramId, message, photoUrl = null, buttons = null, parseMode = null) {
    try {
      const extra = parseMode ? { parse_mode: parseMode } : {};
      if (photoUrl) {
        const uploadPath = this.getLocalUploadPath(photoUrl);
        const fileSource = uploadPath && fs.existsSync(uploadPath)
          ? { source: fs.createReadStream(uploadPath) }
          : photoUrl;

        console.log(`Sending photo broadcast to ${telegramId} with ${uploadPath ? 'local file' : 'url'}: ${photoUrl}`);
        // Send photo with caption
        await this.bot.telegram.sendPhoto(telegramId, fileSource, {
          caption: message,
          ...(buttons && { reply_markup: { inline_keyboard: buttons } }),
          ...extra
        });
      } else {
        // Send text message
        await this.bot.telegram.sendMessage(telegramId, message, {
          ...(buttons && { reply_markup: { inline_keyboard: buttons } }),
          ...extra
        });
      }
      return true;
    } catch (error) {
      // If user blocked the bot, mark them as blocked
      if (error.code === 403) {
        await UserModel.markUserAsBlocked(telegramId);
      }
      throw error;
    }
  }

  // Send broadcast to admins
  async sendBroadcastToAdmins(message) {
    try {
      const adminIds = process.env.ADMIN_USER_IDS ? 
        process.env.ADMIN_USER_IDS.split(',').map(id => parseInt(id.trim())) : [];
      
      for (const adminId of adminIds) {
        try {
          await this.bot.telegram.sendMessage(adminId, message);
        } catch (error) {
          console.error(`Failed to send message to admin ${adminId}:`, error);
        }
      }
    } catch (error) {
      console.error('Error sending broadcast to admins:', error);
    }
  }

  getLocalUploadPath(photoUrl) {
    try {
      const parsed = new URL(photoUrl, 'http://localhost');
      if (!parsed.pathname.startsWith('/uploads/')) return null;
      const safePath = path.normalize(parsed.pathname).replace(/^(\.\.[/\\])+/, '');
      return path.join(__dirname, '..', 'admin', 'public', safePath);
    } catch (error) {
      return null;
    }
  }
}

module.exports = BroadcastService;
