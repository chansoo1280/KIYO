# CONSTITUTION.md — KIYO 프로젝트 헌법

모든 Spec-Driven Development(SDD) 단계(spec → plan → tasks → implement)에서 최상위 의사결정 기준으로 삼는다. 헌법과 상충하는 결정은 구현 전 헌법을 먼저 수정한다.

---

## 1. 도메인 및 미션

### 해결하는 문제
KIYO는 오프라인 우선, 프라이버시 중심의 안드로이드 비밀번호 관리자이다. 사용자가 계정정보를 로컬에만 암호화 저장하고, Android AutofillService를 통해 앱/웹 로그인 필드에 자동 완성할 수 있게 한다.

### 비목표 (명시적으로 하지 않는 것)
- 네트워크 권한 사용 및 클라우드 동기화 (모든 데이터는 기기 로컬에만 저장)
- 암호화 키를 디스크에 영구 저장 (키는 메모리 상의 SecuritySession에만 보관)
- iOS / 데스크톱 / 웹 단독 실행 (타겟 플랫폼: Android만)

---

## 2. 기술 스택 및 버전 고정

| 계층 | 기술 | 고정 버전 / 제약 |
|------|------|----------------|
| Frontend | React 19 | `^19.2.7` |
| Language | TypeScript | `~6.0.2`, strict 모드 |
| Build tool | Vite | `^8.1.1`, ESM only |
| Styling | Tailwind CSS 4 | `@tailwindcss/vite` |
| 상태 관리 | Zustand | `^5.0.14` |
| 라우팅 | React Router 7 | `^7.18.1` |
| Native Bridge | Capacitor 8 (Android) | `^8.4.1` |
| 로컬 DB | Dexie.js (IndexedDB) | `^4.4.4` |
| 암호화 | Web Crypto API | PBKDF2 100k + AES-GCM |
| Android Native | Kotlin, AutofillService, SQLiteOpenHelper, Android Keystore, DataStore | API 26+ |
| 테스트 | Vitest (단위/통합), Playwright (React E2E) | `vitest run --typecheck`, `playwright test` |

### import 경로 규칙
- `@/` → `src/` (tsconfig `paths` 및 vite alias로 고정)
- ESM only (`"type": "module"`, `verbatimModuleSyntax`, `erasableSyntaxOnly`)

---

## 3. 코딩 표준

### TypeScript
- `strict: true`는 `tsconfig.e2e.json`에 명시. 앱 프로젝트(`tsconfig.app.json`)는 개별 strict 관련 플래그(`noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`)를 사용하며 `strict` 플래그 자체는 미설정
- `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch` 사용
- `verbatimModuleSyntax` + `erasableSyntaxOnly` (type-only import는 `import type` 사용)
- `@typescript-eslint` recommended 규칙 준수

### ESLint / 포맷
- `npm run lint` = `eslint .`
- ESLint disable 주석은 예외적 사유가 있을 때만 사용 (예: `// eslint-disable-next-line react-hooks/set-state-in-effect` 등, 사유 필수)
- Prettier 포맷 미사용 (Tailwind 4 클래스 순서 등은 ESLint 플러그인으로 관리)

### React
- React 19, 함수형 컴포넌트 + 훅 기준
- 클래스 컴포넌트 미사용

### 문서/주석
- 코드 블록에는 반드시 한국어 주석 필수
- 공개 API 및 복잡한 로직은 주석으로 의도를 명시

---

## 4. 아키텍처 제약

```
React App (WebView) ◄──Capacitor Bridge──► Android Native (AutofillService)
       │                                           │
       ▼                                           ▼
  IndexedDB (Dexie)                          SQLCipher DB (Autofill Repo)
       │                                           │
       ▼                                           ▼
  암호화 JSON (PBKDF2+AES)                    DB_KEY (AES-256, SQLCipher)
                                                    │
                                                    ▼
                                         Android Keystore
                                         ├─ kiyo_master_key (autofill)
                                         └─ kiyo_secure_master_key (biometric)
```

### 레이어 분리 및 의존성 방향
- React UI → Zustand store → crypto 계층 → Dexie IndexedDB (단방향 의존)
- UI는 crypto 구현을 직접 호출하지 않고 store/pipeline 함수를 경유
- **Vault Persistence Coordinator**: Store(accountStore, templateStore 등)와 FileStorage(database/fileStorage)는 서로를 직접 알지 않음. 두 계층을 모두 아는 Coordinator만이 중재함.
- 자동 저장(저장·불러오기·잠금·해제)은 Coordinator를 통해 수행
- Android Native (Kotlin)는 Capacitor 브리지를 통해 React와만 통신 (직접 UI 접근 금지)

### 암호화 제약
- **볼트 전체 객체 암호화**: `KiyoVaultData` 전체(JSON 직렬화)를 하나의 AES-GCM 블록으로 암호화 (개별 Account/Template 레코드 단위 암호화는 아님)
- PIN → PBKDF2 (100,000 iterations, SHA-256) → AES-GCM-256 키 유도 (`src/crypto/encryption.ts` `createCryptoKey`)
- 파일 시스템 볼트: 메인 계정은 AES-GCM(PIN 기반) 암호화 JSON, 백업/이동 가능
- 앱 설정(테마, 폰트, 자동 잠금 등)은 `zustand persist`로 **localStorage**에 평문 저장 (`src/store/settingsStore.ts`)

