class Product {
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.description = data.description;
    this.price = parseFloat(data.price);
    this.currency = data.currency;
    this.photoUrl = data.photo_url;
    this.stock = parseInt(data.stock);
    this.status = data.status;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
  }

  // Format price with currency
  getFormattedPrice() {
    return `${this.price} ${this.currency}`;
  }

  // Check if product is available
  isAvailable() {
    return this.status === 'active' && this.stock > 0;
  }

  // Check if product is active
  isActive() {
    return this.status === 'active';
  }
}

module.exports = Product;