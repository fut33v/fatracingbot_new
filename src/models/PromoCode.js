class PromoCode {
  constructor(data) {
    this.id = data.id;
    this.partnerName = data.partner_name;
    this.description = data.description;
    this.code = data.code;
    this.link = data.link;
    this.startDate = data.start_date;
    this.endDate = data.end_date;
    this.status = data.status;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
  }

  // Check if promo code is active
  isActive() {
    if (this.status !== 'active') {
      return false;
    }

    const now = new Date();
    
    // Check if promo code has started
    if (this.startDate && new Date(this.startDate) > now) {
      return false;
    }
    
    // Check if promo code has expired
    if (this.endDate && new Date(this.endDate) < now) {
      return false;
    }
    
    return true;
  }

  // Get formatted dates
  getFormattedDates() {
    if (!this.startDate && !this.endDate) {
      return '';
    }
    
    const startDateStr = this.startDate ? new Date(this.startDate).toLocaleDateString('ru-RU') : '';
    const endDateStr = this.endDate ? new Date(this.endDate).toLocaleDateString('ru-RU') : '';
    
    if (startDateStr && endDateStr) {
      return `${startDateStr} - ${endDateStr}`;
    } else if (startDateStr) {
      return `С ${startDateStr}`;
    } else if (endDateStr) {
      return `До ${endDateStr}`;
    }
    
    return '';
  }
}

module.exports = PromoCode;