let nextPage = 0;
let isLoading = false;
let observer = null;
let selectedCategory = null;
let searchKeyword = "";
let categoriesLoaded = false;

document.addEventListener("DOMContentLoaded", () => {
  setupInfiniteScroll();
  setupCategoryPanel();
  setupSearchForm();
  setupMrtBar();
  loadMrts();
  loadAttractions({ replace: true });
});

function setupInfiniteScroll() {
  const sentinel = document.getElementById("scroll-sentinel");
  if (!sentinel) return;

  observer = new IntersectionObserver(
    (entries) => {
      if (entries[0].isIntersecting) {
        loadAttractions();
      }
    },
    { root: null, rootMargin: "0px", threshold: 0 },
  );

  observer.observe(sentinel);
}

function setupSearchForm() {
  const form = document.getElementById("search-form");
  if (!form) return;

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    searchAttractions();
  });
}

function searchAttractions() {
  const input = document.getElementById("search-input");
  searchKeyword = input?.value.trim() || "";
  resetAndLoadAttractions();
}

function resetAndLoadAttractions() {
  nextPage = 0;
  isLoading = false;

  const sentinel = document.getElementById("scroll-sentinel");
  if (observer && sentinel) {
    observer.disconnect();
    observer.observe(sentinel);
  }

  loadAttractions({ replace: true });
}

function setupCategoryPanel() {
  const button = document.getElementById("category-button");
  const panel = document.getElementById("category-panel");
  if (!button || !panel) return;

  button.addEventListener("click", async (event) => {
    event.stopPropagation();
    if (panel.hidden) {
      await openCategoryPanel();
    } else {
      closeCategoryPanel();
    }
  });

  document.addEventListener("click", (event) => {
    if (panel.hidden) return;
    if (panel.contains(event.target) || button.contains(event.target)) return;
    closeCategoryPanel();
  });
}

async function openCategoryPanel() {
  const button = document.getElementById("category-button");
  const panel = document.getElementById("category-panel");
  if (!button || !panel) return;

  if (!categoriesLoaded) {
    await loadCategories();
  }

  panel.hidden = false;
  button.setAttribute("aria-expanded", "true");
}

function closeCategoryPanel() {
  const button = document.getElementById("category-button");
  const panel = document.getElementById("category-panel");
  if (!button || !panel) return;

  panel.hidden = true;
  button.setAttribute("aria-expanded", "false");
}

async function loadCategories() {
  const list = document.getElementById("category-list");
  if (!list) return;

  try {
    const response = await fetch("/api/categories");
    const result = await response.json();

    if (!response.ok || result.error) {
      throw new Error(result.message || "取得分類失敗");
    }

    list.innerHTML = "";

    result.data.forEach((category) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "category-panel__item";
      item.textContent = category;
      item.addEventListener("click", () => {
        selectCategory(category);
      });
      list.appendChild(item);
    });

    categoriesLoaded = true;
  } catch (error) {
    console.error(error);
    list.innerHTML = `<p class="category-panel__error">無法載入分類</p>`;
  }
}

function selectCategory(category) {
  selectedCategory = category;
  const label = document.getElementById("category-label");
  if (label) {
    label.textContent = category;
  }
  closeCategoryPanel();
}

function setupMrtBar() {
  const list = document.getElementById("mrt-list");
  const left = document.getElementById("mrt-left");
  const right = document.getElementById("mrt-right");
  if (!list || !left || !right) return;

  left.addEventListener("click", () => {
    list.scrollBy({ left: -list.clientWidth * 0.8, behavior: "smooth" });
  });

  right.addEventListener("click", () => {
    list.scrollBy({ left: list.clientWidth * 0.8, behavior: "smooth" });
  });
}

async function loadMrts() {
  const list = document.getElementById("mrt-list");
  if (!list) return;

  try {
    const response = await fetch("/api/mrts");
    const result = await response.json();

    if (!response.ok || result.error) {
      throw new Error(result.message || "取得捷運站失敗");
    }

    list.innerHTML = "";

    result.data.forEach((mrtName) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "mrt__item";
      item.textContent = mrtName;
      item.addEventListener("click", () => {
        filterByMrt(mrtName);
      });
      list.appendChild(item);
    });
  } catch (error) {
    console.error(error);
    list.innerHTML = "";
  }
}

function filterByMrt(mrtName) {
  const input = document.getElementById("search-input");
  if (input) {
    input.value = mrtName;
  }
  searchKeyword = mrtName;
  resetAndLoadAttractions();
}

function buildAttractionsUrl(page) {
  const params = new URLSearchParams({ page: String(page) });
  if (selectedCategory) {
    params.set("category", selectedCategory);
  }
  if (searchKeyword) {
    params.set("keyword", searchKeyword);
  }
  return `/api/attractions?${params.toString()}`;
}

async function loadAttractions({ replace = false } = {}) {
  if (isLoading) return;
  if (nextPage === null) return;

  const list = document.getElementById("attraction-list");
  if (!list) return;

  const page = nextPage;
  isLoading = true;

  try {
    const response = await fetch(buildAttractionsUrl(page));
    const result = await response.json();

    if (!response.ok || result.error) {
      throw new Error(result.message || "取得景點資料失敗");
    }

    if (replace) {
      list.innerHTML = "";
    }

    if (!result.data.length) {
      if (replace) {
        list.innerHTML = `<p class="attractions__error">查無相關景點</p>`;
      }
      nextPage = null;
      observer?.disconnect();
      return;
    }

    result.data.forEach((attraction) => {
      list.appendChild(createAttractionCard(attraction));
    });

    nextPage = result.nextPage ?? null;

    if (nextPage === null) {
      observer?.disconnect();
    }
  } catch (error) {
    console.error(error);
    if (replace) {
      list.innerHTML = `<p class="attractions__error">無法載入景點資料</p>`;
    }
    nextPage = null;
    observer?.disconnect();
  } finally {
    isLoading = false;
  }

  // 第一頁不夠高、sentinel 仍在視窗內時，Observer 不會再觸發，補打下一頁
  requestMoreIfSentinelVisible();
}

function requestMoreIfSentinelVisible() {
  if (isLoading || nextPage === null) return;

  const sentinel = document.getElementById("scroll-sentinel");
  if (!sentinel) return;

  const rect = sentinel.getBoundingClientRect();
  if (rect.top < window.innerHeight && rect.bottom > 0) {
    loadAttractions();
  }
}

function createAttractionCard(attraction) {
  const link = document.createElement("a");
  link.className = "card-link";
  link.href = `/attraction/${attraction.id}`;

  const card = document.createElement("article");
  card.className = "card";

  const imageWrap = document.createElement("div");
  imageWrap.className = "card__image";

  const image = document.createElement("img");
  image.src = attraction.images?.[0] || "";
  image.alt = attraction.name || "";
  image.loading = "lazy";

  const name = document.createElement("div");
  name.className = "card__name";
  name.textContent = attraction.name || "";

  imageWrap.append(image, name);

  const meta = document.createElement("div");
  meta.className = "card__meta";

  const mrt = document.createElement("span");
  mrt.className = "card__mrt";
  mrt.textContent = attraction.mrt || "";

  const category = document.createElement("span");
  category.className = "card__category";
  category.textContent = attraction.category || "";

  meta.append(mrt, category);
  card.append(imageWrap, meta);
  link.appendChild(card);

  return link;
}
