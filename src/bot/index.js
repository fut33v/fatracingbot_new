require('dotenv').config();
const { Telegraf, Markup, session } = require('telegraf');
const UserModel = require('../models/userModel');
const ProductModel = require('../models/productModel');
const PromoCodeModel = require('../models/promoCodeModel');
const CartModel = require('../models/cartModel');
const OrderModel = require('../models/orderModel');
const ChannelMembershipModel = require('../models/channelMembershipModel');
const https = require('https');

const MAX_PVZ_OPTIONS = 5;
const YANDEX_PVZ_ENABLED = process.env.FEATURE_ENABLE_YANDEX_PVZ === 'true';

// Initialize the bot
const bot = new Telegraf(process.env.BOT_TOKEN);

console.log('Starting FATRACING Bot...');

// Middleware to track user interactions
bot.use(session());
bot.use(async (ctx, next) => {
  if (ctx.from) {
    try {
      await UserModel.upsertUser(ctx.from);
    } catch (error) {
      console.error('Error upserting user:', error);
    }
  }
  // Ensure ctx.session exists to avoid undefined usage later
  if (!ctx.session) {
    ctx.session = {};
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
    const keyboard = getMenuKeyboard();
    const hasCbMsg = Boolean(ctx.update?.callback_query?.message?.message_id);
    if (hasCbMsg) {
      try {
        await ctx.editMessageText('Выбери интересующий раздел:', keyboard);
        await ctx.answerCbQuery();
        return;
      } catch (error) {
        console.warn('editMessageText failed in main_menu, sending new message', error.description || error.message);
      }
    }
    await ctx.reply('Выбери интересующий раздел:', keyboard);
    if (ctx.update?.callback_query) {
      await ctx.answerCbQuery();
    }
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
  await showShop(ctx, { fromCallback: true });
});

// Text handler for shop from reply keyboard
bot.hears('🛒 Магазин мерча', async (ctx) => {
  await showShop(ctx, { fromCallback: false });
});

async function showShop(ctx, { fromCallback }) {
  try {
    const products = await ProductModel.getActiveProducts();
    
    if (products.length === 0) {
      const emptyMsg = '🛒 Магазин временно пуст. Следи за новостями!';
      if (fromCallback && ctx.update?.callback_query?.message?.message_id) {
        const kb = Markup.inlineKeyboard([[Markup.button.callback('⬅️ Назад', 'main_menu')]]);
        await ctx.editMessageText(emptyMsg, kb);
        await ctx.answerCbQuery();
      } else {
        await ctx.reply(emptyMsg, getMenuKeyboard());
      }
      return;
    }
    
    let message = '🛒 Доступные товары:\n\n';
    
    for (const product of products) {
      const preorderTag = product.isPreorder ? ' (предзаказ)' : '';
      message += `🔹 ${product.name}${preorderTag}\n`;
    }
    
    const keyboard = [
      ...products.map(product => [
        Markup.button.callback(`🎽 ${product.name}`, `product_${product.id}`)
      ]),
      [Markup.button.callback('📦 Мои заказы', 'my_orders')],
      [Markup.button.callback('🛒 Корзина', 'cart')],
      [Markup.button.callback('⬅️ Назад', 'main_menu')]
    ];
    
    const markup = Markup.inlineKeyboard(keyboard);
    if (fromCallback && ctx.update?.callback_query?.message?.message_id) {
      try {
        await ctx.editMessageText(message, markup);
      } catch (error) {
        console.warn('editMessageText failed in showShop, sending new message', error.description || error.message);
        await ctx.reply(message, markup);
      }
      await ctx.answerCbQuery();
    } else {
      await ctx.reply(message, markup);
    }
  } catch (error) {
    console.error('Error in shop action:', error);
    try {
      if (fromCallback) {
        await ctx.answerCbQuery('❌ Произошла ошибка, попробуйте позже');
      } else {
        await ctx.reply('❌ Произошла ошибка, попробуйте позже');
      }
    } catch (callbackError) {
      console.error('Failed to send callback query:', callbackError);
    }
  }
}

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
    
    const message = buildProductCaption(product);
    
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
        Markup.button.callback('➕ В корзину', `add_to_cart_${product.id}`)
      ]);
    }
    
    keyboard.push([
      Markup.button.callback('🛒 Корзина', 'cart'),
      Markup.button.callback('⬅️ Назад', 'shop')
    ]);
    
    await sendProductView(ctx, {
      message,
      keyboard,
      photoUrl: product.photoUrl
    });
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
    
    const message = buildProductCaption(product, selectedVariant);
    
    const keyboard = [
      [Markup.button.callback('➕ В корзину', `add_to_cart_${productId}_${variantId}`)],
      [Markup.button.callback('🛒 Корзина', 'cart')],
      [Markup.button.callback('⬅️ Назад', `product_${productId}`)]
    ];
    
    await sendProductView(ctx, {
      message,
      keyboard,
      photoUrl: product.photoUrl
    });
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
    // Ensure user exists for FK constraints
    if (ctx.from) {
      await UserModel.upsertUser(ctx.from);
    }
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

