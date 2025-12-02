// Example of how to use the broadcast service
require('dotenv').config();
const BroadcastService = require('../services/broadcastService');

async function broadcastExample() {
  // Initialize the broadcast service
  const broadcastService = new BroadcastService(process.env.BOT_TOKEN);
  
  // Example: Send a simple text message to all users with consent
  try {
    console.log('Sending broadcast message...');
    const result = await broadcastService.sendBroadcastToAll(
      '🚴 Привет от FATRACING! У нас новые товары в магазине. Заходи посмотреть!'
    );
    
    console.log('Broadcast result:', result);
  } catch (error) {
    console.error('Error sending broadcast:', error);
  }
  
  // Example: Send a message with photo and buttons
  try {
    console.log('Sending broadcast with photo...');
    const result = await broadcastService.sendBroadcastToAll(
      '🔥 Новинка в нашем мерче! Футболка FATRACING уже в продаже!',
      'https://example.com/fatracing-tshirt.jpg',
      [
        [{ text: '🛒 Перейти в магазин', callback_data: 'shop' }],
        [{ text: 'ℹ️ Узнать больше', url: 'https://fatracing.example.com' }]
      ]
    );
    
    console.log('Broadcast with photo result:', result);
  } catch (error) {
    console.error('Error sending broadcast with photo:', error);
  }
  
  // Example: Send a message to admins
  try {
    console.log('Sending message to admins...');
    await broadcastService.sendBroadcastToAdmins(
      '🚨 Важное уведомление: Новый заказ #123 создан в магазине!'
    );
    
    console.log('Admin message sent successfully');
  } catch (error) {
    console.error('Error sending message to admins:', error);
  }
}

// Run the example
broadcastExample();