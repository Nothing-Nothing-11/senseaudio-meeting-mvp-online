const STORAGE_KEY = "ac_org_members_v1";
const DEFAULT_COMPANY = "神州数码";
const MEMBER_AVATAR_COLORS = [
  "var(--speaker-1)",
  "var(--speaker-2)",
  "var(--speaker-3)",
  "var(--speaker-4)",
  "var(--speaker-5)",
  "var(--speaker-6)",
  "var(--speaker-7)",
  "var(--speaker-8)",
];

const SEEDED_MEMBERS = [
  {
    id: "mem_dc_001",
    name: "严文会",
    email: "yanwh@digitalchina.com",
    role: "admin",
    department: "IIG-创新业务-管理层",
    title: "技术总经理",
    status: "active",
    lastActiveLabel: "刚刚",
    isWeeklyActive: true,
    joinedAt: "2026-07-28",
    avatarColor: "var(--speaker-1)",
  },
  {
    id: "mem_dc_002",
    name: "朱海涛",
    email: "zhuht@digitalchina.com",
    role: "admin",
    department: "IIG-创新业务-管理层",
    title: "业务总经理",
    status: "active",
    lastActiveLabel: "刚刚",
    isWeeklyActive: true,
    joinedAt: "2026-07-28",
    avatarColor: "var(--speaker-2)",
  },
  {
    id: "mem_dc_003",
    name: "刘拓",
    email: "liut@digitalchina.com",
    role: "member",
    department: "IIG-创新业务-研发",
    title: "AI咨询顾问",
    status: "active",
    lastActiveLabel: "刚刚",
    isWeeklyActive: true,
    joinedAt: "2026-07-28",
    avatarColor: "var(--speaker-3)",
  },
  {
    id: "mem_dc_004",
    name: "钱百胜",
    email: "qianbs@digitalchina.com",
    role: "member",
    department: "IIG-创新业务-研发",
    title: "AI咨询顾问",
    status: "active",
    lastActiveLabel: "刚刚",
    isWeeklyActive: true,
    joinedAt: "2026-07-28",
    avatarColor: "var(--speaker-4)",
  },
  {
    id: "mem_dc_005",
    name: "顾景超",
    email: "gujc@digitalchina.com",
    role: "member",
    department: "IIG-创新业务-研发",
    title: "AI咨询顾问",
    status: "active",
    lastActiveLabel: "刚刚",
    isWeeklyActive: true,
    joinedAt: "2026-07-28",
    avatarColor: "var(--speaker-5)",
  },
  {
    id: "mem_dc_006",
    name: "王栩",
    email: "wangx@digitalchina.com",
    role: "member",
    department: "IIG-创新业务-研发",
    title: "AI咨询顾问",
    status: "active",
    lastActiveLabel: "刚刚",
    isWeeklyActive: true,
    joinedAt: "2026-07-28",
    avatarColor: "var(--speaker-6)",
  },
  {
    id: "mem_dc_007",
    name: "陈家韵",
    email: "chenjy@digitalchina.com",
    role: "member",
    department: "IIG-创新业务-研发",
    title: "AI咨询顾问",
    status: "active",
    lastActiveLabel: "刚刚",
    isWeeklyActive: true,
    joinedAt: "2026-07-28",
    avatarColor: "var(--speaker-7)",
  },
  {
    id: "mem_dc_008",
    name: "张小涓",
    email: "zhangxj@digitalchina.com",
    role: "member",
    department: "IIG-创新业务-研发",
    title: "AI咨询顾问",
    status: "active",
    lastActiveLabel: "刚刚",
    isWeeklyActive: true,
    joinedAt: "2026-07-28",
    avatarColor: "var(--speaker-8)",
  },
  {
    id: "mem_dc_009",
    name: "葛佳琪",
    email: "gejq@digitalchina.com",
    role: "member",
    department: "IIG-创新业务-研发",
    title: "AI咨询顾问",
    status: "active",
    lastActiveLabel: "刚刚",
    isWeeklyActive: true,
    joinedAt: "2026-07-28",
    avatarColor: "var(--speaker-1)",
  },
  {
    id: "mem_dc_010",
    name: "刘子腾",
    email: "liuzt@digitalchina.com",
    role: "member",
    department: "IIG-创新业务-研发",
    title: "AI咨询顾问",
    status: "active",
    lastActiveLabel: "刚刚",
    isWeeklyActive: true,
    joinedAt: "2026-07-28",
    avatarColor: "var(--speaker-2)",
  },
  {
    id: "mem_dc_011",
    name: "黄天蛟",
    email: "huangtj@digitalchina.com",
    role: "member",
    department: "IIG-创新业务-研发",
    title: "AI咨询顾问",
    status: "active",
    lastActiveLabel: "刚刚",
    isWeeklyActive: true,
    joinedAt: "2026-07-28",
    avatarColor: "var(--speaker-3)",
  },
  {
    id: "mem_dc_012",
    name: "刘丽霞",
    email: "liulx@digitalchina.com",
    role: "member",
    department: "IIG-创新业务-研发",
    title: "AI咨询顾问",
    status: "active",
    lastActiveLabel: "刚刚",
    isWeeklyActive: true,
    joinedAt: "2026-07-28",
    avatarColor: "var(--speaker-4)",
  },
  {
    id: "mem_dc_013",
    name: "周天宇",
    email: "zhouty@digitalchina.com",
    role: "member",
    department: "IIG-创新业务-研发",
    title: "AI咨询顾问",
    status: "active",
    lastActiveLabel: "刚刚",
    isWeeklyActive: true,
    joinedAt: "2026-07-28",
    avatarColor: "var(--speaker-5)",
  },
  {
    id: "mem_dc_014",
    name: "陈子豪",
    email: "chenzh@digitalchina.com",
    role: "member",
    department: "IIG-创新业务-研发",
    title: "AI咨询顾问",
    status: "active",
    lastActiveLabel: "刚刚",
    isWeeklyActive: true,
    joinedAt: "2026-07-28",
    avatarColor: "var(--speaker-6)",
  },
  {
    id: "mem_dc_015",
    name: "陈一帆",
    email: "chenyf@digitalchina.com",
    role: "member",
    department: "IIG-创新业务-研发",
    title: "AI咨询顾问",
    status: "active",
    lastActiveLabel: "刚刚",
    isWeeklyActive: true,
    joinedAt: "2026-07-28",
    avatarColor: "var(--speaker-7)",
  },
  {
    id: "mem_dc_016",
    name: "张艳阳",
    email: "zhangyy@digitalchina.com",
    role: "member",
    department: "IIG-创新业务-研发",
    title: "AI咨询顾问",
    status: "active",
    lastActiveLabel: "刚刚",
    isWeeklyActive: true,
    joinedAt: "2026-07-28",
    avatarColor: "var(--speaker-8)",
  },
];

