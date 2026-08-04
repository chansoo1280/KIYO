# KIYO v2 React 컴포넌트 리팩토링 계획

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** KIYO 프로젝트의 React 컴포넌트 구조를 모듈화하고, 중복을 제거하며, 타입 안전성을 강화한다.

**Architecture:** 
- 큰 컴포넌트(AccountEdit, Settings, WebsiteSelector)를 기능별로 분할
- 공통 로직(clipboard, dialog 상태, auto-lock)을 커스텀 훅으로 추출
- TypeScript strict mode 준수 및 `any` 제거
- 기존 `npm run check` (typecheck + vitest) 통과 유지

**Tech Stack:** React 19, TypeScript 6, Vite 8, Vitest, Zustand, Tailwind CSS 4, Capacitor 8

---

## 현재 상태 분석

### 컴포넌트 현황 (총 23개)
| 분류 | 파일 | 줄 수 | 이슈 |
|------|------|------|------|
| **Pages** | 8개 | - | 정상 |
| **Components** | 15개 | - | 일부 리팩토링 필요 |
| **최대 파일** | Settings.tsx | 399줄 | 분할 필요 |
| **최대 파일** | AccountEdit.tsx | 340줄 | 분할 필요 |
| **최대 파일** | WebsiteSelector.tsx | 319줄 | 분할 필요 |

### 중복 로직 발견
- `copyToClipboard`: 5곳 (PasswordField, PasswordGenerator, AccountList, AccountDetail, AccountEdit)
- `BaseDialog` 패턴: 6개 다이얼로그에서 유사하게 사용
- `FIELD_TYPES` 상수: TemplateFieldEditor.tsx와 models/fieldTypes.ts 중복 정의

---

## Phase 1: 훅 분리 및 유틸리티화 (우선순위: 높음)

### Task 1.1: `useClipboard` 훅 생성

**Objective:** 5곳에 중복된 clipboard 복사 로직을 단일 훅으로 통합

**Files:**
- Create: `src/hooks/useClipboard.ts`
- Modify: `src/components/PasswordField.tsx`, `src/components/PasswordGenerator.tsx`, `src/pages/AccountList.tsx`, `src/pages/AccountDetail.tsx`, `src/pages/AccountEdit.tsx`

**Step 1: Create hook**
```typescript
// src/hooks/useClipboard.ts
import { useCallback, useState } from "react";

export function useClipboard() {
  const [copied, setCopied] = useState(false);
  const [remainingTime, setRemainingTime] = useState(0);

  const copy = useCallback(async (text: string): Promise<boolean> => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setRemainingTime(30);
      const timer = setInterval(() => {
        setRemainingTime((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            setCopied(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return true;
    } catch {
      return false;
    }
  }, []);

  return { copy, copied, remainingTime };
}
```

**Step 2: Replace in 5 files**
- PasswordField.tsx: `onCopy={() => copyToClipboard(value)}` → `onCopy={copy}`
- PasswordGenerator.tsx: 내부 `copyToClipboard` 함수 제거, 훅 사용
- AccountList.tsx: 내부 `copyToClipboard` 함수 제거, 훅 사용
- AccountDetail.tsx: 내부 `copyToClipboard` 함수 제거, 훅 사용
- AccountEdit.tsx: 내부 `copyToClipboard` 함수 제거, 훅 사용

**Verification:**
```bash
npm run check
# Expected: 173 tests pass, typecheck pass
```

---

### Task 1.2: `useDialog` 훅 생성

**Objective:** BaseDialog를 사용하는 6개 컴포넌트의 상태 관리(open, loading, error, confirmDisabled) 통합

**Files:**
- Create: `src/hooks/useDialog.ts`
- Modify: `src/components/FileCreateDialog.tsx`, `src/components/FileOpenDialog.tsx`, `src/components/PasswordGenerator.tsx`, `src/components/PinChangeDialog.tsx`, `src/components/TemplatePicker.tsx`, `src/components/WebsiteSelector.tsx`

