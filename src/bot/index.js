require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const UserModel = require('../models/userModel');
const ProductModel = require('../models/productModel');
const PromoCodeModel = require('../models/promoCodeModel');
const CartModel = require('../models/cartModel');
const OrderModel = require('../models/orderModel');
const ChannelMembershipModel = require('../models/channelMembershipModel');

// Initialize the bot
const bot = new Telegraf(process.env.BOT_TOKEN);

console.log('Starting FATRACING Bot...');

// Middleware to track user interactions
bot.use(async (ctx, next) => {
  if (ctx.from) {
    try {
      await UserModel.upsertUser(ctx.from);
    } catch (error) {
      console.error('Error upserting user:', error);
    }
  }
  await next();
});

// Error handling
bot.catch((err, ctx) => {
  console.error(`Error for ${ctx.updateType}:`, err);
  try {
    ctx.reply('❌ Произошла ошибка. Попробуйте позже.');
  } catch (sendError) {
    console.error('Failed to send error message:', sendError);
  }
});

// Start command
bot.start(async (ctx) => {
  try {
    const welcomeMessage = `
🚴 Добро пожаловать в FATRACING Bot!

Здесь ты можешь:
🛒 Приобрести мерч клуба
🎁 Получить промокоды от партнёров
📊 Посмотреть свою статистику
ℹ️ Узнать больше о проекте FATRACING

Выбери интересующий раздел в меню ниже:
    `;
    
    await ctx.reply(welcomeMessage, getMenuKeyboard());
  } catch (error) {
    console.error('Error in start command:', error);
    await ctx.reply('❌ Произошла ошибка. Попробуйте позже.');
  }
});

// Main menu command
bot.command('menu', async (ctx) => {
  try {
    await ctx.reply('Выбери интересующий раздел:', getMenuKeyboard());
  } catch (error) {
    console.error('Error in menu command:', error);
    await ctx.reply('❌ Произошла ошибка. Попробуйте позже.');
  }
});

// Main menu callback
bot.action('main_menu', async (ctx) => {
  try {
    await ctx.editMessageText('Выбери интересующий раздел:', getMenuKeyboard());
    await ctx.answerCbQuery();
  } catch (error) {
    console.error('Error in main_menu action:', error);
    try {
      await ctx.answerCbQuery('❌ Произошла ошибка');
    } catch (callbackError) {
      console.error('Failed to send callback query:', callbackError);
    }
  }
});

// Shop menu
bot.action('shop', async (ctx) => {
  try {
    const products = await ProductModel.getActiveProducts();
    
    if (products.length === 0) {
      await ctx.reply('🛒 Магазин временно пуст. Следи за новостями!', getMenuKeyboard());
      return;
    }
    
    let message = '🛒 Доступные товары:\n\n';
    
    for (const product of products) {
      message += `🔹 ${product.name}\n`;
      message += `   ${product.description}\n`;
      message += `   💰 ${product.getFormattedPrice()}\n`;
      message += `   📦 В наличии: ${product.stock} шт.\n\n`;
    }
    
    const keyboard = [
      ...products.map(product => [
        Markup.button.callback(`🛒 ${product.name}`, `product_${product.id}`)
      ]),
      [Markup.button.callback('⬅️ Назад', 'main_menu')]
    ];
    
    await ctx.editMessageText(message, Markup.inlineKeyboard(keyboard));
    await ctx.answerCbQuery();
  } catch (error) {
    console.error('Error in shop action:', error);
    try {
      await ctx.answerCbQuery('❌ Произошла ошибка, попробуйте позже');
    } catch (callbackError) {
      console.error('Failed to send callback query:', callbackError);
    }
  }
});

