import type { WebsitePreset } from "@/models/websitePreset";

/**
 * Website presets for popular sites
 * Easily extensible array structure for adding more sites
 */
export const websitePresets: WebsitePreset[] = [
  {
    id: "google",
    name: "Google",
    aliases: ["google", "구글", "gmail", "지메일"],
    websiteUrl: "https://accounts.google.com",
    domain: "google.com",
    category: "email",
    packageNames: ["com.google.android.googlequicksearchbox", "com.google.android.gm"],
  },
  {
    id: "naver",
    name: "Naver",
    aliases: ["naver", "네이버"],
    websiteUrl: "https://nid.naver.com",
    domain: "naver.com",
    category: "email",
    packageNames: ["com.nhn.android.search"],
  },
  {
    id: "kakao",
    name: "Kakao",
    aliases: ["kakao", "카카오", "카톡"],
    websiteUrl: "https://accounts.kakao.com",
    domain: "kakao.com",
    category: "social",
    packageNames: ["com.kakao.talk"],
  },
  {
    id: "microsoft",
    name: "Microsoft",
    aliases: ["microsoft", "마이크로소프트", "outlook", "hotmail"],
    websiteUrl: "https://login.microsoftonline.com",
    domain: "microsoft.com",
    category: "email",
    packageNames: ["com.microsoft.office.outlook"],
    // Note: Microsoft 아이콘은 저작권 문제로 제외됨 (TRADEMARK ENFORCEMENT)
    // 도메인 매칭 + packageNames는 유지, 아이콘만 기본 아이콘으로 fallback
  },
  {
    id: "apple",
    name: "Apple",
    aliases: ["apple", "애플", "icloud"],
    websiteUrl: "https://appleid.apple.com",
    domain: "apple.com",
    category: "email",
    // Apple has no official Android app for iCloud
  },
  {
    id: "github",
    name: "GitHub",
    aliases: ["github", "깃허브"],
    websiteUrl: "https://github.com/login",
    domain: "github.com",
    category: "development",
    packageNames: ["com.github.android"],
  },
  {
    id: "discord",
    name: "Discord",
    aliases: ["discord", "디스코드"],
    websiteUrl: "https://discord.com/login",
    domain: "discord.com",
    category: "social",
    packageNames: ["com.discord"],
  },
  {
    id: "instagram",
    name: "Instagram",
    aliases: ["instagram", "인스타그램", "인스타"],
    websiteUrl: "https://www.instagram.com/accounts/login/",
    domain: "instagram.com",
    category: "social",
    packageNames: ["com.instagram.android"],
  },
  {
    id: "facebook",
    name: "Facebook",
    aliases: ["facebook", "페이스북", "fb"],
    websiteUrl: "https://www.facebook.com/login",
    domain: "facebook.com",
    category: "social",
    packageNames: ["com.facebook.katana"],
  },
  {
    id: "twitter",
    name: "X (Twitter)",
    aliases: ["twitter", "트위터", "x", "엑스"],
    websiteUrl: "https://x.com/i/flow/login",
    domain: "x.com",
    category: "social",
    packageNames: ["com.twitter.android"],
  },
  {
    id: "netflix",
    name: "Netflix",
    aliases: ["netflix", "넷플릭스"],
    websiteUrl: "https://www.netflix.com/login",
    domain: "netflix.com",
    category: "entertainment",
    packageNames: ["com.netflix.mediaclient"],
  },
  {
    id: "steam",
    name: "Steam",
    aliases: ["steam", "스팀"],
    websiteUrl: "https://store.steampowered.com/login/",
    domain: "steampowered.com",
    category: "gaming",
    packageNames: ["com.valvesoftware.android.steam.community"],
  },
  {
    id: "amazon",
    name: "Amazon",
    aliases: ["amazon", "아마존"],
    websiteUrl: "https://www.amazon.com/ap/signin",
    domain: "amazon.com",
    category: "shopping",
    packageNames: ["com.amazon.mShop.android.shopping"],
  },
  {
    id: "dropbox",
    name: "Dropbox",
    aliases: ["dropbox", "드롭박스"],
    websiteUrl: "https://www.dropbox.com/login",
    domain: "dropbox.com",
    category: "storage",
    packageNames: ["com.dropbox.android"],
  },
];

/**
 * Search presets by query string
 * Matches against name and aliases (case-insensitive, trimmed)
 */
export function searchPresets(query: string): WebsitePreset[] {
  if (!query || !query.trim()) {
    return [];
  }

  const normalizedQuery = query
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "");

  return websitePresets.filter((preset) => {
    // Check name
    const normalizedName = preset.name.toLowerCase().replace(/\s+/g, "");
    if (normalizedName.includes(normalizedQuery)) {
      return true;
    }

    // Check aliases
    return preset.aliases.some((alias) => {
      const normalizedAlias = alias.toLowerCase().replace(/\s+/g, "");
      return normalizedAlias.includes(normalizedQuery);
    });
  });
}

/**
 * Get preset by ID
 */
export function getPresetById(id: string): WebsitePreset | undefined {
  return websitePresets.find((preset) => preset.id === id);
}

/**
 * Get all presets grouped by category
 */
export function getPresetsByCategory(): Record<string, WebsitePreset[]> {
  return websitePresets.reduce((acc, preset) => {
    const category = preset.category || "other";
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(preset);
    return acc;
  }, {} as Record<string, WebsitePreset[]>);
}