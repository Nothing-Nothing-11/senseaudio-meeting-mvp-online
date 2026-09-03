import {
  MEETING_STATUSES,
  createMeetingForCurrentUser,
  deleteFinishedMeetingById,
  getMeetingsByUser,
  getOngoingMeetingByUser,
  isArchivedMeetingStatus,
  toggleMeetingStarred,
} from "../storage/meeting-store.js";
import { getOrgMembersByCompany } from "../storage/org-member-store.js?v=20260728-brand-refresh";
import { getVoiceprintsByUser } from "../storage/voiceprint-store.js";
import { getTermStats } from "../storage/terms-store.js";
import {
  formatDateTime,
  getSystemLanguage,
  onSystemLanguageChange,
  setSystemLanguage,
} from "../i18n/locale-store.js";
import { t } from "../i18n/messages.js";
import {
  LANGUAGE_LABELS,
  renderTargetLanguageOptions,
} from "../i18n/translation-languages.js?v=20260709-langs";

const MEETING_MEMBER_ROLE_PRIORITY = {
  owner: 0,
  admin: 1,
  member: 2,
};

function navigateToMeeting(meetingId, mode = "live") {
  const targetUrl = new URL("./index.html", window.location.href);
  targetUrl.searchParams.set("meetingId", meetingId);
  targetUrl.searchParams.set("mode", mode);
  window.location.href = targetUrl.toString();
}

function getLanguageLabel(code) {
  const language = getSystemLanguage();
  return LANGUAGE_LABELS[code]?.[language] || code || t("common_not_set", {}, language);
}

function isMeetingTranslationEnabled(meeting) {
  return meeting?.translationEnabled !== false;
}

function formatDuration(startedAt) {
  const elapsedMs = Math.max(0, Date.now() - new Date(startedAt).getTime());
  const totalMinutes = Math.floor(elapsedMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  }
  return `${totalMinutes}m`;
}

