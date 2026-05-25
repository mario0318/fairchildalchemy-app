// ─── State ────────────────────────────────────────────────────────────────────
let catalogData = null;
let modalItem = null;
let carouselIndex = 0;
let claimed = JSON.parse(localStorage.getItem('fca-claimed') || '{}');
let interests = JSON.parse(localStorage.getItem('fca-interests') || '{}');

// ─── DOM refs ─────────────────────────────────────────────────────────────────
const collectionRoot = document.querySelector('#collection');
const categoryTemplate = document.querySelector('#category-template');
const productTemplate = document.querySelector('#product-template');
const toast = document.querySelector('#toast');
const heroImage = document.querySelector('#hero-image');
const heroName = document.querySelector('#hero-name');
const heroDescription = document.querySelector('#hero-description');
const aboutCopy = document.querySelector('#about-copy');
const itemCount = document.querySelector('[data-item-count]');
const contactForm = document.querySelector('#contact-form');
const contactStatus = document.querySelector('#contact-status');

const modalOverlay = document.querySelector('#modal-overlay');
const modal = document.querySelector('#modal');
const modalClose = document.querySelector('#modal-close');
const modalImg = document.querySelector('#modal-img');
const modalImgFallback = document.querySelector('#modal-img-fallback');
const carouselPrev = document.querySelector('#carousel-prev');
const carouselNext = document.querySelector('#carousel-next');
const carouselDots = document.querySelector('#carousel-dots');

const modalCategory = document.querySelector('#modal-category');
const modalTitle = document.querySelector('#modal-title');
const modalPrice = document.querySelector('#modal-price');
const modalBadge = document.querySelector('#modal-badge');
const modalLongDesc = document.querySelector('#modal-long-desc');
const modalMaterials = document.querySelector('#modal-materials');
const modalDimensions = document.querySelector('#modal-dimensions');
const modalCare = document.querySelector('#modal-care');

const seedToggle = document.querySelector('#seed-toggle');
const seedContent = document.querySelector('#seed-content');
const seedModel = document.querySelector('#seed-model');
const seedNum = document.querySelector('#seed-num');
const seedPrompt = document.querySelector('#seed-prompt');
const seedVariants = document.querySelector('#seed-variants');
const seedCopyBtn = document.querySelector('#seed-copy-btn');

const interestForm = document.querySelector('#interest-form');
const formSuccess = document.querySelector('#form-success');
const purchaseDesc = document.querySelector('#purchase-desc');
const purchaseLink = document.querySelector('#purchase-link');
const filterButtons = document.querySelectorAll('.filter-btn');

const FILTER_TAGS = {
  all: () => true,
  desktop: tags => tags.has('desktop'),
  kinetic: tags => tags.has('kinetic'),
  ritual: tags => tags.has('ritual'),
  giftable: tags => tags.has('giftable')
};

function itemTags(item, categoryId) {
  const text = [
    item.id,
    item.name,
    item.short_description,
    item.long_description,
    ...(item.materials || [])
  ].join(' ').toLowerCase();
  const tags = new Set(['giftable']);

  if (categoryId === 'study' || /desk|calendar|globe|letter|journal|bookmark|pad|weight/.test(text)) tags.add('desktop');
  if (/spinner|fidget|puzzle|sphere|top|kinetic|gravity|rotating|mechanical/.test(text)) tags.add('kinetic');
  if (categoryId === 'ritual' || /incense|candle|pour|tea|coffee|whisky|stone|smoke|ritual/.test(text)) tags.add('ritual');
  if (/wireless|charging|light|circuit|lamp|mova|aerospace/.test(text)) tags.add('tech');

  return tags;
}

function setImageState(img, fallback) {
  fallback.hidden = false;
  img.hidden = false;
  img.addEventListener('load', () => {
    fallback.hidden = true;
    img.hidden = false;
  });
  img.addEventListener('error', () => {
    img.hidden = true;
    fallback.hidden = false;
  });
}

// ─── Toast ────────────────────────────────────────────────────────────────────
let toastTimer;
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 2800);
}

// ─── Scroll reveal ────────────────────────────────────────────────────────────
function observeReveals() {
  const observer = new IntersectionObserver(
    entries => entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('is-visible'); observer.unobserve(e.target); }
    }),
    { threshold: 0.1 }
  );
  document.querySelectorAll('.reveal').forEach(n => observer.observe(n));
}

// ─── Persist claimed state ────────────────────────────────────────────────────
function saveClaimed() { localStorage.setItem('fca-claimed', JSON.stringify(claimed)); }
function saveInterests() { localStorage.setItem('fca-interests', JSON.stringify(interests)); }