**Step 1: Create hook**
```typescript
// src/hooks/useDialog.ts
import { useState, useCallback } from "react";

export interface DialogState {
  open: boolean;
  isLoading: boolean;
  errorMessage: string;
  confirmDisabled: boolean;
}

export interface UseDialogOptions {
  onConfirm?: () => Promise<void>;
  onClose?: () => void;
  initialConfirmDisabled?: boolean;
}

export function useDialog(options: UseDialogOptions = {}) {
  const [state, setState] = useState<DialogState>({
    open: false,
    isLoading: false,
    errorMessage: "",
    confirmDisabled: options.initialConfirmDisabled ?? false,
  });

  const open = useCallback(() => {
    setState((s) => ({ ...s, open: true, errorMessage: "", confirmDisabled: options.initialConfirmDisabled ?? false }));
  }, [options.initialConfirmDisabled]);

  const close = useCallback(() => {
    setState((s) => ({ ...s, open: false, isLoading: false, errorMessage: "" }));
    options.onClose?.();
  }, [options.onClose]);

  const setLoading = useCallback((loading: boolean) => {
    setState((s) => ({ ...s, isLoading: loading }));
  }, []);

  const setError = useCallback((message: string) => {
    setState((s) => ({ ...s, errorMessage: message, isLoading: false }));
  }, []);

  const setConfirmDisabled = useCallback((disabled: boolean) => {
    setState((s) => ({ ...s, confirmDisabled: disabled }));
  }, []);

  const handleConfirm = useCallback(async () => {
    if (state.confirmDisabled || state.isLoading) return;
    setState((s) => ({ ...s, isLoading: true, errorMessage: "" }));
    try {
      await options.onConfirm?.();
      close();
    } catch (err) {
      setState((s) => ({ ...s, errorMessage: err instanceof Error ? err.message : "오류가 발생했습니다.", isLoading: false }));
    }
  }, [state.confirmDisabled, state.isLoading, options.onConfirm, close]);

  return { ...state, open, close, setLoading, setError, setConfirmDisabled, handleConfirm };
}
```

**Step 2: Apply to each dialog component**

**Verification:**
```bash
npm run check
```

---

### Task 1.3: `useAutoLock` 훅 최적화

**Objective:** 불필요한 리렌더링 방지, useCallback 의존성 정리

**Files:**
- Modify: `src/hooks/useAutoLock.ts`, `src/components/AutoLockProvider.tsx`, `src/components/AutoLockIndicator.tsx`

**Step 1: Review current implementation**
- `tick` callback이 `navigate`에 의존 → `useNavigate`는 안정적임
- `startTimer`가 `tick`에 의존 → 순환 의존성 가능성
- `lockedRef`, `startedRef` 등 ref 사용으로 클로저 문제 회피 중

**Step 2: Optimize**
- `tick`에서 `navigate` 대신 ref에 저장된 navigate 함수 사용
- `TIMEOUT_MAP`을 모듈 레벨 상수로 유지 (이미 잘 되어 있음)
- `activity` 이벤트 리스너에 `passive: true` 유지 (이미 잘 되어 있음)

**Verification:**
```bash
npm run check
# AutoLock 관련 테스트 6개 통과 확인
```

---

## Phase 2: 큰 컴포넌트 분할 (우선순위: 높음)

### Task 2.1: AccountEdit 분할 (340줄 → 5개 파일)

**Objective:** 단일 책임 원칙 적용, 테스트 용이성 확보

**Files:**
- Create: `src/pages/AccountEdit/AccountEditor.tsx`
- Create: `src/pages/AccountEdit/components/AccountTitleSection.tsx`
- Create: `src/pages/AccountEdit/components/AccountFieldsSection.tsx`
- Create: `src/pages/AccountEdit/components/FieldEditor.tsx`
- Create: `src/pages/AccountEdit/components/WebsiteSelectorTrigger.tsx`
- Create: `src/pages/AccountEdit/hooks/useAccountEdit.ts`
- Modify: `src/pages/AccountEdit.tsx` (entry point)
- Delete: `src/pages/AccountEdit.tsx` (기존 파일 → 폴더로 변경)

**Step 1: Create folder structure**
```bash
mkdir -p src/pages/AccountEdit/components src/pages/AccountEdit/hooks
```

**Step 2: Extract hooks - `useAccountEdit.ts`**
```typescript
// src/pages/AccountEdit/hooks/useAccountEdit.ts
import { useState, useMemo, useCallback } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import type { Account, AccountField, FieldType } from "@/models/account";
import { useAccountStore } from "@/store/accountStore";
import { processWebsiteUrl } from "@/utils/urlUtils";
import { useClipboard } from "@/hooks/useClipboard";
import { useDialog } from "@/hooks/useDialog";
import { PasswordGenerator } from "@/components/PasswordGenerator";
import { WebsiteSelector } from "@/components/WebsiteSelector";

export function useAccountEdit() {
  // ... 기존 AccountEditor의 모든 상태/로직 이동
}
```