function formatMinutesDuration(totalSeconds) {
  const safeSeconds = Math.max(0, Number(totalSeconds) || 0);
  const totalMinutes = Math.max(1, Math.round(safeSeconds / 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  }
  return `${totalMinutes}m`;
}

function escapeHtml(text) {
  return String(text || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getMeetingParticipantSecondaryText(member) {
  return [member?.title, member?.department, member?.email].filter(Boolean).join(" · ");
}

function getMeetingParticipantDisplayText(member) {
  const secondary = [member?.title, member?.department].filter(Boolean).join(" · ");
  return secondary ? `${member.name} · ${secondary}` : member.name;
}

function buildMeetingParticipant(member) {
  return {
    memberId: member.id,
    source: "org_member",
    companyKey: member.companyKey,
    name: member.name,
    title: member.title || "",
    department: member.department || "",
    email: member.email || "",
    avatar: member.avatarText || member.name.trim().slice(0, 1) || "未",
    color: member.avatarColor || "var(--text-tertiary)",
    role: member.title || member.department || "",
  };
}

function sortMeetingCandidateMembers(members) {
  return [...members].sort((left, right) => {
    const roleOrder =
      (MEETING_MEMBER_ROLE_PRIORITY[left.role] ?? MEETING_MEMBER_ROLE_PRIORITY.member) -
      (MEETING_MEMBER_ROLE_PRIORITY[right.role] ?? MEETING_MEMBER_ROLE_PRIORITY.member);
    if (roleOrder !== 0) {
      return roleOrder;
    }
    const createdDiff = new Date(right.createdAt || right.joinedAt || 0).getTime() -
      new Date(left.createdAt || left.joinedAt || 0).getTime();
    if (createdDiff !== 0) {
      return createdDiff;
    }
    return String(left.name || "").localeCompare(String(right.name || ""), "zh-Hans-CN");
  });
}

function buildLiveMeta(meeting) {
  const mainLanguage = getLanguageLabel(meeting.mainLanguage);
  const targetLanguage = getLanguageLabel(meeting.meetingTargetLanguage);
  const languagePair = !isMeetingTranslationEnabled(meeting)
    ? mainLanguage
    : meeting.mainLanguage && meeting.mainLanguage === meeting.meetingTargetLanguage
      ? mainLanguage
      : `${mainLanguage} ↔ ${targetLanguage}`;
  const participantCount = Array.isArray(meeting.participants) ? meeting.participants.length : 0;
  const language = getSystemLanguage();
  const liveDuration = meeting.startedAt ? formatDuration(meeting.startedAt) : null;

  const joinMeta = (statusText) => {
    if (language === "ja") {
      return `${languagePair} · ${participantCount} 名参加者 · ${statusText}`;
    }
    if (language === "en") {
      return `${languagePair} · ${participantCount} participants · ${statusText}`;
    }
    return `${languagePair} · ${participantCount} 位参会者 · ${statusText}`;
  };

  if (meeting.status === MEETING_STATUSES.DRAFT) {
    return joinMeta(language === "ja" ? "開始待ち" : language === "en" ? "Ready to start" : "待开始");
  }
  if (meeting.status === MEETING_STATUSES.STARTING) {
    return joinMeta(language === "ja" ? "起動中" : language === "en" ? "Starting" : "正在启动");
  }
  if (meeting.status === MEETING_STATUSES.ENDING) {
    return joinMeta(language === "ja" ? "終了処理中" : language === "en" ? "Ending" : "正在结束");
  }
  if (meeting.status === MEETING_STATUSES.SUMMARIZING) {
    return joinMeta(language === "ja" ? "サマリー生成中" : language === "en" ? "Generating summary" : "正在生成总结");
  }
  if (meeting.status === MEETING_STATUSES.ARCHIVABLE) {
    return joinMeta(language === "ja" ? "アーカイブ待ち" : language === "en" ? "Ready to archive" : "待归档");
  }
  if (meeting.status === MEETING_STATUSES.ARCHIVABLE_NO_SUMMARY) {
    return joinMeta(
      language === "ja"
        ? "サマリー失敗・アーカイブ待ち"
        : language === "en"
          ? "Summary failed, archive pending"
          : "总结失败，待归档"
    );
  }
  if (meeting.status === MEETING_STATUSES.RECOVERABLE) {
    return joinMeta(language === "ja" ? "復元可能" : language === "en" ? "Recoverable" : "可恢复");
  }

  if (language === "ja") {
    return `${languagePair} · ${participantCount} 名参加者 · 開始から ${liveDuration || "0m"}`;
  }
  if (language === "en") {
    return `${languagePair} · ${participantCount} participants · Live for ${liveDuration || "0m"}`;
  }
  return `${languagePair} · ${participantCount} 位参会者 · 已进行 ${liveDuration || "0m"}`;
}

function getOngoingBannerTitle(meeting) {
  const language = getSystemLanguage();
  if (meeting.status === MEETING_STATUSES.RECOVERABLE) {
    return language === "ja"
      ? `復元可能な会議 · ${meeting.title}`
      : language === "en"
        ? `Recoverable Meeting · ${meeting.title}`
        : `可恢复会议 · ${meeting.title}`;
  }
  if (
    meeting.status === MEETING_STATUSES.ARCHIVABLE ||
    meeting.status === MEETING_STATUSES.ARCHIVABLE_NO_SUMMARY
  ) {
    return language === "ja"
      ? `アーカイブ待ち会議 · ${meeting.title}`
      : language === "en"
        ? `Meeting Ready To Archive · ${meeting.title}`
        : `待归档会议 · ${meeting.title}`;
  }
  return meeting.title;
}

function getOngoingBannerActionLabel(meeting) {
  const language = getSystemLanguage();
  if (
    meeting.status === MEETING_STATUSES.ARCHIVABLE ||
    meeting.status === MEETING_STATUSES.ARCHIVABLE_NO_SUMMARY
  ) {
    return language === "ja" ? "アーカイブへ" : language === "en" ? "Archive Meeting" : "进入归档";
  }
  if (meeting.status === MEETING_STATUSES.RECOVERABLE) {
    return language === "ja" ? "復元会議" : language === "en" ? "Resume Meeting" : "恢复会议";
  }
  return language === "ja" ? "会議に戻る" : language === "en" ? "Back To Meeting" : "回到会议";
}

function buildHistoryMeta(meeting) {
  const startedAt = meeting.startedAt ? new Date(meeting.startedAt) : null;
  const startedLabel = startedAt
    ? formatDateTime(
        startedAt,
        {
          month: "numeric",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        },
        getSystemLanguage()
      )
    : getSystemLanguage() === "ja"
      ? "時刻未記録"
      : getSystemLanguage() === "en"
        ? "Time not recorded"
        : "时间未记录";
  return `${startedLabel} · ${formatMinutesDuration(meeting.durationSeconds)}`;
}

function buildHistoryTags(meeting) {
  const tags = [];
  if (meeting.mainLanguage) {
    tags.push({ label: getLanguageLabel(meeting.mainLanguage), className: languageTagClass(meeting.mainLanguage) });
  }
  if (
    isMeetingTranslationEnabled(meeting) &&
    meeting.meetingTargetLanguage &&
    meeting.meetingTargetLanguage !== meeting.mainLanguage
  ) {
    tags.push({
      label: getLanguageLabel(meeting.meetingTargetLanguage),
      className: languageTagClass(meeting.meetingTargetLanguage),
    });
  }
  if (meeting.summaryStatus === "ready") {
    tags.push({
      label:
        getSystemLanguage() === "ja"
          ? "AI サマリー"
          : getSystemLanguage() === "en"
            ? "AI Summary"
            : "AI 总结",
      className: "",
    });
  }
  return tags.slice(0, 3);
}

function languageTagClass(code) {
  if (code === "zh") return "lang-cn";
  if (code === "ja" || code === "jp") return "lang-jp";
  if (code === "en") return "lang-en";
  return "";
}

function renderSpeakerDots(participants) {
  const safeParticipants = Array.isArray(participants) ? participants : [];
  const visibleParticipants = safeParticipants.slice(0, 4);
  const moreCount = safeParticipants.length - visibleParticipants.length;
  const dots = visibleParticipants
    .map(
      (participant) =>
        `<div class="speaker-dot" style="background:${participant.color || "var(--text-tertiary)"}">${escapeHtml(
          participant.avatar || participant.name?.slice(0, 1) || "未"
        )}</div>`
    )
    .join("");

  if (moreCount > 0) {
    return `${dots}<div class="speaker-dot more-count">+${moreCount}</div>`;
  }

  return dots || '<div class="speaker-dot more-count">0</div>';
}

function buildHistorySnippet(meeting) {
  const summarySnippet = meeting?.summary?.aiSummary?.trim?.();
  if (summarySnippet) {
    return summarySnippet;
  }

  const archivedSnippet = meeting?.coverSnippet?.trim?.();
  if (archivedSnippet) {
    return archivedSnippet;
  }

  return "会议已归档，可点击查看完整内容。";
}

function getArchivedSnippetFallback() {
  const language = getSystemLanguage();
  if (language === "ja") {
    return "会議はアーカイブ済みです。クリックして完全な内容を確認できます。";
  }
  if (language === "en") {
    return "This meeting has been archived. Click to open the full content.";
  }
  return "会议已归档，可点击查看完整内容。";
}

function closeHistoryActionMenus(scope = document) {
  scope.querySelectorAll('[data-role="history-card-actions"].is-open').forEach((actions) => {
    actions.classList.remove("is-open");
    const card = actions.closest('[data-role="real-history-card"]');
    if (card) {
      card.removeAttribute("data-menu-open");
    }
    const trigger = actions.querySelector('[data-action="toggle-history-menu"]');
    if (trigger) {
      trigger.setAttribute("aria-expanded", "false");
    }
  });
}

function renderHistoryMeetingCard(meeting) {
  const snippet = buildHistorySnippet(meeting);
  const tags = buildHistoryTags(meeting)
    .map(
      (tag) => `<span class="tag ${tag.className}">${escapeHtml(tag.label)}</span>`
    )
    .join("");

  return `
    <div class="meeting-card" data-role="real-history-card" data-meeting-id="${meeting.id}">
      <div class="card-actions" data-role="history-card-actions">
        <button class="card-more" type="button" data-action="toggle-history-menu" data-meeting-id="${meeting.id}" aria-label="更多操作" aria-haspopup="true" aria-expanded="false">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>
        </button>
        <div class="card-menu" data-role="history-card-menu">
          <button class="card-menu-item danger" type="button" data-action="delete-history-meeting" data-meeting-id="${meeting.id}">
            ${getSystemLanguage() === "ja" ? "履歴会議を削除" : getSystemLanguage() === "en" ? "Delete Replay" : "删除历史会议"}
          </button>
        </div>
        <button class="star-btn ${meeting.isStarred ? "starred" : ""}" type="button" data-action="toggle-history-star" data-meeting-id="${meeting.id}" aria-label="${
          meeting.isStarred
            ? getSystemLanguage() === "ja"
              ? "お気に入り解除"
              : getSystemLanguage() === "en"
                ? "Remove Star"
                : "取消收藏"
            : getSystemLanguage() === "ja"
              ? "お気に入りに追加"
              : getSystemLanguage() === "en"
                ? "Star Meeting"
                : "收藏会议"
        }">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="${meeting.isStarred ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2"><polygon points="12 2 15 8.5 22 9.3 17 14 18.2 21 12 17.8 5.8 21 7 14 2 9.3 9 8.5 12 2"/></svg>
        </button>
      </div>
      <div class="card-head">
        <div class="card-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg></div>
        <div class="card-title-area">
          <div class="card-title">${escapeHtml(meeting.title)}</div>
          <div class="card-meta">
            <span>${escapeHtml(buildHistoryMeta(meeting))}</span>
          </div>
        </div>
      </div>
      <div class="card-snippet">
        <div class="card-snippet-text">${escapeHtml(snippet)}</div>
      </div>
      <div class="card-tags">${tags}</div>
      <div class="card-foot">
        <div class="speakers">${renderSpeakerDots(meeting.participants)}</div>
        <div class="card-stats">
          <span class="stat-item">${meeting.participants?.length || 0} 人</span>
          <span class="stat-item">${
            meeting.summaryStatus === "ready"
              ? getSystemLanguage() === "ja"
                ? "サマリー完了"
                : getSystemLanguage() === "en"
                  ? "Summary ready"
                  : "总结完成"
              : getSystemLanguage() === "ja"
                ? "アーカイブ済み"
                : getSystemLanguage() === "en"
                  ? "Archived"
                  : "已归档"
          }</span>
        </div>
      </div>
    </div>
  `;
}

function createModalController(currentUser) {
  const modal = document.querySelector('[data-role="meeting-create-modal"]');
  if (!modal) {
    return null;
  }

  const titleInput = modal.querySelector('[data-field="meeting-title"]');
  const mainLanguageSelect = modal.querySelector('[data-field="meeting-main-language"]');
  const targetLanguageSelect = modal.querySelector('[data-field="meeting-target-language"]');
  const translationToggle = modal.querySelector('[data-role="meeting-translation-toggle"]');
  const translationNote = modal.querySelector('[data-role="meeting-translation-note"]');
  renderTargetLanguageOptions(targetLanguageSelect);
  const participantSearchInput = modal.querySelector('[data-field="meeting-participant-search"]');
  const participantOptionsNode = modal.querySelector('[data-role="meeting-participant-options"]');
  const participantHintNode = modal.querySelector('[data-role="meeting-participant-hint"]');
  const selectedParticipantsNode = modal.querySelector('[data-role="selected-participants"]');
  const errorNode = modal.querySelector('[data-role="meeting-create-error"]');
  const addParticipantButton = modal.querySelector('[data-action="add-participant"]');
  const cancelButton = modal.querySelector('[data-action="cancel-meeting-create"]');
  const confirmButton = modal.querySelector('[data-action="confirm-meeting-create"]');

  let allMembers = [];
  let selectedParticipants = [];
  let selectedCandidateMemberId = null;
  let isParticipantDropdownOpen = false;
  let translationEnabled = true;

  function getModalTexts() {
    const language = getSystemLanguage();
    if (language === "ja") {
      return {
        selectedEmpty:
          "少なくとも 1 名の参加者を追加してください。参加者は組織メンバーから検索して追加できます。",
        searchPlaceholder: "氏名、役職、部署、メールで検索",
        searchHint: "まず候補を検索して選択し、その後右側のボタンで下のリストに追加します。",
        searchEmpty: "追加可能なアクティブメンバーがいません。",
        searchNoMatch: "検索条件に一致するメンバーが見つかりません。",
        selectParticipantError: "検索結果から追加したい参加者を先に選択してください。",
        titleRequired: "会議タイトルを入力してください。",
        participantRequired: "少なくとも 1 名の参加者を追加してください。",
        createFailed: "会議の作成に失敗しました。後でもう一度お試しください。",
        removeLabel: (name) => `${name} を削除`,
        translationNote: "オフにすると ASR 文字起こしのみ保持し、会議中は翻訳モデルを呼び出しません。",
        translationOn: "オン",
        translationOff: "オフ",
      };
    }
    if (language === "en") {
      return {
        selectedEmpty:
          "Add at least one participant. Search and add people from the real organization member list.",
        searchPlaceholder: "Search by name, title, department, or email",
        searchHint: "Search and select one candidate first, then use the button on the right to add them below.",
        searchEmpty: "No active members are available to add.",
        searchNoMatch: "No members match the current search.",
        selectParticipantError: "Please select a participant from the search results first.",
        titleRequired: "Please enter a meeting title.",
        participantRequired: "Please add at least one participant.",
        createFailed: "Failed to create the meeting. Please try again later.",
        removeLabel: (name) => `Remove ${name}`,
        translationNote: "When off, the meeting keeps ASR transcription only and skips all translation model calls.",
        translationOn: "On",
        translationOff: "Off",
      };
    }
    return {
      selectedEmpty: "请至少添加 1 位参会人。可以从真实组织成员中搜索后加入本场会议。",
      searchPlaceholder: "搜索姓名、职位、部门或邮箱",
      searchHint: "先搜索并点选一位参会人，再点击右侧按钮加入下方列表。",
      searchEmpty: "当前没有可添加的活跃成员。",
      searchNoMatch: "没有找到符合条件的成员。",
      selectParticipantError: "请先从搜索结果中点选一位参会人。",
      titleRequired: "请输入会议标题。",
      participantRequired: "请至少添加 1 位参会人。",
      createFailed: "创建会议失败，请稍后重试。",
      removeLabel: (name) => `移除 ${name}`,
      translationNote: "关闭后仅保留 ASR 转写，进入会议后不再触发翻译模型调用。",
      translationOn: "开",
      translationOff: "关",
    };
  }

  function syncTranslationToggle() {
    if (!translationToggle) {
      return;
    }

    const texts = getModalTexts();
    translationToggle.dataset.state = translationEnabled ? "on" : "off";
    translationToggle.querySelectorAll('[data-action="set-translation-enabled"]').forEach((button) => {
      const isActive = button.dataset.value === (translationEnabled ? "on" : "off");
      button.classList.toggle("active", isActive);
      button.setAttribute("aria-pressed", String(isActive));
      button.textContent = button.dataset.value === "on" ? texts.translationOn : texts.translationOff;
    });
    if (translationNote) {
      translationNote.textContent = texts.translationNote;
    }
  }

  function syncParticipantHint() {
    if (participantHintNode) {
      participantHintNode.textContent = getModalTexts().searchHint;
    }
  }

  function closeParticipantDropdown() {
    isParticipantDropdownOpen = false;
    if (participantOptionsNode) {
      participantOptionsNode.hidden = true;
    }
  }

  function getAvailableMembers() {
    const selectedIds = new Set(selectedParticipants.map((participant) => participant.memberId));
    return allMembers.filter((member) => !selectedIds.has(member.id));
  }

  function getFilteredMembers() {
    const keyword = String(participantSearchInput?.value || "")
      .trim()
      .toLowerCase();
    const availableMembers = getAvailableMembers();
    if (!keyword) {
      return availableMembers;
    }
    return availableMembers.filter((member) =>
      [member.name, member.title, member.department, member.email]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(keyword))
    );
  }

  function renderParticipantOptions() {
    if (!participantOptionsNode) {
      return;
    }

    const texts = getModalTexts();
    const filteredMembers = getFilteredMembers();

    if (!isParticipantDropdownOpen) {
      participantOptionsNode.hidden = true;
      return;
    }

    if (!filteredMembers.length) {
      participantOptionsNode.innerHTML = `<div class="meeting-participant-empty">${
        getAvailableMembers().length ? texts.searchNoMatch : texts.searchEmpty
      }</div>`;
      participantOptionsNode.hidden = false;
      return;
    }

    participantOptionsNode.innerHTML = filteredMembers
      .slice(0, 8)
      .map((member) => {
        const isActive = selectedCandidateMemberId === member.id;
        return `
          <button
            type="button"
            class="meeting-participant-option${isActive ? " active" : ""}"
            data-action="select-participant-candidate"
            data-member-id="${escapeHtml(member.id)}"
          >
            <span class="meeting-participant-swatch" style="background:${escapeHtml(member.avatarColor)}"></span>
            <span class="meeting-participant-meta">
              <span class="meeting-participant-name">${escapeHtml(member.name)}</span>
              <span class="meeting-participant-sub">${escapeHtml(
                getMeetingParticipantSecondaryText(member) || member.department || member.email || ""
              )}</span>
            </span>
          </button>
        `;
      })
      .join("");
    participantOptionsNode.hidden = false;
  }

  function renderSelectedParticipants() {
    if (!selectedParticipantsNode) {
      return;
    }

    if (!selectedParticipants.length) {
      selectedParticipantsNode.innerHTML = `<span class="meeting-selected-empty">${getModalTexts().selectedEmpty}</span>`;
      return;
    }

    selectedParticipantsNode.innerHTML = selectedParticipants
      .map((participant) => {
        return `
          <span class="meeting-chip">
            <span class="meeting-participant-swatch" style="background:${escapeHtml(participant.color)}"></span>
            ${escapeHtml(getMeetingParticipantDisplayText(participant))}
            <button
              type="button"
              data-action="remove-participant"
              data-member-id="${escapeHtml(participant.memberId)}"
              aria-label="${escapeHtml(getModalTexts().removeLabel(participant.name))}"
            >×</button>
          </span>
        `;
      })
      .join("");
  }

  function loadMembers() {
    allMembers = sortMeetingCandidateMembers(
      getOrgMembersByCompany(currentUser?.company || "").filter((member) => member.status === "active")
    );
  }

  function syncDefaultParticipants() {
    selectedParticipants = [];
    const matched =
      currentUser?.role === "admin"
        ? allMembers.find((member) => member.role === "admin")
        : allMembers.find((member) => member.role === "member");
    if (matched) {
      selectedParticipants.push(buildMeetingParticipant(matched));
    }
    selectedCandidateMemberId = null;
    if (participantSearchInput) {
      participantSearchInput.value = "";
    }
    closeParticipantDropdown();
    renderSelectedParticipants();
    renderParticipantOptions();
  }

  function clearError() {
    if (errorNode) {
      errorNode.textContent = "";
    }
  }

  function setError(message) {
    if (errorNode) {
      errorNode.textContent = message;
    }
  }

  function open() {
    modal.hidden = false;
    clearError();
    translationEnabled = true;
    if (confirmButton) {
      confirmButton.dataset.loading = "false";
      confirmButton.disabled = false;
    }
    loadMembers();
    if (titleInput) {
      titleInput.value = "";
      window.setTimeout(() => titleInput.focus(), 0);
    }
    if (mainLanguageSelect) {
      mainLanguageSelect.value = getSystemLanguage();
    }
    if (targetLanguageSelect) {
      targetLanguageSelect.value = "en";
    }
    syncTranslationToggle();
    syncParticipantHint();
    if (participantSearchInput) {
      participantSearchInput.value = "";
      participantSearchInput.placeholder = getModalTexts().searchPlaceholder;
    }
    syncDefaultParticipants();
  }

  function close() {
    modal.hidden = true;
    closeParticipantDropdown();
    clearError();
  }

  function addSelectedParticipant() {
    if (!selectedCandidateMemberId) {
      setError(getModalTexts().selectParticipantError);
      return;
    }

    const candidate = allMembers.find((member) => member.id === selectedCandidateMemberId);
    if (!candidate) {
      setError(getModalTexts().selectParticipantError);
      return;
    }

    if (!selectedParticipants.some((participant) => participant.memberId === candidate.id)) {
      selectedParticipants.push(buildMeetingParticipant(candidate));
      renderSelectedParticipants();
    }
    selectedCandidateMemberId = null;
    if (participantSearchInput) {
      participantSearchInput.value = "";
    }
    renderParticipantOptions();
    closeParticipantDropdown();
    clearError();
  }

  function removeParticipant(memberId) {
    selectedParticipants = selectedParticipants.filter((participant) => participant.memberId !== memberId);
    renderSelectedParticipants();
    renderParticipantOptions();
  }

  function selectCandidate(memberId) {
    const candidate = getFilteredMembers().find((member) => member.id === memberId) || allMembers.find((member) => member.id === memberId);
    if (!candidate) {
      return;
    }
    selectedCandidateMemberId = candidate.id;
    if (participantSearchInput) {
      participantSearchInput.value = getMeetingParticipantDisplayText(candidate);
    }
    renderParticipantOptions();
    closeParticipantDropdown();
  }

  function refreshLanguage() {
    if (participantSearchInput) {
      participantSearchInput.placeholder = getModalTexts().searchPlaceholder;
    }
    syncTranslationToggle();
    syncParticipantHint();
    renderSelectedParticipants();
    renderParticipantOptions();
  }

  function getPayload() {
    const title = titleInput?.value?.trim() || "";
    if (!title) {
      setError(getModalTexts().titleRequired);
      return null;
    }

    if (!selectedParticipants.length) {
      setError(getModalTexts().participantRequired);
      return null;
    }

    return {
      title,
      mainLanguage: mainLanguageSelect?.value || "zh",
      meetingTargetLanguage: targetLanguageSelect?.value || "en",
      translationEnabled,
      participants: selectedParticipants.map((participant) => ({ ...participant })),
    };
  }

  addParticipantButton?.addEventListener("click", addSelectedParticipant);
  cancelButton?.addEventListener("click", close);
  participantSearchInput?.addEventListener("focus", () => {
    isParticipantDropdownOpen = true;
    renderParticipantOptions();
  });
  participantSearchInput?.addEventListener("input", () => {
    selectedCandidateMemberId = null;
    isParticipantDropdownOpen = true;
    renderParticipantOptions();
    clearError();
  });
  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      close();
    }
  });
  modal.addEventListener("click", (event) => {
    const translationButton = event.target.closest('[data-action="set-translation-enabled"]');
    if (translationButton) {
      translationEnabled = translationButton.dataset.value !== "off";
      syncTranslationToggle();
      return;
    }
    const candidateButton = event.target.closest('[data-action="select-participant-candidate"]');
    if (candidateButton) {
      selectCandidate(candidateButton.dataset.memberId || "");
      return;
    }
    const removeButton = event.target.closest('[data-action="remove-participant"]');
    if (removeButton) {
      removeParticipant(removeButton.dataset.memberId || "");
    }
  });
  document.addEventListener("click", (event) => {
    if (!modal.hidden && !event.target.closest(".meeting-participant-picker")) {
      closeParticipantDropdown();
    }
  });
  confirmButton?.addEventListener("click", () => {
    if (confirmButton.dataset.loading === "true") {
      return;
    }

    const payload = getPayload();
    if (!payload) {
      return;
    }

    confirmButton.dataset.loading = "true";
    confirmButton.disabled = true;

    try {
      const meeting = createMeetingForCurrentUser(payload);
      navigateToMeeting(meeting.id, "live");
    } catch (error) {
      confirmButton.dataset.loading = "false";
      confirmButton.disabled = false;
      setError(error instanceof Error ? error.message : getModalTexts().createFailed);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modal.hidden) {
      close();
    }
  });

  return { open, refreshLanguage };
}