function setClaimed(id, value) {
  claimed[id] = value;
  saveClaimed();
  document.querySelectorAll(`.claim-btn[data-id="${id}"]`).forEach(btn => applyClaimState(btn, value));
}

function applyClaimState(btn, state) {
  const label = btn.querySelector('.claim-label');
  if (state === 'interested') {
    btn.classList.add('is-interested');
    btn.classList.remove('is-claimed');
    label.textContent = 'Interest Noted ✓';
  } else if (state === 'claimed') {
    btn.classList.add('is-claimed');
    btn.classList.remove('is-interested');
    label.textContent = 'Claimed ✓';
  } else {
    btn.classList.remove('is-interested', 'is-claimed');
    label.textContent = 'Claim This';
  }
}

// ─── Carousel ─────────────────────────────────────────────────────────────────
function setCarouselSlide(idx) {
  const urls = modalItem.image_urls || [];
  if (!urls.length) return;
  carouselIndex = ((idx % urls.length) + urls.length) % urls.length;
  modalImg.hidden = false;
  modalImgFallback.hidden = false;
  modalImg.alt = modalItem.name;
  modalImgFallback.textContent = modalItem._symbol || '☿';
  modalImg.src = urls[carouselIndex];

  // Dots
  carouselDots.innerHTML = '';
  urls.forEach((_, i) => {
    const dot = document.createElement('button');
    dot.className = 'carousel-dot' + (i === carouselIndex ? ' active' : '');
    dot.setAttribute('aria-label', `Image ${i + 1}`);
    dot.addEventListener('click', () => setCarouselSlide(i));
    carouselDots.append(dot);
  });

  const showNav = urls.length > 1;
  carouselPrev.hidden = !showNav;
  carouselNext.hidden = !showNav;
}

// ─── Modal ────────────────────────────────────────────────────────────────────
function openModal(item, categoryName, categorySymbol) {
  modalItem = { ...item, _symbol: categorySymbol };
  carouselIndex = 0;

  // Header
  modalCategory.textContent = `${categorySymbol} ${categoryName}`;
  modalTitle.textContent = item.name;
  modalPrice.textContent = `$${item.price.toFixed(2)}`;

  // Badge
  if (item.status === 'limited' && item.units_available != null) {
    modalBadge.textContent = `${item.units_available} of ${item.units_total} remaining`;
    modalBadge.hidden = false;
  } else {
    modalBadge.hidden = true;
  }

  // Descriptions
  modalLongDesc.textContent = item.long_description || item.short_description;

  // Specs
  modalMaterials.textContent = Array.isArray(item.materials) ? item.materials.join(' · ') : '';
  modalDimensions.textContent = item.dimensions || '';
  modalCare.textContent = item.care || '';

  // Carousel
  modalImg.src = '';
  setCarouselSlide(0);

  // Seed
  const gs = item.generation_seed;
  if (gs) {
    seedModel.textContent = gs.model || '';
    seedNum.textContent = gs.seed || '';
    seedPrompt.textContent = gs.prompt || '';
    seedVariants.innerHTML = '';
    if (Array.isArray(gs.angle_variants) && gs.angle_variants.length) {
      const heading = document.createElement('p');
      heading.className = 'seed-variants-heading';
      heading.textContent = 'Angle variants:';
      seedVariants.append(heading);
      const ul = document.createElement('ul');
      gs.angle_variants.forEach(v => {
        const li = document.createElement('li');
        li.textContent = v;
        ul.append(li);
      });
      seedVariants.append(ul);
    }
    document.querySelector('#seed-block').hidden = false;
  } else {
    document.querySelector('#seed-block').hidden = true;
  }
  seedContent.hidden = true;
  seedToggle.querySelector('.seed-chevron').textContent = '▸';

  // Purchase panel
  purchaseDesc.textContent = `${item.name} — $${item.price.toFixed(2)}`;
  if (item.stripe_payment_link) {
    purchaseLink.href = item.stripe_payment_link;
    purchaseLink.style.pointerEvents = '';
    purchaseLink.style.opacity = '';
    purchaseLink.textContent = 'Proceed to Secure Checkout →';
  } else {
    purchaseLink.href = '#';
    purchaseLink.style.pointerEvents = 'none';
    purchaseLink.style.opacity = '0.4';
    purchaseLink.textContent = 'Payment link coming soon';
  }

  // Reset form
  interestForm.reset();
  interestForm.hidden = false;
  formSuccess.hidden = true;

  // Reset tabs
  document.querySelectorAll('.tab-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === 'interest');
    b.setAttribute('aria-selected', b.dataset.tab === 'interest');
  });
  document.querySelectorAll('.tab-panel').forEach(p => {
    p.classList.toggle('hidden', p.dataset.panel !== 'interest');
  });

  // Show modal
  modalOverlay.removeAttribute('aria-hidden');
  modalOverlay.classList.add('is-open');
  document.body.classList.add('modal-open');
  setTimeout(() => modalClose.focus(), 100);
}