**Step 3: Create FieldEditor.tsx** - 단일 필드 렌더링 (type별 분기)
**Step 4: Create AccountFieldsSection.tsx** - 필드 리스트 + 추가/삭제
**Step 5: Create AccountTitleSection.tsx** - 제목/웹사이트/태그
**Step 6: Create WebsiteSelectorTrigger.tsx** - 웹사이트 선택 버튼
**Step 7: Create AccountEditor.tsx** - 메인 조합 컴포넌트 (~80줄)
**Step 8: Update AccountEdit.tsx** - 라우팅만 담당하는 얇은 wrapper

**Verification:**
```bash
npm run check
# AccountEdit 관련 테스트 모두 통과
```

---

### Task 2.2: Settings 분할 (399줄 → 6개 파일)

**Objective:** 섹션별 분리, 설정 액션 훅 추출

**Files:**
- Create: `src/pages/Settings/components/SecuritySection.tsx`
- Create: `src/pages/Settings/components/UISection.tsx`
- Create: `src/pages/Settings/components/DataSection.tsx`
- Create: `src/pages/Settings/components/AppInfoDialog.tsx`
- Create: `src/pages/Settings/hooks/useSettingsActions.ts`
- Modify: `src/pages/Settings.tsx` (메인 조합, ~100줄)

**Step 1: Create folder structure**
```bash
mkdir -p src/pages/Settings/components src/pages/Settings/hooks
```

**Step 2: Extract hooks - `useSettingsActions.ts`**
```typescript
// src/pages/Settings/hooks/useSettingsActions.ts
import { useCallback } from "react";
import { backupDataFile, openImportedDataFile, changePin, closeDataFile, isKiyoFile } from "@/database/fileStorage";
import { fileTable } from "@/database/fileTable";
import { useSessionStore } from "@/store/sessionStore";
import { useNavigate } from "react-router-dom";

export function useSettingsActions() {
  // handleBackup, handleRestore, handlePinChange, handleFileChange 등 이동
}
```

**Step 3: Create section components** - 각각 50-80줄 수준
**Step 4: Update Settings.tsx** - 섹션 조합만 담당

**Verification:**
```bash
npm run check
```

---

### Task 2.3: WebsiteSelector 분할 (319줄 → 4개 파일)

**Objective:** 검색/추천/카테고리/빈상태 분리, 선택 로직 훅화

**Files:**
- Create: `src/components/WebsiteSelector/components/SearchInput.tsx`
- Create: `src/components/WebsiteSelector/components/RecommendationCard.tsx`
- Create: `src/components/WebsiteSelector/components/CategorySection.tsx`
- Create: `src/components/WebsiteSelector/components/PresetItem.tsx`
- Create: `src/components/WebsiteSelector/components/EmptyState.tsx`
- Create: `src/components/WebsiteSelector/hooks/useWebsiteSelector.ts`
- Modify: `src/components/WebsiteSelector.tsx` (메인 조합, ~80줄)

**Step 1: Create folder structure**
```bash
mkdir -p src/components/WebsiteSelector/components src/components/WebsiteSelector/hooks
```

**Step 2: Extract hook - `useWebsiteSelector.ts`**
```typescript
// src/components/WebsiteSelector/hooks/useWebsiteSelector.ts
import { useState, useCallback, useMemo } from "react";
import type { WebsitePreset } from "@/models/websitePreset";
import { searchPresets, getPresetsByCategory } from "@/data/websitePresets";

export function useWebsiteSelector(currentTitle: string, currentWebsiteUrl: string) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPreset, setSelectedPreset] = useState<WebsitePreset | null>(null);
  const presetsByCategory = useMemo(() => getPresetsByCategory(), []);
  const searchResults = useMemo(() => searchQuery.trim() ? searchPresets(searchQuery) : [], [searchQuery]);
  const recommendation = useMemo(() => {
    if (!currentTitle.trim() || currentWebsiteUrl) return { show: false, preset: null as WebsitePreset | null };
    const results = searchPresets(currentTitle);
    return results.length > 0 ? { show: true, preset: results[0] } : { show: false, preset: null };
  }, [currentTitle, currentWebsiteUrl]);
  
  return { searchQuery, setSearchQuery, selectedPreset, setSelectedPreset, presetsByCategory, searchResults, recommendation };
}
```

**Step 3: Create UI components**
**Step 4: Update WebsiteSelector.tsx**

**Verification:**
```bash
npm run check
```

---

