# KIYO 테스트 전략 — 핵심 경계 중심

> 목표: 커버리지 숫자(%)가 아닌 **실제 버그 방지 / 포트폴리오 품질**  
> 접근: 전체 메서드/컴포넌트 나열식이 아니라 **데이터 손실·복호화 실패·세션 전환·자동잠금** 같은 보안 경계(boundary)만 타겟

---

## 현황 요약 (2026-08-12)

| 영역 | 테스트 수 | 커버리지 | 평가 |
|------|----------|----------|------|
| crypto (encryption, recordEncryption, autofillToken) | 66 | ~95% | ✅ 충분 |
| fileStorage (lifecycle, encryption, error) | 85 | ~62% | ✅ 핵심 플로우 검증됨 |
| useAutoLock | 6 | ~87% | ✅ 시간/상태 경계 검증됨 |
| **Store / DB Table / Components / Pages** | **0** | **0~50%** | ⚠️ 선택적 보강 필요 |

**총 172개 통과** — 이미 핵심 암호화/파일 저장/자동잠금은 검증됨.

---

## 하지 않을 것 (과투자 방지)

| 대상 | 이유 |
|------|------|
| `FileStorageError.test.ts` 전수 | enum/factory 검증은 버그 예방 효과 낮음. 실제 발생 플로우에서 검증 |
| `settingsStore` 단순 setter 전체 | "Zustand가 값을 저장한다" 테스트는 의미 없음. side effect만 확인 |
| `sessionStore` 단순 setter | 내부 상태 변경만 테스트해도 실질적 검증 안 됨 |
| `accountStore._persistAccounts` | 내부 구현 세부사항. DB/통합 테스트로 검증 |
| `accountTable.initializeDevData` | 개발용 데이터. 프로덕션 로직 아님 |
| `db.ts` 단순 초기화 | 상위 계층 테스트에서 이미 검증됨 |
| Components 23개 전체 | dumb component 테스트는 유지보수 비용 대비 가치 낮음 |
| Pages 11개 전체 | E2E가 실제 사용자 흐름을 검증 중. 단위 테스트 중복 |
| `useClipboard` | 단순 wrapper. 우선순위 낮음 |

---

## 반드시 테스트할 것 (P0)

### 1. `fileTable.ts` — 파일 기반 vault의 핵심 경계
> 세션 복구·파일 전환·활성 파일 관리의 진입점

```text
테스트 케이스
├── 활성 파일 저장/조회 (정상)
├── 파일 생성 → 활성화 → 조회 플로우
├── 존재하지 않는 파일 조회 → null/에러
├── JSON parse 실패한 레코드 복구 시도
├── DB 레코드와 실제 파일 상태 불일치 감지
└── 파일 삭제 후 세션 정리
```

### 2. `accountTable.ts` — 암호화 왕복 경계
> `Account` → encrypt → IndexedDB → decrypt → `Account` 가 깨지면 데이터 손실

```text
테스트 케이스 (public API만)
├── create → get → 동일 객체 복원 (암호화 key 있음/없음)
├── update → get → 변경사항 반영
├── delete → get → undefined
├── clear → getAll → []
├── 여러 계정 생성 → getAll 순서/정렬 검증
└── 잘못된 key로 복호화 시도 → 에러 (데이터 손상 방지)
```

### 3. `templateTable.ts` — 동일 패턴
```text
테스트 케이스 (public API만)
├── create → get → 동일 객체 (암호화 key 있음/없음)
├── update → 정렬(sortOrder) 유지
├── delete / clear
└── 복호화 실패 시 에러
```

### 4. `fileStorage.ts` — `changePin` 전용
> PIN 변경은 암호화 데이터와 직결되는 위험한 operation

```text
테스트 케이스
├── 평문 → 암호화 (새 PIN 설정)
├── 암호화 → 암호화 (PIN 변경, 기존 salt 재사용 안 함)
├── 암호화 → 평문 (PIN 제거)
├── 잘못된 현재 PIN → 에러, 원본 데이터 보존
├── 동일 PIN 재설정 → 에러
└── 변경 후 unlock → 데이터 무결성 확인
```

### 5. `useFileAuthGuard.tsx` — 라우팅/인증 경계
> 보호된 페이지 접근 시 리다이렉트·인증 상태 검증

```text
테스트 케이스
├── 암호화 파일 + 세션 없음 → Auth 페이지 리다이렉트
├── 암호화 파일 + 세션 유효 → 통과
├── 평문 파일 → 통과 (skipRedirect 옵션 포함)
├── 파일 없음 → Home으로 리다이렉트
└── 파일 닫힘 상태 → Auth 페이지 리다이렉트
```

### 6. `useAutoLock.ts` — 핵심 edge case 유지
> 이미 87%지만, 다음 경계는 **반드시** 유지

```text
이미 검증됨 (유지)
├── 마운트 → 타이머 시작 → 카운트다운 → 0 → lockDataFile 호출
├── 'none' 설정 → 타이머 비활성화
├── 사용자 활동(click) → 타이머 리셋
├── timeout 변경 → 타이머 재시작
├── cryptoKey 상실 → 즉시 remainingSeconds = 0
└── 언마운트 → 타이머 정리

추가 권장 (잉여 시간 여유 시)
├── 탭 비활성 → 재활성 시 타이머 동기화
└── 다중 마운트/언마운트 시 중복 타이머 방지
```

---

## 있으면 좋음 (P1) — public behavior 중심만

