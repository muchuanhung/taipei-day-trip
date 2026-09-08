function bootThankyouPage() {
  renderOrderNumber();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootThankyouPage);
} else {
  bootThankyouPage();
}

function renderOrderNumber() {
  const params = new URLSearchParams(location.search);
  const number = (params.get("number") || "").trim();

  const card = document.getElementById("thankyou-card");
  const empty = document.getElementById("thankyou-empty");

  // 直接開啟 /thankyou 而沒有帶編號時，給明確提示而不是空白畫面
  if (!number) {
    card?.setAttribute("hidden", "");
    empty?.removeAttribute("hidden");
    return;
  }

  const target = document.getElementById("order-number");
  if (target) target.textContent = number;
}
