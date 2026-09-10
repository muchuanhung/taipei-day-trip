const TAPPAY_APP_ID = 171077;
const TAPPAY_APP_KEY = "app_pA2g6k1E2RN5nLjiXeTJitBBLeg0E0W24KVT0OVEXqjHClypJEc1t9npOYvE";
const TAPPAY_SERVER_TYPE = "sandbox";

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
  setupTapPayFields();
  setupPayButton();
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

let currentBooking = null;

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
  currentBooking = data;
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

let cardCanGetPrime = false;

function setupTapPayFields() {
  if (typeof TPDirect === "undefined") {
    console.error("TapPay SDK 未載入");
    return;
  }

  TPDirect.setupSDK(TAPPAY_APP_ID, TAPPAY_APP_KEY, TAPPAY_SERVER_TYPE);

  TPDirect.card.setup({
    fields: {
      number: { element: "#card-number", placeholder: "**** **** **** ****" },
      expirationDate: { element: "#card-expiry", placeholder: "MM / YY" },
      ccv: { element: "#card-ccv", placeholder: "CVV" },
    },
    styles: {
      input: { "font-size": "16px", color: "#000000" },
      "input.ccv": { "font-size": "16px" },
      ":focus": { color: "#000000" },
      ".valid": { color: "#448899" },
      ".invalid": { color: "#cc3333" },
    },
  });

  TPDirect.card.onUpdate(handleCardUpdate);
}

// status: 0 = 正確、1 = 未填完、2 = 錯誤
function handleCardUpdate(update) {
  cardCanGetPrime = update.canGetPrime;

  toggleFieldError("card-number", update.status.number);
  toggleFieldError("card-expiry", update.status.expiry);
  toggleFieldError("card-ccv", update.status.ccv);
}

function toggleFieldError(elementId, status) {
  const field = document.getElementById(elementId);
  if (!field) return;

  field.classList.toggle("is-error", status === 2);
}

function setupPayButton() {
  const payBtn = document.getElementById("booking-pay");
  if (!payBtn || payBtn.dataset.bound === "true") return;

  payBtn.dataset.bound = "true";
  payBtn.addEventListener("click", handlePay);
}

async function handlePay() {
  const contact = collectContact();
  if (!contact) return;

  if (!cardCanGetPrime) {
    alert("請填寫正確的信用卡資訊");
    return;
  }

  if (!currentBooking) {
    alert("目前沒有待預訂的行程");
    return;
  }

  const payBtn = document.getElementById("booking-pay");
  payBtn.disabled = true;

  try {
    const prime = await getPrime();
    const order = await createOrder(prime, contact);

    if (order.payment.status !== 0) {
      alert(`付款失敗：${order.payment.message}，請確認信用卡資訊後再試一次`);
      return;
    }

    location.assign(`/thankyou?number=${encodeURIComponent(order.number)}`);
  } catch (error) {
    alert(error.message || "取得付款資訊失敗，請稍後再試");
  } finally {
    payBtn.disabled = false;
  }
}

async function createOrder(prime, contact) {
  const token = localStorage.getItem("token");
  const response = await fetch("/api/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      prime,
      order: {
        price: currentBooking.price,
        trip: {
          attraction: {
            id: currentBooking.attraction.id,
            name: currentBooking.attraction.name,
            address: currentBooking.attraction.address,
            image: currentBooking.attraction.image,
          },
          date: currentBooking.date,
          time: currentBooking.time,
        },
        contact,
      },
    }),
  });

  const result = await response.json();

  if (response.status === 403) {
    location.replace("/");
    throw new Error("請重新登入");
  }

  if (!response.ok || result.error) {
    throw new Error(result.message || "訂購失敗，請稍後再試");
  }

  return result.data;
}

function collectContact() {
  const name = document.getElementById("contact-name")?.value.trim() ?? "";
  const email = document.getElementById("contact-email")?.value.trim() ?? "";
  const phone = document.getElementById("contact-phone")?.value.trim() ?? "";

  if (!name || !email || !phone) {
    alert("請填寫完整的聯絡資訊");
    return null;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    alert("請填寫正確的電子郵件格式");
    return null;
  }

  if (!/^09\d{8}$/.test(phone)) {
    alert("請填寫正確的手機號碼");
    return null;
  }

  return { name, email, phone };
}

function getPrime() {
  return new Promise((resolve, reject) => {
    TPDirect.card.getPrime((result) => {
      if (result.status !== 0) {
        reject(new Error(result.msg || "取得 prime 失敗"));
        return;
      }
      resolve(result.card.prime);
    });
  });
}