### 7. `settingsStore.ts` — side effect만
```text
테스트 케이스
├── toggleTheme() → document.documentElement.classList 변경 + localStorage persist
├── setFontSize() → document.documentElement.classList 변경 + persist
├── 새로고침 후 initializeTheme() → 저장된 테마 복원 + 클래스 적용
├── 새로고침 후 initializeFontSize() → 저장된 폰트 복원 + 클래스 적용
└── setAutoLockTimeout() → state 변경만 (side effect 없음 → 테스트 생략 가능)
```

### 8. `templateStore.ts` / `accountStore.ts` — Autofill sync 경계
```text
templateStore
├── createTemplate → DB 저장 → loadTemplates → 정렬 유지
├── updateTemplate → DB 반영 → loadTemplates
└── deleteTemplate → DB 반영

accountStore (Autofill 연동만)
├── add/update/delete → syncToAutofill 호출 확인 (mock)
└── Capacitor 비-Android 환경 → sync 생략 확인
```

### 9. `db.ts` — snapshot/restore
```text
테스트 케이스
├── getDatabaseSnapshot → 전체 데이터 구조 반환 (암호화 key 있음/없음)
├── replaceDatabaseData → 평문/암호화 모두 복원
└── 암호화 데이터 replace 시 encryptedFileData 전달 → DB에 암호화된 상태로 저장
```

---

## 선택 (P2) — 시간 여유 시

### 10. 핵심 Component 3~5개
> 상태/행동이 복잡한 것만

| 컴포넌트 | 테스트 이유 |
|----------|-------------|
| `BaseDialog` | 포털/포커스 트랩/ESC 닫기/백드롭 클릭 |
| `PasswordField` | show/hide 토글, 복사, 생성기 연동 |
| `TemplatePicker` | 템플릿 선택 → 필드 동적 생성 |
| `AccountForm` (AccountEdit 섹션) | 필드 추가/삭제/순서/검증 |
| `FileSelector` (Settings) | 파일 생성/열기/가져오기/내보내기 플로우 |

### 11. 핵심 Page 분기만
> E2E와 중복 안 되게 **렌더링+핵심 분기**만

| 페이지 | 테스트 분기 |
|--------|-------------|
| `Auth.tsx` | PIN 성공 → unlock + navigate / PIN 실패 → error 표시 |
| `AccountEdit.tsx` | create 모드 / update 모드 초기값 로드 |
| `Settings.tsx` | 테마/폰트/자동잠금 변경 → side effect 발생 확인 |

### 12. `useClipboard.ts`
> 시간 남으면. 권한 요청/실패/성공 플로우

---

## 테스트 파일 생성 계획 (실제 파일 기준)

```
src/
├── database/
│   ├── fileTable.test.ts              ← P0 (신규)
│   ├── accountTable.test.ts           ← P0 (보강: public API 중심)
│   ├── templateTable.test.ts          ← P0 (보강: public API 중심)
│   └── fileStorage.changePin.test.ts  ← P0 (신규: changePin 전용)
├── hooks/
│   ├── useFileAuthGuard.test.tsx      ← P0 (신규)
│   └── useAutoLock.test.tsx           ← 유지 (기존)
├── store/
│   ├── settingsStore.test.ts          ← P1 (신규: side effect만)
│   ├── templateStore.test.ts          ← P1 (신규: public API)
│   └── accountStore.autofill.test.ts  ← P1 (신규: syncToAutofill만)
└── components/
    ├── BaseDialog.test.tsx            ← P2
    ├── PasswordField.test.tsx         ← P2
    ├── TemplatePicker.test.tsx        ← P2
    ├── AccountForm.test.tsx           ← P2
    └── FileSelector.test.tsx          ← P2
```

**예상 추가 테스트: 25~35개** (현재 172개 → ~200개)

---

## 실행 순서

```bash
# 1. P0 순차 진행
npm run test -- --watch  # 개발 중 감시 모드

# 2. 각 파일 생성 후 바로 실행 검증
npm run test src/database/fileTable.test.ts
npm run test src/database/accountTable.test.ts
npm run test src/database/templateTable.test.ts
npm run test src/database/fileStorage.changePin.test.ts
npm run test src/hooks/useFileAuthGuard.test.tsx

# 3. P1 진행
npm run test src/store/settingsStore.test.ts
npm run test src/store/templateStore.test.ts
npm run test src/store/accountStore.autofill.test.ts
npm run test src/database/db.snapshot.test.ts

# 4. P2 (시간 여유 시)
npm run test src/components/*.test.tsx

# 5. 전체 검증
npm run check  # typecheck + test
```

---

## 포트폴리오 어필 포인트

> "전체 커버리지 70%가 아니라, **암호화 데이터 왕복·PIN 변경·세션 복구·자동잠금 상태 머신·인증 경계** 같은 **보안 크리티컬 패스**에 대한 테스트를 경계 기준으로 설계했습니다."

- `fileTable` / `accountTable` / `templateTable`: **암호화 ↔ IndexedDB ↔ 복호화** 왕복 검증
- `fileStorage.changePin`: **키 회전(key rotation)** 시 데이터 무결성 보장
- `useAutoLock`: **시간/상태 기반 보안 상태 머신** 검증 (타이머, cryptoKey 상실, 활동 감지)
- `useFileAuthGuard`: **라우팅 가드**로서 인증 우회 방지
- `settingsStore`: **side effect(테마/폰트 클래스, persist, 복원)** 검증

---

## 참고: 기존 테스트 유지 원칙

- ❌ 기존 테스트 삭제/변경 안 함
- ❌ 통합 테스트를 단위 테스트로 대체 안 함 (역할 다름)
- ✅ 신규 테스트는 **행동/경계 중심**으로만 추가
- ✅ `vi.mock` 남용 피하고 **실제 DB/암호화** 사용 (이미 통합 테스트에서 검증된 패턴 유지)