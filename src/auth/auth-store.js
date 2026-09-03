import { getSystemLanguage } from "../i18n/locale-store.js";
import { t } from "../i18n/messages.js";
import { clearMeetingConfigForUser } from "../storage/meeting-config-store.js";

const STORAGE_KEYS = {
  demoUsers: "ac_demo_users",
  currentUser: "ac_current_user",
};

const DEFAULT_COMPANY = "神州数码";

function getDefaultUserName(role) {
  return role === "admin" ? "管理员" : "普通成员";
}

function getDefaultUserAvatar(role) {
  return role === "admin" ? "管" : "普";
}

const DEMO_USERS = [
  {
    id: "u_admin_001",
    role: "admin",
    name: getDefaultUserName("admin"),
    company: DEFAULT_COMPANY,
    account: "admin@demo.com",
    password: "admin123",
    avatar: getDefaultUserAvatar("admin"),
  },
  {
    id: "u_member_001",
    role: "member",
    name: getDefaultUserName("member"),
    company: DEFAULT_COMPANY,
    account: "member@demo.com",
    password: "member123",
    avatar: getDefaultUserAvatar("member"),
  },
];

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function normalizeDemoUser(user, fallback = {}) {
  const role = user?.role === "admin" ? "admin" : "member";
  return {
    id: String(user?.id || fallback.id || "").trim(),
    role,
    name: getDefaultUserName(role),
    company: DEFAULT_COMPANY,
    account: String(user?.account || fallback.account || "").trim(),
    password: String(user?.password || fallback.password || "").trim(),
    avatar: getDefaultUserAvatar(role),
  };
}

function sanitizeUser(user) {
  const normalized = normalizeDemoUser(user);
  return {
    id: normalized.id,
    role: normalized.role,
    name: normalized.name,
    company: normalized.company,
    account: normalized.account,
    avatar: normalized.avatar,
  };
}

export function ensureDemoUsers() {
  const existing = readJson(STORAGE_KEYS.demoUsers, null);
  if (Array.isArray(existing) && existing.length) {
    const normalizedExisting = existing
      .map((user, index) => normalizeDemoUser(user, DEMO_USERS[index] || {}))
      .filter((user) => user.id && user.account);
    if (JSON.stringify(existing) !== JSON.stringify(normalizedExisting)) {
      writeJson(STORAGE_KEYS.demoUsers, normalizedExisting);
    }
    return normalizedExisting;
  }

  writeJson(STORAGE_KEYS.demoUsers, DEMO_USERS);
  return DEMO_USERS;
}

export function getDemoUsers() {
  return ensureDemoUsers();
}

export function getCurrentUser() {
  const currentUser = readJson(STORAGE_KEYS.currentUser, null);
  if (!currentUser) {
    return null;
  }
  const normalized = sanitizeUser(currentUser);
  if (
    currentUser.id !== normalized.id ||
    currentUser.role !== normalized.role ||
    currentUser.name !== normalized.name ||
    currentUser.company !== normalized.company ||
    currentUser.account !== normalized.account ||
    currentUser.avatar !== normalized.avatar
  ) {
    writeJson(STORAGE_KEYS.currentUser, {
      ...normalized,
      loginAt: currentUser.loginAt || new Date().toISOString(),
    });
  }
  return {
    ...normalized,
    loginAt: currentUser.loginAt,
  };
}

export function setCurrentUser(user) {
  writeJson(STORAGE_KEYS.currentUser, {
    ...sanitizeUser(user),
    loginAt: new Date().toISOString(),
  });
}

export function clearCurrentUser() {
  const currentUser = getCurrentUser();
  clearMeetingConfigForUser(currentUser?.id || "");
  localStorage.removeItem(STORAGE_KEYS.currentUser);
}

export function logout() {
  clearCurrentUser();
  window.location.replace("login.html");
}

export function loginWithPassword(account, password) {
  const normalizedAccount = account.trim().toLowerCase();
  const normalizedPassword = password.trim();
  const language = getSystemLanguage();

  if (!normalizedAccount) {
    return { ok: false, code: "account_required", message: t("auth_account_required", {}, language) };
  }

  if (!normalizedPassword) {
    return { ok: false, code: "password_required", message: t("auth_password_required", {}, language) };
  }

  const user = ensureDemoUsers().find(
    (item) => item.account.toLowerCase() === normalizedAccount
  );

  if (!user) {
    return { ok: false, code: "account_not_found", message: t("auth_account_not_found", {}, language) };
  }

  if (user.password !== normalizedPassword) {
    return {
      ok: false,
      code: "password_incorrect",
      message: t("auth_password_incorrect", {}, language),
    };
  }

  setCurrentUser(user);
  return { ok: true, user: sanitizeUser(user) };
}

export function getRoleLabel(role, language = getSystemLanguage()) {
  return role === "admin" ? t("role_admin", {}, language) : t("role_member", {}, language);
}

export function requireAuth() {
  ensureDemoUsers();
  const currentUser = getCurrentUser();
  if (!currentUser) {
    window.location.replace("login.html");
    return null;
  }
  return currentUser;
}

export function requireAdmin() {
  const currentUser = requireAuth();
  if (!currentUser) {
    return null;
  }

  if (currentUser.role !== "admin") {
    window.location.replace("home.html");
    return null;
  }

  return currentUser;
}