// Show user's orders
bot.action('my_orders', async (ctx) => {
  await showUserOrders(ctx, { fromCallback: true });
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
    // Drop checkout context to avoid dangling flow after cart is emptied
    ctx.session = {};
    await ctx.answerCbQuery('✅ Корзина очищена');
    await showCart(ctx);
    await ctx.reply('Оформление заказа прервано: корзина пуста.', getMenuKeyboard());
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

    const lastOrder = await OrderModel.getLatestOrderForUser(userId);
    const savedName = lastOrder?.customerName;
    const savedCity = lastOrder?.cityCountry;
    const savedPhone = lastOrder?.phone;
    const savedPickupAddress = lastOrder?.deliveryPickupAddress;

    if (!YANDEX_PVZ_ENABLED) {
      const pickupAddress = savedPickupAddress || savedCity;
      if (savedName && savedPhone && pickupAddress) {
        ctx.session.customerName = savedName;
        ctx.session.phone = savedPhone;
        ctx.session.deliveryPickupAddress = pickupAddress;
        ctx.session.city = pickupAddress;
        ctx.session.pvzSelection = pickupAddress;
        ctx.session.checkoutStep = 'comment';
        await ctx.reply(
          `Используем ранее указанные данные:\n` +
          `👤 Имя: ${savedName}\n` +
          `📞 Телефон: ${savedPhone}\n` +
          `🏤 ПВЗ Яндекса: ${pickupAddress}\n\n` +
          '💬 Оставьте комментарий к заказу или нажмите "Без комментария":',
          buildCommentKeyboard()
        );
      } else if (savedName && savedPhone) {
        ctx.session.customerName = savedName;
        ctx.session.phone = savedPhone;
        ctx.session.checkoutStep = 'pvz_address';
        await ctx.reply(
          `Используем ранее указанные данные:\n` +
          `👤 Имя: ${savedName}\n` +
          `📞 Телефон: ${savedPhone}\n\n` +
          '🏤 Напишите адрес ПВЗ Яндекса (город, улица, номер отделения):'
        );
      } else if (savedName) {
        ctx.session.customerName = savedName;
        ctx.session.checkoutStep = 'phone';
        await ctx.reply(
          `👤 Имя: ${savedName}\n` +
          '📞 Укажите номер телефона для связи:'
        );
      } else {
        await ctx.reply('📝 Для оформления заказа укажите, как к вам обращаться:');
      }
    } else if (savedName && savedCity) {
      ctx.session.customerName = savedName;
      ctx.session.city = savedCity;
      ctx.session.checkoutStep = 'comment';
      await ctx.reply(
        `Используем ранее указанные данные:\n` +
        `👤 Имя: ${savedName}\n` +
        `🌍 Город: ${savedCity}\n\n` +
        '💬 Оставьте комментарий к заказу или нажмите "Без комментария":',
        buildCommentPromptKeyboard()
      );
    } else {
      await ctx.reply('📝 Для оформления заказа укажите, как к вам обращаться:');
    }
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
  // If checkout is active but cart got emptied, abort flow early
  if (await abortIfCartEmptyDuringCheckout(ctx)) {
    return;
  }
  if (YANDEX_PVZ_ENABLED && ctx.session?.pvzStep === 'city') {
    await handlePvzCityInput(ctx, ctx.message.text);
    return;
  }
  if (YANDEX_PVZ_ENABLED && ctx.session?.pvzStep === 'street') {
    await handlePvzStreetInput(ctx, ctx.message.text);
    return;
  }
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
        if (YANDEX_PVZ_ENABLED) {
          ctx.session.checkoutStep = 'city';
          await ctx.reply('🌍 Укажите ваш город/страну:');
        } else {
          ctx.session.checkoutStep = 'phone';
          await ctx.reply('📞 Укажите номер телефона для связи:');
        }
        break;

      case 'phone':
        ctx.session.phone = text;
        ctx.session.checkoutStep = 'pvz_address';
        await ctx.reply('🏤 Напишите адрес ПВЗ Яндекса (город, улица, номер отделения):');
        break;

      case 'pvz_address':
        ctx.session.deliveryPickupAddress = text;
        ctx.session.pvzSelection = text;
        ctx.session.city = text;
        ctx.session.checkoutStep = 'comment';
        await ctx.reply('💬 Оставьте комментарий к заказу или нажмите "Без комментария":', buildCommentKeyboard());
        break;

      case 'city':
        if (!YANDEX_PVZ_ENABLED) {
          ctx.session.city = text;
          ctx.session.checkoutStep = 'comment';
          await ctx.reply('💬 Оставьте комментарий к заказу или нажмите "Без комментария":', buildCommentKeyboard());
          break;
        }
        await handleCityInput(ctx, text);
        break;

      case 'comment':
        ctx.session.comment = text === 'нет' ? '' : text;
        ctx.session.checkoutStep = 'payment_proof';
        await ctx.reply(
          await buildPaymentRequestMessage(userId),
          buildPaymentProofKeyboard()
        );
        break;

      case 'payment_proof':
        await ctx.reply('Пожалуйста, отправьте скриншот перевода как фото сообщением.');
        break;
    }
  } catch (error) {
    console.error('Error in checkout text handler:', error);
    await ctx.reply('❌ Произошла ошибка. Попробуйте начать оформление заново: /menu');
    ctx.session = {};
  }
});