---

## 5. 보안 규칙 (절대 준수)

| 규칙 | 내용 |
|------|------|
| **키 디스크 저장 금지** | 암호화 키는 `SecuritySession` 메모리에만 보관. `fileName`/`salt`만 디스크 persist |
| **PIN → PBKDF2 → AES-GCM** | 키 유도 횟수 100k 고정, 임의 변경 금지 |
| **자동 잠금** | `none` / `1m` / `10m` / `30m`. 활동 감지 시 리셋, 키 상실 시 즉시 잠금 |
| **Keystore 분리** | `kiyo_master_key`(autofill DB)와 `kiyo_secure_master_key`(biometric vault)는 별도 보호 |
| **Autofill 인증** | `accountStore.ts`의 `syncToAutofill()`이 Capacitor 브리지(`KiyoAutofill.syncAccountsFromReact`)를 통해 Android Keystore 기반 autofill DB에 계정을 동기화함. `syncAutofillToken()`은 미사용 |
| **네트워크 금지** | AndroidManifest에 인터넷 권한 미부여, fetch/XHR 사용 금지 |

### Android 변경 후 필수 작업
- 네이티브(Kotlin/리소스) 변경 후 반드시 `npx cap sync android` 실행

---

## 6. 테스트 관례

| 유형 | 도구 | 위치 | 실행 명령 |
|------|------|------|-----------|
| 단위 | Vitest (jsdom) | `src/**/*.test.ts`, `*.test.tsx` | `npm run test` (unit 프로젝트) |
| 통합 | Vitest (jsdom) | `src/**/*.integration.test.ts` | `npm run test` (integration 프로젝트) |
| React E2E | Playwright | `e2e/**` | `npm run test:e2e` |
| Android Autofill E2E | UI Automator (에뮬레이터) | `android/...` | `npm run test:e2e:android` |
| Android Biometric E2E | UI Automator (에뮬레이터) | `android/...` | `npm run test:e2e:biometric` |

- Crypto 변경 시 반드시 통합 테스트 추가
- `npm run check` = `npm run typecheck && npm run test` (커밋 전 필수 실행)
- Vitest는 `globals: true`, setupFiles로 `./src/test/unit.setup.ts` (단위), `./src/test/integration.setup.ts` (통합) 사용

---

## 7. 커밋 및 브랜치 관례

### 커밋 메시지 (Conventional Commits)
형식: `<type>(<scope>): <한글 제목>`

type: `feat` | `fix` | `docs` | `chore` | `refactor` | `test` | `style` | `perf` | `ci` | `revert`

예시:
- `feat(autobackup): 암호화 볼트 생성/불러오기 직후 자동백업 실행 + 파일명 미러링`
- `fix(settings): 설정 행의 긴 URI 줄바꿈 처리`
- `docs(readme): 계정정보 관리앱 설명으로 README 개요 수정`

### 브랜치 전략
- 메인 브랜치: `v2` (원격 origin)
- 개발 브랜치: `dev` (기본 작업 브랜치)
- 기능 브랜치: `feat/*`, `fix/*` 등
- PR 기반 병합, 메인 브랜치 직접 push 금지

### 커밋 전 체크
1. `npm run lint` 통과
2. `npm run typecheck` 통과
3. `npm run test` 통과
4. Android 변경 시 `npx cap sync android` 실행

---

## 8. 헌법 위반 체크리스트 (spec-review 시 사용)

- [ ] TypeScript strict 모드 위반 코드가 없는가?
- [ ] ESM only인가? (CommonJS require 미사용)
- [ ] `@/` import 경로가 올바른가?
- [ ] 암호화 키를 디스크에 persist하지 않는가? (메모리만)
- [ ] PIN → PBKDF2(100k) → AES-GCM 흐름을 따르는가?
- [ ] 볼트 전체 객체 암호화가 적용되었는가? (개별 레코드 단위 암호화는 아님)
- [ ] `syncAutofillToken()`을 사용하지 않는가? (`syncToAutofill()` 사용)
- [ ] 네트워크 권한/코드가 추가되지 않았는가?
- [ ] Android 네이티브 변경 후 `cap sync android`를 실행했는가?
- [ ] 커밋 메시지가 Conventional Commits 형식인가?
- [ ] `npm run check` (typecheck + test)가 통과하는가?
- [ ] Crypto 변경 시 통합 테스트가 있는가?
- [ ] 코드 블록/공개 API에 한국어 주석이 있는가?

---

## 9. 헌법 수정 절차

1. 헌법 위반 또는 개선 필요 사항 발견 시 이 파일을 먼저 수정
2. 관련 spec/plan/task를 헌법에 맞게 정렬
3. `npm run check`로 검증
4. `docs` 타입 커밋으로 반영

---

*버전: 1.0.0 | 작성: KIYO 프로젝트 | 적용 범위: 전체 레포지토리 (src/, android/, e2e/)*
