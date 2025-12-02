// Utility functions for validation

// Check if user is admin based on environment config
function isAdmin(telegramId) {
  if (!process.env.ADMIN_USER_IDS) return false;
  
  const adminIds = process.env.ADMIN_USER_IDS.split(',').map(id => parseInt(id.trim()));
  return adminIds.includes(parseInt(telegramId));
}

// Validate phone number format
function validatePhone(phone) {
  if (!phone) return false;
  
  // Simple validation for Russian phone numbers
  const phoneRegex = /^(\+7|8)?[\s\-]?\(?[0-9]{3}\)?[\s\-]?[0-9]{3}[\s\-]?[0-9]{2}[\s\-]?[0-9]{2}$/;
  return phoneRegex.test(phone);
}

// Validate email format
function validateEmail(email) {
  if (!email) return false;
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Validate required fields
function validateRequiredFields(obj, requiredFields) {
  const missingFields = [];
  
  for (const field of requiredFields) {
    if (!obj[field] || obj[field].toString().trim() === '') {
      missingFields.push(field);
    }
  }
  
  return {
    isValid: missingFields.length === 0,
    missingFields
  };
}

module.exports = {
  isAdmin,
  validatePhone,
  validateEmail,
  validateRequiredFields
};