// Product details
bot.action(/product_(\d+)/, async (ctx) => {
  const productId = ctx.match[1];
  
  try {
    const product = await ProductModel.getProductById(productId);
    if (!product) {
      await ctx.answerCbQuery('❌ Товар не найден');
      return;
    }
    
    const variants = await ProductModel.getProductVariants(productId);
    
    let message = `🛒 ${product.name}\n\n`;
    message += `${product.description}\n\n`;
    message += `💰 Цена: ${product.getFormattedPrice()}\n`;
    message += `📦 В наличии: ${product.stock} шт.\n`;
    
    const keyboard = [];
    
    if (variants.length > 0) {
      message += '\n📏 Выберите размер:\n';
      keyboard.push(
        ...variants.map(variant => [
          Markup.button.callback(variant.name, `variant_${product.id}_${variant.id}`)
        ])
      );
    } else {
      keyboard.push([
        Markup.button.callback('🛒 Добавить в корзину', `add_to_cart_${product.id}`)
      ]);
    }
    
    keyboard.push([
      Markup.button.callback('🛒 Корзина', 'cart'),
      Markup.button.callback('⬅️ Назад', 'shop')
    ]);
    
    await ctx.editMessageText(message, Markup.inlineKeyboard(keyboard));
    await ctx.answerCbQuery();
  } catch (error) {
    console.error('Error in product action:', error);
    try {
      await ctx.answerCbQuery('❌ Произошла ошибка, попробуйте позже');
    } catch (callbackError) {
      console.error('Failed to send callback query:', callbackError);
    }
  }
});

// Variant selection
bot.action(/variant_(\d+)_(\d+)/, async (ctx) => {
  const productId = ctx.match[1];
  const variantId = ctx.match[2];
  
  try {
    const product = await ProductModel.getProductById(productId);
    const variants = await ProductModel.getProductVariants(productId);
    const selectedVariant = variants.find(v => v.id == variantId);
    
    if (!product || !selectedVariant) {
      await ctx.answerCbQuery('❌ Товар или вариант не найден');
      return;
    }
    
    let message = `🛒 ${product.name} (${selectedVariant.name})\n\n`;
    message += `${product.description}\n\n`;
    message += `💰 Цена: ${product.getFormattedPrice()}\n`;
    message += `📦 В наличии: ${selectedVariant.stock} шт.\n`;
    
    const keyboard = [
      [Markup.button.callback('🛒 Добавить в корзину', `add_to_cart_${productId}_${variantId}`)],
      [Markup.button.callback('🛒 Корзина', 'cart')],
      [Markup.button.callback('⬅️ Назад', `product_${productId}`)]
    ];
    
    await ctx.editMessageText(message, Markup.inlineKeyboard(keyboard));
    await ctx.answerCbQuery();
  } catch (error) {
    console.error('Error in variant action:', error);
    try {
      await ctx.answerCbQuery('❌ Произошла ошибка, попробуйте позже');
    } catch (callbackError) {
      console.error('Failed to send callback query:', callbackError);
    }
  }
});

// Add to cart
bot.action(/add_to_cart_(\d+)(_(\d+))?/, async (ctx) => {
  const userId = ctx.from.id;
  const productId = ctx.match[1];
  const variantId = ctx.match[3] || null;
  
  try {
    await CartModel.addToCart(userId, productId, variantId);
    await ctx.answerCbQuery('✅ Добавлено в корзину!');
    
    // Show cart after adding
    await showCart(ctx);
  } catch (error) {
    console.error('Error adding to cart:', error);
    try {
      await ctx.answerCbQuery('❌ Ошибка при добавлении в корзину');
    } catch (callbackError) {
      console.error('Failed to send callback query:', callbackError);
    }
  }
});

// Show cart
bot.action('cart', async (ctx) => {
  try {
    await showCart(ctx);
  } catch (error) {
    console.error('Error showing cart:', error);
    try {
      await ctx.answerCbQuery('❌ Ошибка при загрузке корзины');
    } catch (callbackError) {
      console.error('Failed to send callback query:', callbackError);
    }
  }
});

// Clear cart
bot.action('clear_cart', async (ctx) => {
  const userId = ctx.from.id;
  
  try {
    await CartModel.clearCart(userId);
    await ctx.answerCbQuery('✅ Корзина очищена');
    await showCart(ctx);
  } catch (error) {
    console.error('Error clearing cart:', error);
    try {
      await ctx.answerCbQuery('❌ Ошибка при очистке корзины');
    } catch (callbackError) {
      console.error('Failed to send callback query:', callbackError);
    }
  }
});

// Checkout
bot.action('checkout', async (ctx) => {
  const userId = ctx.from.id;
  
  try {
    const cartItems = await CartModel.getCartItems(userId);
    
    if (cartItems.length === 0) {
      await ctx.answerCbQuery('❌ Корзина пуста');
      return;
    }
    
    // Ask for customer name
    ctx.session = { checkoutStep: 'name' };
    await ctx.reply('📝 Для оформления заказа укажите, как к вам обращаться:');
  } catch (error) {
    console.error('Error in checkout:', error);
    await ctx.reply('❌ Произошла ошибка при оформлении заказа');
  }
  
  try {
    await ctx.answerCbQuery();
  } catch (callbackError) {
    console.error('Failed to send callback query:', callbackError);
  }
});

