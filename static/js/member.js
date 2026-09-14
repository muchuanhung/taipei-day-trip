const AUTH_TOKEN_KEY = "token";

document.addEventListener("DOMContentLoaded", async () => {
  await checkMemberAuth();
  setupMemberPage();
});

async function checkMemberAuth() {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  if (!token) {
    redirectToHome();
    return;
  }

  try {
    const response = await fetch("/api/user/auth", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const result = await response.json();
    if (!result.data) {
      redirectToHome();
      return;
    }
    window.currentUser = result.data;
    renderMemberGreeting(result.data);
  } catch (error) {
    console.error(error);
    redirectToHome();
  }
}

function redirectToHome() {
  location.href = "/";
}

function renderMemberGreeting(user) {
  const greeting = document.getElementById("member-greeting");
  if (greeting && user?.name) {
    greeting.textContent = `您好，${user.name}，歡迎使用會員功能`;
  }
}

function setupMemberPage() {
  setupMcpHostUrl();
  setupTokenSection();
  setupLogout();
}

function setupMcpHostUrl() {
  const input = document.getElementById("mcp-host-url");
  const copyBtn = document.getElementById("copy-host-url");
  const mcpUrl = location.origin + "/mcp/";

  if (input) {
    input.value = mcpUrl;
  }

  copyBtn?.addEventListener("click", () => {
    copyToClipboard(mcpUrl, copyBtn);
  });

  updateConfigExample(mcpUrl, "");
}

async function setupTokenSection() {
  const tokenInput = document.getElementById("mcp-token");
  const copyBtn = document.getElementById("copy-token");
  const generateBtn = document.getElementById("generate-token");
  const hint = document.getElementById("token-hint");

  await loadTokenStatus(hint);

  generateBtn?.addEventListener("click", async () => {
    await generateToken(tokenInput, hint, generateBtn);
  });

  copyBtn?.addEventListener("click", () => {
    const token = tokenInput?.value;
    if (token && token !== "尚未產生金鑰") {
      copyToClipboard(token, copyBtn);
    }
  });
}

async function loadTokenStatus(hint) {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  if (!token) return;

  try {
    const response = await fetch("/api/member/mcp-token", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const result = await response.json();
    if (result.data?.exists && hint) {
      const date = new Date(result.data.updatedAt);
      hint.textContent = `金鑰已產生，最後更新：${formatDate(date)}`;
    } else if (hint) {
      hint.textContent = "尚未產生金鑰，請點擊下方按鈕產生";
    }
  } catch (error) {
    console.error(error);
  }
}

async function generateToken(tokenInput, hint, generateBtn) {
  const authToken = localStorage.getItem(AUTH_TOKEN_KEY);
  if (!authToken) {
    redirectToHome();
    return;
  }

  generateBtn.disabled = true;
  generateBtn.textContent = "產生中...";

  try {
    const response = await fetch("/api/member/mcp-token", {
      method: "POST",
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const result = await response.json();

    if (result.error) {
      hint.textContent = result.message || "產生金鑰失敗，請稍後再試";
      return;
    }

    const newToken = result.data?.token;
    if (newToken && tokenInput) {
      tokenInput.value = newToken;
      hint.textContent = "金鑰已產生！請妥善保管，此金鑰只會顯示一次。";

      const mcpUrl = location.origin + "/mcp/";
      updateConfigExample(mcpUrl, newToken);
    }
  } catch (error) {
    console.error(error);
    hint.textContent = "產生金鑰失敗，請稍後再試";
  } finally {
    generateBtn.disabled = false;
    generateBtn.textContent = "產生 / 更新金鑰";
  }
}

function updateConfigExample(mcpUrl, token) {
  const codeEl = document.getElementById("mcp-config-example");
  if (!codeEl) return;

  const config = {
    mcpServers: {
      "taipei-day-trip": {
        url: mcpUrl,
        headers: {
          Authorization: `Bearer ${token || "<YOUR_TOKEN>"}`,
        },
      },
    },
  };

  codeEl.textContent = JSON.stringify(config, null, 2);
}

function setupLogout() {
  const logoutBtn = document.getElementById("logout-button");
  logoutBtn?.addEventListener("click", () => {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    location.href = "/";
  });
}

function copyToClipboard(text, button) {
  navigator.clipboard.writeText(text).then(() => {
    const originalText = button.textContent;
    button.textContent = "已複製";
    setTimeout(() => {
      button.textContent = originalText;
    }, 1500);
  }).catch((error) => {
    console.error("複製失敗:", error);
  });
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}/${month}/${day} ${hours}:${minutes}`;
}
