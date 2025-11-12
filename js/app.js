/**
 * @license
 * Copyright © 2025 Tecnología y Soluciones Informáticas. Todos los derechos reservados.
 *
 * NICOWINGS PWA
 *
 * Este software es propiedad confidencial y exclusiva de TECSIN.
 * El permiso de uso de este software es temporal para pruebas en NICOWINGS.
 *
 * Queda estrictamente prohibida la copia, modificación, distribución,
 * ingeniería inversa o cualquier otro uso no autorizado de este código
 * sin el consentimiento explícito por escrito del autor.
 *
 * Para más información, contactar a: sidsoporte@proton.me
 */

const { createClient } = supabase;

let SB_URL = null;
let SB_ANON_KEY = null;
let supabaseClient = null;

// --- Variables de estado ---
let cart = [];
let products = [];
let currentImageIndex = 0;
let currentProduct = null;
let deferredPrompt = null;
const PRODUCTS_PER_PAGE = 25;
let orderDetails = {};

// --- Referencias del DOM ---
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

// --- Funciones de Ayuda ---
const money = (v) => {
    const value = Math.floor(v || 0);
    return value.toLocaleString('es-CO');
};

const shuffleArray = (array) => {
    if (!Array.isArray(array)) return [];
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
};

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

// --- Funciones para renderizar productos ---
// Ahora la tarjeta permite seleccionar una talla (si existe) y la pasa a addToCart como el índice del array sizes.
const generateProductCard = (p) => {
    let bestSellerTag = '';
    if (p.bestSeller) {
        bestSellerTag = `<div class="best-seller-tag">Lo más vendido</div>`;
    }

    let stockOverlay = '';
    let stockClass = '';

    // determinar stock total: si tiene sizes sumar stock por talla, si no usar p.stock
    const availableSizes = Array.isArray(p.sizes) ? p.sizes : [];
    const totalStock = availableSizes.length > 0 ? availableSizes.reduce((acc, s) => acc + Number(s.stock || 0), 0) : (p.stock || 0);

    if (totalStock <= 0) {
        stockOverlay = `<div class="out-of-stock-overlay">Agotado</div>`;
        stockClass = ' out-of-stock';
    }

    // construir HTML del selector de tamaños (si aplica)
    let sizeSelectorHtml = '';
    if (availableSizes.length > 0) {
        // opciones con índice como value
        const options = availableSizes.map((s, idx) => {
            const label = s.name || s.label || (`T${idx+1}`);
            const price = typeof s.price === 'number' ? s.price : (p.price || 0);
            const stockInfo = (typeof s.stock !== 'undefined') ? ` (${s.stock})` : '';
            return `<option value="${idx}">${escapeHtml(label)} — $${money(price)}${stockInfo}</option>`;
        }).join('');
        sizeSelectorHtml = `
          <div class="size-select-wrapper">
            <select class="card-size-select" aria-label="Seleccionar tamaño" data-product-id="${p.id}">
              <option value="">Seleccionar tamaño</option>
              ${options}
            </select>
          </div>
        `;
    }

    return `
      <div class="product-card${stockClass}" data-product-id="${p.id}">
        ${bestSellerTag}
        <div class="image-wrap">
          <img src="${p.image && p.image[0] ? p.image[0] : 'img/favicon.png'}" alt="${escapeHtml(p.name)}" class="product-image" data-id="${p.id}" loading="lazy" />
        </div>
        ${stockOverlay}
        <div class="product-info">
          <div>
            <div class="product-name">${escapeHtml(p.name)}</div>
            <div class="product-description">${escapeHtml(p.description || '')}</div>
            ${sizeSelectorHtml}
          </div>
          <div class="card-bottom">
            <div class="product-price">$${money(p.price)}</div>
            <button class="card-add-to-cart" data-id="${p.id}" ${totalStock <= 0 ? 'disabled' : ''}>Añadir</button>
          </div>
        </div>
      </div>
    `;
};