bot.action(/city_pick_(\d+)/, async (ctx) => {
  const idx = parseInt(ctx.match[1], 10);
  if (!ctx.session || ctx.session.checkoutStep !== 'city_choice') {
    return ctx.answerCbQuery();
  }
  const option = ctx.session.cityOptions?.[idx];
  const original = ctx.session.pendingCity || '';
  ctx.session.city = option?.address || original;
  ctx.session.pendingPvzGeoId = option?.geo_id || null;
  ctx.session.pvzStep = 'street';
  ctx.session.checkoutStep = 'comment';
  await ctx.answerCbQuery(option ? option.address : 'Город выбран');
  await ctx.reply(`Город для ПВЗ: ${ctx.session.city}\nТеперь введите улицу для поиска ПВЗ:`);
});

bot.action('city_keep', async (ctx) => {
  if (!ctx.session || ctx.session.checkoutStep !== 'city_choice') {
    return ctx.answerCbQuery();
  }
  ctx.session.city = ctx.session.pendingCity || '';
  ctx.session.pendingPvzGeoId = null;
  ctx.session.pvzStep = 'street';
  ctx.session.checkoutStep = 'comment';
  await ctx.answerCbQuery('Используем ваш вариант');
  await ctx.reply(`Город для ПВЗ: ${ctx.session.city}\nТеперь введите улицу для поиска ПВЗ:`);
});

bot.action('pvz_start', async (ctx) => {
  if (!YANDEX_PVZ_ENABLED) {
    ctx.session = ctx.session || {};
    ctx.session.checkoutStep = 'pvz_address';
    await ctx.answerCbQuery('Теперь просто отправьте адрес ПВЗ текстом');
    await ctx.reply('🏤 Напишите адрес ПВЗ Яндекса (город, улица, номер отделения):');
    return;
  }
  ctx.session = ctx.session || {};
  ctx.session.pvzStep = 'city';
  ctx.session.pvzOptions = null;
  ctx.session.pendingPvzCity = null;
  await ctx.answerCbQuery();
  await ctx.reply('Введите город для выбора ПВЗ:');
});

