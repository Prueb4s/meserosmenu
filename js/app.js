/**
 * @license
 * Copyright © 2025 Tecnología y Soluciones Informáticas. Todos los derechos reservados.
 *
 * MESEROS PWA
 *
 * Este software es propiedad confidencial y exclusiva de TECSIN.
 *
 * Para más información, contactar a: sidsoporte@proton.me
 */

const { createClient } = supabase;

let SB_URL = null;
let SB_ANON_KEY = null;
let supabaseClient = null;

// --- Estado ---
let cart = [];
let products = [];
let currentImageIndex = 0;
let currentProduct = null;
let deferredPrompt = null;
const PRODUCTS_PER_PAGE = 25;
let orderDetails = {};

// --- DOM refs (pueden ser null si no existen en el HTML) ---
const featuredContainer = document.getElementById('featured-grid');
const offersGrid = document.getElementById('offers-grid');
const allFilteredContainer = document.getElementById('all-filtered-products');
const featuredSection = document.getElementById('featured-section');
const offersSection = document.getElementById('offers-section');
const filteredSection = document.getElementById('filtered-section');
const noProductsMessage = document.getElementById('no-products-message');
const searchInput = document.getElementById('search-input');
const searchResultsTitle = document.getElementById('search-results-title');
const categoryCarousel = document.getElementById('category-carousel');
const productModal = document.getElementById('productModal');
const modalProductName = document.getElementById('modal-product-name');
const modalProductDescription = document.getElementById('modal-product-description');
const modalProductPrice = document.getElementById('modal-product-price');
const modalAddToCartBtn = document.getElementById('modal-add-to-cart-btn');
const qtyInput = document.getElementById('qty-input');
const carouselImagesContainer = document.getElementById('carousel-images-container');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const cartBtn = document.getElementById('cart-btn');
const cartBadge = document.getElementById('cart-badge');
const cartModal = document.getElementById('cartModal');
const cartItemsContainer = document.getElementById('cart-items');
const cartTotalElement = document.getElementById('cart-total');
const checkoutBtn = document.getElementById('checkout-btn');
const checkoutModal = document.getElementById('checkoutModal');
const customerNameInput = document.getElementById('customer-name');
const tableNumberInput = document.getElementById('table-number');
const finalizeBtn = document.getElementById('finalize-btn');
const installBanner = document.getElementById('install-banner');
const installCloseBtn = document.getElementById('install-close-btn');
const installPromptBtn = document.getElementById('install-prompt-btn');
const orderSuccessModal = document.getElementById('orderSuccessModal');
const orderSuccessTotal = document.getElementById('order-success-total');
const closeSuccesSUPAtn = document.getElementById('close-success-btn');
const orderObservationInput = document.getElementById('order-observation');

// --- Utilidades ---
const money = (v) => {
  const value = Math.floor(Number(v) || 0);
  return value.toLocaleString('es-CO');
};

const escapeHtml = (str) => {
  if (!str && str !== 0) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
};