// --- Renderizado con paginación ---
function renderProducts(container, data, page = 1, perPage = 20, withPagination = false) {
    if (!container) return;
    container.innerHTML = '';
    const paginationContainer = document.getElementById('pagination-container');
    if (!data || data.length === 0) {
        if (noProductsMessage) noProductsMessage.style.display = 'block';
        if (paginationContainer) paginationContainer.innerHTML = '';
        return;
    }
    if (noProductsMessage) noProductsMessage.style.display = 'none';
    const totalPages = Math.ceil(data.length / perPage);
    const start = (page - 1) * perPage;
    const end = start + perPage;
    const currentProducts = data.slice(start, end);
    currentProducts.forEach(p => container.innerHTML += generateProductCard(p));
    if (withPagination && totalPages > 1) {
        renderPagination(page, totalPages, data, perPage);
    } else {
        if (paginationContainer) paginationContainer.innerHTML = '';
    }
}

function showImageHints(container) {
    try {
        const hints = container.querySelectorAll('.image-hint');
        const max = Math.min(6, hints.length);
        for (let i = 0; i < max; i++) {
            const h = hints[i];
            h.classList.add('show-hint');
            h.style.transitionDelay = `${i * 120}ms`;
        }
        setTimeout(() => {
            for (let i = 0; i < max; i++) {
                const h = hints[i];
                if (h) {
                    h.classList.remove('show-hint');
                    h.style.transitionDelay = '';
                }
            }
        }, 2200);
    } catch (err) {
        console.warn('showImageHints err', err);
    }
}

function enableTouchHints() {
  let lastTouchedCard = null;
  let lastTouchMoved = false;

  function onTouchStart(e) {
    lastTouchMoved = false;
    const card = e.target.closest('.product-card');
    if (!card) return;
    if (e.target.closest('button, a, input, textarea, select')) return;
    const hint = card.querySelector('.image-hint');
    if (!hint) return;
    hint.classList.add('show-hint');
    if (card._hintTimeout) {
      clearTimeout(card._hintTimeout);
      card._hintTimeout = null;
    }
    card._hintTimeout = setTimeout(() => {
      hint.classList.remove('show-hint');
      card._hintTimeout = null;
    }, 2200);
    lastTouchedCard = card;
  }

  function onTouchMove() {
    lastTouchMoved = true;
    if (lastTouchedCard) {
      const h = lastTouchedCard.querySelector('.image-hint');
      if (h) h.classList.remove('show-hint');
      if (lastTouchedCard._hintTimeout) {
        clearTimeout(lastTouchedCard._hintTimeout);
        lastTouchedCard._hintTimeout = null;
      }
      lastTouchedCard = null;
    }
  }

  function onTouchEnd() {
    if (!lastTouchedCard) return;
    const h = lastTouchedCard.querySelector('.image-hint');
    if (h && !lastTouchMoved) {
      setTimeout(() => {
        h.classList.remove('show-hint');
      }, 700);
    } else {
      if (h) h.classList.remove('show-hint');
    }
    if (lastTouchedCard && lastTouchedCard._hintTimeout) {
      clearTimeout(lastTouchedCard._hintTimeout);
      lastTouchedCard._hintTimeout = null;
    }
    lastTouchedCard = null;
  }

  document.addEventListener('touchstart', onTouchStart, { passive: true });
  document.addEventListener('touchmove', onTouchMove, { passive: true });
  document.addEventListener('touchend', onTouchEnd, { passive: true });
}

