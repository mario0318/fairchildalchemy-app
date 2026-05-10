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
const contactLink = document.querySelector('#contact-link');
const itemCount = document.querySelector('[data-item-count]');

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
  modalImg.src = urls[carouselIndex];
  modalImg.alt = modalItem.name;
  modalImgFallback.textContent = modalItem._symbol || '☿';

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
  const totalItems = data.categories.reduce((s, c) => s + c.items.length, 0);
  itemCount.textContent = String(totalItems);
  aboutCopy.textContent = data.brand.about;
  contactLink.textContent = data.brand.contact_email;
  contactLink.href = `mailto:${data.brand.contact_email}`;

  // Hero — pick first limited item from first category
  const heroSource = data.categories[0].items[0];
  heroImage.src = heroSource.image_urls?.[0] || '';
  heroImage.alt = heroSource.name;
  heroName.textContent = heroSource.name;
  heroDescription.textContent = heroSource.short_description;
  heroImage.addEventListener('error', () => { heroImage.hidden = true; });

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
      img.src = firstImg;
      img.alt = item.name;
      img.addEventListener('error', () => { img.hidden = true; });

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
}

// ─── Modal events ─────────────────────────────────────────────────────────────
modalClose.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', e => { if (e.target === modalOverlay) closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

carouselPrev.addEventListener('click', () => setCarouselSlide(carouselIndex - 1));
carouselNext.addEventListener('click', () => setCarouselSlide(carouselIndex + 1));

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

// Purchase link click — also mark claimed
purchaseLink.addEventListener('click', e => {
  if (purchaseLink.style.pointerEvents === 'none') { e.preventDefault(); return; }
  if (modalItem) setClaimed(modalItem.id, 'claimed');
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
