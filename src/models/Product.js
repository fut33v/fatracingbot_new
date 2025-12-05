class Product {
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.description = data.description;
    this.price = parseFloat(data.price);
    this.cost = data.cost !== undefined && data.cost !== null ? parseFloat(data.cost) : 0;
    this.shippingIncluded = Boolean(data.shipping_included);
    this.shippingCost = data.shipping_cost !== undefined && data.shipping_cost !== null ? parseFloat(data.shipping_cost) : 0;
    this.currency = data.currency;
    const rawImages = Array.isArray(data.images) ? data.images.filter(Boolean) : [];
    if (data.photo_url && !rawImages.includes(data.photo_url)) {
      rawImages.unshift(data.photo_url);
    }
    this.images = rawImages;
    this.photoUrl = this.images[0] || null;
    this.sizeGuideUrl = data.size_guide_url || null;
    this.genderRequired = Boolean(data.gender_required);
    this.stock = parseInt(data.stock);
    this.isPreorder = Boolean(data.is_preorder);
    this.preorderEndDate = data.preorder_end_date ? new Date(data.preorder_end_date) : null;
    this.estimatedDeliveryDate = data.estimated_delivery_date ? new Date(data.estimated_delivery_date) : null;
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
    if (this.status !== 'active') return false;
    if (this.isPreorder) return true;
    return this.stock > 0;
  }

  // Check if product is active
  isActive() {
    return this.status === 'active';
  }
}

module.exports = Product;