// Handle text messages during checkout
bot.on('text', async (ctx) => {
  if (!ctx.session || !ctx.session.checkoutStep) {
    // Not in checkout flow, ignore
    return;
  }
  
  const userId = ctx.from.id;
  const text = ctx.message.text;
  
  try {
    switch (ctx.session.checkoutStep) {
      case 'name':
        ctx.session.customerName = text;
        ctx.session.checkoutStep = 'phone';
        await ctx.reply('📱 Укажите ваш номер телефона:');
        break;
        
      case 'phone':
        ctx.session.phone = text;
        ctx.session.checkoutStep = 'city';
        await ctx.reply('🌍 Укажите ваш город/страну:');
        break;
        
      case 'city':
        ctx.session.city = text;
        ctx.session.checkoutStep = 'comment';
        await ctx.reply('💬 Оставьте комментарий к заказу (или напишите "нет", если комментариев нет):');
        break;
        
      case 'comment':
        ctx.session.comment = text === 'нет' ? '' : text;
        ctx.session.checkoutStep = null;
        
        // Create order
        await createOrder(ctx, userId);
        break;
    }
  } catch (error) {
    console.error('Error in checkout text handler:', error);
    await ctx.reply('❌ Произошла ошибка. Попробуйте начать оформление заново: /menu');
    ctx.session = {};
  }
});

// Promo codes menu
bot.action('promos', async (ctx) => {
  try {
    const promos = await PromoCodeModel.getActivePromoCodes();
    
    if (promos.length === 0) {
      await ctx.editMessageText('🎁 Активных промокодов пока нет. Следи за новостями!', getMenuKeyboard());
      await ctx.answerCbQuery();
      return;
    }
    
    let message = '🎁 Доступные промокоды:\n\n';
    
    const keyboard = [
      ...promos.map(promo => [
        Markup.button.callback(`🎁 ${promo.partnerName}`, `promo_${promo.id}`)
      ]),
      [Markup.button.callback('⬅️ Назад', 'main_menu')]
    ];
    
    await ctx.editMessageText(message, Markup.inlineKeyboard(keyboard));
    await ctx.answerCbQuery();
  } catch (error) {
    console.error('Error in promos action:', error);
    try {
      await ctx.answerCbQuery('❌ Произошла ошибка, попробуйте позже');
    } catch (callbackError) {
      console.error('Failed to send callback query:', callbackError);
    }
  }
});

// Promo code details
bot.action(/promo_(\d+)/, async (ctx) => {
  const promoId = ctx.match[1];
  
  try {
    const promo = await PromoCodeModel.getPromoCodeById(promoId);
    if (!promo) {
      await ctx.answerCbQuery('❌ Промокод не найден');
      return;
    }
    
    let message = `🎁 ${promo.partnerName}\n\n`;
    message += `${promo.description}\n\n`;
    message += `🔢 Промокод: \`${promo.code}\`\n`;
    
    const dates = promo.getFormattedDates();
    if (dates) {
      message += `📅 Действует: ${dates}\n`;
    }
    
    const keyboard = [
      [Markup.button.url('🔗 Перейти к партнёру', promo.link)],
      [Markup.button.callback('⬅️ Назад', 'promos')]
    ];
    
    await ctx.editMessageText(message, Markup.inlineKeyboard(keyboard).parse_mode('Markdown'));
    await ctx.answerCbQuery();
  } catch (error) {
    console.error('Error in promo action:', error);
    try {
      await ctx.answerCbQuery('❌ Произошла ошибка, попробуйте позже');
    } catch (callbackError) {
      console.error('Failed to send callback query:', callbackError);
    }
  }
});

// Statistics menu
bot.action('stats', async (ctx) => {
  const userId = ctx.from.id;
  
  try {
    const totalDays = await ChannelMembershipModel.getTotalSubscriptionDays(userId);
    
    const message = `
📊 Твоя статистика:

🎖 Дней подписки на канал: ${totalDays}

Скоро здесь появится больше статистики!
    `;
    
    const keyboard = [
      [Markup.button.callback('⬅️ Назад', 'main_menu')]
    ];
    
    await ctx.editMessageText(message, Markup.inlineKeyboard(keyboard));
    await ctx.answerCbQuery();
  } catch (error) {
    console.error('Error in stats action:', error);
    try {
      await ctx.answerCbQuery('❌ Произошла ошибка, попробуйте позже');
    } catch (callbackError) {
      console.error('Failed to send callback query:', callbackError);
    }
  }
});

