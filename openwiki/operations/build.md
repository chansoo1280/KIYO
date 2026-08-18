---
type: detail
title: Build Process
description: Build configuration and commands for KIYO including Vite, TypeScript, Capacitor sync, and Gradle.
tags: [operations, build, vite, gradle, capacitor]
---

# Build Process

This document covers the build configuration and commands for the KIYO application, spanning both the React frontend (Vite) and Android native layer (Gradle).

## Frontend Build (Vite)

### Configuration

- **Config file**: `/vite.config.ts`
- **Key plugins**:
  - `@vitejs/plugin-react` - React Fast Refresh
  - `vite-plugin-pwa` - PWA support (optional)
  - Path aliases via `resolve.alias` (e.g., `@/` -> `src/`)

### Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server with HMR |
| `npm run build` | Production build to `/dist` |
| `npm run preview` | Preview production build locally |
| `npm run typecheck` | TypeScript type checking (`tsc --noEmit`) |
| `npm run lint` | ESLint code quality check |

### Output

- Production assets in `/dist`
- Source maps included for debugging
- Optimized chunks with hash-based filenames

## Capacitor Sync

After frontend build, sync assets and configuration to native platforms:

```bash
# Build frontend first
npm run build

# Sync to Android
npx cap sync android

# Or sync all platforms
npx cap sync
```

This copies:
- `/dist` contents to `android/app/src/main/assets/public`
- `capacitor.config.ts` settings to native projects
- Plugin native code to platform projects

## Android Build (Gradle)

### Configuration Files

| File | Purpose |
|------|---------|
| `/android/build.gradle.kts` | Project-level Gradle config |
| `/android/app/build.gradle.kts` | App module config |
| `/android/gradle.properties` | Gradle properties (versions, JVM args) |
| `/android/settings.gradle.kts` | Project includes |
| `/capacitor.config.ts` | Capacitor plugin/project config |

### Key Dependencies

- **Android Gradle Plugin**: 8.x
- **Kotlin**: 2.x
- **Capacitor Android**: 8.4.1
- **SQLCipher**: For encrypted autofill database
- **AndroidX**: Biometric, Security, DataStore

### Commands

| Command | Description |
|---------|-------------|
| `cd android && ./gradlew assembleDebug` | Debug APK |
| `cd android && ./gradlew assembleRelease` | Release AAB/APK |
| `cd android && ./gradlew test` | Unit tests |
| `cd android && ./gradlew connectedAndroidTest` | Instrumented tests |

### Build Types

- **Debug**: Unoptimized, debuggable, signed with debug keystore
- **Release**: Optimized, minified (R8), signed with release keystore

## Full Build Pipeline

```bash
# 1. Frontend typecheck + lint + test
npm run typecheck && npm run lint && npm run test

# 2. Frontend production build
npm run build

# 3. Sync to Android
npx cap sync android

# 4. Android build
cd android && ./gradlew assembleRelease
```

## Environment Variables

| Variable | Used By | Purpose |
|----------|---------|---------|
| `NODE_ENV` | Vite | `development` / `production` |
| `VITE_*` | Vite | Client-exposed env vars (prefix required) |

No secret environment variables should be committed. Use `.env.local` for local overrides (gitignored).

## Troubleshooting

| Issue | Resolution |
|-------|------------|
| Capacitor sync fails | Run `npm run build` first; ensure `dist/` exists |
| Gradle dependency errors | `cd android && ./gradlew --refresh-dependencies` |
| Android SDK not found | Set `ANDROID_HOME` or `local.properties` |
| TypeScript errors in build | Run `npm run typecheck` to see full errors |

---

*Documented based on repository structure and CI workflow*