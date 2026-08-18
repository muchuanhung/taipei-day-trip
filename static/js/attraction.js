document.addEventListener("DOMContentLoaded", () => {
  setupTimeSelection();
  loadAttraction();
});

function getAttractionId() {
  const match = window.location.pathname.match(/^\/attraction\/(\d+)\/?$/);
  return match ? Number(match[1]) : null;
}

async function loadAttraction() {
  const attractionId = getAttractionId();
  if (!attractionId) {
    showAttractionError("景點編號不正確");
    return;
  }

  try {
    const response = await fetch(`/api/attraction/${attractionId}`);
    const result = await response.json();

    if (!response.ok || result.error) {
      throw new Error(result.message || "取得景點資料失敗");
    }

    renderAttraction(result.data);
  } catch (error) {
    console.error(error);
    showAttractionError(error.message || "無法載入景點資料");
  }
}

function renderAttraction(attraction) {
  document.title = `${attraction.name} | 台北一日遊`;

  const name = document.getElementById("attraction-name");
  const category = document.getElementById("attraction-category");
  const description = document.getElementById("attraction-description");
  const address = document.getElementById("attraction-address");
  const transport = document.getElementById("attraction-transport");
  const imageWrap = document.getElementById("attraction-image");

  if (name) name.textContent = attraction.name || "";
  if (category) {
    const mrt = attraction.mrt || "";
    const categoryName = attraction.category || "";
    category.textContent = mrt ? `${categoryName} at ${mrt}` : categoryName;
  }
  if (description) description.textContent = attraction.description || "";
  if (address) address.textContent = attraction.address || "";
  if (transport) transport.textContent = attraction.transport || "";

  if (imageWrap) {
    imageWrap.innerHTML = "";
    const firstImage = attraction.images?.[0];
    if (firstImage) {
      const image = document.createElement("img");
      image.src = firstImage;
      image.alt = attraction.name || "";
      imageWrap.appendChild(image);
    }
  }
}

function showAttractionError(message) {
  const name = document.getElementById("attraction-name");
  const description = document.getElementById("attraction-description");
  if (name) name.textContent = "無法顯示景點";
  if (description) description.textContent = message;
}

function setupTimeSelection() {
  const options = document.querySelectorAll('input[name="time-slot"]');
  const price = document.getElementById("booking-price");
  if (!options.length || !price) return;

  options.forEach((option) => {
    option.addEventListener("change", () => {
      updateBookingPrice();
    });
  });

  updateBookingPrice();
}

function updateBookingPrice() {
  const selected = document.querySelector('input[name="time-slot"]:checked');
  const price = document.getElementById("booking-price");
  if (!price) return;

  const amount = selected?.value === "morning" ? 2000 : 2500;
  price.textContent = `新台幣 ${amount} 元`;
}