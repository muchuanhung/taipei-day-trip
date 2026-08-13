let nextPage = 0;
let isLoading = false;
let observer = null;

document.addEventListener("DOMContentLoaded", () => {
  setupInfiniteScroll();
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

async function loadAttractions({ replace = false } = {}) {
  if (isLoading) return;
  if (nextPage === null) return;

  const list = document.getElementById("attraction-list");
  if (!list) return;

  const page = nextPage;
  isLoading = true;

  try {
    const response = await fetch(`/api/attractions?page=${page}`);
    const result = await response.json();

    if (!response.ok || result.error) {
      throw new Error(result.message || "取得景點資料失敗");
    }

    if (replace) {
      list.innerHTML = "";
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

  return card;
}