function readMembers() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) {
      return [];
    }
    const normalizedMembers = parsed.map(normalizeMember);
    const { members: repairedMembers, changed } = repairMemberIds(normalizedMembers);
    if (changed) {
      writeMembers(repairedMembers);
    }
    return repairedMembers;
  } catch {
    return [];
  }
}

function writeMembers(members) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(members));
}

function getAvatarText(name) {
  const normalized = String(name || "").trim();
  return normalized.slice(0, 1) || "未";
}

function normalizeMember(member) {
  const now = new Date().toISOString();
  const name = String(member?.name || "").trim();
  const email = String(member?.email || "").trim();

  return {
    id: String(member?.id || ""),
    companyKey: String(member?.companyKey || DEFAULT_COMPANY).trim() || DEFAULT_COMPANY,
    name,
    email,
    role: member?.role === "owner" || member?.role === "admin" ? member.role : "member",
    department: String(member?.department || "").trim(),
    title: String(member?.title || "").trim(),
    status:
      member?.status === "pending" || member?.status === "disabled" ? member.status : "active",
    lastActiveLabel: String(member?.lastActiveLabel || (member?.status === "pending" ? "—" : "刚刚")).trim(),
    isWeeklyActive: Boolean(member?.isWeeklyActive),
    joinedAt: String(member?.joinedAt || now.slice(0, 10)).trim(),
    avatarText: String(member?.avatarText || getAvatarText(name)).trim() || "未",
    avatarColor: String(member?.avatarColor || "var(--text-tertiary)").trim() || "var(--text-tertiary)",
    isSeeded: Boolean(member?.isSeeded),
    createdAt: String(member?.createdAt || now),
    updatedAt: String(member?.updatedAt || now),
  };
}