bot.action(/pvz_pick_(\d+)/, async (ctx) => {
  if (!YANDEX_PVZ_ENABLED) {
    await ctx.answerCbQuery('Выбор ПВЗ через карту отключён. Напишите адрес текстом.');
    return;
  }
  if (!ctx.session || (ctx.session.pvzStep !== 'pvz_choice' && ctx.session.pvzStep !== 'street_choice')) {
    return ctx.answerCbQuery();
  }
  const idx = parseInt(ctx.match[1], 10);
  const option = ctx.session.pvzOptions?.[idx];
  const original = ctx.session.pendingPvzCity || '';
  if (ctx.session.pvzStep === 'pvz_choice') {
    ctx.session.city = option?.address || original;
    ctx.session.pendingPvzGeoId = option?.geo_id || null;
    ctx.session.deliveryGeoId = ctx.session.pendingPvzGeoId;
    ctx.session.pvzStep = 'street';
    await ctx.answerCbQuery(option ? option.address : 'Город выбран');
    await ctx.reply(`Город для ПВЗ: ${ctx.session.city}\nТеперь введите улицу для поиска ПВЗ:`);
    return;
  }

  // street_choice: picking concrete PVZ
  const label = formatPickupLabel(option);
  ctx.session.pvzSelection = label || ctx.session.city;
  ctx.session.deliveryPickupId = option?.id || option?.operator_station_id || null;
  ctx.session.deliveryPickupAddress = label || null;
  ctx.session.pvzStep = null;
  ctx.session.checkoutStep = 'comment';
  await ctx.answerCbQuery(label || 'ПВЗ выбран');
  await ctx.reply(`ПВЗ выбран: ${ctx.session.pvzSelection}`);
  await ctx.reply('💬 Оставьте комментарий к заказу или нажмите "Без комментария":', buildCommentKeyboard());
});

bot.action('pvz_keep', async (ctx) => {
  if (!ctx.session || ctx.session.pvzStep !== 'pvz_choice') {
    return ctx.answerCbQuery();
  }
  ctx.session.city = ctx.session.pendingPvzCity || '';
  ctx.session.pvzStep = 'street';
  await ctx.answerCbQuery('Идём дальше');
  await ctx.reply(`Город для ПВЗ: ${ctx.session.city}\nТеперь введите улицу для поиска ПВЗ:`);
});

bot.action('pvz_skip_pickpoint', async (ctx) => {
  if (!ctx.session || ctx.session.pvzStep !== 'street_choice') {
    return ctx.answerCbQuery();
  }
  ctx.session.pvzStep = null;
  ctx.session.checkoutStep = 'comment';
  ctx.session.deliveryPickupId = null;
  ctx.session.deliveryPickupAddress = null;
  await ctx.answerCbQuery('Идём дальше');
  await ctx.reply('💬 Оставьте комментарий к заказу или нажмите "Без комментария":', buildCommentKeyboard());
});

bot.action('comment_none', async (ctx) => {
  ctx.session.comment = '';
  ctx.session.checkoutStep = 'payment_proof';
  await ctx.answerCbQuery('Комментарий не нужен');
  await ctx.reply(
    await buildPaymentRequestMessage(ctx.from.id),
    buildPaymentProofKeyboard()
  );
});

bot.action('cancel_checkout', async (ctx) => {
  ctx.session = {};
  await ctx.answerCbQuery('Оформление отменено');
  await ctx.reply('❌ Оформление заказа отменено. Корзина сохранилась, можно начать заново.', getMenuKeyboard());
});

// Handle payment proof photo
bot.on('photo', async (ctx) => {
  if (!ctx.session || ctx.session.checkoutStep !== 'payment_proof') {
    return;
  }
  // Abort if cart is empty before processing payment proof
  if (await abortIfCartEmptyDuringCheckout(ctx)) {
    return;
  }
  const userId = ctx.from.id;
  try {
    const photos = ctx.message.photo || [];
    const largest = photos[photos.length - 1];
    if (!largest?.file_id) {
      await ctx.reply('Не удалось прочитать файл. Попробуйте отправить скриншот ещё раз.');
      return;
    }

    const fileLink = await ctx.telegram.getFileLink(largest.file_id);
    ctx.session.paymentProofUrl = fileLink.href;
    ctx.session.checkoutStep = null;

    await createOrder(ctx, userId);
  } catch (error) {
    console.error('Error handling payment proof:', error);
    await ctx.reply('❌ Не удалось получить скриншот. Попробуйте отправить ещё раз.');
  }
});