## Phase 3: 타입 강화 및 중복 제거 (우선순위: 중간)

### Task 3.1: PasswordField 모드 분리

**Objective:** `mode` prop 제거, 뷰/에디트 별도 컴포넌트로 분리

**Files:**
- Create: `src/components/PasswordFieldView.tsx`
- Create: `src/components/PasswordFieldEdit.tsx`
- Modify: `src/components/PasswordField.tsx` → 재수출 또는 삭제
- Modify: `src/pages/AccountDetail.tsx`, `src/pages/AccountEdit.tsx` (import 경로 변경)

**Step 1: Create PasswordFieldView.tsx** - mode="view" 로직만
**Step 2: Create PasswordFieldEdit.tsx** - mode="edit" 로직만 (onGenerate 포함)
**Step 3: Update imports**

**Verification:**
```bash
npm run check
```

---

### Task 3.2: FIELD_TYPES 중복 정의 제거

**Objective:** TemplateFieldEditor.tsx의 FIELD_TYPES 상수를 models/fieldTypes.ts에서 import하도록 변경

**Files:**
- Modify: `src/components/TemplateFieldEditor.tsx`
- Verify: `src/models/fieldTypes.ts`에 FIELD_TYPE_OPTIONS 존재 확인

**Step 1: Check models/fieldTypes.ts**
```typescript
// src/models/fieldTypes.ts
export type FieldType = "text" | "password" | "email" | "url" | "number" | "textarea" | "totp" | "select" | "date" | "secureText" | "secureTextarea";

export const FIELD_TYPE_OPTIONS: { value: FieldType; label: string; encrypted: boolean }[] = [
  { value: "text", label: "텍스트", encrypted: false },
  { value: "password", label: "비밀번호", encrypted: true },
  // ...
];
```

**Step 2: Update TemplateFieldEditor.tsx**
```typescript
// Before: const FIELD_TYPES = [...] (중복 정의)
// After:
import { FIELD_TYPE_OPTIONS } from "@/models/fieldTypes";
// 사용 시 FIELD_TYPE_OPTIONS.map(...)
```

**Verification:**
```bash
npm run check
```

---

### Task 3.3: IconPicker 상수 분리

**Objective:** ICON_OPTIONS를 data/icons.ts로 분리

**Files:**
- Create: `src/data/icons.ts`
- Modify: `src/components/IconPicker.tsx`

**Step 1: Create icons.ts**
```typescript
// src/data/icons.ts
export const ICON_OPTIONS = [
  "🔐", "🔑", "💳", "🏦", "📶", "📝", "🔒", "🔗",
  "📧", "🔢", "📄", "📋", "📅", "⚙️", "🌐", "💻",
  "📱", "🎮", "💰", "📸", "🎫", "🏷️", "🔖", "📌",
  "🔑", "🗝️", "💾", "💿", "📀", "💽",
] as const;
```

**Step 2: Update IconPicker.tsx**

**Verification:**
```bash
npm run check
```

---

### Task 3.4: BaseDialog 타입 강화

**Objective:** `onConfirm` 타입을 `() => Promise<void>`로 통일, `confirmDisabled` 기본값 명시

**Files:**
- Modify: `src/components/BaseDialog.tsx`
- Modify: 모든 BaseDialog 사용처 (6개 파일)

**Step 1: Update BaseDialog interface**
```typescript
// src/components/BaseDialog.tsx
interface BaseDialogProps {
  // ...
  onConfirm?: () => Promise<void>;  // FormEvent 제거
  confirmDisabled?: boolean;  // 기본값 false 명시
  // ...
}
```

**Step 2: Update callers** - handleConfirm에서 event.preventDefault() 제거 (form submit 아닌 button click으로 변경 권장)

**Verification:**
```bash
npm run check
```

---

## Phase 4: 테스트 및 검증 (우선순위: 필수)

### Task 4.1: 전체 테스트 실행

**Objective:** 모든 리팩토링 후 `npm run check` 통과 확인

**Commands:**
```bash
cd /c/Github/KIYO
npm run check
```

**Expected:**
- `npm run typecheck`: 0 errors
- `npm run test`: 173 tests pass (또는 동일 수)

---

### Task 4.2: 빌드 검증

**Objective:** 프로덕션 빌드 성공 확인

**Commands:**
```bash
npm run build
```

**Expected:** dist/ 폴더 생성, 에러 없음

---

### Task 4.3: 기능 검증 (수동)

**Objective:** 주요 사용자 플로우 동작 확인

