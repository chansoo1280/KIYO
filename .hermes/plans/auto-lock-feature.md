# 자동잠금 기능 구현 계획

## 개요
설정에서 자동잠금 시간 선택(미사용/1분/10분/30분) → 화면 하단에 남은 시간 표시 → 시간 만료 시 세션 정리 후 첫 화면(/)로 이동 → Auth로 리다이렉트 → PIN 입력으로 복구

---

## 1. 설정 저장소 확장 (`src/store/settingsStore.ts`)

### 상태 추가
```typescript
autoLockTimeout: 'none' | '1m' | '10m' | '30m'  // 기본값: 'none'
```

### 액션 추가
- `setAutoLockTimeout(timeout: 'none' | '1m' | '10m' | '30m')` — localStorage 영구 저장
- `initializeAutoLockTimeout()` — 초기화용

### partialize 업데이트
```typescript
partialize: (state) => ({
  theme: state.theme,
  fontSize: state.fontSize,
  autoLockTimeout: state.autoLockTimeout,
})
```

---

## 2. 잠금 전용 함수 추가 (`src/database/fileStorage.ts`)

### `lockDataFile` 신규 생성
```typescript
export const lockDataFile = async (): Promise<void> => {
  // Clear only crypto key from session, keep activeFileName and salt
  await useSessionStore.getState().clearCryptoKey();
  // Save lock state to autofill (marks as locked)
  await KiyoAutofill.saveSession({ isLock: true });
  // Do NOT call fileTable.clearActiveFileInfo() - preserve file info for unlock
};
```

### `closeDataFile` vs `lockDataFile` 차이
| 동작 | closeDataFile (파일 변경/로그아웃) | lockDataFile (자동잠금) |
|------|-----------------------------------|------------------------|
| sessionStore.clearSession() | ✅ | ❌ `clearCryptoKey()` |
| accountStore.clearAccounts() | ✅ | ❌ |
| KiyoAutofill.clearSession() | ✅ | ❌ `saveSession({ isLock: true })` |
| fileTable.clearActiveFileInfo() | ✅ | ❌ **보존** (activeFileName, salt 유지) |

**📝 변경사항**: `lockDataFile`은 `clearSession()` 대신 `clearCryptoKey()`만 호출하여 `activeFileName`과 `salt`를 보존. `accountStore.clearAccounts()` 호출 안 함.

---

## 3. `clearCryptoKey` 추가 (`src/store/sessionStore.ts`)

```typescript
clearCryptoKey: async () => {
  set({ cryptoKey: null });
},
```

---

## 3. 전역 자동잠금 타이머 훅 (`src/hooks/useAutoLock.ts`)

### 역할
- 앱 전역 유휴 시간 감지 및 자동잠금 트리거
- 설정값 변경 시 타이머 리셋/시작/정지
- 사용자 활동(클릭, 키다운, 터치, 스크롤) 감지 시 타이머 리셋 (`document` 전역 이벤트)
- 1초마다 카운트다운, 0 도달 시 `lockDataFile()` + `navigate('/', { replace: true })`
- `cryptoKey` 존재 시(암호화된 파일 열림)만 작동
- **백그라운드/탭 전환 시 타이머 일시정지하지 않고 계속 진행** — 포커스 복귀 시 이미 0이면 잠김 처리

### 반환값
- `remainingSeconds: number` — 남은 초 (하단 표시용)
- `resetTimer: () => void` — 수동 리셋용

---

## 4. 남은 시간 표시 컴포넌트 (`src/components/AutoLockIndicator.tsx`)

### 위치
- `fixed bottom-20 right-4 z-40` (우측 하단, BottomTabs 위쪽)

### 스타일
- 캡슐 형태: `rounded-full bg-[var(--color-code-bg)] border px-3 py-1 text-xs`
- `remainingSeconds > 0`일 때만 표시

### 포맷
- `자동잠금: 09:30` (mm:ss)
- 10초 이하: `text-[var(--color-accent)]` 강조

---

## 5. 설정 UI 추가 (`src/pages/Settings.tsx`)

### 위치
- Security 섹션 내 "자동잠금" 항목

### UI
```tsx
<select
  value={autoLockTimeout}
  onChange={(e) => {
    setAutoLockTimeout(e.target.value as AutoLockTimeout);
    setSecurityMessage(...);
  }}
  onPointerDown={(e) => {
    if (!isEncrypted) {
      e.preventDefault();
      setSecurityMessage("암호화된 파일에서만 자동잠금을 설정할 수 있습니다. PIN을 설정해 파일을 암호화하세요.");
    }
  }}
  disabled={!isEncrypted}
>
  <option value="none">미사용</option>
  <option value="1m">1분</option>
  <option value="10m">10분</option>
  <option value="30m">30분</option>
</select>
```

**📝 변경사항**:
- `isEncrypted` 상태를 `fileTable.getActiveFileInfo()`로 실시간 체크 (`useEffect` 의존성에 `fileName, cryptoKey` 추가)
- 암호화되지 않은 파일일 때 `disabled` + 회색 스타일 + `onPointerDown`으로 안내 메시지 표시
- 자동잠금 변경 시 즉시 `securityMessage` 표시
- 다크모드/글자크기 변경 시 `uiMessage` 표시
- 백업/복원 시 `dataMessage` 표시
- 섹션별 메시지 분리: `securityMessage`/`uiMessage`/`dataMessage`

---

