(() => {
  let productImageRowCounter = 0;
  let productVariantRowCounter = 0;
  let productQuestionRowCounter = 0;

  function loadProducts() {
    showLoading();

    fetch('/api/products', { credentials: 'include' })
      .then(response => response.json())
      .then(products => {
        document.getElementById('content').innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: center;">
              <h2>Магазин мерча</h2>
              <button class="btn" onclick="showAddProductForm()">Добавить товар</button>
          </div>
          <div class="content">
              ${products.length > 0 ? `
                  <table>
                      <thead>
                          <tr>
                              <th>ID</th>
                              <th>Название</th>
                              <th>Цена</th>
                              <th>Себестоимость</th>
                              <th>Наличие</th>
                              <th>Предзаказ</th>
                              <th>Окончание предзаказа</th>
                              <th>Ориентир получения</th>
                              <th>Статус</th>
                              <th>Действия</th>
                          </tr>
                      </thead>
                      <tbody>
                          ${products.map(product => `
                              <tr class="product-row" data-product-id="${product.id}" style="cursor:pointer;">
                                  <td>${product.id}</td>
                                  <td>${product.name}</td>
                                  <td>${product.price} ${product.currency}</td>
                                  <td>${product.cost ? Number(product.cost).toFixed(2) : '0.00'} ${product.currency}</td>
                                  <td>${product.is_preorder ? '—' : product.stock}</td>
                                  <td>${product.is_preorder ? 'Да' : 'Нет'}</td>
                                  <td>${product.preorder_end_date ? new Date(product.preorder_end_date).toLocaleDateString('ru-RU') : '—'}</td>
                          <td>${product.estimated_delivery_date ? new Date(product.estimated_delivery_date).toLocaleDateString('ru-RU') : '—'}</td>
                          <td>${product.status}</td>
                          <td style="display:flex; gap:8px; flex-wrap:wrap;">
                              <button class="btn" onclick="event.stopPropagation(); duplicateProduct(${product.id})">Дублировать</button>
                              <button class="btn btn-danger" onclick="event.stopPropagation(); deleteProduct(${product.id})">Удалить</button>
                          </td>
                      </tr>
                  `).join('')}
              </tbody>
                  </table>
              ` : '<p style="text-align: center;">Нет товаров</p>'}
          </div>
        `;
        bindProductRows();
      })
      .catch(error => {
        console.error('Error loading products:', error);
        showError('Не удалось загрузить товары');
      });
  }

  function renderProductForm(mode, product = {}) {
    const images = Array.isArray(product.images) && product.images.length
      ? product.images
      : (product.photo_url ? [product.photo_url] : ['']);
    productImageRowCounter = 0;
    const variants = Array.isArray(product.variants) ? product.variants : [];
    productVariantRowCounter = 0;
    const questions = Array.isArray(product.questions) ? product.questions : [];
    productQuestionRowCounter = 0;
    const sizesEnabled = variants.length > 0;
    const questionsEnabled = questions.length > 0;
    const title = mode === 'edit' ? `Редактировать товар #${product.id}` : 'Добавить товар';
    document.getElementById('content').innerHTML = `
        <h2>${title}</h2>
        <div class="content">
            <div class="form-group">
                <label for="product-name">Название</label>
                <input id="product-name" type="text" placeholder="Например: Футболка FATRACING" value="${product.name || ''}" />
            </div>
            <div class="form-group">
                <label for="product-description">Описание</label>
                <textarea id="product-description" rows="4" placeholder="Краткое описание товара">${product.description || ''}</textarea>
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px;">
                <div class="form-group">
                    <label for="product-price">Цена</label>
                    <input id="product-price" type="number" min="0" step="0.01" placeholder="1490" value="${product.price || ''}" />
                </div>
                <div class="form-group">
                    <label for="product-cost">Себестоимость</label>
                    <input id="product-cost" type="number" min="0" step="0.01" placeholder="500" value="${product.cost || ''}" />
                </div>
                <div class="form-group">
                    <label for="product-currency">Валюта</label>
                    <select id="product-currency">
                        <option value="RUB" ${product.currency === 'RUB' || !product.currency ? 'selected' : ''}>RUB</option>
                        <option value="USD" ${product.currency === 'USD' ? 'selected' : ''}>USD</option>
                        <option value="EUR" ${product.currency === 'EUR' ? 'selected' : ''}>EUR</option>
                    </select>
                </div>
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px;">
                <div class="form-group">
                    <label for="product-stock">Количество на складе</label>
                    <input id="product-stock" type="number" min="0" step="1" value="${product.stock ?? 0}" />
                </div>
                <div class="form-group">
                    <label for="product-status">Статус</label>
                    <select id="product-status">
                        <option value="active" ${product.status === 'active' || !product.status ? 'selected' : ''}>active</option>
                        <option value="inactive" ${product.status === 'inactive' ? 'selected' : ''}>inactive</option>
                    </select>
                </div>
            </div>
            <div class="form-group checkbox-group">
                <label for="product-preorder" style="display:flex; align-items:center; gap:8px;">
                    <input id="product-preorder" type="checkbox" ${product.is_preorder ? 'checked' : ''} />
                    Товар доступен по предзаказу
                </label>
                <small>При предзаказе пользователи не увидят остаток и получат пометку «предзаказ».</small>
            </div>
            <div class="form-group checkbox-group">
                <label for="product-shipping-included" style="display:flex; align-items:center; gap:8px;">
                    <input id="product-shipping-included" type="checkbox" ${product.shipping_included ? 'checked' : ''} />
                    Доставка за наш счет
                </label>
                <small>Если включено — ниже укажите стоимость доставки для расчета чистой прибыли.</small>
            </div>
            <div class="form-group" id="shipping-cost-group" style="display:${product.shipping_included ? 'block' : 'none'};">
                <label for="product-shipping-cost">Стоимость доставки</label>
                <input id="product-shipping-cost" type="number" min="0" step="0.01" placeholder="300" value="${product.shipping_cost || ''}" />
            </div>
            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px;">
                <div class="form-group">
                    <label for="product-preorder-end">Окончание предзаказа</label>
                    <input id="product-preorder-end" type="date" value="${product.preorder_end_date ? new Date(product.preorder_end_date).toISOString().split('T')[0] : ''}" />
                </div>
                <div class="form-group">
                    <label for="product-estimated-delivery">Ориентировочная дата получения</label>
                    <input id="product-estimated-delivery" type="date" value="${product.estimated_delivery_date ? new Date(product.estimated_delivery_date).toISOString().split('T')[0] : ''}" />
                </div>
            </div>
            <div class="form-group">
                <label for="product-size-guide">Ссылка на размерную сетку (опционально)</label>
                <input id="product-size-guide" type="text" placeholder="https://..." value="${product.size_guide_url || ''}" />
                <small>Если указать ссылку, она появится в карточке товара в боте.</small>
            </div>
            <div class="form-group checkbox-group">
                <label for="product-has-sizes" style="display:flex; align-items:center; gap:8px;">
                    <input id="product-has-sizes" type="checkbox" ${sizesEnabled ? 'checked' : ''} />
                    У товара есть размеры
                </label>
                <small>При включении можно задать список размеров с остатками. Пользователю будет показан выбор размера.</small>
            </div>
            <div class="form-group checkbox-group">
                <label for="product-gender-required" style="display:flex; align-items:center; gap:8px;">
                    <input id="product-gender-required" type="checkbox" ${product.gender_required ? 'checked' : ''} />
                    Требовать выбор пола (М/Ж)
                </label>
                <small>Перед добавлением в корзину попросим выбрать М или Ж.</small>
            </div>
            <div class="form-group checkbox-group">
                <label for="product-has-questions" style="display:flex; align-items:center; gap:8px;">
                    <input id="product-has-questions" type="checkbox" ${questionsEnabled ? 'checked' : ''} />
                    Дополнительные вопросы при оформлении
                </label>
                <small>Можно задать любые вопросы, на которые пользователь ответит перед добавлением товара в корзину.</small>
            </div>
            <div id="questions-section" style="display:${questionsEnabled ? 'block' : 'none'};">
                ${renderQuestionsSection(questions)}
            </div>
            <div id="variants-section" style="display:${sizesEnabled ? 'block' : 'none'};">
                ${renderVariantsSection(variants)}
            </div>
            ${renderProductImagesSection(images)}
            <div style="display: flex; gap: 12px; flex-wrap: wrap;">
                ${mode === 'edit' ? `
                    <button class="btn btn-success" onclick="updateProduct(${product.id})">Сохранить</button>
                    <button class="btn" onclick="duplicateProduct(${product.id})">Дублировать</button>
                    <button class="btn btn-secondary" onclick="loadProducts()">Отмена</button>
                ` : `
                    <button class="btn btn-success" onclick="createProduct()">Создать товар</button>
                    <button class="btn btn-secondary" onclick="loadProducts()">Назад к списку</button>
                `}
            </div>
        </div>
    `;
    attachVariantsToggleHandler();
    attachQuestionsToggleHandler();
    initProductImagePreviews();
    bindProductRows();
  }

  function bindProductRows() {
    const rows = document.querySelectorAll('.product-row[data-product-id]');
    rows.forEach(row => {
      row.addEventListener('click', (e) => {
        const id = row.getAttribute('data-product-id');
        if (!id) return;
        editProduct(id);
      });
    });
  }

  function attachVariantsToggleHandler() {
    const checkbox = document.getElementById('product-has-sizes');
    if (!checkbox) return;
    checkbox.addEventListener('change', handleVariantsToggle);
  }

  function attachQuestionsToggleHandler() {
    const checkbox = document.getElementById('product-has-questions');
    if (!checkbox) return;
    checkbox.addEventListener('change', handleQuestionsToggle);
  }

  function handleVariantsToggle() {
    const checkbox = document.getElementById('product-has-sizes');
    const section = document.getElementById('variants-section');
    if (!checkbox || !section) return;
    const enabled = checkbox.checked;
    section.style.display = enabled ? 'block' : 'none';
    if (enabled) {
      const rows = section.querySelectorAll('.product-variant-row');
      if (rows.length === 0) {
        addVariantRow();
      }
    }
  }

  function handleQuestionsToggle() {
    const checkbox = document.getElementById('product-has-questions');
    const section = document.getElementById('questions-section');
    if (!checkbox || !section) return;
    const enabled = checkbox.checked;
    section.style.display = enabled ? 'block' : 'none';
    if (enabled) {
      const rows = section.querySelectorAll('.product-question-row');
      if (rows.length === 0) {
        addQuestionRow();
      }
    }
  }

  function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe.replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function updateProductImagePreview(key) {
    const urlInput = document.getElementById(`product-photo-${key}`);
    const url = urlInput?.value?.trim();
    const card = document.querySelector(`.product-image-card[data-preview="${key}"]`);
    if (!card) return;
    const placeholder = card.querySelector('.product-image-placeholder');
    const openLink = card.querySelector('.product-image-open');
    if (url) {
      card.style.backgroundImage = `url('${url}')`;
      card.style.backgroundSize = 'cover';
      card.style.backgroundPosition = 'center';
      if (placeholder) placeholder.textContent = '';
      if (openLink) {
        openLink.href = url;
        openLink.style.display = 'inline-flex';
      } else {
        card.insertAdjacentHTML('beforeend', `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" class="product-image-open" style="position:absolute; left:6px; bottom:6px; background:rgba(0,0,0,0.6); color:#fff; padding:3px 8px; border-radius:4px; font-size:11px; text-decoration:none;">Открыть</a>`);
      }
    } else {
      card.style.backgroundImage = 'none';
      if (placeholder) placeholder.textContent = 'Нет изображения';
      if (openLink) openLink.style.display = 'none';
    }
  }

  function initProductImagePreviews() {
    const rows = document.querySelectorAll('.product-image-row');
    rows.forEach(row => {
      const key = row.getAttribute('data-key');
      updateProductImagePreview(key);
    });
  }

  function triggerProductMultiUpload() {
    const input = document.getElementById('product-upload-multi');
    if (input) input.click();
  }

  async function handleProductMultiUpload(event) {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    await uploadProductImagesFromFiles(files);
    event.target.value = '';
  }

  async function uploadProductImagesFromFiles(files) {
    for (const file of files) {
      try {
        const url = await uploadProductFile(file);
        if (url) {
          addProductImageRow(url);
        }
      } catch (error) {
        if (error.message === 'file-too-large') {
          // Уже показали алерт в uploadProductFile
          continue;
        }
        console.error('Error uploading product image:', error);
        alert('Не удалось загрузить изображение');
        break;
      }
    }
  }

  async function uploadProductFile(file) {
    if (!file) return null;
    if (file.size > 5 * 1024 * 1024) {
      alert('Максимальный размер файла 5 МБ');
      throw new Error('file-too-large');
    }

    const dataUrl = await ensureReadFileAsDataURL(file);
    const response = await fetch('/api/uploads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name: file.name, data: dataUrl })
    });
    const data = await response.json();
    if (data.error) {
      alert(data.error);
      throw new Error(data.error);
    }
    return data.url;
  }

  function ensureReadFileAsDataURL(file) {
    if (typeof readFileAsDataURL === 'function') {
      return readFileAsDataURL(file);
    }
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error || new Error('Ошибка чтения файла'));
      reader.readAsDataURL(file);
    });
  }

  function showAddProductForm() {
    window.location.hash = '#/products';
    renderProductForm('add');
  }

  function renderProductImagesSection(images = []) {
    const safeImages = Array.isArray(images) ? images : [];
    const prepared = safeImages.length ? safeImages : [];
    const rowsHtml = prepared.map((url, index) => renderProductImageRow(url, `existing-${index}`)).join('');
    return `
        <div class="form-group">
            <label>Изображения товара</label>
            <div style="display:flex; gap:12px; align-items:center; flex-wrap:wrap; margin-bottom:8px;">
                <button class="btn" type="button" onclick="triggerProductMultiUpload()">Добавить изображения</button>
                <input id="product-upload-multi" type="file" accept="image/*" multiple style="display:none;" onchange="handleProductMultiUpload(event)" />
                <small style="color:#666;">Можно выбрать несколько файлов сразу</small>
            </div>
            <div id="product-images-list">
                ${rowsHtml || ''}
            </div>
            <small>Первое изображение станет обложкой товара.</small>
        </div>
    `;
  }

  function nextProductImageKey(customKey) {
    if (customKey) return customKey;
    productImageRowCounter += 1;
    return `img-${Date.now()}-${productImageRowCounter}`;
  }

  function renderProductImageRow(url = '', key) {
    const rowKey = nextProductImageKey(key);
    const safeUrl = escapeHtml(url || '');
    return `
        <div class="product-image-row" data-key="${rowKey}" style="display:flex; gap:12px; align-items:flex-start; flex-wrap:wrap; margin-bottom:12px;">
            <input id="product-photo-${rowKey}" class="product-image-input" type="hidden" value="${safeUrl}" />
            <div class="product-image-card" data-preview="${rowKey}" style="width:140px; height:140px; position:relative; border:1px solid #eee; border-radius:8px; background:#fafafa; display:flex; align-items:center; justify-content:center; overflow:hidden;">
                <span class="product-image-placeholder" style="color:#999; font-size:12px;">${safeUrl ? '' : 'Нет изображения'}</span>
                <button type="button" class="product-image-remove" onclick="event.stopPropagation(); removeProductImageRow('${rowKey}')" title="Убрать" style="position:absolute; top:6px; right:6px; border:none; background:rgba(0,0,0,0.7); color:#fff; border-radius:50%; width:26px; height:26px; cursor:pointer; font-size:16px; line-height:1; z-index:2;">×</button>
                ${safeUrl ? `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="product-image-open" style="position:absolute; left:6px; bottom:6px; background:rgba(0,0,0,0.6); color:#fff; padding:3px 8px; border-radius:4px; font-size:11px; text-decoration:none;">Открыть</a>` : ''}
            </div>
        </div>
    `;
  }

  function addProductImageRow(url = '') {
    const container = document.getElementById('product-images-list');
    if (!container) return;
    const key = nextProductImageKey();
    container.insertAdjacentHTML('beforeend', renderProductImageRow(url, key));
    updateProductImagePreview(key);
  }

  function removeProductImageRow(key) {
    const row = document.querySelector('.product-image-row[data-key="' + key + '"]');
    if (row) {
      row.remove();
    }
  }

  async function uploadPendingProductImages() {
    // Нет отложенных загрузок в новом UI; загрузка происходит сразу при выборе файлов
  }

  function collectProductImages() {
    const inputs = document.querySelectorAll('.product-image-input');
    return Array.from(inputs)
      .map(input => input.value.trim())
      .filter(Boolean);
  }

  function renderVariantsSection(variants = []) {
    const prepared = variants.length ? variants : [{ name: '', stock: 0 }];
    const rowsHtml = prepared.map((variant, index) => renderVariantRow(variant, `var-${index}`)).join('');
    return `
        <div class="form-group">
            <label>Размеры</label>
            <div id="product-variants-list">
                ${rowsHtml || renderVariantRow({ name: '', stock: 0 }, 'var-0')}
            </div>
            <button class="btn" type="button" onclick="addVariantRow()">Добавить размер</button>
            <small>Добавьте варианты размера и остаток. Порядок не важен.</small>
        </div>
    `;
  }

  function nextVariantKey(customKey) {
    if (customKey) return customKey;
    productVariantRowCounter += 1;
    return `variant-${Date.now()}-${productVariantRowCounter}`;
  }

  function renderVariantRow(variant = {}, key) {
    const rowKey = nextVariantKey(key);
    const name = variant.name || '';
    return `
        <div class="product-variant-row" data-key="${rowKey}" style="display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin-bottom:8px;">
            <input id="variant-name-${rowKey}" type="text" placeholder="Размер (S/M/L или цифра)" value="${name}" />
            <button class="btn btn-secondary" type="button" onclick="removeVariantRow('${rowKey}')">Убрать</button>
        </div>
    `;
  }

  function addVariantRow(variant = {}) {
    const container = document.getElementById('product-variants-list');
    if (!container) return;
    container.insertAdjacentHTML('beforeend', renderVariantRow(variant));
  }

  function removeVariantRow(key) {
    const row = document.querySelector('.product-variant-row[data-key="' + key + '"]');
    if (row) row.remove();
    const rowsLeft = document.querySelectorAll('.product-variant-row').length;
    if (rowsLeft === 0) {
      addVariantRow();
    }
  }

  function renderQuestionsSection(questions = []) {
    const prepared = questions.length ? questions : [''];
    const rowsHtml = prepared.map((question, index) => renderQuestionRow(question, `q-${index}`)).join('');
    return `
        <div class="form-group">
            <label>Дополнительные вопросы</label>
            <div id="product-questions-list">
                ${rowsHtml || renderQuestionRow('', 'q-0')}
            </div>
            <button class="btn" type="button" onclick="addQuestionRow()">Добавить вопрос</button>
            <small>Эти вопросы будут заданы пользователю при добавлении товара в корзину.</small>
        </div>
    `;
  }

  function nextQuestionKey(customKey) {
    if (customKey) return customKey;
    productQuestionRowCounter += 1;
    return `question-${Date.now()}-${productQuestionRowCounter}`;
  }

  function renderQuestionRow(question = '', key) {
    const rowKey = nextQuestionKey(key);
    const safeQuestion = escapeHtml(question || '');
    return `
        <div class="product-question-row" data-key="${rowKey}" style="display:flex; gap:8px; align-items:flex-start; flex-wrap:wrap; margin-bottom:8px; width:100%;">
            <textarea id="question-${rowKey}" rows="2" style="flex:1; min-width:220px;" placeholder="Например: ваш рост/вес или пожелания">${safeQuestion}</textarea>
            <button class="btn btn-secondary" type="button" onclick="removeQuestionRow('${rowKey}')">Убрать</button>
        </div>
    `;
  }

  function addQuestionRow(question = '') {
    const container = document.getElementById('product-questions-list');
    if (!container) return;
    const key = nextQuestionKey();
    container.insertAdjacentHTML('beforeend', renderQuestionRow(question, key));
  }

  function removeQuestionRow(key) {
    const row = document.querySelector('.product-question-row[data-key="' + key + '"]');
    if (row) row.remove();
  }

  function collectQuestions() {
    const rows = document.querySelectorAll('.product-question-row');
    const questions = [];
    rows.forEach(row => {
      const key = row.getAttribute('data-key');
      const textarea = document.getElementById(`question-${key}`);
      const value = textarea?.value?.trim();
      if (value) questions.push(value);
    });
    return questions;
  }

  function collectVariants() {
    const rows = document.querySelectorAll('.product-variant-row');
    const variants = [];
    rows.forEach(row => {
      const key = row.getAttribute('data-key');
      const nameInput = document.getElementById(`variant-name-${key}`);
      const name = nameInput?.value?.trim();
      if (name) {
        variants.push({ name, stock: null });
      }
    });
    return variants;
  }

  async function createProduct() {
    const name = document.getElementById('product-name').value.trim();
    const description = document.getElementById('product-description').value.trim();
    const priceValue = parseFloat(document.getElementById('product-price').value);
    const costValue = parseFloat(document.getElementById('product-cost').value);
    const shippingIncluded = document.getElementById('product-shipping-included').checked;
    const shippingCostValue = parseFloat(document.getElementById('product-shipping-cost')?.value);
    const currency = document.getElementById('product-currency').value;
    const stockValueRaw = document.getElementById('product-stock').value;
    const stockValue = Number.isNaN(parseInt(stockValueRaw, 10)) ? 0 : parseInt(stockValueRaw, 10);
    const status = document.getElementById('product-status').value;
    const is_preorder = document.getElementById('product-preorder').checked;
    const preorder_end_date = document.getElementById('product-preorder-end').value || null;
    const estimated_delivery_date = document.getElementById('product-estimated-delivery').value || null;
    const size_guide_url = document.getElementById('product-size-guide').value.trim() || null;
    const hasSizes = document.getElementById('product-has-sizes').checked;
    const gender_required = document.getElementById('product-gender-required').checked;
    const hasQuestions = document.getElementById('product-has-questions').checked;

    if (!name) {
      alert('Введите название товара');
      return;
    }
    if (Number.isNaN(priceValue)) {
      alert('Введите корректную цену');
      return;
    }
    if (!Number.isNaN(costValue) && costValue < 0) {
      alert('Себестоимость не может быть отрицательной');
      return;
    }
    if (stockValue < 0) {
      alert('Количество на складе не может быть отрицательным');
      return;
    }
    if (shippingIncluded && !Number.isNaN(shippingCostValue) && shippingCostValue < 0) {
      alert('Стоимость доставки не может быть отрицательной');
      return;
    }

    try {
      await uploadPendingProductImages();
    } catch (error) {
      if (error.message !== 'file-too-large') {
        console.error('Error uploading product images:', error);
        alert('Ошибка при загрузке изображений');
      }
      return;
    }

    const images = collectProductImages();
    const variants = hasSizes ? collectVariants() : [];
    if (hasSizes && variants.length === 0) {
      alert('Добавьте хотя бы один размер или уберите галочку размеров');
      return;
    }
    const questions = hasQuestions ? collectQuestions() : [];

    try {
      const response = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name,
          description,
          price: priceValue,
          cost: Number.isNaN(costValue) ? 0 : costValue,
          shipping_included: shippingIncluded,
          shipping_cost: shippingIncluded ? (Number.isNaN(shippingCostValue) ? 0 : shippingCostValue) : 0,
          currency,
          stock: stockValue,
          images,
          size_guide_url,
          gender_required,
          questions,
          variants,
          status,
          is_preorder,
          preorder_end_date,
          estimated_delivery_date
        })
      });
      const data = await response.json();
      if (data.error) {
        alert(data.error);
        return;
      }
      alert('Товар создан');
      loadProducts();
    } catch (error) {
      console.error('Error creating product:', error);
      alert('Ошибка при создании товара');
    }
  }

  async function editProduct(id, skipHash) {
    if (!skipHash) {
      window.location.hash = `#/product/${id}`;
    }
    showLoading();
    try {
      const response = await fetch(`/api/products/${id}`, { credentials: 'include' });
      const data = await response.json();
      if (data.error) {
        showError(data.error);
        return;
      }
      renderProductForm('edit', data);
    } catch (error) {
      console.error('Error loading product:', error);
      showError('Не удалось загрузить товар');
    }
  }

  async function updateProduct(id) {
    const name = document.getElementById('product-name').value.trim();
    const description = document.getElementById('product-description').value.trim();
    const priceValue = parseFloat(document.getElementById('product-price').value);
    const costValue = parseFloat(document.getElementById('product-cost').value);
    const shippingIncluded = document.getElementById('product-shipping-included').checked;
    const shippingCostValue = parseFloat(document.getElementById('product-shipping-cost')?.value);
    const currency = document.getElementById('product-currency').value;
    const stockValueRaw = document.getElementById('product-stock').value;
    const stockValue = Number.isNaN(parseInt(stockValueRaw, 10)) ? 0 : parseInt(stockValueRaw, 10);
    const status = document.getElementById('product-status').value;
    const is_preorder = document.getElementById('product-preorder').checked;
    const preorder_end_date = document.getElementById('product-preorder-end').value || null;
    const estimated_delivery_date = document.getElementById('product-estimated-delivery').value || null;
    const size_guide_url = document.getElementById('product-size-guide').value.trim() || null;
    const hasSizes = document.getElementById('product-has-sizes').checked;
    const gender_required = document.getElementById('product-gender-required').checked;
    const hasQuestions = document.getElementById('product-has-questions').checked;

    if (!name) {
      alert('Введите название товара');
      return;
    }
    if (Number.isNaN(priceValue)) {
      alert('Введите корректную цену');
      return;
    }
    if (!Number.isNaN(costValue) && costValue < 0) {
      alert('Себестоимость не может быть отрицательной');
      return;
    }
    if (stockValue < 0) {
      alert('Количество на складе не может быть отрицательным');
      return;
    }
    if (shippingIncluded && !Number.isNaN(shippingCostValue) && shippingCostValue < 0) {
      alert('Стоимость доставки не может быть отрицательной');
      return;
    }

    try {
      await uploadPendingProductImages();
    } catch (error) {
      if (error.message !== 'file-too-large') {
        console.error('Error uploading product images:', error);
        alert('Ошибка при загрузке изображений');
      }
      return;
    }

    const images = collectProductImages();
    const variants = hasSizes ? collectVariants() : [];
    if (hasSizes && variants.length === 0) {
      alert('Добавьте хотя бы один размер или уберите галочку размеров');
      return;
    }
    const questions = hasQuestions ? collectQuestions() : [];

    try {
      const response = await fetch(`/api/products/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name,
          description,
          price: priceValue,
          cost: Number.isNaN(costValue) ? 0 : costValue,
          shipping_included: shippingIncluded,
          shipping_cost: shippingIncluded ? (Number.isNaN(shippingCostValue) ? 0 : shippingCostValue) : 0,
          currency,
          stock: stockValue,
          images,
          size_guide_url,
          gender_required,
          questions,
          variants,
          status,
          is_preorder,
          preorder_end_date,
          estimated_delivery_date
        })
      });
      const data = await response.json();
      if (data.error) {
        alert(data.error);
        return;
      }
      alert('Товар обновлен');
      loadProducts();
    } catch (error) {
      console.error('Error updating product:', error);
      alert('Ошибка при обновлении товара');
    }
  }

  async function deleteProduct(id) {
    if (!confirm('Удалить товар? Это действие необратимо.')) return;
    try {
      const response = await fetch(`/api/products/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      const data = await response.json();
      if (data.error) {
        alert(data.error);
        return;
      }
      alert('Товар удален');
      loadProducts();
    } catch (error) {
      console.error('Error deleting product:', error);
      alert('Ошибка при удалении товара');
    }
  }

  function normalizeDateValue(value) {
    if (!value) return null;
    try {
      const iso = new Date(value).toISOString();
      return iso.split('T')[0];
    } catch (e) {
      return null;
    }
  }

  async function duplicateProduct(id) {
    try {
      const response = await fetch(`/api/products/${id}`, { credentials: 'include' });
      const product = await response.json();
      if (product.error) {
        alert(product.error);
        return;
      }

      const variants = Array.isArray(product.variants)
        ? product.variants.map(variant => ({
            name: variant.name,
            stock: Number.isNaN(parseInt(variant.stock, 10)) ? 0 : parseInt(variant.stock, 10)
          }))
        : [];

      const payload = {
        name: `${product.name || 'Товар'} (копия)`,
        description: product.description || '',
        price: Number(product.price) || 0,
        cost: Number(product.cost) || 0,
        shipping_included: Boolean(product.shipping_included),
        shipping_cost: product.shipping_included ? (Number(product.shipping_cost) || 0) : 0,
        currency: product.currency || 'RUB',
        stock: Number(product.stock) || 0,
        images: Array.isArray(product.images) && product.images.length ? product.images : (product.photo_url ? [product.photo_url] : []),
        size_guide_url: product.size_guide_url || null,
        gender_required: Boolean(product.gender_required),
        questions: Array.isArray(product.questions) ? product.questions : [],
        variants,
        status: 'inactive',
        is_preorder: Boolean(product.is_preorder),
        preorder_end_date: normalizeDateValue(product.preorder_end_date),
        estimated_delivery_date: normalizeDateValue(product.estimated_delivery_date)
      };

      const createResponse = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });
      const data = await createResponse.json();
      if (data.error) {
        alert(data.error);
        return;
      }
      alert('Товар успешно скопирован. Новый товар создан в статусе inactive.');
      loadProducts();
    } catch (error) {
      console.error('Error duplicating product:', error);
      alert('Не удалось скопировать товар');
    }
  }

  window.loadProducts = loadProducts;
  window.showAddProductForm = showAddProductForm;
  window.renderProductForm = renderProductForm;
  window.addProductImageRow = addProductImageRow;
  window.removeProductImageRow = removeProductImageRow;
  window.addVariantRow = addVariantRow;
  window.removeVariantRow = removeVariantRow;
  window.createProduct = createProduct;
  window.editProduct = editProduct;
  window.updateProduct = updateProduct;
  window.deleteProduct = deleteProduct;
  window.duplicateProduct = duplicateProduct;
  window.updateProductImagePreview = updateProductImagePreview;
  window.triggerProductMultiUpload = triggerProductMultiUpload;
  window.handleProductMultiUpload = handleProductMultiUpload;
  window.addQuestionRow = addQuestionRow;
  window.removeQuestionRow = removeQuestionRow;
})();