async function handleCityInput(ctx, text) {
  if (!YANDEX_PVZ_ENABLED) {
    ctx.session.city = text;
    ctx.session.checkoutStep = 'comment';
    await ctx.reply('💬 Оставьте комментарий к заказу или нажмите "Без комментария":', buildCommentKeyboard());
    return;
  }
  ctx.session.pendingCity = text;
  const token = process.env.YANDEX_DELIVERY_TOKEN;
  if (!token) {
    ctx.session.city = text;
    ctx.session.checkoutStep = 'comment';
    await ctx.reply('💬 Оставьте комментарий к заказу или нажмите "Без комментария":', buildCommentPromptKeyboard());
    return;
  }

  try {
    const variants = await detectCity(text, token);
    if (variants.length === 0) {
      ctx.session.city = text;
      ctx.session.checkoutStep = 'comment';
      await ctx.reply('💬 Оставьте комментарий к заказу или нажмите "Без комментария":', buildCommentPromptKeyboard());
      return;
    }

    ctx.session.cityOptions = variants;
    ctx.session.checkoutStep = 'city_choice';

    const buttons = variants.slice(0, 5).map((v, idx) => [Markup.button.callback(v.address, `city_pick_${idx}`)]);
    buttons.push([Markup.button.callback('Оставить как ввели', 'city_keep')]);
    await ctx.reply('Выберите город из списка или оставьте как ввели:', Markup.inlineKeyboard(buttons));
  } catch (error) {
    console.error('City detect error:', error);
    ctx.session.city = text;
    ctx.session.checkoutStep = 'comment';
    await ctx.reply('💬 Оставьте комментарий к заказу или нажмите "Без комментария":', buildCommentPromptKeyboard());
  }
}

async function handlePvzCityInput(ctx, text) {
  if (!YANDEX_PVZ_ENABLED) {
    ctx.session.deliveryPickupAddress = text;
    ctx.session.pvzSelection = text;
    ctx.session.city = text;
    ctx.session.pvzStep = null;
    ctx.session.checkoutStep = 'comment';
    await ctx.reply('Адрес ПВЗ записали. 💬 Оставьте комментарий к заказу или нажмите "Без комментария":', buildCommentKeyboard());
    return;
  }
  ctx.session.pendingPvzCity = text;
  const token = process.env.YANDEX_DELIVERY_TOKEN;
  if (!token) {
    ctx.session.city = text;
    ctx.session.pvzStep = null;
    ctx.session.deliveryGeoId = null;
    await ctx.reply(`Город для ПВЗ: ${text}`);
    return;
  }

  try {
    const variants = await detectCity(text, token);
    if (variants.length === 0) {
      ctx.session.city = text;
      ctx.session.pvzStep = null;
      ctx.session.deliveryGeoId = null;
      await ctx.reply(`Город для ПВЗ: ${text}`);
      return;
    }
    ctx.session.pvzOptions = variants;
    ctx.session.pvzStep = 'pvz_choice';
    const buttons = variants.slice(0, MAX_PVZ_OPTIONS).map((v, idx) => [Markup.button.callback(v.address, `pvz_pick_${idx}`)]);
    buttons.push([Markup.button.callback('Потом разберемся', 'pvz_keep')]);
    await ctx.reply('Выберите город для ПВЗ:', Markup.inlineKeyboard(buttons));
  } catch (error) {
    console.error('PVZ City detect error:', error);
    ctx.session.city = text;
    ctx.session.pvzStep = null;
    ctx.session.deliveryGeoId = null;
    await ctx.reply(`Город для ПВЗ: ${text}`);
  }
}

