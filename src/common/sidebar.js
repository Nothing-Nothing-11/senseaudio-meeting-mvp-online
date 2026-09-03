// 共享侧栏渲染：所有页面复用，动态渲染侧栏计数和用户卡
import { getMeetingsByUser, isArchivedMeetingStatus } from "../storage/meeting-store.js";
import { getVoiceprintsByUser } from "../storage/voiceprint-store.js";
import { getTermStats } from "../storage/terms-store.js";
import { getSystemLanguage } from "../i18n/locale-store.js";

/**
 * 动态渲染侧栏导航计数（会议数、声纹数、术语数）
 * @param {Object} currentUser - 当前登录用户
 */
export function renderSidebarCounts(currentUser) {
  if (!currentUser?.id) return;

  const navCounts = document.querySelectorAll(".nav-count");

  // 会议数
  const allFinished = getMeetingsByUser(currentUser.id).filter(
    (m) => isArchivedMeetingStatus(m.status),
  );
  if (navCounts[0]) navCounts[0].textContent = String(allFinished.length);

  // 声纹数（异步）
  getVoiceprintsByUser(currentUser.id)
    .then((vps) => {
      if (navCounts[1]) navCounts[1].textContent = String(vps.length);
    })
    .catch(() => {});

  // 术语数
  try {
    const termStats = getTermStats(currentUser);
    if (navCounts[2]) navCounts[2].textContent = String(termStats.totalEntries);
  } catch {
    // ignore
  }
}

/**
 * 动态渲染侧栏底部用户卡
 * @param {Object} currentUser - 当前登录用户
 */
export function renderSidebarUserCard(currentUser) {
  if (!currentUser) return;

  const language = getSystemLanguage();
  const userAvatar = document.querySelector(".sidebar .user-avatar, .sidebar-bottom .user-avatar");
  const userName = document.querySelector(".sidebar .user-name, .sidebar-bottom .user-name");
  const userPlan = document.querySelector(".sidebar .user-plan, .sidebar-bottom .user-plan");

  if (userAvatar) {
    userAvatar.textContent = currentUser.avatar || currentUser.name?.slice(0, 1) || "?";
  }
  if (userName) {
    userName.textContent = currentUser.name || "";
  }
  if (userPlan) {
    const roleLabel =
      currentUser.role === "admin"
        ? language === "ja"
          ? "管理者"
          : language === "en"
            ? "Admin"
            : "管理员"
        : language === "ja"
          ? "メンバー"
          : language === "en"
            ? "Member"
            : "成员";
    userPlan.textContent = `${roleLabel} · ${currentUser.company || ""}`;
  }
}