function bindStartMeetingTrigger(button, modalController) {
  if (!button || button.dataset.bound === "true") {
    return;
  }

  button.dataset.bound = "true";
  button.addEventListener("click", () => {
    const ongoingMeeting = modalController?.currentUser?.id
      ? getOngoingMeetingByUser(modalController.currentUser.id)
      : null;
    if (ongoingMeeting) {
      navigateToMeeting(ongoingMeeting.id, "live");
      return;
    }
    modalController?.open();
  });
}

function getHomePrimaryMeetingActionLabel(currentUser) {
  const hasOngoingMeeting = Boolean(currentUser?.id && getOngoingMeetingByUser(currentUser.id));
  const language = getSystemLanguage();
  if (hasOngoingMeeting) {
    return language === "ja" ? "現在の会議に戻る" : language === "en" ? "Back To Current Meeting" : "回到当前会议";
  }
  return language === "ja" ? "新しい会議を開始" : language === "en" ? "Start New Meeting" : "开始新会议";
}

function renderPrimaryMeetingEntry(currentUser) {
  const welcomeBtn = document.querySelector(".welcome .btn.primary");
  if (!welcomeBtn) {
    return;
  }
  welcomeBtn.lastChild.textContent = getHomePrimaryMeetingActionLabel(currentUser);
}

