class User {
  constructor(data) {
    this.id = data.id;
    this.telegramId = data.telegram_id;
    this.username = data.username;
    this.firstName = data.first_name;
    this.lastName = data.last_name;
    this.languageCode = data.language_code;
    this.isBot = data.is_bot;
    this.isPremium = data.is_premium;
    this.addedToAttachmentMenu = data.added_to_attachment_menu;
    this.canJoinGroups = data.can_join_groups;
    this.canReadAllGroupMessages = data.can_read_all_group_messages;
    this.supportsInlineQueries = data.supports_inline_queries;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
    this.lastInteraction = data.last_interaction;
    this.isBlocked = data.is_blocked;
    this.consentToBroadcast = data.consent_to_broadcast;
  }

  // Get full name of the user
  getFullName() {
    if (this.firstName && this.lastName) {
      return `${this.firstName} ${this.lastName}`;
    }
    return this.firstName || this.username || `User ${this.telegramId}`;
  }

  // Check if user is admin
  isAdmin() {
    const adminIds = process.env.ADMIN_USER_IDS ? process.env.ADMIN_USER_IDS.split(',').map(id => parseInt(id.trim())) : [];
    return adminIds.includes(parseInt(this.telegramId));
  }
}

module.exports = User;