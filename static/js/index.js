document.addEventListener("DOMContentLoaded", () => {
  loadAttractions();
});

async function loadAttractions() {
  const list = document.getElementById("attraction-list");
  if (!list) return;

  try {
    const response = await fetch("/api/attractions?page=0");
    const result = await response.json();

    if (!response.ok || result.error) {
      throw new Error(result.message || "取得景點資料失敗");
    }

    list.innerHTML = "";

    result.data.forEach((attraction) => {
      list.appendChild(createAttractionCard(attraction));
    });
  } catch (error) {
    console.error(error);
    list.innerHTML = `<p class="attractions__error">無法載入景點資料</p>`;
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