function handleInitialHomeAction(modalController, currentUser) {
  const currentUrl = new URL(window.location.href);
  if (currentUrl.searchParams.get("action") !== "create-meeting") {
    return;
  }

  currentUrl.searchParams.delete("action");
  window.history.replaceState({}, "", currentUrl.toString());

  const ongoingMeeting = currentUser?.id ? getOngoingMeetingByUser(currentUser.id) : null;
  if (ongoingMeeting) {
    navigateToMeeting(ongoingMeeting.id, "live");
    return;
  }

  modalController?.open();
}

function bindResumeMeetingTrigger(node, meetingId) {
  if (!node || !meetingId) {
    return;
  }

  // 会议 id 每次渲染都可能变，存到 dataset 上由处理器实时读取，避免重复绑定后停在旧 id
  node.dataset.resumeMeetingId = meetingId;
  if (node.dataset.resumeBound === "true") {
    return;
  }

  node.dataset.resumeBound = "true";
  node.addEventListener("click", (event) => {
    if (node.matches("button")) {
      event.stopPropagation();
    }
    navigateToMeeting(node.dataset.resumeMeetingId, "live");
  });
}

function renderOngoingMeetingBanner(currentUser) {
  const liveBanner = document.querySelector('[data-role="ongoing-meeting-banner"]');
  if (!liveBanner || !currentUser?.id) {
    return;
  }

  const ongoingMeeting = getOngoingMeetingByUser(currentUser.id);
  if (!ongoingMeeting) {
    liveBanner.hidden = true;
    return;
  }

  const titleNode = liveBanner.querySelector('[data-field="ongoing-title"]');
  const metaNode = liveBanner.querySelector('[data-field="ongoing-meta"]');
  const resumeButton = liveBanner.querySelector('[data-action="resume-meeting"]');

  if (titleNode) {
    titleNode.textContent = getOngoingBannerTitle(ongoingMeeting);
  }

  if (metaNode) {
    metaNode.textContent = buildLiveMeta(ongoingMeeting);
  }

  if (resumeButton) {
    resumeButton.textContent = getOngoingBannerActionLabel(ongoingMeeting);
  }

  liveBanner.hidden = false;
  bindResumeMeetingTrigger(liveBanner, ongoingMeeting.id);
  bindResumeMeetingTrigger(resumeButton, ongoingMeeting.id);
}