async function handlePvzStreetInput(ctx, text) {
  if (!YANDEX_PVZ_ENABLED) {
    ctx.session.deliveryPickupAddress = ctx.session.pendingPvzCity || text;
    ctx.session.pvzSelection = ctx.session.deliveryPickupAddress;
    ctx.session.pvzStep = null;
    ctx.session.checkoutStep = 'comment';
    await ctx.reply('Адрес ПВЗ записали. 💬 Оставьте комментарий к заказу или нажмите "Без комментария":', buildCommentKeyboard());
    return;
  }
  ctx.session.pendingPvzCity = ctx.session.pendingPvzCity || ctx.session.city || '';
  ctx.session.pendingPvzStreet = text;
  const token = process.env.YANDEX_DELIVERY_TOKEN;
  if (!token || !ctx.session.pendingPvzGeoId) {
    ctx.session.city = ctx.session.pendingPvzCity;
    ctx.session.pvzStep = null;
    ctx.session.deliveryGeoId = ctx.session.pendingPvzGeoId || null;
    await ctx.reply(`Город для ПВЗ: ${ctx.session.city}`);
    return;
  }

  try {
    const pickups = await listPickupPoints(ctx.session.pendingPvzGeoId, token);
    const filtered = pickups.filter((p) => {
      const label = formatPickupLabel(p).toLowerCase();
      return label.includes(text.toLowerCase());
    });
    const options = (filtered.length > 0 ? filtered : pickups).slice(0, MAX_PVZ_OPTIONS);
    if (options.length === 0) {
      ctx.session.city = ctx.session.pendingPvzCity;
      ctx.session.pvzStep = null;
      await ctx.reply(`ПВЗ не найдены. Город: ${ctx.session.city}`);
      return;
    }
    ctx.session.pvzOptions = options;
    ctx.session.pvzStep = 'street_choice';
    const buttons = options.map((v, idx) => [Markup.button.callback(formatPickupLabel(v), `pvz_pick_${idx}`)]);
    buttons.push([Markup.button.callback('Потом разберемся', 'pvz_skip_pickpoint')]);
    await ctx.reply('Выберите ПВЗ:', Markup.inlineKeyboard(buttons));
  } catch (error) {
    console.error('PVZ City detect error:', error);
    ctx.session.city = text;
    ctx.session.pvzStep = null;
    await ctx.reply(`Город для ПВЗ: ${text}`);
  }
}

async function detectCity(query, token) {
  const payload = JSON.stringify({ location: query });
  const url = 'https://b2b-authproxy.taxi.yandex.net/api/b2b/platform/location/detect';
  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          if (res.statusCode >= 400) {
            return reject(new Error(`Yandex API error: ${res.statusCode} ${data}`));
          }
          const parsed = JSON.parse(data);
          resolve(parsed.variants || []);
        } catch (err) {
          reject(err);
        }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function listPickupPoints(geoId, token) {
  const payload = JSON.stringify({ geo_id: geoId, limit: 200 });
  const url = 'https://b2b-authproxy.taxi.yandex.net/api/b2b/platform/pickup-points/list';
  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          if (res.statusCode >= 400) {
            return reject(new Error(`Yandex API error: ${res.statusCode} ${data}`));
          }
          const parsed = JSON.parse(data);
          resolve(parsed.pickup_points || parsed.points || []);
        } catch (err) {
          reject(err);
        }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function formatPickupLabel(p) {
  if (!p) return '';
  if (p.full_address) return p.full_address;
  if (p.address?.formatted) return p.address.formatted;
  if (p.address?.full_address) return p.address.full_address;
  if (p.name) return p.name;
  return `${p.lat || ''} ${p.lon || ''}`.trim();
}

function buildPvzButtonKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('Выбрать Яндекс ПВЗ', 'pvz_start')]
  ]);
}

function buildCommentPromptKeyboard() {
  return YANDEX_PVZ_ENABLED ? buildPvzButtonKeyboard() : buildCommentKeyboard();
}

function buildCommentKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('Без комментария', 'comment_none')]
  ]);
}

function buildPaymentProofKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('❌ Отменить оформление', 'cancel_checkout')]
  ]);
}

