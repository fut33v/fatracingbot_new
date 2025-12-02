class Order {
  constructor(data) {
    this.id = data.id;
    this.userId = data.user_id;
    this.status = data.status;
    this.customerName = data.customer_name;
    this.phone = data.phone;
    this.cityCountry = data.city_country;
    this.comment = data.comment;
    this.totalAmount = parseFloat(data.total_amount);
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
  }

  // Get status in Russian
  getStatusText() {
    const statuses = {
      'new': 'Новый',
      'processing': 'В обработке',
      'completed': 'Завершён',
      'cancelled': 'Отменён'
    };
    return statuses[this.status] || this.status;
  }

  // Check if order is new
  isNew() {
    return this.status === 'new';
  }
}

module.exports = Order;