**Checklist:**
- [ ] 홈 → 파일 생성 → 리스트 진입
- [ ] 계정 추가 (템플릿 선택 → 편집 → 저장)
- [ ] 계정 상세 보기 (비밀번호 복사)
- [ ] 계정 수정
- [ ] 설정: PIN 변경, 백업/복원, 다크모드, 글자크기
- [ ] 템플릿 관리 (생성/수정/삭제)
- [ ] 자동잠금 동작 (설정 → 대기 → 잠금)
- [ ] Android Autofill 설정 (Android에서만)

---

## 위험 요소 및 트레이드오프

| 위험 | 완화 방안 |
|------|-----------|
| 컴포넌트 분할로 인한 import 경로 변경 | @/ path alias 사용, 상대 경로 최소화 |
| 훅 추출 시 상태 동기화 문제 | useCallback/useMemo 적절히 사용, 의존성 배열 검증 |
| BaseDialog 타입 변경으로 기존 다이얼로그 깨짐 | 한 번에 모든 사용처 수정, 타입 에러로 누락 방지 |
| 테스트 커버리지 감소 | 리팩토링 전후 테스트 수 비교, 신규 훅 별도 테스트 추가 고려 |

---

## 파일 변경 요약

### 생성될 파일 (신규)
```
src/hooks/useClipboard.ts
src/hooks/useDialog.ts
src/pages/AccountEdit/AccountEditor.tsx
src/pages/AccountEdit/components/AccountTitleSection.tsx
src/pages/AccountEdit/components/AccountFieldsSection.tsx
src/pages/AccountEdit/components/FieldEditor.tsx
src/pages/AccountEdit/components/WebsiteSelectorTrigger.tsx
src/pages/AccountEdit/hooks/useAccountEdit.ts
src/pages/Settings/components/SecuritySection.tsx
src/pages/Settings/components/UISection.tsx
src/pages/Settings/components/DataSection.tsx
src/pages/Settings/components/AppInfoDialog.tsx
src/pages/Settings/hooks/useSettingsActions.ts
src/components/WebsiteSelector/components/SearchInput.tsx
src/components/WebsiteSelector/components/RecommendationCard.tsx
src/components/WebsiteSelector/components/CategorySection.tsx
src/components/WebsiteSelector/components/PresetItem.tsx
src/components/WebsiteSelector/components/EmptyState.tsx
src/components/WebsiteSelector/hooks/useWebsiteSelector.ts
src/components/PasswordFieldView.tsx
src/components/PasswordFieldEdit.tsx
src/data/icons.ts
```

### 수정될 파일
```
src/components/PasswordField.tsx          # 재수출 또는 삭제
src/components/PasswordGenerator.tsx      # useClipboard, useDialog 사용
src/components/PinChangeDialog.tsx        # useDialog 사용
src/components/FileCreateDialog.tsx       # useDialog 사용
src/components/FileOpenDialog.tsx         # useDialog 사용
src/components/TemplatePicker.tsx         # useDialog 사용
src/components/WebsiteSelector.tsx        # 분할된 컴포넌트 조합
src/components/TemplateFieldEditor.tsx    # FIELD_TYPES import 변경
src/components/IconPicker.tsx             # ICON_OPTIONS import 변경
src/components/BaseDialog.tsx             # 타입 강화
src/components/AutoLockIndicator.tsx      # useAutoLock 최적화 확인
src/components/AutoLockProvider.tsx       # useAutoLock 최적화 확인
src/hooks/useAutoLock.ts                  # 최적화
src/pages/AccountList.tsx                 # useClipboard 사용
src/pages/AccountDetail.tsx               # useClipboard 사용, PasswordFieldView import
src/pages/AccountEdit.tsx                 # 폴더 구조로 변경 (entry point만 남김)
src/pages/Settings.tsx                    # 섹션 컴포넌트 조합
src/pages/TemplateEdit.tsx                # TemplateFieldEditor 변경 반영
```

### 삭제될 파일
```
src/pages/AccountEdit.tsx (기존 단일 파일) → 폴더로 대체
```

---

## 실행 순서

1. **Phase 1** (훅 분리) - 가장 안전, 즉시 효과
2. **Phase 2** (컴포넌트 분할) - 순서 무관, 병렬 가능
3. **Phase 3** (타입/중복) - 의존성 낮음
4. **Phase 4** (검증) - 마지막 필수 단계

---

## 승인 대기

위 계획으로 진행하시겠습니까? 승인 시 Phase 1부터 순차적으로 구현합니다.