function closeModal() {
  modalOverlay.setAttribute('aria-hidden', 'true');
  modalOverlay.classList.remove('is-open');
  document.body.classList.remove('modal-open');
}

// ─── Catalog render ───────────────────────────────────────────────────────────
function renderCategories(data) {
  collectionRoot.innerHTML = '';
  const totalItems = data.categories.reduce((s, c) => s + c.items.length, 0);
  itemCount.textContent = String(totalItems);
  aboutCopy.textContent = data.brand.about;

  // Hero - prefer a modern desk/gadget object when present.
  const allItems = data.categories.flatMap(category => category.items.map(item => ({ ...item, _categoryId: category.id })));
  const heroSource = allItems.find(item => item.id === 'mova-globe-earth') || allItems[0];
  heroImage.alt = heroSource.name;
  heroName.textContent = heroSource.name;
  heroDescription.textContent = heroSource.short_description;
  setImageState(heroImage, document.querySelector('.hero-image-fallback'));
  heroImage.src = heroSource.image_urls?.[0] || '';

  for (const category of data.categories) {
    const catNode = categoryTemplate.content.firstElementChild.cloneNode(true);
    catNode.querySelector('.category-kicker').textContent = `${category.symbol} ${category.name}`;
    catNode.querySelector('h2').textContent = category.name;
    catNode.querySelector('.category-tagline').textContent = category.tagline || '';

    const grid = catNode.querySelector('.product-grid');

    for (const item of category.items) {
      const pNode = productTemplate.content.firstElementChild.cloneNode(true);
      const btn = pNode.querySelector('.product-button');
      const img = pNode.querySelector('.product-image');
      const fallback = pNode.querySelector('.image-fallback');
      const countBadge = pNode.querySelector('.image-count-badge');
      const claimBtn = pNode.querySelector('.claim-btn');

      // Image
      fallback.textContent = category.symbol;
      const firstImg = item.image_urls?.[0] || '';
      img.alt = item.name;
      setImageState(img, fallback);
      img.src = firstImg;

      const tags = itemTags(item, category.id);
      pNode.dataset.tags = [...tags].join(' ');

      // Multi-image badge
      const imgCount = item.image_urls?.length || 0;
      if (imgCount > 1) {
        countBadge.textContent = `1 / ${imgCount}`;
        countBadge.hidden = false;
      } else {
        countBadge.hidden = true;
      }

      // Meta
      pNode.querySelector('h3').textContent = item.name;
      pNode.querySelector('.product-price').textContent = `$${item.price.toFixed(2)}`;
      pNode.querySelector('.product-description').textContent = item.short_description;

      // Limit badge
      const limitBadge = pNode.querySelector('.product-limit-badge');
      if (item.status === 'limited' && item.units_available != null) {
        limitBadge.textContent = `${item.units_available} left`;
        limitBadge.hidden = false;
      } else {
        limitBadge.hidden = true;
      }

      // Claim btn
      claimBtn.dataset.id = item.id;
      applyClaimState(claimBtn, claimed[item.id] || null);

      claimBtn.addEventListener('click', e => {
        e.stopPropagation();
        openModal(item, category.name, category.symbol);
      });

      btn.addEventListener('click', () => openModal(item, category.name, category.symbol));

      grid.append(pNode);
    }

    collectionRoot.append(catNode);
  }

  applyFilter(document.querySelector('.filter-btn.active')?.dataset.filter || 'all');
}

function applyFilter(filter) {
  const predicate = FILTER_TAGS[filter] || FILTER_TAGS.all;

  document.querySelectorAll('.product-card').forEach(card => {
    const tags = new Set((card.dataset.tags || '').split(' ').filter(Boolean));
    card.hidden = !predicate(tags);
  });

  document.querySelectorAll('.category').forEach(category => {
    const visible = category.querySelectorAll('.product-card:not([hidden])').length;
    category.classList.toggle('is-empty', visible === 0);
  });
}

// ─── Modal events ─────────────────────────────────────────────────────────────
modalClose.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', e => { if (e.target === modalOverlay) closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

carouselPrev.addEventListener('click', () => setCarouselSlide(carouselIndex - 1));
carouselNext.addEventListener('click', () => setCarouselSlide(carouselIndex + 1));
setImageState(modalImg, modalImgFallback);

filterButtons.forEach(button => {
  button.setAttribute('aria-pressed', String(button.classList.contains('active')));
  button.addEventListener('click', () => {
    filterButtons.forEach(btn => {
      const active = btn === button;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', String(active));
    });
    applyFilter(button.dataset.filter || 'all');
  });
});

