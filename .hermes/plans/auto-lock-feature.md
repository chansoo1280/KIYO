# 자동잠금 기능 구현 계획

## 개요
설정에서 자동잠금 시간 선택(미사용/1분/10분/30분) → 화면 하단에 남은 시간 표시 → 시간 만료 시 세션 정리 후 첫 화면(/)로 이동

---

## 1. 설정 저장소 확장 (`src/store/settingsStore.ts`)

### 상태 추가
```typescript
autoLockTimeout: 'none' | '1m' | '10m' | '30m'  // 기본값: 'none'
```

### 액션 추가
- `setAutoLockTimeout(timeout: 'none' | '1m' | '10m' | '30m')` — localStorage 영구 저장

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
  // 1. 세션만 정리 (cryptoKey, salt 제거) — activeFileName은 유지
  await useSessionStore.getState().clearSession();
  // 2. 계정 데이터 메모리에서 정리
  await useAccountStore.getState().clearAccounts();
  // 3. 네이티브 자동완성 세션 정리 (잠금 상태로 저장)
  await KiyoAutofill.saveSession({ isLock: true });
  // 4. fileTable.clearActiveFileInfo() 호출 안 함 — 파일 정보 보존
};
```

### `closeDataFile` vs `lockDataFile` 차이
| 동작 | closeDataFile (파일 변경/로그아웃) | lockDataFile (자동잠금) |
|------|-----------------------------------|------------------------|
| sessionStore.clearSession() | ✅ | ✅ |
| accountStore.clearAccounts() | ✅ | ✅ |
| KiyoAutofill.clearSession() | ✅ | ❌ `saveSession({ isLock: true })` |
| fileTable.clearActiveFileInfo() | ✅ | ❌ **보존** (activeFileName, salt 유지) |

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
- `fixed bottom-0 left-1/2 -translate-x-1/2 z-40` (BottomTabs 위쪽)

### 스타일
- 캡슐 형태: `rounded-full bg-[var(--color-code-bg)] border border-[var(--color-border)] px-3 py-1 text-xs`
- `remainingSeconds > 0`일 때만 표시

### 포맷
- `자동잠금: 09:30` (mm:ss)
- 10초 이하: `text-[var(--color-accent)]` 강조

---

## 5. 설정 UI 추가 (`src/pages/Settings.tsx`)

### 위치
- Security 섹션 내 "자동잠금" 항목 (기존 빈 div 자리에)

### UI
```tsx
<select
  value={autoLockTimeout}
  onChange={(e) => setAutoLockTimeout(e.target.value as AutoLockTimeout)}
  className="..."
>
  <option value="none">미사용</option>
  <option value="1m">1분</option>
  <option value="10m">10분</option>
  <option value="30m">30분</option>
</select>
```

---

## 6. App 레벨 통합 (`src/App.tsx`)

### 추가 사항
- `useAutoLock()` 훅 호출 (초기화용, 반환값 미사용)
- `AutoLockIndicator` 컴포넌트 렌더링 (Routes 바깥, 전역 표시)

---

## 7. 표시 대상 페이지 정리

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

## 8. 복구 시나리오 (자동잠금 후 사용자 복귀)

1. 사용자가 `/` (Home) 도착
2. `Home.tsx`에서 `fileTable.getActiveFileInfo()`로 활성 파일 감지
3. `encrypted: true`면 `/auth`로 리다이렉트 (기존 로직 그대로 동작)
4. PIN 입력 후 `unlockFile()` 호출 → 세션 복원 (`sessionStore.setSession` + `fileTable.saveFileDataToDB`)

**이미 구현됨** (`Auth.tsx:18-25`):
```typescript
const { activeFileName, encrypted } = await fileTable.getActiveFileInfo();
if (!activeFileName || !encrypted) {
  navigate("/", { replace: true });
  return;
}
```

---

## 구현 순서

1. `src/store/settingsStore.ts` — 상태/액션/partialize 추가
2. `src/database/fileStorage.ts` — `lockDataFile` 함수 추가
3. `src/hooks/useAutoLock.ts` — 신규 생성
4. `src/components/AutoLockIndicator.tsx` — 신규 생성
5. `src/pages/Settings.tsx` — select UI 추가
6. `src/App.tsx` — 훅/컴포넌트 통합
7. `npm run check` — 타입체크 + 테스트 통과 확인

---

## 사용자 결정 사항 반영

1. **타이머 리셋 트리거**: `document` 전역 이벤트(click, keydown, touchstart, scroll)로 충분
2. **백그라운드/화면 꺼짐**: 타이머 일시정지하지 않고 계속 진행 — 시간 만료 후 복귀 시 자동 잠금
3. **옵션**: 미사용 / 1분 / 10분 / 30분만 (추가 옵션 없음)