// Utility functions for date formatting

// Format date as "DD.MM.YYYY"
function formatDate(date) {
  if (!date) return '';
  
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  
  return `${day}.${month}.${year}`;
}

// Format date as "DD MMMM YYYY" in Russian
function formatLongDate(date) {
  if (!date) return '';
  
  const d = new Date(date);
  const months = [
    'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
    'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
  ];
  
  const day = d.getDate();
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  
  return `${day} ${month} ${year}`;
}

// Format date as relative time (e.g., "2 дня назад")
function formatRelativeDate(date) {
  if (!date) return '';
  
  const d = new Date(date);
  const now = new Date();
  const diffMs = now - d;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) {
    return 'сегодня';
  } else if (diffDays === 1) {
    return 'вчера';
  } else if (diffDays < 7) {
    return `${diffDays} дня назад`;
  } else if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `${weeks} недель назад`;
  } else {
    const months = Math.floor(diffDays / 30);
    return `${months} месяцев назад`;
  }
}

module.exports = {
  formatDate,
  formatLongDate,
  formatRelativeDate
};