class ChannelMembership {
  constructor(data) {
    this.id = data.id;
    this.userId = data.user_id;
    this.joinDate = data.join_date;
    this.leaveDate = data.leave_date;
    this.daysSubscribed = parseInt(data.days_subscribed);
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
  }

  // Calculate current subscription days
  calculateSubscriptionDays() {
    if (!this.joinDate) return 0;
    
    const joinDate = new Date(this.joinDate);
    const endDate = this.leaveDate ? new Date(this.leaveDate) : new Date();
    
    // Calculate difference in days
    const diffTime = Math.abs(endDate - joinDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
  }

  // Check if user is currently subscribed
  isCurrentlySubscribed() {
    return this.joinDate && !this.leaveDate;
  }
}

module.exports = ChannelMembership;