function renderHistoryMeetings(currentUser) {
  const section = document.querySelector('[data-role="real-history-section"]');
  const grid = document.querySelector('[data-role="real-history-grid"]');
  const emptyNode = document.querySelector('[data-role="history-empty"]');
  const divider = document.querySelector('[data-role="history-divider"]');
  if (!section || !grid || !currentUser?.id) {
    return;
  }

  const allFinished = getMeetingsByUser(currentUser.id).filter((meeting) => isArchivedMeetingStatus(meeting.status));

  // ---- search filter ----
  const searchInput = document.querySelector('.search-box input');
  const keyword = (searchInput?.value || "").trim().toLowerCase();

  // ---- chip filter ----
  const activeChip = document.querySelector('[data-role="history-filter-row"] .chip.active');
  const filter = activeChip?.dataset.filter || "all";

  let filtered = allFinished;

  // apply time/star filter
  const now = new Date();
  if (filter === "week") {
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    filtered = filtered.filter((m) => new Date(m.startedAt || m.lastVisitedAt) >= weekAgo);
  } else if (filter === "month") {
    const monthAgo = new Date(now);
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    filtered = filtered.filter((m) => new Date(m.startedAt || m.lastVisitedAt) >= monthAgo);
  } else if (filter === "starred") {
    filtered = filtered.filter((m) => m.isStarred);
  }

  // apply search keyword
  if (keyword) {
    filtered = filtered.filter((meeting) => {
      const title = (meeting.title || "").toLowerCase();
      const snippet = (meeting.coverSnippet || "").toLowerCase();
      const participants = (meeting.participants || []).map((p) => p.name || "").join(" ").toLowerCase();
      return title.includes(keyword) || snippet.includes(keyword) || participants.includes(keyword);
    });
  }

  if (!allFinished.length) {
    section.hidden = true;
    grid.innerHTML = "";
    if (emptyNode) {
      const language = getSystemLanguage();
      emptyNode.textContent = language === "ja"
        ? "まだアーカイブされた会議はありません。「新しい会議を開始」をクリックして最初の会議を作成しましょう。"
        : language === "en"
          ? "No archived meetings yet. Click \"Start New Meeting\" to create your first one."
          : "暂无历史会议，点击上方\u201c开始新会议\u201d创建第一场。";
      emptyNode.hidden = false;
    }
    if (divider) divider.hidden = true;
    return;
  }

  if (!filtered.length) {
    section.hidden = false;
    grid.innerHTML = "";
    if (emptyNode) {
      const language = getSystemLanguage();
      emptyNode.textContent = keyword
        ? (language === "ja" ? `「${keyword}」に一致する会議が見つかりません。` : language === "en" ? `No meetings match "${keyword}".` : `没有找到与"${keyword}"匹配的会议。`)
        : (language === "ja" ? "条件に一致する会議がありません。" : language === "en" ? "No meetings match the current filter." : "当前筛选条件下没有会议。");
      emptyNode.hidden = false;
    }
    if (divider) divider.hidden = true;
    return;
  }

  grid.innerHTML = filtered.map(renderHistoryMeetingCard).join("");
  section.hidden = false;
  if (emptyNode) emptyNode.hidden = true;
  if (divider) divider.hidden = false;
}

