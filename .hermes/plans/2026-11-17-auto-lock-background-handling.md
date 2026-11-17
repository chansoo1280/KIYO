# Plan: 자동잠금 절대 시간 기반 비교 로직 추가

## Goal

`useAutoLock` 훅에 사용자 마지막 액션 시간과 현재 시간을 절대 시간으로 비교하여, 설정된 자동잠금 시간을 넘겼을 때 잠금을 수행하는 로직을 추가한다. `visibilitychange` 이벤트에 의존하지 않는다.

## Architecture

- 사용자 액션(click, keydown, touchstart, scroll) 발생 시 `lastActivityTime = Date.now()` 기록
- `cryptoKey`가 설정(잠금 해제)될 때 `lastActivityTime = Date.now()`로 초기화 (사용자 액션 없이도 설정 시간이 지나면 잠금)
- `setInterval`(1초 틱) 실행 시마다 `Date.now() - lastActivityTime >= TIMEOUT_MAP[autoLockTimeout]` 비교 (`>=` 사용, 정확히 경과한 시점부터 잠금)
- 차이가 타임아웃을 넘으면 `lockedRef.current = true`로 잠금 시작을 먼저 표시한 후 `lockDataFile()` 호출
- `lockedRef.current === true`이면 중복 잠금 방지 (즉시 리턴)
- `lockDataFile()` 실패 시 `lockedRef.current = false`로 복구
- 잠금 해제(복원) 시 `lockedRef.current = false` 리셋
- `lastActivityTime`이 null이면 비교 건너뜀
- `autoLockTimeout` 변경 시 기존 `lastActivityTime` 유지하고 변경된 타임아웃 즉시 적용
- `visibilitychange` 이벤트 미사용 (Android WebView 신뢰도 문제 회피)

## Tech Stack

- TypeScript (~6.0.2, strict, ESM only)
- React 19 (useEffect, useRef, useCallback)
- Zustand (settingsStore, sessionStore)
- Vitest (단위 테스트)

## Files

### Modify

- `src/hooks/useAutoLock.ts` — `lastActivityTime` ref 추가, 사용자 액션 핸들러에서 기록, `cryptoKey` 설정 시 초기화, setInterval 틱에서 절대 시간 비교 및 잠금 호출, 기존 `timeoutRef.current` decrement 로직 제거, `lockedRef` 해제/복구 로직 추가
- `src/hooks/useAutoLock.test.tsx` — 절대 시간 비교 기반 테스트 추가, 기존 decrement 기반 테스트 수정

## Tasks

각 task는 2~5분 단위로 분해하며, 순차적으로 의존성을 가진다.

1. [ ] `useAutoLock.ts`에 `lastActivityTime` ref 추가 (null 초기화)
2. [ ] `useAutoLock.ts` 사용자 액션 핸들러(`handleActivity`)에서 `lastActivityTime = Date.now()` 기록 로직 추가
3. [ ] `useAutoLock.ts` `tick` 콜백에서 `Date.now() - lastActivityTime >= TIMEOUT_MAP[autoLockTimeout]` 비교 후 `lockedRef.current = true` 설정 및 `lockDataFile()` 호출 (기존 `timeoutRef.current--` 로직 제거)
4. [ ] `useAutoLock.ts` `timeoutRef` 관련 코드 정리 (decrement 사용 안 하므로 불필요한 변수 제거)
5. [ ] `useAutoLock.ts` `useCallback` deps 배열 수정 — `tick`의 deps에 `autoLockTimeout`, `lockDataFile` 포함하여 최신 값 참조 보장
6. [ ] `useAutoLock.ts` `lockDataFile()` 호출 후 실패 시 `lockedRef.current = false`로 복구 처리
7. [ ] `useAutoLock.ts` `cryptoKey` 변경 시 `lastActivityTime = Date.now()` 초기화 및 `lockedRef.current = false` 리셋 (useEffect로 구현)
8. [ ] 기존 `useAutoLock.test.tsx`의 13개 테스트를 절대 시간 비교 방식으로 수정 (decrement 기반 테스트 → `vi.setSystemTime()` 기반으로 변경)
9. [ ] `useAutoLock.test.tsx`에 타임아웃 직전 테스트 (잠금 안 됨)
10. [ ] `useAutoLock.test.tsx`에 타임아웃 정확히 도달 테스트 (잠금 실행, `>=` 연산자 검증)
11. [ ] `useAutoLock.test.tsx`에 타임아웃 초과 테스트 (잠금 실행)
12. [ ] `useAutoLock.test.tsx`에 잠금 이후 중복 호출 방지 테스트
13. [ ] `useAutoLock.test.tsx`에 잠금 해제 직후 시간 초기화 테스트
14. [ ] `useAutoLock.test.tsx`에 타임아웃 변경 즉시 적용 테스트
15. [ ] `useAutoLock.test.tsx`에 액션 발생 시 마지막 액션 시간 갱신 테스트
16. [ ] `useAutoLock.test.tsx`에 `lastActivityTime` null 시 비교 건너뜀 테스트
17. [ ] `npm run typecheck` 통과
18. [ ] `npm run lint` 통과 (수정 파일 기준)
19. [ ] `npm run test` 통과 (기존 13개 테스트 + 신규 테스트)

### 의존성 순서

Tasks 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12 → 13 → 14 → 15 → 16 → 17 → 18 → 19

## Tests / Validation

- `npm run typecheck` — TypeScript 컴파일 오류 없음
- `npm run lint` — 수정한 파일에 새로운 lint 오류 없음 (기존 코드 에러는 제외)
- `npm run test` — Vitest 단위/통합 테스트 모두 통과 (기존 행위 유지)

## Risks / Tradeoffs / Open Questions

- **Risk**: `vi.useFakeTimers()` 환경에서 `Date.now()`도 fake될 수 있어, 절대 시간 비교 테스트 작성 시 `vi.setSystemTime()`으로 시간을 명시적으로 제어해야 함
- **Tradeoff**: 기존 `timeoutRef.current` decrement 방식을 완전히 제거함. 기존 테스트 13개 중 decrement 기반 로직을 검증하는 테스트가 있다면 수정 필요 (Task 8)
- **Risk**: `lockDataFile()`이 비동기 함수이므로, `lockedRef.current = true`를 설정한 후 실패하면 `lockedRef.current = false`로 복구해야 함. 그렇지 않으면 영구 잠금 상태가 될 수 있음. (Task 6)
- **Risk**: `cryptoKey`가 설정될 때 `lastActivityTime`을 초기화하는 로직을 `useEffect`에 구현할 때, `autoLockTimeout`이나 `cryptoKey` deps 변경 시 무한 루프가 발생할 수 있음. deps 배열을 신중히 구성해야 함. (Task 7)
- **Open Question**: `setInterval`이 백그라운드에서 브라우저에 의해 스로틀링될 수 있어 틱이 정확히 1초마다 돌지 않을 수 있음. 하지만 절대 시간 비교 방식이므로 스로틀링되어도 결국 현재 시간과 비교해 정확한 잠금 시점을 잡을 수 있음.