// About menu
bot.action('about', async (ctx) => {
  try {
    const message = `
ℹ️ О проекте FATRACING

FATRACING - это сообщество любителей велоспорта, объединённых страстью к скорости, приключениям и здоровому образу жизни.

🚴‍♂️ Мы проводим регулярные выезды
🔥 Организуем соревнования
🎁 Раздаем мерч
🤝 Сотрудничаем с брендами

Следи за нами в соцсетях:
🔗 Instagram: @fatracing
🔗 VK: vk.com/fatracing
    `;
    
    const keyboard = [
      [Markup.button.callback('⬅️ Назад', 'main_menu')]
    ];
    
    await ctx.editMessageText(message, Markup.inlineKeyboard(keyboard));
    await ctx.answerCbQuery();
  } catch (error) {
    console.error('Error in about action:', error);
    try {
      await ctx.answerCbQuery('❌ Произошла ошибка, попробуйте позже');
    } catch (callbackError) {
      console.error('Failed to send callback query:', callbackError);
    }
  }
});

// Broadcast consent
bot.action('toggle_broadcast_consent', async (ctx) => {
  const userId = ctx.from.id;
  
  try {
    const user = await UserModel.getUserByTelegramId(userId);
    if (!user) {
      await ctx.answerCbQuery('❌ Пользователь не найден');
      return;
    }
    
    const newConsent = !user.consentToBroadcast;
    await UserModel.updateUserConsent(userId, newConsent);
    
    const message = newConsent 
      ? '✅ Вы успешно подписались на рассылку!' 
      : '❌ Вы отписались от рассылки.';
      
    await ctx.answerCbQuery(message);
  } catch (error) {
    console.error('Error toggling broadcast consent:', error);
    try {
      await ctx.answerCbQuery('❌ Произошла ошибка, попробуйте позже');
    } catch (callbackError) {
      console.error('Failed to send callback query:', callbackError);
    }
  }
});

// Helper function to create main menu keyboard
function getMenuKeyboard() {
  return Markup.keyboard([
    ['🛒 Магазин мерча', '🎁 Промокоды партнёров'],
    ['📊 Моя статистика', 'ℹ️ О проекте FATRACING']
  ]).resize();
}

// Helper function to show cart
async function showCart(ctx) {
  const userId = ctx.from.id;
  
  try {
    const cartItems = await CartModel.getCartItems(userId);
    const total = await CartModel.getCartTotal(userId);
    
    if (cartItems.length === 0) {
      const message = '🛒 Ваша корзина пуста';
      const keyboard = [
        [Markup.button.callback('🛍️ В магазин', 'shop')],
        [Markup.button.callback('⬅️ Назад', 'main_menu')]
      ];
      
      if (ctx.update.callback_query) {
        await ctx.editMessageText(message, Markup.inlineKeyboard(keyboard));
      } else {
        await ctx.reply(message, Markup.inlineKeyboard(keyboard));
      }
      return;
    }
    
    let message = '🛒 Ваша корзина:\n\n';
    
    for (const item of cartItems) {
      const variantText = item.variant_name ? ` (${item.variant_name})` : '';
      message += `🔹 ${item.product_name}${variantText} x${item.quantity}\n`;
      message += `   💰 ${parseFloat(item.product_price) * item.quantity} ${item.product_currency}\n\n`;
    }
    
    message += `Итого: ${total.toFixed(2)} RUB\n`;
    
    const keyboard = [
      ...cartItems.map(item => [
        Markup.button.callback('❌', `remove_from_cart_${item.id}`),
        Markup.button.callback(`${item.product_name}${item.variant_name ? ` (${item.variant_name})` : ''} x${item.quantity}`, 'noop')
      ]),
      [
        Markup.button.callback('🔄 Очистить корзину', 'clear_cart'),
        Markup.button.callback('✅ Оформить заказ', 'checkout')
      ],
      [Markup.button.callback('⬅️ Назад', 'shop')]
    ];
    
    if (ctx.update.callback_query) {
      await ctx.editMessageText(message, Markup.inlineKeyboard(keyboard));
    } else {
      await ctx.reply(message, Markup.inlineKeyboard(keyboard));
    }
  } catch (error) {
    console.error('Error showing cart:', error);
    throw error;
  }
}