function seedMembersForCompany(companyKey) {
  return SEEDED_MEMBERS.map((member) =>
    normalizeMember({
      ...member,
      companyKey: companyKey || DEFAULT_COMPANY,
      isSeeded: true,
    })
  );
}

function buildCompanySlug(companyKey) {
  return String(companyKey || DEFAULT_COMPANY)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "") || "org";
}

function parseMemberId(value) {
  const matched = String(value || "").match(/^(.*_)(\d+)$/);
  if (!matched) {
    return null;
  }
  return {
    prefix: matched[1],
    sequence: Number(matched[2]) || 0,
    width: matched[2].length,
  };
}

function getMemberIdPrefix(companyKey, existingMembers = []) {
  const normalizedCompany = String(companyKey || DEFAULT_COMPANY).trim() || DEFAULT_COMPANY;
  const prefixCounts = new Map();
  existingMembers
    .filter((member) => member.companyKey === normalizedCompany)
    .forEach((member) => {
      const parsed = parseMemberId(member.id);
      if (!parsed?.prefix) {
        return;
      }
      prefixCounts.set(parsed.prefix, (prefixCounts.get(parsed.prefix) || 0) + 1);
    });

  const sortedPrefixes = Array.from(prefixCounts.entries()).sort((a, b) => {
    if (b[1] !== a[1]) {
      return b[1] - a[1];
    }
    return a[0].localeCompare(b[0]);
  });
  if (sortedPrefixes[0]?.[0]) {
    return sortedPrefixes[0][0];
  }
  return `mem_${buildCompanySlug(normalizedCompany)}_`;
}

function generateUniqueMemberId(companyKey, existingMembers = [], takenIds = new Set()) {
  const normalizedCompany = String(companyKey || DEFAULT_COMPANY).trim() || DEFAULT_COMPANY;
  const prefix = getMemberIdPrefix(normalizedCompany, existingMembers);
  const parsedIds = existingMembers
    .filter((member) => member.companyKey === normalizedCompany)
    .map((member) => parseMemberId(member.id))
    .filter((parsed) => parsed?.prefix === prefix);
  const width = Math.max(3, ...parsedIds.map((parsed) => parsed.width || 0));
  let sequence = parsedIds.reduce((max, parsed) => Math.max(max, parsed.sequence || 0), 0) + 1;
  let candidate = `${prefix}${String(sequence).padStart(width, "0")}`;
  while (takenIds.has(candidate)) {
    sequence += 1;
    candidate = `${prefix}${String(sequence).padStart(width, "0")}`;
  }
  return candidate;
}

function ensureSeededMembers(companyKey) {
  const normalizedCompany = String(companyKey || DEFAULT_COMPANY).trim() || DEFAULT_COMPANY;
  const members = readMembers();
  const hasCompanyMembers = members.some((member) => member.companyKey === normalizedCompany);
  if (hasCompanyMembers) {
    return members;
  }

  const seededMembers = [...members, ...seedMembersForCompany(normalizedCompany)];
  writeMembers(seededMembers);
  return seededMembers;
}

