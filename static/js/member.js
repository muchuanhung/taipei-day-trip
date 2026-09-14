const AUTH_TOKEN_KEY = "token";

document.addEventListener("DOMContentLoaded", async () => {
  await checkMemberAuth();
  setupMemberPage();
});

async function checkMemberAuth() {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  if (!token) {
    location.href = "/";
    return;
  }

  try {
    const response = await fetch("/api/user/auth", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const result = await response.json();
    if (!result.data) {
      location.href = "/";
      return;
    }
    window.currentUser = result.data;
    renderGreeting(result.data);
  } catch (error) {
    console.error(error);
    location.href = "/";
  }
}

function renderGreeting(user) {
  const el = document.getElementById("member-greeting");
  if (el && user?.name) {
    el.textContent = `您好，${user.name}：`;
  }
}

function setupMemberPage() {
  const hostEl = document.getElementById("mcp-host-url");
  if (hostEl) {
    hostEl.textContent = `${location.origin}/mcp/`;
  }

  loadExistingToken();
  document.getElementById("generate-token")?.addEventListener("click", generateToken);
  document.getElementById("logout-button")?.addEventListener("click", () => {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    location.href = "/";
  });
}

async function loadExistingToken() {
  const authToken = localStorage.getItem(AUTH_TOKEN_KEY);
  if (!authToken) return;

  try {
    const response = await fetch("/api/member/mcp-token", {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const result = await response.json();
    const mcpToken = result.data?.token;
    const tokenEl = document.getElementById("mcp-token");
    if (mcpToken && tokenEl) {
      tokenEl.textContent = mcpToken;
    }
  } catch (error) {
    console.error(error);
  }
}

async function generateToken() {
  const authToken = localStorage.getItem(AUTH_TOKEN_KEY);
  if (!authToken) {
    location.href = "/";
    return;
  }

  const btn = document.getElementById("generate-token");
  const tokenEl = document.getElementById("mcp-token");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "產生中...";
  }

  try {
    const response = await fetch("/api/member/mcp-token", {
      method: "POST",
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const result = await response.json();
    if (!response.ok || result.error) {
      console.error(result.message || "產生金鑰失敗");
      return;
    }
    if (result.data?.token && tokenEl) {
      tokenEl.textContent = result.data.token;
    }
  } catch (error) {
    console.error(error);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "產生 / 更新金鑰";
    }
  }
}