// Helper function to create order
async function createOrder(ctx, userId) {
  try {
    const cartItems = await CartModel.getCartItems(userId);
    const total = await CartModel.getCartTotal(userId);
    
    if (cartItems.length === 0) {
      await ctx.reply('❌ Корзина пуста');
      return;
    }
    
    // Create order
    const orderData = {
      userId: userId,
      customerName: ctx.session.customerName,
      phone: ctx.session.phone,
      cityCountry: ctx.session.city,
      comment: ctx.session.comment,
      totalAmount: total
    };
    
    const order = await OrderModel.createOrder(orderData);
    await OrderModel.createOrderItems(order.id, cartItems);
    
    // Clear cart
    await CartModel.clearCart(userId);
    
    // Send confirmation message
    const message = `
🎉 Спасибо за заказ!

Мы свяжемся с тобой в Telegram, чтобы обсудить оплату и доставку.

Номер заказа: #${order.id}
    `;
    
    await ctx.reply(message, getMenuKeyboard());
    
    // Clear session
    ctx.session = {};
  } catch (error) {
    console.error('Error creating order:', error);
    await ctx.reply('❌ Произошла ошибка при создании заказа. Попробуйте позже.');
  }
}

// Handle channel join/leave events
bot.on('chat_member', async (ctx) => {
  if (!process.env.FATRACING_CHANNEL_ID) {
    console.log('FATRACING_CHANNEL_ID not configured, skipping channel membership tracking');
    return;
  }
  
  const channelId = process.env.FATRACING_CHANNEL_ID;
  const userId = ctx.from.id;
  const chatMember = ctx.update.chat_member;
  
  // Check if this is for our channel
  if (chatMember.chat.id.toString() !== channelId) {
    console.log(`Ignoring chat member update for chat ${chatMember.chat.id}, expecting ${channelId}`);
    return;
  }
  
  try {
    if (chatMember.new_chat_member && 
        (chatMember.new_chat_member.status === 'member' || 
         chatMember.new_chat_member.status === 'administrator' || 
         chatMember.new_chat_member.status === 'creator')) {
      // User joined channel
      console.log(`User ${userId} joined channel ${channelId}`);
      await ChannelMembershipModel.recordUserJoin(userId);
    } else if (chatMember.old_chat_member && 
               (chatMember.old_chat_member.status === 'member' || 
                chatMember.old_chat_member.status === 'administrator' || 
                chatMember.old_chat_member.status === 'creator') &&
               (chatMember.new_chat_member.status === 'left' || 
                chatMember.new_chat_member.status === 'kicked')) {
      // User left channel
      console.log(`User ${userId} left channel ${channelId}`);
      await ChannelMembershipModel.recordUserLeave(userId);
    }
  } catch (error) {
    console.error('Error handling channel membership:', error);
  }
});

// Handle inline button callbacks for removing items from cart
bot.action(/remove_from_cart_(\d+)/, async (ctx) => {
  const cartItemId = ctx.match[1];
  const userId = ctx.from.id;
  
  try {
    const result = await CartModel.removeFromCart(cartItemId, userId);
    if (result) {
      await ctx.answerCbQuery('✅ Товар удален из корзины');
      await showCart(ctx);
    } else {
      await ctx.answerCbQuery('❌ Ошибка при удалении товара');
    }
  } catch (error) {
    console.error('Error removing from cart:', error);
    try {
      await ctx.answerCbQuery('❌ Ошибка при удалении товара');
    } catch (callbackError) {
      console.error('Failed to send callback query:', callbackError);
    }
  }
});

// No-op action for disabled buttons
bot.action('noop', async (ctx) => {
  try {
    await ctx.answerCbQuery();
  } catch (callbackError) {
    console.error('Failed to send callback query:', callbackError);
  }
});

// Start the bot
bot.launch()
  .then(() => {
    console.log('✅ FATRACING Bot started successfully!');
  })
  .catch((error) => {
    console.error('❌ Failed to start FATRACING Bot:', error);
    process.exit(1);
  });

// Enable graceful stop
process.once('SIGINT', () => {
  console.log('Received SIGINT, stopping bot...');
  bot.stop('SIGINT');
});
process.once('SIGTERM', () => {
  console.log('Received SIGTERM, stopping bot...');
  bot.stop('SIGTERM');
});

console.log('FATRACING Bot initialization complete');