async function buildPaymentRequestMessage(userId) {
  try {
    const total = Number(await CartModel.getCartTotal(userId)) || 0;
    const amountText = total > 0 ? `Сумма к оплате: ${total.toFixed(2)} RUB\n` : '';
    return (
      '💳 Оплатите переводом по СБП (Т-Банк/Сбер) на номер 89633345452.\n' +
      amountText +
      '📸 После оплаты отправьте сюда скриншот перевода, чтобы завершить заказ.'
    );
  } catch (error) {
    console.error('Failed to build payment request message:', error);
    return (
      '💳 Оплатите переводом по СБП (Т-Банк/Сбер) на номер 89633345452.\n' +
      '📸 После оплаты отправьте сюда скриншот перевода, чтобы завершить заказ.'
    );
  }
}

// Abort checkout flow if cart emptied mid-process
async function abortIfCartEmptyDuringCheckout(ctx) {
  if (!ctx.session || !ctx.session.checkoutStep) return false;
  const cartItems = await CartModel.getCartItems(ctx.from.id);
  if (cartItems.length === 0) {
    ctx.session = {};
    await ctx.reply('❌ Корзина пуста. Добавьте товары и попробуйте оформить заказ снова.', getMenuKeyboard());
    return true;
  }
  return false;
}

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

// Helper to build product captions
function buildProductCaption(product, variant) {
  let message = `🎽 ${product.name}`;
  if (variant?.name) {
    message += ` (${variant.name})`;
  }
  message += `\n\n${product.description || ''}\n\n`;
  message += `💰 Цена: ${product.getFormattedPrice()}\n`;
  if (product.shippingIncluded) {
    message += '🚚 Доставка за наш счет\n';
  }
  if (product.isPreorder) {
    message += '🕒 Это предзаказ. Сроки и детали уточним после оформления.\n';
    if (product.preorderEndDate) {
      message += `📅 Предзаказ до: ${product.preorderEndDate.toLocaleDateString('ru-RU')}\n`;
    }
    if (product.estimatedDeliveryDate) {
      message += `🚚 Ориентир получения: ${product.estimatedDeliveryDate.toLocaleDateString('ru-RU')}\n`;
    }
  } else if (variant?.stock !== undefined) {
    message += `📦 В наличии: ${variant.stock} шт.\n`;
  } else {
    message += `📦 В наличии: ${product.stock} шт.\n`;
  }
  return message;
}

// Send product view with photo when есть фото
async function sendProductView(ctx, { message, keyboard, photoUrl }) {
  const markup = Markup.inlineKeyboard(keyboard);
  if (!photoUrl) {
    // Fallback to text-only
    if (ctx.update?.callback_query?.message?.message_id) {
      await ctx.editMessageText(message, markup);
    } else {
      await ctx.reply(message, markup);
    }
    return;
  }

  try {
    await ctx.editMessageMedia(
      {
        type: 'photo',
        media: photoUrl,
        caption: message
      },
      markup
    );
  } catch (error) {
    console.warn('editMessageMedia failed, sending new photo message', error.message);
    await ctx.replyWithPhoto(photoUrl, {
      caption: message,
      ...markup
    });
  }
}

