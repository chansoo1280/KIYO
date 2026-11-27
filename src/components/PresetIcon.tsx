/**
 * PresetIcon — Renders the official brand logo for a WebsitePreset.
 * Uses SVGR via Vite to import SVGs as React components (?react suffix).
 */
import { lazy, Suspense, type FC } from "react";
import type { WebsitePreset } from "@/models/websitePreset";

// Map preset.id → SVG component (lazy-loaded for code-splitting)
// Note: Microsoft 아이콘은 저작권 문제로 제외됨 (TRADEMARK ENFORCEMENT)
const ICON_COMPONENTS: Record<string, ReturnType<typeof lazy>> = {
  google: lazy(() => import("@/assets/icons/google.svg?react")),
  naver: lazy(() => import("@/assets/icons/naver.svg?react")),
  kakao: lazy(() => import("@/assets/icons/kakaotalk.svg?react")),
  apple: lazy(() => import("@/assets/icons/apple.svg?react")),
  github: lazy(() => import("@/assets/icons/github.svg?react")),
  discord: lazy(() => import("@/assets/icons/discord.svg?react")),
  instagram: lazy(() => import("@/assets/icons/instagram.svg?react")),
  facebook: lazy(() => import("@/assets/icons/facebook.svg?react")),
  twitter: lazy(() => import("@/assets/icons/x.svg?react")),
  netflix: lazy(() => import("@/assets/icons/netflix.svg?react")),
  steam: lazy(() => import("@/assets/icons/steam.svg?react")),
  amazon: lazy(() => import("@/assets/icons/amazon.svg?react")),
  dropbox: lazy(() => import("@/assets/icons/dropbox.svg?react")),
};

interface PresetIconProps {
  preset: WebsitePreset;
  size?: number;
  className?: string;
}

const PresetIcon: FC<PresetIconProps> = ({ preset, size = 24, className }) => {
  const Icon = ICON_COMPONENTS[preset.id];
  if (!Icon) return <DefaultIcon size={size} className={className} />;

  return (
    <Suspense fallback={<DefaultIcon size={size} className={className} />}>
      {/* Apply width/height explicitly — SVGR components spread props to the inner <svg>.
          The simple-icons SVGs have only viewBox, so without explicit width/height
          they expand to fill the parent container. */}
      <Icon width={size} height={size} className={className} />
    </Suspense>
  );
};

const DefaultIcon: FC<{ size?: number; className?: string }> = ({ size = 24, className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    aria-label="default icon"
    role="img"
  >
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm0-14c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6z" />
  </svg>
);

export default PresetIcon;
