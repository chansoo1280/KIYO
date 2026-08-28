/**
 * PresetIcon — Renders the official brand logo for a WebsitePreset.
 * Uses SVGR via Vite to import SVGs as React components (?react suffix).
 */
import { lazy, Suspense, type FC, type SVGProps } from "react";
import type { WebsitePreset } from "@/models/websitePreset";

// Map preset.id → SVG component (lazy-loaded for code-splitting)
// Note: Microsoft 아이콘은 저작권 문제로 제외됨 (TRADEMARK ENFORCEMENT)
const ICON_LOADERS: Record<string, () => Promise<{ default: FC<SVGProps<SVGSVGElement> & { size?: number; className?: string }> }>> = {
  google: () => import("@/assets/icons/google.svg?react"),
  naver: () => import("@/assets/icons/naver.svg?react"),
  kakao: () => import("@/assets/icons/kakaotalk.svg?react"),
  apple: () => import("@/assets/icons/apple.svg?react"),
  github: () => import("@/assets/icons/github.svg?react"),
  discord: () => import("@/assets/icons/discord.svg?react"),
  instagram: () => import("@/assets/icons/instagram.svg?react"),
  facebook: () => import("@/assets/icons/facebook.svg?react"),
  twitter: () => import("@/assets/icons/x.svg?react"),
  netflix: () => import("@/assets/icons/netflix.svg?react"),
  steam: () => import("@/assets/icons/steam.svg?react"),
  amazon: () => import("@/assets/icons/amazon.svg?react"),
  dropbox: () => import("@/assets/icons/dropbox.svg?react"),
};

interface PresetIconProps {
  preset: WebsitePreset;
  size?: number;
  className?: string;
}

const PresetIcon: FC<PresetIconProps> = ({ preset, size = 24, className }) => {
  const loader = ICON_LOADERS[preset.id];
  if (!loader) return <DefaultIcon size={size} className={className} />;

  // Lazy component for code-splitting
  const Icon = lazy(loader);
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
