const AUTH_TOKEN_KEY = "token";

document.addEventListener("DOMContentLoaded", async () => {
  const user = await checkUser();
  if (!user) {
    location.href = "/";
    return;
  }

  renderTitle(user.name);
  await loadBooking();
});

async function checkUser() {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
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
  if (title) title.textContent = `您好，${name}，待預訂的行程如下：`;
}

async function loadBooking() {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);

  try {
    const response = await fetch("/api/booking", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const result = await response.json();

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

  item.removeAttribute("hidden");

  const deleteBtn = document.getElementById("booking-delete");
  deleteBtn?.addEventListener("click", handleDelete);
}

function showEmpty() {
  const item = document.getElementById("booking-item");
  const empty = document.getElementById("booking-empty");
  if (item) item.hidden = true;
  if (empty) empty.removeAttribute("hidden");
}

async function handleDelete() {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);

  try {
    const response = await fetch("/api/booking", {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

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