function renderHomeStats(currentUser) {
  if (!currentUser?.id) return;

  const allFinished = getMeetingsByUser(currentUser.id).filter((m) => isArchivedMeetingStatus(m.status));
  const language = getSystemLanguage();

  // ---- month count ----
  const now = new Date();
  const thisMonth = allFinished.filter((m) => {
    const d = new Date(m.startedAt || m.lastVisitedAt);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const lastMonth = allFinished.filter((m) => {
    const d = new Date(m.startedAt || m.lastVisitedAt);
    const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return d.getMonth() === lm.getMonth() && d.getFullYear() === lm.getFullYear();
  });

  const monthValueNode = document.querySelector('[data-role="stat-month-value"]');
  const monthTrendNode = document.querySelector('[data-role="stat-month-label"]');
  const monthTrend = document.querySelector('[data-role="stat-month-trend"]');
  if (monthValueNode) monthValueNode.textContent = String(thisMonth.length);
  if (monthTrendNode) {
    monthTrendNode.textContent = language === "ja" ? "今月の会議数" : language === "en" ? "Meetings this month" : "总会议数（本月）";
  }
  if (monthTrend) {
    if (lastMonth.length > 0) {
      const pct = Math.round(((thisMonth.length - lastMonth.length) / lastMonth.length) * 100);
      const arrow = pct >= 0 ? "↑" : "↓";
      monthTrend.textContent = `${arrow} ${pct >= 0 ? "+" : ""}${pct}%`;
      monthTrend.style.color = pct >= 0 ? "var(--success)" : "var(--danger)";
    } else {
      monthTrend.textContent = thisMonth.length > 0
        ? (language === "ja" ? "先月比 —" : language === "en" ? "vs last month —" : "较上月 —")
        : "";
    }
  }

  // ---- total duration ----
  const totalSeconds = allFinished.reduce((sum, m) => sum + (Number(m.durationSeconds) || 0), 0);
  const totalMinutes = Math.max(0, Math.round(totalSeconds / 60));
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;

  // this week duration
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekSeconds = allFinished
    .filter((m) => new Date(m.startedAt || m.lastVisitedAt) >= weekAgo)
    .reduce((sum, m) => sum + (Number(m.durationSeconds) || 0), 0);
  const weekMinutes = Math.max(0, Math.round(weekSeconds / 60));
  const weekHours = Math.floor(weekMinutes / 60);
  const weekMins = weekMinutes % 60;

  const durationValueNode = document.querySelector('[data-role="stat-duration-value"]');
  const durationLabelNode = document.querySelector('[data-role="stat-duration-label"]');
  const durationTrendNode = document.querySelector('[data-role="stat-duration-trend"]');
  if (durationValueNode) {
    if (hours > 0) {
      durationValueNode.innerHTML = `${hours}<span style="font-size:14px;font-weight:500;color:var(--text-secondary)">h ${String(mins).padStart(2, "0")}m</span>`;
    } else {
      durationValueNode.innerHTML = `${mins}<span style="font-size:14px;font-weight:500;color:var(--text-secondary)">m</span>`;
    }
  }
  if (durationLabelNode) {
    durationLabelNode.textContent = language === "ja" ? "累計録音時間" : language === "en" ? "Total recording time" : "累计录音时长";
  }
  if (durationTrendNode) {
    const weekLabel = weekHours > 0 ? `${weekHours}h ${weekMins}m` : `${weekMins}m`;
    durationTrendNode.textContent = allFinished.length
      ? (language === "ja" ? `↑ 今週 ${weekLabel}` : language === "en" ? `↑ This week ${weekLabel}` : `↑ 本周 ${weekLabel}`)
      : "";
  }

  // ---- language count ----
  const languageSet = new Set();
  allFinished.forEach((m) => {
    if (m.mainLanguage) languageSet.add(m.mainLanguage);
    if (m.meetingTargetLanguage && m.meetingTargetLanguage !== m.mainLanguage) {
      languageSet.add(m.meetingTargetLanguage);
    }
  });
  const langList = Array.from(languageSet);

  const langValueNode = document.querySelector('[data-role="stat-lang-value"]');
  const langLabelNode = document.querySelector('[data-role="stat-lang-label"]');
  const langDetailNode = document.querySelector('[data-role="stat-lang-detail"]');
  if (langValueNode) {
    const unit = language === "ja" ? " 種" : language === "en" ? " types" : " 种";
    langValueNode.innerHTML = `${langList.length}<span style="font-size:14px;font-weight:500;color:var(--text-secondary)">${unit}</span>`;
  }
  if (langLabelNode) {
    langLabelNode.textContent = language === "ja" ? "使用言語" : language === "en" ? "Languages used" : "使用语言";
  }
  if (langDetailNode) {
    langDetailNode.textContent = langList.map((code) => getLanguageLabel(code)).join(" · ");
  }
}

function renderSidebarCounts(currentUser) {
  // meetings count
  const allFinished = currentUser?.id
    ? getMeetingsByUser(currentUser.id).filter((m) => isArchivedMeetingStatus(m.status))
    : [];
  const navCounts = document.querySelectorAll(".nav-count");
  if (navCounts[0]) navCounts[0].textContent = String(allFinished.length);

  // voiceprint count (async)
  if (currentUser?.id) {
    getVoiceprintsByUser(currentUser.id).then((vps) => {
      if (navCounts[1]) navCounts[1].textContent = String(vps.length);
    }).catch(() => {});
  }

  // terms count
  try {
    const termStats = getTermStats(currentUser);
    if (navCounts[2]) navCounts[2].textContent = String(termStats.totalEntries);
  } catch {
    // ignore
  }
}

function renderSidebarUserCard(currentUser) {
  if (!currentUser) return;
  const userAvatar = document.querySelector(".user-avatar");
  const userName = document.querySelector(".user-name");
  const userPlan = document.querySelector(".user-plan");
  const language = getSystemLanguage();

  if (userAvatar) {
    userAvatar.textContent = currentUser.avatar || currentUser.name?.slice(0, 1) || "?";
  }
  if (userName) {
    userName.textContent = currentUser.name || "";
  }
  if (userPlan) {
    const roleLabel = currentUser.role === "admin"
      ? (language === "ja" ? "管理者" : language === "en" ? "Admin" : "管理员")
      : (language === "ja" ? "メンバー" : language === "en" ? "Member" : "成员");
    userPlan.textContent = `${roleLabel} · ${currentUser.company || ""}`;
  }
}

function bindSearchAndFilter(currentUser) {
  const searchInput = document.querySelector(".search-box input");
  if (searchInput && searchInput.dataset.bound !== "true") {
    searchInput.dataset.bound = "true";
    searchInput.addEventListener("input", () => {
      renderHistoryMeetings(currentUser);
    });
  }

  const filterRow = document.querySelector('[data-role="history-filter-row"]');
  if (filterRow && filterRow.dataset.bound !== "true") {
    filterRow.dataset.bound = "true";
    filterRow.addEventListener("click", (event) => {
      const chip = event.target.closest(".chip[data-filter]");
      if (!chip) return;
      filterRow.querySelectorAll(".chip").forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      renderHistoryMeetings(currentUser);
    });
  }
}

function renderWelcomeGreeting(currentUser) {
  const welcomeH1 = document.querySelector(".welcome h1");
  const welcomeSub = document.querySelector(".welcome-sub");
  const language = getSystemLanguage();
  const userName = currentUser?.name || "";

  if (welcomeH1 && userName) {
    const hour = new Date().getHours();
    let greeting;
    if (language === "ja") {
      greeting = hour < 12 ? "おはようございます" : hour < 18 ? "こんにちは" : "こんばんは";
      welcomeH1.textContent = `${greeting}、${userName} 👋`;
    } else if (language === "en") {
      greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
      welcomeH1.textContent = `${greeting}, ${userName} 👋`;
    } else {
      greeting = hour < 12 ? "上午好" : hour < 18 ? "下午好" : "晚上好";
      welcomeH1.textContent = `${greeting}，${userName} 👋`;
    }
  }

  if (welcomeSub && currentUser?.id) {
    const allFinished = getMeetingsByUser(currentUser.id).filter((m) => isArchivedMeetingStatus(m.status));
    const now = new Date();
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekCount = allFinished.filter((m) => new Date(m.startedAt || m.lastVisitedAt) >= weekAgo).length;

    const dateStr = formatDateTime(now, { year: "numeric", month: "long", day: "numeric", weekday: "long" }, language);
    if (language === "ja") {
      welcomeSub.textContent = `${dateStr} · 今週 ${weekCount} 件の会議を完了`;
    } else if (language === "en") {
      welcomeSub.textContent = `${dateStr} · ${weekCount} meetings completed this week`;
    } else {
      welcomeSub.textContent = `${dateStr} · 本周已完成 ${weekCount} 场会议`;
    }
  }
}

function bindHistoryInteractions(currentUser) {
  const section = document.querySelector('[data-role="real-history-section"]');
  if (!section || section.dataset.bound === "true") {
    return;
  }

  section.dataset.bound = "true";
  section.addEventListener("click", (event) => {
    const menuTrigger = event.target.closest('[data-action="toggle-history-menu"]');
    if (menuTrigger) {
      event.stopPropagation();
      const actions = menuTrigger.closest('[data-role="history-card-actions"]');
      if (!actions) {
        return;
      }
      const card = actions.closest('[data-role="real-history-card"]');
      const shouldOpen = !actions.classList.contains("is-open");
      closeHistoryActionMenus(section);
      actions.classList.toggle("is-open", shouldOpen);
      if (card) {
        if (shouldOpen) {
          card.setAttribute("data-menu-open", "true");
        } else {
          card.removeAttribute("data-menu-open");
        }
      }
      menuTrigger.setAttribute("aria-expanded", shouldOpen ? "true" : "false");
      return;
    }

    const deleteButton = event.target.closest('[data-action="delete-history-meeting"]');
    if (deleteButton) {
      event.stopPropagation();
      const meetingId = deleteButton.dataset.meetingId || "";
      closeHistoryActionMenus(section);
      if (!meetingId || !currentUser?.id) {
        return;
      }
      if (
        !window.confirm(
          getSystemLanguage() === "ja"
            ? "削除すると元に戻せません。この履歴会議を削除しますか？"
            : getSystemLanguage() === "en"
              ? "This cannot be undone. Delete this archived meeting?"
              : "删除后无法恢复，确认删除这条历史会议吗？"
        )
      ) {
        return;
      }
      try {
        deleteFinishedMeetingById(meetingId, currentUser.id);
        renderHistoryMeetings(currentUser);
        renderHomeStats(currentUser);
        renderWelcomeGreeting(currentUser);
        renderSidebarCounts(currentUser);
      } catch (error) {
        console.error(error);
      }
      return;
    }

    const starButton = event.target.closest('[data-action="toggle-history-star"]');
    if (starButton) {
      event.stopPropagation();
      const meetingId = starButton.dataset.meetingId || "";
      if (!meetingId) {
        return;
      }
      closeHistoryActionMenus(section);
      toggleMeetingStarred(meetingId);
      renderHistoryMeetings(currentUser);
      renderHomeStats(currentUser);
      renderWelcomeGreeting(currentUser);
      return;
    }

    const card = event.target.closest('[data-role="real-history-card"]');
    if (!card) {
      return;
    }

    const meetingId = card.dataset.meetingId || "";
    if (meetingId) {
      navigateToMeeting(meetingId, "replay");
    }
  });

  document.addEventListener("click", (event) => {
    if (event.target.closest('[data-role="history-card-actions"]')) {
      return;
    }
    closeHistoryActionMenus(section);
  });
}

export function initHomePage(currentUser) {
  const modalController = createModalController(currentUser);
  if (modalController) {
    modalController.currentUser = currentUser;
  }
  document
    .querySelectorAll('[data-action="start-meeting"]')
    .forEach((button) => bindStartMeetingTrigger(button, modalController));

  applyHomeStaticTranslations();
  renderSidebarUserCard(currentUser);
  renderSidebarCounts(currentUser);
  renderWelcomeGreeting(currentUser);
  renderOngoingMeetingBanner(currentUser);
  renderHomeStats(currentUser);
  renderHistoryMeetings(currentUser);
  bindSearchAndFilter(currentUser);
  bindHistoryInteractions(currentUser);
  renderPrimaryMeetingEntry(currentUser);
  handleInitialHomeAction(modalController, currentUser);
  onSystemLanguageChange(() => {
    applyHomeStaticTranslations();
    modalController?.refreshLanguage?.();
    renderSidebarUserCard(currentUser);
    renderWelcomeGreeting(currentUser);
    renderOngoingMeetingBanner(currentUser);
    renderHomeStats(currentUser);
    renderHistoryMeetings(currentUser);
    renderPrimaryMeetingEntry(currentUser);
  });
}

function applyHomeStaticTranslations() {
  const language = getSystemLanguage();
  document.title =
    language === "ja" ? "AudioClaw · ホーム" : language === "en" ? "AudioClaw · Home" : "AudioClaw · 我的会议";

  const textMap = {
    zh: {
      newMeeting: "开始新会议",
      navMain: "主导航",
      navAssets: "资产库",
      navOrg: "组织",
      myMeetings: "我的会议",
      voiceprints: "声纹库",
      terms: "术语热词库",
      admin: "组织管理",
      settings: "设置",
      pageTitle: "我的会议",
      searchPlaceholder: "搜索会议、发言人、关键内容…",
      history: "历史会议",
      all: "全部",
      week: "本周",
      month: "本月",
      starred: "⭐ 已收藏",
      cards: "卡片",
      list: "列表",
      empty: "— 已显示最近 11 场会议 · 滚动到底加载更多 —",
      modalTitle: "开始新会议",
      modalSub: "填写本场会议的基础信息后进入会议页。参会人将从真实组织成员中搜索并加入本场会议。",
      meetingTitle: "会议标题",
      meetingTitlePlaceholder: "例如：AI会议平台产品介绍 · 神州数码 x 商汤科技",
      mainLanguage: "主阅读语言",
      meetingTarget: "会议外语目标语言",
      translationEnabled: "本场翻译",
      participants: "参会人",
      participantSearchPlaceholder: "搜索姓名、职位、部门或邮箱",
      participantHint: "先搜索并点选一位参会人，再点击右侧按钮加入下方列表。",
      addParticipant: "添加参会人",
      cancel: "取消",
      confirm: "开始会议",
    },
    ja: {
      newMeeting: "新しい会議を開始",
      navMain: "メイン",
      navAssets: "アセット",
      navOrg: "組織",
      myMeetings: "会議一覧",
      voiceprints: "声紋ライブラリ",
      terms: "用語ライブラリ",
      admin: "組織管理",
      settings: "設定",
      pageTitle: "会議一覧",
      searchPlaceholder: "会議、話者、キーワードを検索...",
      history: "履歴会議",
      all: "すべて",
      week: "今週",
      month: "今月",
      starred: "⭐ お気に入り",
      cards: "カード",
      list: "リスト",
      empty: "最近の 11 件を表示中 · 最下部までスクロールしてさらに読み込み ·",
      modalTitle: "新しい会議を開始",
      modalSub: "基本情報を入力して会議ページに入ります。参加者は実際の組織メンバーから検索して追加します。",
      meetingTitle: "会議タイトル",
      meetingTitlePlaceholder: "例: AI会议平台产品介绍 · 神州数码 x 商汤科技",
      mainLanguage: "主表示言語",
      meetingTarget: "会議の翻訳対象言語",
      translationEnabled: "この会議の翻訳",
      participants: "参加者",
      participantSearchPlaceholder: "氏名、役職、部署、メールで検索",
      participantHint: "まず候補を検索して選択し、その後右側のボタンで下のリストに追加します。",
      addParticipant: "参加者を追加",
      cancel: "キャンセル",
      confirm: "会議を開始",
    },
    en: {
      newMeeting: "Start New Meeting",
      navMain: "Main",
      navAssets: "Assets",
      navOrg: "Organization",
      myMeetings: "My Meetings",
      voiceprints: "Voiceprints",
      terms: "Term Library",
      admin: "Organization",
      settings: "Settings",
      pageTitle: "My Meetings",
      searchPlaceholder: "Search meetings, speakers, or key content...",
      history: "Meeting History",
      all: "All",
      week: "This Week",
      month: "This Month",
      starred: "⭐ Starred",
      cards: "Cards",
      list: "List",
      empty: "Showing the latest 11 meetings · Scroll to the end to load more ·",
      modalTitle: "Start New Meeting",
      modalSub:
        "Fill in the meeting basics before entering the meeting page. Search and add participants from the real organization member list.",
      meetingTitle: "Meeting Title",
      meetingTitlePlaceholder:
        "Example: AI Meeting Platform Product Introduction · Digital China x SenseTime",
      mainLanguage: "Primary Reading Language",
      meetingTarget: "Meeting Target Language",
      translationEnabled: "Meeting Translation",
      participants: "Participants",
      participantSearchPlaceholder: "Search by name, title, department, or email",
      participantHint: "Search and select one candidate first, then use the button on the right to add them below.",
      addParticipant: "Add Participant",
      cancel: "Cancel",
      confirm: "Start Meeting",
    },
  }[language];

  document.querySelector(".new-meeting-btn span").textContent = textMap.newMeeting;
  document.querySelectorAll(".nav-title")[0].textContent = textMap.navMain;
  document.querySelectorAll(".nav-title")[1].textContent = textMap.navAssets;
  document.querySelectorAll(".nav-title")[2].textContent = textMap.navOrg;
  const navLabels = document.querySelectorAll(".nav-item span:not(.nav-count):not(.admin-badge)");
  if (navLabels[0]) navLabels[0].textContent = textMap.myMeetings;
  if (navLabels[1]) navLabels[1].textContent = textMap.voiceprints;
  if (navLabels[2]) navLabels[2].textContent = textMap.terms;
  if (navLabels[3]) navLabels[3].textContent = textMap.admin;
  if (navLabels[4]) navLabels[4].textContent = textMap.settings;
  document.querySelector(".page-title").textContent = textMap.pageTitle;
  document.querySelector(".search-box input").placeholder = textMap.searchPlaceholder;
  const welcomeBtn = document.querySelector(".welcome .btn.primary");
  if (welcomeBtn) {
    welcomeBtn.lastChild.textContent = textMap.newMeeting;
  }
  const filterTitle = document.querySelector(".filter-row h2");
  if (filterTitle) filterTitle.textContent = textMap.history;
  const chips = document.querySelectorAll(".filter-row .chip");
  if (chips[0]) chips[0].textContent = `${textMap.all}`;
  if (chips[1]) chips[1].textContent = textMap.week;
  if (chips[2]) chips[2].textContent = textMap.month;
  if (chips[3]) chips[3].textContent = textMap.starred;
  const viewButtons = document.querySelectorAll(".view-btn");
  if (viewButtons[0]) viewButtons[0].lastChild.textContent = textMap.cards;
  if (viewButtons[1]) viewButtons[1].lastChild.textContent = textMap.list;
  const emptyHint = document.querySelector(".empty-hint");
  if (emptyHint) emptyHint.textContent = textMap.empty;

  const modal = document.querySelector('[data-role="meeting-create-modal"]');
  if (modal) {
    modal.querySelector(".meeting-modal-title").textContent = textMap.modalTitle;
    modal.querySelector(".meeting-modal-subtitle").textContent = textMap.modalSub;
    const labels = modal.querySelectorAll(".meeting-field label");
    if (labels[0]) labels[0].textContent = textMap.meetingTitle;
    if (labels[1]) labels[1].textContent = textMap.mainLanguage;
    if (labels[2]) labels[2].textContent = textMap.meetingTarget;
    if (labels[3]) labels[3].textContent = textMap.translationEnabled;
    if (labels[4]) labels[4].textContent = textMap.participants;
    modal.querySelector('[data-action="add-participant"]').textContent = textMap.addParticipant;
    modal.querySelector('[data-action="cancel-meeting-create"]').textContent = textMap.cancel;
    modal.querySelector('[data-action="confirm-meeting-create"]').textContent = textMap.confirm;
    const titleInput = modal.querySelector('[data-field="meeting-title"]');
    if (titleInput) {
      titleInput.placeholder = textMap.meetingTitlePlaceholder;
    }
    const participantSearchInput = modal.querySelector('[data-field="meeting-participant-search"]');
    if (participantSearchInput) {
      participantSearchInput.placeholder = textMap.participantSearchPlaceholder;
    }
    const participantHint = modal.querySelector('[data-role="meeting-participant-hint"]');
    if (participantHint) {
      participantHint.textContent = textMap.participantHint;
    }
  }
}