// Helper to show user's orders
async function showUserOrders(ctx, { fromCallback = false } = {}) {
  try {
    if (ctx.from) {
      await UserModel.upsertUser(ctx.from);
    }
    const orders = await OrderModel.getOrdersWithItemsByTelegramId(ctx.from.id);
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('🛒 Корзина', 'cart')],
      [Markup.button.callback('⬅️ В магазин', 'shop')],
      [Markup.button.callback('🏠 В меню', 'main_menu')]
    ]);

    if (orders.length === 0) {
      const emptyMsg = '📦 У вас пока нет заказов. Соберите корзину и оформите первый заказ!';
      if (fromCallback && ctx.update?.callback_query?.message?.message_id) {
        await ctx.editMessageText(emptyMsg, keyboard);
        await ctx.answerCbQuery();
      } else {
        await ctx.reply(emptyMsg, keyboard);
      }
      return;
    }

    const messageParts = ['📦 Мои заказы:\n'];
    for (const order of orders) {
      const createdAt = order.createdAt
        ? new Date(order.createdAt).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })
        : '';
      const headerParts = [`#${order.id}`, order.getStatusText()];
      if (createdAt) {
        headerParts.push(createdAt);
      }
      messageParts.push(headerParts.join(' • '));

      if (order.items?.length) {
        for (const item of order.items) {
          const variant = item.variantName ? ` (${item.variantName})` : '';
          const preorder = item.isPreorder ? ' (предзаказ)' : '';
          const lineTotal = (item.pricePerUnit || 0) * item.quantity;
          messageParts.push(` • ${item.productName}${variant}${preorder} x${item.quantity}`);
          messageParts.push(`   ${lineTotal.toFixed(2)} ${item.currency}`);
        }
      } else {
        messageParts.push(' • Товары не найдены');
      }

      const total = Number.isFinite(order.totalAmount) ? order.totalAmount : 0;
      messageParts.push(`Итого: ${total.toFixed(2)} RUB`);
      messageParts.push('');
    }

    const message = messageParts.join('\n');

    if (fromCallback && ctx.update?.callback_query?.message?.message_id) {
      try {
        await ctx.editMessageText(message, keyboard);
      } catch (error) {
        console.warn('editMessageText failed in showUserOrders, sending new message', error.description || error.message);
        await ctx.reply(message, keyboard);
      }
      await ctx.answerCbQuery();
    } else {
      await ctx.reply(message, keyboard);
    }
  } catch (error) {
    console.error('Error showing orders:', error);
    try {
      if (fromCallback) {
        await ctx.answerCbQuery('❌ Не удалось загрузить заказы');
      }
    } catch (callbackError) {
      console.error('Failed to send callback query:', callbackError);
    }
    if (!fromCallback) {
      await ctx.reply('❌ Не удалось загрузить заказы, попробуйте позже.');
    }
  }
}

// Helper function to show cart
async function showCart(ctx) {
  const userId = ctx.from.id;
  
  try {
    const cartItems = await CartModel.getCartItems(userId);
    const total = parseFloat(await CartModel.getCartTotal(userId)) || 0;
    
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
      const preorderText = item.is_preorder ? ' (предзаказ)' : '';
      message += `🔹 ${item.product_name}${variantText}${preorderText} x${item.quantity}\n`;
      message += `   💰 ${parseFloat(item.product_price) * item.quantity} ${item.product_currency}\n`;
      if (item.is_preorder) {
        message += '   🕒 Товар по предзаказу\n\n';
      } else {
        message += '\n';
      }
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
      try {
        await ctx.editMessageText(message, Markup.inlineKeyboard(keyboard));
      } catch (error) {
        console.warn('editMessageText failed in showCart, sending new message', error.description || error.message);
        await ctx.reply(message, Markup.inlineKeyboard(keyboard));
      }
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
      await ctx.reply('❌ Корзина пуста. Добавьте товары и попробуйте оформить заказ снова.', getMenuKeyboard());
      ctx.session = {};
      return;
    }
    
    // Create order
    const pvzNote = ctx.session.pvzSelection ? `ПВЗ: ${ctx.session.pvzSelection}` : null;
    const baseComment = ctx.session.comment || '';
    const combinedComment = pvzNote ? (baseComment ? `${pvzNote}\n${baseComment}` : pvzNote) : baseComment;
    const phone = ctx.session.phone || null;
    const deliveryPickupAddress = ctx.session.deliveryPickupAddress || ctx.session.pvzSelection || null;
    const city = ctx.session.city || deliveryPickupAddress || null;

    const orderData = {
      userId: userId,
      customerName: ctx.session.customerName,
      phone,
      cityCountry: city,
      comment: combinedComment,
      totalAmount: total,
      paymentProofUrl: ctx.session.paymentProofUrl || null,
      deliveryGeoId: ctx.session.deliveryGeoId || null,
      deliveryPickupId: ctx.session.deliveryPickupId || null,
      deliveryPickupAddress
    };
    
    const order = await OrderModel.createOrder(orderData);
    await OrderModel.createOrderItems(order.id, cartItems);
    
    // Clear cart
    await CartModel.clearCart(userId);
    
    // Send confirmation message
    const message = `
🎉 Спасибо за заказ!

Номер заказа: #${order.id}
Мы получили скриншот оплаты. Свяжемся с вами в Telegram, чтобы подтвердить детали.
По всем вопросам пишите @fatracing_manager.
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
