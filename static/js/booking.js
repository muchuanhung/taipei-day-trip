function bootBookingPage() {
  initBookingPage();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootBookingPage);
} else {
  bootBookingPage();
}

async function initBookingPage() {
  const user = await resolveCurrentUser();
  if (!user) {
    location.replace("/");
    return;
  }

  renderTitle(user.name);
  fillContactForm(user);
  setupDeleteButton();
  await loadBooking();
}

async function resolveCurrentUser() {
  if (window.authStatusPromise) {
    await window.authStatusPromise;
    return window.currentUser ?? null;
  }

  const token = localStorage.getItem("token");
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    const response = await fetch("/api/user/auth", { headers });
    const result = await response.json();
    return result.data ?? null;
  } catch {
    return null;
  }
}

function renderTitle(name) {
  const title = document.getElementById("booking-title");
  if (!title) return;

  title.innerHTML = `您好，<span class="booking-section__name">${name}</span>，待預訂的行程如下：`;
}

function fillContactForm(user) {
  const nameInput = document.getElementById("contact-name");
  const emailInput = document.getElementById("contact-email");
  if (nameInput) nameInput.value = user.name || "";
  if (emailInput) emailInput.value = user.email || "";
}

async function loadBooking() {
  const token = localStorage.getItem("token");
  if (!token) {
    location.replace("/");
    return;
  }

  try {
    const response = await fetch("/api/booking", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const result = await response.json();

    if (response.status === 403 || result.message?.includes("未登入")) {
      location.replace("/");
      return;
    }

    if (!response.ok || result.error) {
      showEmpty();
      return;
    }

    if (!result.data) {
      showEmpty();
      return;
    }

    renderBooking(result.data);
  } catch {
    showEmpty();
  }
}

function renderBooking(data) {
  const item = document.getElementById("booking-item");
  const empty = document.getElementById("booking-empty");
  const checkout = document.getElementById("booking-checkout");
  if (!item) return;

  const attractionId = data.attraction.id;
  const attractionName = data.attraction.name;
  const attractionAddress = data.attraction.address;
  const attractionImage = data.attraction.image;

  const timeLabel =
    data.time === "morning" ? "早上9點 - 下午1點" : "下午1點 - 下午6點";

  item.querySelector(".booking-item__image").href = `/attraction/${attractionId}`;
  item.querySelector(".booking-item__image img").src = attractionImage;
  item.querySelector(".booking-item__image img").alt = attractionName;

  const nameLink = item.querySelector(".booking-item__name");
  nameLink.href = `/attraction/${attractionId}`;
  nameLink.querySelectorAll("span")[1].textContent = attractionName;

  const rows = item.querySelectorAll(".booking-item__value");
  rows[0].textContent = data.date;
  rows[1].textContent = timeLabel;
  rows[2].textContent = `新台幣 ${data.price} 元`;
  rows[3].textContent = attractionAddress;

  const total = document.getElementById("booking-total");
  if (total) total.textContent = `總價：新台幣 ${data.price} 元`;

  empty?.setAttribute("hidden", "");
  checkout?.removeAttribute("hidden");
  item.removeAttribute("hidden");
}

function showEmpty() {
  const item = document.getElementById("booking-item");
  const empty = document.getElementById("booking-empty");
  const checkout = document.getElementById("booking-checkout");
  if (item) item.setAttribute("hidden", "");
  checkout?.setAttribute("hidden", "");
  empty?.removeAttribute("hidden");
}

function setupDeleteButton() {
  const deleteBtn = document.getElementById("booking-delete");
  if (!deleteBtn || deleteBtn.dataset.bound === "true") return;

  deleteBtn.dataset.bound = "true";
  deleteBtn.addEventListener("click", handleDelete);
}

async function handleDelete() {
  const token = localStorage.getItem("token");
  if (!token) {
    location.replace("/");
    return;
  }

  try {
    const response = await fetch("/api/booking", {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.status === 403) {
      location.replace("/");
      return;
    }

    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      alert(result.message || "刪除失敗，請稍後再試");
      return;
    }

    location.reload();
  } catch {
    alert("刪除失敗，請稍後再試");
  }
}
