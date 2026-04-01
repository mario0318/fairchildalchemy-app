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

let toastTimer;

function buildFallbackSymbol(symbol) {
  const el = document.createElement('span');
  el.textContent = symbol;
  return el;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toast.classList.remove('is-visible');
  }, 2200);
}

function observeReveals() {
  const nodes = document.querySelectorAll('.reveal');
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      }
    },
    { threshold: 0.16 }
  );

  for (const node of nodes) {
    observer.observe(node);
  }
}

function renderCategories(data) {
  const totalItems = data.categories.reduce((sum, category) => sum + category.items.length, 0);
  itemCount.textContent = String(totalItems);
  aboutCopy.textContent = data.about;
  contactLink.textContent = data.brand.contact_email;
  contactLink.href = `mailto:${data.brand.contact_email}`;

  const featured = data.categories[data.categories.length - 1].items[0];
  heroImage.src = featured.image_url;
  heroImage.alt = featured.name;
  heroName.textContent = featured.name;
  heroDescription.textContent = featured.description;

  for (const category of data.categories) {
    const categoryNode = categoryTemplate.content.firstElementChild.cloneNode(true);
    categoryNode.querySelector('.category-kicker').textContent = `${category.symbol} ${category.name}`;
    categoryNode.querySelector('h2').textContent = category.name;

    const grid = categoryNode.querySelector('.product-grid');

    for (const item of category.items) {
      const productNode = productTemplate.content.firstElementChild.cloneNode(true);
      const button = productNode.querySelector('.product-button');
      const image = productNode.querySelector('.product-image');
      const fallback = productNode.querySelector('.image-fallback');

      fallback.replaceChildren(buildFallbackSymbol(category.symbol));
      image.src = item.image_url;
      image.alt = item.name;
      image.addEventListener('error', () => {
        image.hidden = true;
      });

      productNode.querySelector('h3').textContent = item.name;
      productNode.querySelector('.product-price').textContent = `$${item.price.toFixed(2)}`;
      productNode.querySelector('.product-description').textContent = item.description;

      button.addEventListener('click', () => {
        showToast(`${item.name} is arriving soon.`);
      });

      grid.append(productNode);
    }

    collectionRoot.append(categoryNode);
  }
}

async function init() {
  const response = await fetch('/data/fairchild.json', {
    headers: { accept: 'application/json' }
  });

  if (!response.ok) {
    throw new Error(`Failed to load catalog: ${response.status}`);
  }

  renderCategories(await response.json());
  observeReveals();
}

init().catch((error) => {
  console.error(error);
  showToast('The collection is briefly out of reach.');
  observeReveals();
});