const shuffleArray = (arr) => {
  if (!Array.isArray(arr)) return [];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

// --- Render product card ---
// If product.sizes (jsonb) exists and is array, show a select inside the card.
// The option value is the index into product.sizes. When adding to cart we store
// size as a STRING (the name) in order_items.
function generateProductCard(p) {
  const id = p.id;
  const name = escapeHtml(p.name || '');
  const desc = escapeHtml(p.description || '');
  const img = (p.image && p.image[0]) ? p.image[0] : 'img/favicon.png';

  const availableSizes = Array.isArray(p.sizes) ? p.sizes : [];
  const totalStock = availableSizes.length > 0
    ? availableSizes.reduce((acc, s) => acc + Number(s.stock || 0), 0)
    : (Number(p.stock) || 0);

  const outOfStock = totalStock <= 0;
  const stockOverlay = outOfStock ? `<div class="out-of-stock-overlay">Agotado</div>` : '';

  // size selector HTML (if sizes exist)
  let sizeHtml = '';
  if (availableSizes.length > 0) {
    const opts = availableSizes.map((s, idx) => {
      const label = escapeHtml(s.name || s.label || `T${idx+1}`);
      const price = typeof s.price === 'number' ? s.price : (p.price || 0);
      const stockInfo = (typeof s.stock !== 'undefined') ? ` (${s.stock})` : '';
      return `<option value="${idx}">${label} — $${money(price)}${stockInfo}</option>`;
    }).join('');
    sizeHtml = `
      <div class="size-select-wrapper">
        <select class="card-size-select" aria-label="Seleccionar tamaño" data-product-id="${id}">
          <option value="">Seleccionar tamaño</option>
          ${opts}
        </select>
      </div>
    `;
  }

  return `
    <div class="product-card${outOfStock ? ' out-of-stock' : ''}" data-product-id="${id}">
      ${stockOverlay}
      <div class="image-wrap">
        <img src="${img}" alt="${name}" class="product-image" data-id="${id}" loading="lazy" />
      </div>
      <div class="product-info">
        <div>
          <div class="product-name">${name}</div>
          <div class="product-description">${desc}</div>
          ${sizeHtml}
        </div>
        <div class="card-bottom">
          <div class="product-price">$${money(p.price)}</div>
          <button class="card-add-to-cart" data-id="${id}" ${outOfStock ? 'disabled' : ''}>Añadir</button>
        </div>
      </div>
    </div>
  `;
}

// --- Products rendering with pagination ---
function renderProducts(container, data, page = 1, perPage = 20, withPagination = false) {
  if (!container) return;
  container.innerHTML = '';
  const paginationContainer = document.getElementById('pagination-container');

  if (!Array.isArray(data) || data.length === 0) {
    if (noProductsMessage) noProductsMessage.style.display = 'block';
    if (paginationContainer) paginationContainer.innerHTML = '';
    return;
  }
  if (noProductsMessage) noProductsMessage.style.display = 'none';

  const totalPages = Math.ceil(data.length / perPage);
  const start = (page - 1) * perPage;
  const end = start + perPage;
  const current = data.slice(start, end);
  current.forEach(p => {
    container.insertAdjacentHTML('beforeend', generateProductCard(p));
  });

  if (withPagination && totalPages > 1) {
    renderPagination(page, totalPages, data, perPage);
  } else if (paginationContainer) {
    paginationContainer.innerHTML = '';
  }
}

function renderPagination(currentPage, totalPages, data, perPage) {
  const paginationContainer = document.getElementById('pagination-container');
  if (!paginationContainer) return;
  paginationContainer.innerHTML = '';
  const createBtn = (label, page, active = false) => {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.className = 'pagination-btn';
    if (active) btn.classList.add('active');
    btn.addEventListener('click', () => {
      renderProducts(allFilteredContainer, data, page, perPage, true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    return btn;
  };

  if (currentPage > 1) paginationContainer.appendChild(createBtn('Primera', 1));
  if (currentPage > 3) paginationContainer.appendChild(document.createTextNode('...'));
  const start = Math.max(1, currentPage - 2);
  const end = Math.min(totalPages, currentPage + 2);
  for (let i = start; i <= end; i++) {
    paginationContainer.appendChild(createBtn(i, i, i === currentPage));
  }
  if (currentPage < totalPages - 2) paginationContainer.appendChild(document.createTextNode('...'));
  if (currentPage < totalPages) paginationContainer.appendChild(createBtn('Última', totalPages));
}

// --- Category carousel generation ---
function generateCategoryCarousel() {
  if (!categoryCarousel) return;
  categoryCarousel.innerHTML = '';
  const categories = Array.from(new Set((products || []).map(p => p.category))).filter(Boolean);
  const allItem = document.createElement('div');
  allItem.className = 'category-item';
  const allIconPath = 'img/icons/all.webp';
  allItem.innerHTML = `<img class="category-image" src="${allIconPath}" alt="Todo" data-category="__all"><span class="category-name">Todo</span>`;
  categoryCarousel.appendChild(allItem);

  categories.forEach(c => {
    const el = document.createElement('div');
    el.className = 'category-item';
    const fileName = `img/icons/${String(c).toLowerCase().replace(/\s+/g, '_')}.webp`;
    el.innerHTML = `<img class="category-image" src="${fileName}" alt="${escapeHtml(c)}" data-category="${escapeHtml(c)}"><span class="category-name">${escapeHtml(c)}</span>`;
    categoryCarousel.appendChild(el);
  });
}

// --- Interaction handlers ---
// Delegated click handler for card add button and modal add button
document.addEventListener('click', (e) => {
  // Add from card
  const cardBtn = e.target.closest && e.target.closest('.card-add-to-cart');
  if (cardBtn) {
    const id = cardBtn.dataset.id;
    const cardEl = cardBtn.closest && cardBtn.closest('.product-card');
    let chosenSizeIndex = null;

    if (cardEl) {
      const select = cardEl.querySelector('.card-size-select');
      if (select) {
        if (!select.value) {
          alert('Selecciona un tamaño antes de añadir al carrito.');
          return;
        }
        chosenSizeIndex = Number(select.value);
      }
    }

    addToCart(id, 1, chosenSizeIndex);
    return;
  }

  // Add from modal (if used)
  if (e.target && e.target.id === 'modal-add-to-cart-btn') {
    const qty = Math.max(1, parseInt(qtyInput?.value || '1', 10) || 1);
    if (currentProduct && currentProduct.id) {
      addToCart(currentProduct.id, qty, null);
    }
    closeModal(productModal);
    return;
  }

  // Close modal buttons
  if (e.target && e.target.classList && e.target.classList.contains('modal-close')) {
    const modal = e.target.closest('.modal');
    if (modal) closeModal(modal);
  }
});

// Update price in card when select changes
document.addEventListener('change', (e) => {
  const sel = e.target;
  if (!sel || !sel.classList) return;
  if (!sel.classList.contains('card-size-select')) return;
  const card = sel.closest('.product-card');
  if (!card) return;
  const productId = sel.dataset.productId;
  const p = products.find(x => x.id === productId);
  if (!p) return;
  const availableSizes = Array.isArray(p.sizes) ? p.sizes : [];
  const idx = sel.value !== '' ? Number(sel.value) : null;
  const priceEl = card.querySelector('.product-price');
  if (idx !== null && typeof availableSizes[idx] !== 'undefined') {
    const price = Number(availableSizes[idx].price || p.price || 0);
    if (priceEl) priceEl.textContent = `$${money(price)}`;
  } else {
    if (priceEl) priceEl.textContent = `$${money(p.price || 0)}`;
  }
});

// --- Modal helpers ---
function showModal(modal) {
  if (!modal) return;
  modal.style.display = 'flex';
  modal.setAttribute('aria-hidden', 'false');
}

function closeModal(modal) {
  if (!modal) return;
  modal.style.display = 'none';
  modal.setAttribute('aria-hidden', 'true');
}

// --- Carousel helpers ---
function updateCarousel(images) {
  if (!carouselImagesContainer) return;
  carouselImagesContainer.innerHTML = '';
  if (!Array.isArray(images) || images.length === 0) {
    carouselImagesContainer.innerHTML = `<div class="carousel-image" style="display:flex;align-items:center;justify-content:center;background:#f3f3f3">Sin imagen</div>`;
    return;
  }
  images.forEach(src => {
    const img = document.createElement('img');
    img.src = src;
    img.className = 'carousel-image';
    carouselImagesContainer.appendChild(img);
  });
  currentImageIndex = 0;
  updateCarouselPosition();
}

function updateCarouselPosition() {
  if (!carouselImagesContainer) return;
  const imgs = carouselImagesContainer.querySelectorAll('.carousel-image');
  if (!imgs || imgs.length === 0) return;
  const imgWidth = imgs[0].clientWidth || carouselImagesContainer.clientWidth || 0;
  carouselImagesContainer.style.transform = `translateX(-${currentImageIndex * imgWidth}px)`;
}

// prev/next
prevBtn && prevBtn.addEventListener('click', () => {
  if (currentImageIndex > 0) currentImageIndex--;
  updateCarouselPosition();
});
nextBtn && nextBtn.addEventListener('click', () => {
  const imgs = carouselImagesContainer?.querySelectorAll('.carousel-image') || [];
  if (currentImageIndex < imgs.length - 1) currentImageIndex++;
  updateCarouselPosition();
});
window.addEventListener('resize', updateCarouselPosition);

// --- Cart rendering & logic ---
function updateCart() {
  if (!cartItemsContainer) return;
  cartItemsContainer.innerHTML = '';

  if (!cart || cart.length === 0) {
    cartItemsContainer.innerHTML = '<p class="empty-cart-msg">Tu carrito está vacío.</p>';
    if (cartBadge) cartBadge.style.display = 'none';
    if (cartBadge) cartBadge.textContent = '0';
    if (cartTotalElement) cartTotalElement.textContent = money(0);
    return;
  }

  let total = 0;
  let totalItems = 0;

  cart.forEach((item, idx) => {
    total += (Number(item.price || 0) * Number(item.qty || 0));
    totalItems += Number(item.qty || 0);

    const itemEl = document.createElement('div');
    itemEl.className = 'cart-item';

    const image = escapeHtml(item.image || 'img/favicon.png');
    const name = escapeHtml(item.name || '');
    const sizeHtml = item.size ? `<div style="font-size:.9rem;color:#666">${escapeHtml(item.size)}</div>` : '';
    const line = `
      <div style="display:flex;align-items:center;gap:8px;">
        <img src="${image}" alt="${name}" style="width:40px;height:40px;object-fit:cover;border-radius:6px;">
        <div>
          <div style="font-weight:700">${name}</div>
          ${sizeHtml}
          <div style="font-size:.9rem;color:#333">$${money(Number(item.price || 0))} x ${item.qty}</div>
        </div>
      </div>
      <div class="controls">
        <button class="qty-btn" data-idx="${idx}" data-op="dec">-</button>
        <span style="min-width:28px;text-align:center;display:inline-block">${item.qty}</span>
        <button class="qty-btn" data-idx="${idx}" data-op="inc">+</button>
      </div>
    `;
    itemEl.innerHTML = line;
    cartItemsContainer.appendChild(itemEl);
  });

  if (cartBadge) cartBadge.style.display = 'flex';
  if (cartBadge) cartBadge.textContent = String(totalItems);
  if (cartTotalElement) cartTotalElement.textContent = money(total);
}

// addToCart: sizeIndex optional; if product has sizes, sizeIndex is required and we store size as a STRING (name)
function addToCart(id, qty = 1, sizeIndex = null) {
  const p = products.find(x => x.id === id);
  if (!p) return;

  const availableSizes = Array.isArray(p.sizes) ? p.sizes : [];

  if (availableSizes.length > 0) {
    // require valid sizeIndex
    if (sizeIndex === null || typeof availableSizes[sizeIndex] === 'undefined') {
      alert('Selecciona un tamaño válido antes de agregar al carrito.');
      return;
    }
    const sizeObj = availableSizes[sizeIndex];
    const availableStock = Number(sizeObj.stock || 0);
    const sizeName = sizeObj.name || sizeObj.label || '';

    const existingInCart = cart.find(i => i.id === id && ((i.size || null) === sizeName));
    const currentQtyInCart = existingInCart ? existingInCart.qty : 0;

    if (currentQtyInCart + qty > availableStock) {
      alert(`En el momento solo quedan ${availableStock} unidades del tamaño ${sizeName}.`);
      return;
    }

    if (existingInCart) {
      existingInCart.qty += qty;
    } else {
      cart.push({
        id: p.id,
        name: p.name,
        price: Number(sizeObj.price || p.price || 0),
        qty,
        image: (p.image && p.image[0]) ? p.image[0] : 'img/favicon.png',
        // store only the name as string
        size: sizeName
      });
    }
  } else {
    // product without sizes
    const availableStock = Number(p.stock || 0);
    const existingInCart = cart.find(i => i.id === id && !i.size);
    const currentQtyInCart = existingInCart ? existingInCart.qty : 0;
    if (currentQtyInCart + qty > availableStock) {
      alert(`En el momento solo quedan ${availableStock} unidades.`);
      return;
    }
    if (existingInCart) {
      existingInCart.qty += qty;
    } else {
      cart.push({
        id: p.id,
        name: p.name,
        price: Number(p.price || 0),
        qty,
        image: (p.image && p.image[0]) ? p.image[0] : 'img/favicon.png',
        size: null
      });
    }
  }

  updateCart();
  showAddToCartToast({ image: (p.image && p.image[0]) ? p.image[0] : 'img/favicon.png', name: p.name, qty });
}

// toast
function showAddToCartToast({ image, name, qty = 1 }) {
  const existing = document.getElementById('add-to-cart-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'add-to-cart-toast';
  toast.className = 'add-to-cart-toast';

  toast.innerHTML = `
    <img src="${escapeHtml(image)}" alt="${escapeHtml(name)}" class="toast-img" loading="lazy" />
    <div class="toast-text">
      <div class="toast-title">${escapeHtml(name)}</div>
      <div class="toast-sub">Añadido x${qty}</div>
    </div>
  `;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    toast.classList.add('hide');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
  }, 1800);
}

// cart item increment/decrement
cartItemsContainer && cartItemsContainer.addEventListener('click', (e) => {
  const btn = e.target.closest && e.target.closest('button[data-idx]');
  if (!btn) return;
  const idx = Number(btn.dataset.idx);
  const op = btn.dataset.op;
  if (!Number.isFinite(idx) || idx < 0 || idx >= cart.length) return;

  const productInCart = cart[idx];
  const originalProduct = products.find(p => p.id === productInCart.id);
  if (!productInCart || !originalProduct) return;

  if (op === 'inc') {
    if (productInCart.size) {
      const sizeName = productInCart.size;
      const sizeObj = (originalProduct.sizes || []).find(s => String((s.name || s.label || '')).toLowerCase() === String(sizeName).toLowerCase());
      const stockAvailable = sizeObj ? Number(sizeObj.stock || 0) : 0;
      if ((productInCart.qty + 1) > stockAvailable) {
        alert(`En el momento solo quedan ${stockAvailable} unidades de ese tamaño ${productInCart.size}.`);
        return;
      }
    } else {
      if ((productInCart.qty + 1) > (originalProduct.stock || 0)) {
        alert(`En el momento solo quedan ${originalProduct.stock} unidades.`);
        return;
      }
    }
    productInCart.qty++;
  } else if (op === 'dec') {
    productInCart.qty--;
    if (productInCart.qty <= 0) cart.splice(idx, 1);
  }

  updateCart();
});

// cart button
cartBtn && cartBtn.addEventListener('click', () => {
  showModal(cartModal);
  updateCart();
});

// checkout flow
checkoutBtn && checkoutBtn.addEventListener('click', () => {
  if (!cart || cart.length === 0) {
    alert('El carrito está vacío');
    return;
  }
  showModal(checkoutModal);
});

finalizeBtn && finalizeBtn.addEventListener('click', async () => {
  const name = customerNameInput ? customerNameInput.value.trim() : '';
  const table = tableNumberInput ? tableNumberInput.value.trim() : '';

  if (!name || !table) {
    alert('Por favor completa nombre y número de mesa');
    return;
  }
  if (!supabaseClient) {
    alert('El cliente no está inicializado. Inténtalo de nuevo.');
    return;
  }

  const total = cart.reduce((acc, item) => acc + Number(item.price || 0) * Number(item.qty || 0), 0);

  // items: include size as STRING or null
  const items = cart.map(i => ({
    id: i.id,
    name: i.name,
    qty: i.qty,
    price: i.price,
    size: i.size ? i.size : null
  }));

  const observation = orderObservationInput ? orderObservationInput.value.trim() : '';

  const orderData = {
    customer_name: name,
    customer_address: table,
    total_amount: total,
    order_items: items,
    order_status: 'Pendiente',
    observation: observation
  };

  try {
    const { data: inserted, error: orderError } = await supabaseClient
      .from('orders')
      .insert([orderData])
      .select();

    if (orderError) {
      console.error('Error al guardar la orden en DB:', orderError);
      alert('Error al guardar la orden en DB: ' + orderError.message);
      return;
    }

    orderDetails = { name, table, items, total, observation };

    // refresh products
    products = await fetchProductsFromSupabase();
    showDefaultSections();
    cart = [];
    updateCart();

    if (orderObservationInput) orderObservationInput.value = '';

    if (orderDetails.total && orderSuccessTotal) orderSuccessTotal.textContent = money(orderDetails.total);
    showModal(orderSuccessModal);
    closeModal(checkoutModal);
    closeModal(cartModal);
  } catch (err) {
    console.error('Fallo al guardar la orden:', err);
    alert('Error al procesar el pedido: ' + (err.message || err));
  }
});

// install prompt
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  installBanner && installBanner.classList.add('visible');
});

installPromptBtn && installPromptBtn.addEventListener('click', async () => {
  if (!deferredPrompt) return;
  installBanner && installBanner.classList.remove('visible');
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
});
installCloseBtn && installCloseBtn.addEventListener('click', () => installBanner && installBanner.classList.remove('visible'));

// --- DB helpers ---
const fetchProductsFromSupabase = async () => {
  if (!supabaseClient) return [];
  try {
    const { data, error } = await supabaseClient.from('products').select('*');
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Error al cargar los productos:', err);
    alert('Hubo un error al cargar los productos. Revisa la consola para más detalles.');
    return [];
  }
};

const loadConfigAndInitSupabase = async () => {
  try {
    const response = await fetch('api/get-config');
    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`Fallo al cargar la configuración: ${response.status} ${response.statusText} ${errorText}`);
    }
    const config = await response.json();
    if (!config.url || !config.anonKey) {
      throw new Error('El API Route no retornó las claves de DB. Revisa las Variables de Entorno en Vercel.');
    }
    SB_URL = config.url;
    SB_ANON_KEY = config.anonKey;
    supabaseClient = createClient(SB_URL, SB_ANON_KEY);

    products = await fetchProductsFromSupabase();
    if (products.length > 0) {
      showDefaultSections();
      generateCategoryCarousel();
      enableTouchHints();
      setTimeout(() => showImageHints(document), 500);
    }
    updateCart();
  } catch (error) {
    console.error('Error FATAL al iniciar la aplicación:', error);
    const loadingMessage = document.createElement('div');
    loadingMessage.style = 'position:fixed;top:0;left:0;width:100%;height:100%;background:white;display:flex;align-items:center;justify-content:center;color:red;font-weight:bold;text-align:center;padding:20px;z-index:9999';
    loadingMessage.textContent = 'ERROR DE INICIALIZACIÓN: No se pudo cargar la configuración de la tienda. Revisa la consola para más detalles.';
    document.body.appendChild(loadingMessage);
  }
};

function showDefaultSections() {
  if (featuredSection) featuredSection.style.display = 'block';
  if (offersSection) offersSection.style.display = 'none';
  if (filteredSection) filteredSection.style.display = 'none';
  const featured = shuffleArray(products.filter(p => p.featured)).slice(0, 25);
  renderProducts(featuredContainer, featured, 1, 25, false);
}

document.addEventListener('DOMContentLoaded', loadConfigAndInitSupabase);