function renderPagination(currentPage, totalPages, data, perPage) {
    const paginationContainer = document.getElementById('pagination-container');
    if (!paginationContainer) return;
    paginationContainer.innerHTML = '';

    function createBtn(label, page, active = false) {
        const btn = document.createElement('button');
        btn.textContent = label;
        btn.className = 'pagination-btn';
        if (active) btn.classList.add('active');
        btn.addEventListener('click', () => {
            renderProducts(allFilteredContainer, data, page, perPage, true);
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
        return btn;
    }
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

const generateCategoryCarousel = () => {
    if (!categoryCarousel) return;
    categoryCarousel.innerHTML = '';
    const categories = Array.from(new Set(products.map(p => p.category))).map(c => ({ label: c }));
    const allItem = document.createElement('div');
    allItem.className = 'category-item';
    const allIconPath = 'img/icons/all.webp';
    allItem.innerHTML = `<img class="category-image" src="${allIconPath}" alt="Todo" data-category="__all"><span class="category-name">Todo</span>`;
    categoryCarousel.appendChild(allItem);
    categories.forEach(c => {
        const el = document.createElement('div');
        el.className = 'category-item';
        const fileName = `img/icons/${c.label.toLowerCase().replace(/\s+/g, '_')}.webp`;
        el.innerHTML = `<img class="category-image" src="${fileName}" alt="${c.label}" data-category="${c.label}"><span class="category-name">${c.label}</span>`;
        categoryCarousel.appendChild(el);
    });
};

searchInput && searchInput.addEventListener('input', (e) => {
    const q = e.target.value.trim().toLowerCase();
    if (!q) {
        showDefaultSections();
        return;
    }
    const filtered = products.filter(p => (p.name || '').toLowerCase().includes(q) || (p.description||'').toLowerCase().includes(q) || (p.category||'').toLowerCase().includes(q));
    if (filteredSection) filteredSection.style.display = 'block';
    if (featuredSection) featuredSection.style.display = 'none';
    if (offersSection) offersSection.style.display = 'none';
    if (searchResultsTitle) searchResultsTitle.textContent = `Resultados para "${q}"`;
    renderProducts(allFilteredContainer, filtered, 1, 20, true);
});

const showDefaultSections = () => {
    if (featuredSection) featuredSection.style.display = 'block';
    if (offersSection) offersSection.style.display = 'none';
    if (filteredSection) filteredSection.style.display = 'none';
    const featured = shuffleArray(products.filter(p => p.featured)).slice(0, 25);
    renderProducts(featuredContainer, featured, 1, 25, false);
};

categoryCarousel && categoryCarousel.addEventListener('click', (ev) => {
    const img = ev.target.closest('.category-image');
    if (!img) return;
    const cat = img.dataset.category;
    if (searchInput) searchInput.value = '';
    if (cat === '__all') {
        showDefaultSections();
        return;
    }
    const filtered = products.filter(p => (p.category || '').toLowerCase() === cat.toLowerCase());
    if (filteredSection) filteredSection.style.display = 'block';
    if (featuredSection) featuredSection.style.display = 'none';
    if (offersSection) offersSection.style.display = 'none';
    if (searchResultsTitle) searchResultsTitle.textContent = cat;
    renderProducts(allFilteredContainer, filtered, 1, 20, true);
});

(function makeCarouselDraggable() {
    let isDown = false,
        startX, scrollLeft;
    if (!categoryCarousel) return;
    categoryCarousel.addEventListener('mousedown', (e) => {
        isDown = true;
        startX = e.pageX - categoryCarousel.offsetLeft;
        scrollLeft = categoryCarousel.scrollLeft;
    });
    window.addEventListener('mouseup', () => {
        isDown = false;
    });
    categoryCarousel.addEventListener('mousemove', (e) => {
        if (!isDown) return;
        e.preventDefault();
        const x = e.pageX - categoryCarousel.offsetLeft;
        const walk = (x - startX) * 1.5;
        categoryCarousel.scrollLeft = scrollLeft - walk;
    });
    categoryCarousel.addEventListener('touchstart', (e) => {
        startX = e.touches[0].pageX - categoryCarousel.offsetLeft;
        scrollLeft = categoryCarousel.scrollLeft;
    });
    categoryCarousel.addEventListener('touchmove', (e) => {
        const x = e.touches[0].pageX - categoryCarousel.offsetLeft;
        const walk = (x - startX) * 1.2;
        categoryCarousel.scrollLeft = scrollLeft - walk;
    });
})();

// Delegación de eventos principal: captura clicks en botones "Añadir" dentro de las tarjetas
document.addEventListener('click', (e) => {
    // Botón de añadir en la tarjeta
    const cardBtn = e.target.closest('.card-add-to-cart');
    if (cardBtn) {
        const id = cardBtn.dataset.id;
        const cardEl = cardBtn.closest('.product-card');
        // Intentar leer selector de tamaño dentro de la tarjeta (si existe)
        const select = cardEl ? cardEl.querySelector('.card-size-select') : null;
        let chosenSizeIndex = null;
        if (select) {
            // Si existe selector y no se eligió nada, pedimos selección
            if (!select.value) {
                alert('Selecciona un tamaño antes de añadir al carrito.');
                return;
            }
            chosenSizeIndex = Number(select.value);
        }
        // Añadimos 1 unidad por defecto, pasando el índice de tamaño si aplica
        addToCart(id, 1, chosenSizeIndex);
        return;
    }

    // Si el usuario usa el modal (no se abre por defecto según petición), permitir agregar desde modal también
    if (e.target.id === 'modal-add-to-cart-btn') {
        const qty = Math.max(1, parseInt(qtyInput.value) || 1);
        if (currentProduct && currentProduct.id) {
            // En modal no tenemos selector de talla por defecto en esta PWA, así que simplemente agregar producto sin talla
            addToCart(currentProduct.id, qty, null);
        }
        closeModal(productModal);
    }
});

// También gestionar cambio de select dentro de la tarjeta para actualizar el precio mostrado in-place
document.addEventListener('change', (e) => {
    const sel = e.target.closest && e.target.closest('.card-size-select');
    if (!sel) return;
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

[productModal, cartModal, checkoutModal, orderSuccessModal].forEach(modal => {
    if (!modal) return;
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal(modal);
        }
        if (e.target.classList.contains('modal-close')) {
            closeModal(modal);
        }
    });
});

if (closeSuccesSUPAtn) {
    closeSuccesSUPAtn.addEventListener('click', () => {
        closeModal(orderSuccessModal);
    });
}

function openProductModal(id) {
    // Aunque la función sigue disponible, no se llama al hacer clic en la tarjeta por diseño de la PWA de meseros.
    const product = products.find(p => p.id === id);
    if (!product) return;
    currentProduct = product;
    modalProductName.textContent = product.name;
    modalProductDescription.textContent = product.description;
    modalProductPrice.textContent = `$${money(product.price)}`;
    qtyInput.value = 1;
    modalAddToCartBtn.dataset.id = product.id;
    updateCarousel(product.image || []);
    showModal(productModal);
}

// --- Anuncios ---
document.querySelectorAll('.ad-image').forEach(img => {
    img.addEventListener('click', () => {
        const id = img.dataset.productId;
        openProductModal(id);
    });
});

function updateCarousel(images) {
    if (!carouselImagesContainer) return;
    carouselImagesContainer.innerHTML = '';
    if (!images || images.length === 0) {
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
    carouselImagesContainer.style.transform = `translateX(0)`;
}

if (prevBtn) {
    prevBtn.addEventListener('click', () => {
        if (currentImageIndex > 0) currentImageIndex--;
        updateCarouselPosition();
    });
}
if (nextBtn) {
    nextBtn.addEventListener('click', () => {
        const imgs = carouselImagesContainer.querySelectorAll('.carousel-image');
        if (currentImageIndex < imgs.length - 1) currentImageIndex++;
        updateCarouselPosition();
    });
}

function updateCarouselPosition() {
    const imgs = carouselImagesContainer.querySelectorAll('.carousel-image');
    if (imgs.length === 0) return;
    const imgWidth = imgs[0].clientWidth || carouselImagesContainer.clientWidth;
    carouselImagesContainer.style.transform = `translateX(-${currentImageIndex * imgWidth}px)`;
}
window.addEventListener('resize', updateCarouselPosition);

function updateCart() {
    if (!cartItemsContainer) return;
    cartItemsContainer.innerHTML = '';
    if (cart.length === 0) {
        cartItemsContainer.innerHTML = '<p class="empty-cart-msg">Tu carrito está vacío.</p>';
        if (cartBadge) cartBadge.style.display = 'none';
        if (cartBadge) cartBadge.textContent = '0';
        if (cartTotalElement) cartTotalElement.textContent = money(0);
        return;
    }
    let total = 0,
        totalItems = 0;
    cart.forEach((item, idx) => {
        total += (Number(item.price || 0) * Number(item.qty || 0));
        totalItems += item.qty;
        const div = document.createElement('div');
        div.className = 'cart-item';
        div.innerHTML = `<div style="display:flex;align-items:center;gap:8px;">
            <img src="${item.image}" alt="${escapeHtml(item.name)}" style="width:40px;height:40px;object-fit:cover;border-radius:6px;">
            <div>
              <div style="font-weight:700">${escapeHtml(item.name)}</div>
              ${item.size ? `<div style="font-size:.9rem;color:#666">${escapeHtml(item.size.name)}</div>` : ''}
              <div style="font-size:.9rem;color:#333">$${money(item.price)} x ${item.qty}</div>
            </div>
          </div>
          <div class="controls">
            <button class="qty-btn" data-idx="${idx}" data-op="dec">-</button>
            <span style="min-width:28px;text-align:center;display:inline-block">${item.qty}</span>
            <button class="qty-btn" data-idx="${idx}" data-op="inc">+</button>
          </div>`;
        cartItemsContainer.appendChild(div);
    });
    if (cartBadge) cartBadge.style.display = 'flex';
    if (cartBadge) cartBadge.textContent = String(totalItems);
    if (cartTotalElement) cartTotalElement.textContent = money(total);
}

/**
 * addToCart ahora acepta un third param sizeIndex (número) que referencia a p.sizes[index].
 * Si sizeIndex es null y el producto no tiene sizes, se añade normalmente.
 * Si el producto tiene sizes y sizeIndex es proporcionado, se usa ese tamaño (stock y precio por talla).
 */
function addToCart(id, qty = 1, sizeIndex = null) {
    const p = products.find(x => x.id === id);
    if (!p) return;

    const availableSizes = Array.isArray(p.sizes) ? p.sizes : [];

    if (availableSizes.length > 0) {
        // producto con tallas: sizeIndex es obligatorio (lo validamos en el botón)
        if (sizeIndex === null || typeof availableSizes[sizeIndex] === 'undefined') {
            alert('Selecciona un tamaño válido antes de agregar al carrito.');
            return;
        }
        const sizeObj = availableSizes[sizeIndex];
        const availableStock = Number(sizeObj.stock || 0);
        const existingInCart = cart.find(i => i.id === id && i.size && String(i.size.name).toLowerCase() === String(sizeObj.name).toLowerCase());
        const currentQtyInCart = existingInCart ? existingInCart.qty : 0;

        if (currentQtyInCart + qty > availableStock) {
            alert(`En el momento solo quedan ${availableStock} unidades del tamaño ${sizeObj.name}.`);
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
                image: p.image && p.image[0] ? p.image[0] : 'img/favicon.png',
                // guardamos el objeto size completo (o una versión reducida) para persistir en orders.order_items
                size: {
                    name: sizeObj.name || sizeObj.label || '',
                    price: Number(sizeObj.price || p.price || 0),
                    key: sizeObj.key || null,
                    raw: sizeObj // si necesitas todo el JSON
                }
            });
        }
    } else {
        // Sin tamaños: usar stock general (campo stock) y precio de producto
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
                image: p.image && p.image[0] ? p.image[0] : 'img/favicon.png',
                size: null
            });
        }
    }

    updateCart();

    showAddToCartToast({
        image: p.image && p.image[0] ? p.image[0] : 'img/favicon.png',
        name: p.name,
        qty
    });
}