document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', e => {
    const hash = anchor.getAttribute('href');
    if (!hash || hash === '#') return;
    const target = document.querySelector(hash);
    if (!target) return;

    e.preventDefault();
    target.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'start'
    });
    window.history.pushState(null, '', hash);
  });
});

// Seed toggle
seedToggle.addEventListener('click', () => {
  const open = !seedContent.hidden;
  seedContent.hidden = open;
  seedToggle.querySelector('.seed-chevron').textContent = open ? '▸' : '▾';
});

// Copy prompt
seedCopyBtn.addEventListener('click', async () => {
  const text = seedPrompt.textContent;
  try {
    await navigator.clipboard.writeText(text);
    seedCopyBtn.textContent = 'Copied!';
    setTimeout(() => { seedCopyBtn.textContent = 'Copy Prompt'; }, 2000);
  } catch {
    seedCopyBtn.textContent = 'Copy failed';
  }
});

// Tab switching
document.querySelectorAll('.tab-btn').forEach(tabBtn => {
  tabBtn.addEventListener('click', () => {
    const target = tabBtn.dataset.tab;
    document.querySelectorAll('.tab-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.tab === target);
      b.setAttribute('aria-selected', b.dataset.tab === target);
    });
    document.querySelectorAll('.tab-panel').forEach(p => {
      p.classList.toggle('hidden', p.dataset.panel !== target);
    });
  });
});

// Interest form submit
interestForm.addEventListener('submit', async e => {
  e.preventDefault();
  const formData = new FormData(interestForm);
  const email = formData.get('email')?.trim();
  if (!email) { showToast('Email address required.'); return; }

  const payload = {
    name: formData.get('name')?.trim() || '',
    email,
    note: formData.get('note')?.trim() || '',
    product_id: modalItem?.id || '',
    product_name: modalItem?.name || ''
  };

  const submitBtn = interestForm.querySelector('.form-submit');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Sending…';

  try {
    await fetch('/api/interest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch {
    // Fail silently — still show success for demo purposes
  }

  // Mark as interested
  setClaimed(payload.product_id, 'interested');
  interests[payload.product_id] = payload;
  saveInterests();

  interestForm.hidden = true;
  formSuccess.hidden = false;
  submitBtn.disabled = false;
  submitBtn.textContent = 'Send Interest →';
  showToast(`Interest noted for ${payload.product_name}.`);
});

// Purchase link click - create a branded Stripe Checkout Session, with Payment Link fallback.
purchaseLink.addEventListener('click', async e => {
  if (purchaseLink.style.pointerEvents === 'none') { e.preventDefault(); return; }
  if (!modalItem) return;

  e.preventDefault();
  const fallbackUrl = modalItem.stripe_payment_link;
  purchaseLink.setAttribute('aria-busy', 'true');
  purchaseLink.textContent = 'Opening Checkout...';

  try {
    const res = await fetch('/api/checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product_id: modalItem.id })
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.url) throw new Error(json.error || 'Checkout unavailable.');
    setClaimed(modalItem.id, 'claimed');
    window.location.href = json.url;
  } catch (error) {
    if (fallbackUrl) {
      setClaimed(modalItem.id, 'claimed');
      window.location.href = fallbackUrl;
      return;
    }
    showToast(error.message || 'Checkout unavailable.');
    purchaseLink.textContent = 'Proceed to Secure Checkout →';
    purchaseLink.removeAttribute('aria-busy');
  }
});

contactForm.addEventListener('submit', async e => {
  e.preventDefault();
  const formData = new FormData(contactForm);
  const email = formData.get('email')?.trim();
  const message = formData.get('message')?.trim();
  const trap = formData.get('company')?.trim();

  if (trap) return;
  if (!email || !message) {
    contactStatus.textContent = 'Email and message are required.';
    return;
  }

  const submitBtn = contactForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Sending...';
  contactStatus.textContent = '';

  try {
    const res = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: formData.get('name')?.trim() || '',
        email,
        message
      })
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.ok) throw new Error(json.error || 'Message delivery failed.');
    contactForm.reset();
    contactStatus.textContent = 'Message sent. It will arrive tagged as Fairchild Alchemy.';
    showToast('Message sent.');
  } catch (error) {
    contactStatus.textContent = error.message || 'Message delivery failed.';
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Send Message';
  }
});

// ─── Init ─────────────────────────────────────────────────────────────────────
async function init() {
  const res = await fetch('/data/fairchild.json', { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`Catalog load failed: ${res.status}`);
  catalogData = await res.json();
  renderCategories(catalogData);
  observeReveals();
}

init().catch(err => {
  console.error(err);
  showToast('The collection is briefly out of reach.');
  observeReveals();
});