function repairMemberIds(members) {
  const normalizedMembers = Array.isArray(members) ? members.map(normalizeMember) : [];
  const takenIds = new Set(normalizedMembers.map((member) => member.id).filter(Boolean));
  const repairedMembers = [];
  const usedIds = new Set();
  let changed = false;

  normalizedMembers.forEach((member) => {
    const trimmedId = String(member.id || "").trim();
    let nextId = trimmedId;
    if (!trimmedId || usedIds.has(trimmedId)) {
      nextId = generateUniqueMemberId(member.companyKey, repairedMembers.concat(normalizedMembers), takenIds);
      takenIds.add(nextId);
      changed = true;
    }
    usedIds.add(nextId);
    repairedMembers.push(
      nextId === member.id
        ? member
        : normalizeMember({
            ...member,
            id: nextId,
          })
    );
  });

  return {
    members: repairedMembers,
    changed,
  };
}

function generateMemberId(companyKey, existingMembers) {
  const normalizedMembers = Array.isArray(existingMembers) ? existingMembers.map(normalizeMember) : [];
  const takenIds = new Set(normalizedMembers.map((member) => member.id).filter(Boolean));
  return generateUniqueMemberId(companyKey, normalizedMembers, takenIds);
}

function getNextAvatarColor(companyKey, existingMembers) {
  const companyMembers = existingMembers.filter((member) => member.companyKey === companyKey);
  const colorCounts = new Map(MEMBER_AVATAR_COLORS.map((color) => [color, 0]));

  companyMembers.forEach((member) => {
    if (colorCounts.has(member.avatarColor)) {
      colorCounts.set(member.avatarColor, (colorCounts.get(member.avatarColor) || 0) + 1);
    }
  });

  return MEMBER_AVATAR_COLORS.reduce((bestColor, currentColor) => {
    if (!bestColor) {
      return currentColor;
    }
    const bestCount = colorCounts.get(bestColor) || 0;
    const currentCount = colorCounts.get(currentColor) || 0;
    return currentCount < bestCount ? currentColor : bestColor;
  }, MEMBER_AVATAR_COLORS[0]);
}

function updateMemberById(memberId, updater) {
  const members = readMembers();
  const index = members.findIndex((member) => member.id === memberId);
  if (index === -1) {
    throw new Error(`未找到成员：${memberId}`);
  }

  const current = normalizeMember(members[index]);
  const next = normalizeMember(updater(current));
  members[index] = next;
  writeMembers(members);
  return next;
}

export function getOrgMembersByCompany(companyKey) {
  const normalizedCompany = String(companyKey || DEFAULT_COMPANY).trim() || DEFAULT_COMPANY;
  return ensureSeededMembers(normalizedCompany)
    .filter((member) => member.companyKey === normalizedCompany)
    .sort((a, b) => new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime());
}

export function getOrgMemberById(memberId) {
  return readMembers().find((member) => member.id === memberId) || null;
}

export function createOrgMember(companyKey, payload = {}) {
  const normalizedCompany = String(companyKey || DEFAULT_COMPANY).trim() || DEFAULT_COMPANY;
  const members = ensureSeededMembers(normalizedCompany);
  const now = new Date().toISOString();
  const avatarColor = String(payload.avatarColor || "").trim() || getNextAvatarColor(normalizedCompany, members);
  const nextMember = normalizeMember({
    ...payload,
    id: payload.id || generateMemberId(normalizedCompany, members),
    companyKey: normalizedCompany,
    status: payload.status || "active",
    lastActiveLabel: payload.lastActiveLabel || "刚刚",
    avatarColor,
    isWeeklyActive: false,
    createdAt: now,
    updatedAt: now,
  });

  members.push(nextMember);
  writeMembers(members);
  return nextMember;
}

export function updateOrgMember(memberId, payload = {}) {
  return updateMemberById(memberId, (member) => ({
    ...member,
    ...payload,
    id: member.id,
    companyKey: member.companyKey,
    updatedAt: new Date().toISOString(),
  }));
}

export function deleteOrgMember(memberId) {
  const members = readMembers();
  const targetMember = members.find((member) => member.id === memberId);
  if (!targetMember) {
    throw new Error(`未找到成员：${memberId}`);
  }

  writeMembers(members.filter((member) => member.id !== memberId));
  return normalizeMember(targetMember);
}

export function clearOrgMembersForDebug() {
  localStorage.removeItem(STORAGE_KEY);
}