/* Helper: crea y anima el toast (se añade al body y se elimina tras el tiempo especificado) */
function showAddToCartToast({ image, name, qty = 1 }) {
    const existing = document.getElementById('add-to-cart-toast');
    if (existing) {
        existing.remove();
    }

    const toast = document.createElement('div');
    toast.id = 'add-to-cart-toast';
    toast.className = 'add-to-cart-toast';

    const safeName = escapeHtml(name);

    toast.innerHTML = `
      <img src="${image}" alt="${safeName}" class="toast-img" loading="lazy" />
      <div class="toast-text">
        <div class="toast-title">${safeName}</div>
        <div class="toast-sub">Añadido x${qty}</div>
      </div>
    `;

    document.body.appendChild(toast);

    requestAnimationFrame(() => {
        toast.classList.add('show');
    });

    const VISIBLE_MS = 2000;
    setTimeout(() => {
        toast.classList.remove('show');
        toast.classList.add('hide');
        toast.addEventListener('transitionend', () => {
            toast.remove();
        }, { once: true });
    }, VISIBLE_MS);
}

cartItemsContainer && cartItemsContainer.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-idx]');
    if (!btn) return;
    const idx = parseInt(btn.dataset.idx, 10);
    const op = btn.dataset.op;

    const productInCart = cart[idx];
    const originalProduct = products.find(p => p.id === productInCart.id);

    if (!productInCart || !originalProduct) return;

    if (op === 'inc') {
        if (productInCart.size) {
            // verificar stock por talla en producto original
            const sizeName = productInCart.size.name;
            const sizeObj = Array.isArray(originalProduct.sizes) ? originalProduct.sizes.find(s => String(s.name).toLowerCase() === String(sizeName).toLowerCase()) : null;
            const stockAvailable = sizeObj ? Number(sizeObj.stock || 0) : 0;
            if ((productInCart.qty + 1) > stockAvailable) {
                alert(`En el momento solo quedan ${stockAvailable} unidades de ese tamaño ${productInCart.size.name}.`);
                return;
            }
        } else {
            if ((productInCart.qty + 1) > (originalProduct.stock || 0)) {
                alert(`En el momento solo quedan ${originalProduct.stock} unidades.`);
                return;
            }
        }
        productInCart.qty++;
    }
    if (op === 'dec') {
        productInCart.qty--;
        if (productInCart.qty <= 0) cart.splice(idx, 1);
    }
    updateCart();
});

