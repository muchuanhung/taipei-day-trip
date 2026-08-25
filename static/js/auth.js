document.addEventListener("DOMContentLoaded", () => {
  setupAuthDialog();
});

function setupAuthDialog() {
  mountAuthDialog();

  const openButton = document.getElementById("auth-open");
  const overlay = document.getElementById("auth-overlay");
  const dialog = document.getElementById("auth-dialog");
  const closeButton = document.getElementById("auth-close");
  const signinPanel = document.getElementById("auth-signin-panel");
  const signupPanel = document.getElementById("auth-signup-panel");
  const toSignup = document.getElementById("auth-to-signup");
  const toSignin = document.getElementById("auth-to-signin");
  const signinForm = document.getElementById("auth-signin-form");
  const signupForm = document.getElementById("auth-signup-form");

  if (!overlay || !dialog) return;

  openButton?.addEventListener("click", () => openAuthDialog("signin"));
  closeButton?.addEventListener("click", closeAuthDialog);
  overlay.addEventListener("click", closeAuthDialog);

  toSignup?.addEventListener("click", () => showAuthPanel("signup"));
  toSignin?.addEventListener("click", () => showAuthPanel("signin"));

  // 4-2: UI only; API wiring is 4-4 / 4-5
  signinForm?.addEventListener("submit", (event) => {
    event.preventDefault();
  });

  signupForm?.addEventListener("submit", (event) => {
    event.preventDefault();
  });

  function openAuthDialog(panel = "signin") {
    showAuthPanel(panel);
    overlay.classList.add("is-open");
    dialog.classList.add("is-open");
    document.body.style.overflow = "hidden";
  }

  function closeAuthDialog() {
    overlay.classList.remove("is-open");
    dialog.classList.remove("is-open");
    document.body.style.overflow = "";
    clearAuthMessages();
  }

  function showAuthPanel(panel) {
    const isSignup = panel === "signup";
    signinPanel?.classList.toggle("is-active", !isSignup);
    signupPanel?.classList.toggle("is-active", isSignup);
    clearAuthMessages();
  }

  function clearAuthMessages() {
    document.querySelectorAll(".auth-dialog__message").forEach((el) => {
      el.textContent = "";
      el.classList.remove("is-error", "is-success");
    });
  }

  window.AuthDialog = {
    open: openAuthDialog,
    close: closeAuthDialog,
    showPanel: showAuthPanel,
  };
}

function mountAuthDialog() {
  if (document.getElementById("auth-dialog")) return;

  const root = document.createElement("div");
  root.id = "auth-root";
  root.innerHTML = `
    <div class="auth-overlay" id="auth-overlay"></div>
    <div class="auth-dialog" id="auth-dialog" role="dialog" aria-modal="true" aria-labelledby="auth-dialog-title">
      <div class="auth-dialog__bar" aria-hidden="true"></div>
      <button type="button" class="auth-dialog__close" id="auth-close" aria-label="關閉">
        <img src="/static/images/icon_close.png" alt="" width="16" height="16">
      </button>

      <div class="auth-dialog__panel is-active" id="auth-signin-panel">
        <h2 class="auth-dialog__title" id="auth-dialog-title">登入會員帳號</h2>
        <form class="auth-dialog__form" id="auth-signin-form">
          <input class="auth-dialog__input" type="email" name="email" placeholder="輸入電子信箱" autocomplete="email" required>
          <input class="auth-dialog__input" type="password" name="password" placeholder="輸入密碼" autocomplete="current-password" required>
          <button class="auth-dialog__submit" type="submit">登入帳戶</button>
        </form>
        <p class="auth-dialog__message" id="auth-signin-message" aria-live="polite"></p>
        <p class="auth-dialog__switch" id="auth-to-signup">還沒有帳戶？點此註冊</p>
      </div>

      <div class="auth-dialog__panel" id="auth-signup-panel">
        <h2 class="auth-dialog__title">註冊會員帳號</h2>
        <form class="auth-dialog__form" id="auth-signup-form">
          <input class="auth-dialog__input" type="text" name="name" placeholder="輸入姓名" autocomplete="name" required>
          <input class="auth-dialog__input" type="email" name="email" placeholder="輸入電子信箱" autocomplete="email" required>
          <input class="auth-dialog__input" type="password" name="password" placeholder="輸入密碼" autocomplete="new-password" required>
          <button class="auth-dialog__submit" type="submit">註冊新帳戶</button>
        </form>
        <p class="auth-dialog__message" id="auth-signup-message" aria-live="polite"></p>
        <p class="auth-dialog__switch" id="auth-to-signin">已經有帳戶了？點此登入</p>
      </div>
    </div>
  `;
  document.body.appendChild(root);
}