## 6. `AutoLockProvider` 추가 (`src/components/AutoLockProvider.tsx`)

**📝 추가됨**: `useAutoLock()`이 `useNavigate()`를 사용하므로 Router 내부에서 실행되도록 별도 Provider 컴포넌트 생성.

```tsx
export function AutoLockProvider({ children }) {
  useAutoLock();
  return <> {children} <AutoLockIndicator /> </>;
}
```

`App.tsx`에서 `<AutoLockProvider>`로 `<Routes>` 감싸기.

---

## 7. Home 페이지 수정 (`src/pages/Home.tsx`)

**📝 변경사항**: `useSessionStore` 대신 `fileTable.getActiveFileInfo()`로 직접 체크하여 `encrypted: true` 시 `/auth` 리다이렉트.

```typescript
const { activeFileName, fileData, encrypted } = await fileTable.getActiveFileInfo();
if (!activeFileName) return;
if (encrypted) {
  navigate("/auth", { replace: true });
  return;
}
```

---

## 8. 파일 닫을 때 자동잠금 리셋 (`closeDataFile`)

```typescript
export const closeDataFile = async (): Promise<void> => {
  await useSessionStore.getState().clearSession();
  await useAccountStore.getState().clearAccounts();
  await KiyoAutofill.clearSession();
  await fileTable.clearActiveFileInfo();
  // Reset auto-lock timeout to default (none) when file is closed
  await useSettingsStore.getState().setAutoLockTimeout("none");
};
```

---

## 9. 표시 대상 페이지 정리

자동잠금 남은 시간이 표시되어야 하는 페이지 (암호화된 파일이 열려 있는 상태에서 접근 가능):

| 경로 | 페이지 | 비고 |
|------|--------|------|
| `/list` | AccountList | 메인 계정 목록 |
| `/account` | AccountDetail | 계정 상세 (새로 만들기) |
| `/account/:id` | AccountDetail | 계정 상세 보기 |
| `/account/edit` | AccountEdit | 계정 추가 |
| `/account/edit/:id` | AccountEdit | 계정 수정 |
| `/settings` | Settings | 설정 페이지 |
| `/templates` | TemplateList | 템플릿 목록 |
| `/templates/new` | TemplateEdit | 템플릿 생성 |
| `/templates/:id/edit` | TemplateEdit | 템플릿 수정 |

**표시 불필요 페이지** (세션 없음):
- `/` (Home — 파일 선택 화면)
- `/auth` (Auth — PIN 입력 화면)
- `/autofill-test` (테스트용)

---

## 10. 복구 시나리오 (자동잠금 후 사용자 복귀)

1. 사용자가 `/` (Home) 도착
2. `Home.tsx`에서 `fileTable.getActiveFileInfo()`로 활성 파일 감지
3. `encrypted: true`면 `/auth`로 리다이렉트 (기존 로직 그대로 동작)
4. PIN 입력 후 `unlockFile()` 호출 → 세션 복원 (`sessionStore.setSession` + `fileTable.saveFileDataToDB`)

---

## 구현 순서 (실제)

1. `src/store/settingsStore.ts` — 상태/액션/partialize/초기화 추가
2. `src/store/sessionStore.ts` — `clearCryptoKey` 추가
3. `src/database/fileStorage.ts` — `lockDataFile`, `closeDataFile` 수정
4. `src/hooks/useAutoLock.ts` — 신규 생성
5. `src/components/AutoLockIndicator.tsx` — 신규 생성
6. `src/components/AutoLockProvider.tsx` — 신규 생성
7. `src/pages/Settings.tsx` — select UI, 섹션별 메시지, `isEncrypted` 실시간 체크
8. `src/pages/Home.tsx` — `fileTable`로 리다이렉트 체크
9. `src/App.tsx` — `AutoLockProvider` 통합
10. `src/test/mocks/sessionStoreMock.ts` — `clearCryptoKey` 모킹 추가
11. `npm run check` — 타입체크 + 테스트 통과 확인

---

## 사용자 결정 사항 반영

1. **타이머 리셋 트리거**: `document` 전역 이벤트(click, keydown, touchstart, scroll)로 충분
2. **백그라운드/화면 꺼짐**: 타이머 일시정지하지 않고 계속 진행 — 시간 만료 후 복귀 시 자동 잠금
3. **옵션**: 미사용 / 1분 / 10분 / 30분만 (추가 옵션 없음)

---

## 실제 구현과 계획의 주요 차이점

| 항목 | 계획 | 실제 구현 |
|------|------|-----------|
| `lockDataFile` | `clearSession()` 호출 | `clearCryptoKey()`만 호출 (파일정보 보존) |
| `accountStore.clearAccounts()` | 호출 | 호출 안 함 |
| `AutoLockProvider` | 계획에 없음 | Router 내부 실행을 위해 추가 |
| `Home.tsx` 리다이렉트 | 기존 로직 유지 | `fileTable` 직접 조회로 변경 |
| `closeDataFile` | 계획에 없음 | `autoLockTimeout: "none"` 리셋 추가 |
| 섹션별 메시지 | 단일 `message` | `securityMessage`/`uiMessage`/`dataMessage` 분리 |
| 비활성화된 select 안내 | 계획에 없음 | `onPointerDown`으로 안내 메시지 |
| `clearCryptoKey` 액션 | 계획에 없음 | `sessionStore`에 추가 |
| 테스트 모킹 | 계획에 없음 | `sessionStoreMock.ts` 업데이트 |