cartBtn && cartBtn.addEventListener('click', () => {
    showModal(cartModal);
    updateCart();
});

checkoutBtn && checkoutBtn.addEventListener('click', () => {
    if (cart.length === 0) {
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
    // Incluir size en los items que la tengan, para guardar en orders.order_items
    // MODIFICACIÓN: guardar solo el nombre de la talla como string, no un objeto.
    const items = cart.map(i => ({
        id: i.id,
        name: i.name,
        qty: i.qty,
        price: i.price,
        size: i.size ? i.size.name : null
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
        // Guardar la orden en DB (tabla 'orders')
        const { data: inserted, error: orderError } = await supabaseClient
            .from('orders')
            .insert([orderData])
            .select();

        if (orderError) {
            console.error('Error al guardar la orden en DB:', orderError);
            alert('Error al guardar la orden en DB: ' + orderError.message);
            return;
        }

        // Operación exitosa: limpiar UI y mostrar modal
        orderDetails = {
            name,
            table,
            items,
            total,
            observation
        };

        // refrescar productos por si hubo cambios de stock en servidor
        products = await fetchProductsFromSupabase();
        showDefaultSections();
        cart = [];
        updateCart();

        // Limpiar observación en UI
        if (orderObservationInput) orderObservationInput.value = '';

        // Mostrar modal de éxito con total
        if (orderDetails.total) {
            orderSuccessTotal.textContent = money(orderDetails.total);
        }
        showModal(orderSuccessModal);
        closeModal(checkoutModal);
        closeModal(cartModal);
    } catch (err) {
        console.error('Fallo al guardar la orden:', err);
        alert('Error al procesar el pedido: ' + (err.message || err));
    }
});

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

// --- Funciones de DB ---
const fetchProductsFromSupabase = async () => {
    if (!supabaseClient) {
        return [];
    }
    try {
        const { data, error } = await supabaseClient
            .from('products')
            .select('*');
        if (error) {
            throw error;
        }
        return data || [];
    } catch (err) {
        console.error('Error al cargar los productos:', err.message || err);
        alert('Hubo un error al cargar los productos. Revisa la consola para más detalles.');
        return [];
    }
};

const loadConfigAndInitSupabase = async () => {
    try {
        const response = await fetch('api/get-config');
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Error del API Route api/get-config:', errorText);
            throw new Error(`Fallo al cargar la configuración: ${response.status} ${response.statusText}`);
        }
        const config = await response.json();
        if (!config.url || !config.anonKey) {
             throw new Error("El API Route no retornó las claves de DB. Revisa las Variables de Entorno en Vercel.");
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
        loadingMessage.style = 'position:fixed;top:0;left:0;width:100%;height:100%;background:white;display:flex;align-items:center;justify-content:center;color:red;font-weight:bold;text-align:center;[...]
        loadingMessage.textContent = 'ERROR DE INICIALIZACIÓN: No se pudo cargar la configuración de la tienda. Revisa la consola para más detalles (Faltan variables de entorno en Vercel).';
        document.body.appendChild(loadingMessage);
    }
};


document.addEventListener('DOMContentLoaded', loadConfigAndInitSupabase);
