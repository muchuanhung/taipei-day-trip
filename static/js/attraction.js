document.addEventListener("DOMContentLoaded", () => {
  setupTimeSelection();
  loadAttraction();
  setupBookingCTA();
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

  if (name) name.textContent = attraction.name || "";
  if (category) {
    const mrt = attraction.mrt || "";
    const categoryName = attraction.category || "";
    category.textContent = mrt ? `${categoryName} at ${mrt}` : categoryName;
  }
  if (description) description.textContent = attraction.description || "";
  if (address) address.textContent = attraction.address || "";
  if (transport) transport.textContent = attraction.transport || "";

  setupSlideshow(attraction.images || [], attraction.name || "");
}

function setupSlideshow(images, altText) {
  const imageWrap = document.getElementById("attraction-image");
  const dotsWrap = document.getElementById("slideshow-dots");
  const prev = document.getElementById("slideshow-prev");
  const next = document.getElementById("slideshow-next");
  if (!imageWrap || !dotsWrap) return;

  const slides = images.filter(Boolean);
  let currentIndex = 0;

  imageWrap.innerHTML = "";
  dotsWrap.innerHTML = "";

  if (!slides.length) return;

  const image = document.createElement("img");
  image.alt = altText;
  imageWrap.appendChild(image);

  slides.forEach((_, index) => {
    const dot = document.createElement("button");
    dot.type = "button";
    dot.className = "slideshow__dot";
    dot.setAttribute("aria-label", `第 ${index + 1} 張`);
    dot.addEventListener("click", () => {
      currentIndex = index;
      renderSlide();
    });
    dotsWrap.appendChild(dot);
  });

  function renderSlide() {
    image.src = slides[currentIndex];
    dotsWrap.querySelectorAll(".slideshow__dot").forEach((dot, index) => {
      dot.classList.toggle("slideshow__dot--active", index === currentIndex);
    });
  }

  prev?.addEventListener("click", () => {
    currentIndex = (currentIndex - 1 + slides.length) % slides.length;
    renderSlide();
  });

  next?.addEventListener("click", () => {
    currentIndex = (currentIndex + 1) % slides.length;
    renderSlide();
  });

  renderSlide();
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

function setupBookingCTA() {
  const button = document.querySelector(".booking-card__submit");
  const dateInput = document.getElementById("booking-date");
  if (!button || !dateInput) return;

  button.addEventListener("click", async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      window.AuthDialog?.open("signin");
      return;
    }

    const attractionId = getAttractionId();
    if (!attractionId) return;

    const date = dateInput.value;
    if (!date) {
      alert("請選擇日期");
      return;
    }

    const selectedTime = document.querySelector('input[name="time-slot"]:checked')?.value;
    if (!selectedTime) {
      alert("請選擇時間");
      return;
    }

    const price = selectedTime === "morning" ? 2000 : 2500;

    try {
      const response = await fetch("/api/booking", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          attractionId,
          date,
          time: selectedTime,
          price,
        }),
      });

      if (response.status === 403) {
        // token 過期/無效：用同一套登入彈窗處理
        window.AuthDialog?.open("signin");
        return;
      }

      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.error) {
        alert(result.message || "建立預定失敗，請稍後再試");
        return;
      }

      location.href = "/booking";
    } catch (error) {
      console.error(error);
      alert("建立預定失敗，請稍後再試");
    }
  });
}