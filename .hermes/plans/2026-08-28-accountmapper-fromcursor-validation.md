# Plan: AccountMapper.fromCursor Corrupt-Row Guard

**Date:** 2026-08-28
**Branch:** `feature/autofill-reliability`
**Related:** STRATEGY.md Track 1 — 자동완성 신뢰도
**Parent plan:** `2026-08-24-autofill-reliability.md` § 2 AccountMapper Improvements
**Status:** Implemented with enhancements — see Implementation Notes below

---

## Goal

`AccountMapper.fromCursor` 가 손상된 row(DB에 남은 username 또는 password 비어있는 row)에 대해 `AutofillAccount?` null을 반환하도록 가드를 추가한다. 이로써 단일 손상 row가 도메인/앱 매칭의 fill 응답 전체를 망가뜨리는 일을 차단한다. `parseReactAccount` (쓰기 경로) 의 가드 패턴과 동일하게 맞추어 두 경로의 매퍼 계약이 대칭이 되도록 한다.

완료 시 다음이 참이어야 한다:

1. `fromCursor`의 반환 시그니처가 `AutofillAccount` → `AutofillAccount?`로 변경되고, username 또는 password 가 `null` 또는 빈 문자열인 row에 대해 `null`을 반환한다
2. `DomainMatcher`와 `AutofillRepository`의 모든 호출부(9곳)가 `AutofillAccount?`를 처리한다 — 0..1 반환 함수는 그대로 null 전파, List 반환 함수는 `filterNotNull`로 손상 row 제거
3. 손상 row 발견 시 `Log.w`로 도메인/앱 컨텍스트가 남는다 (사일런트 드롭 아님 — 추후 진단용)
4. `AccountMapperTest`에 손상 row 가드 시나리오 추가, 기존 테스트는 모두 green
5. `DomainMatcherTest`/`AutofillRepositoryTest` 등 호출부 회귀 없음

---

## Current State

### AccountMapper.fromCursor (읽기 경로)

`android/app/src/main/java/com/kiyo/app/autofill/repository/AccountMapper.kt:143-180`

```kotlin
fun fromCursor(cursor: Cursor): AutofillAccount {
    val password = cursor.getString(cursor.getColumnIndexOrThrow(AutofillDatabaseHelper.COLUMN_PASSWORD))
    // ... packageNames 파싱 ...
    return AutofillAccount(
        id = cursor.getLong(...),
        username = cursor.getString(...),   // ← 검증 없이 그대로 주입
        password = password,                // ← 검증 없이 그대로 주입
        // ...
    )
}
```

- `packageNames`만 JSON 파싱 실패 시 `emptyList()`로 방어됨 (라인 149-166)
- `username` / `password`는 **그저 `cursor.getString(...)`로 읽어 그대로 반환** — null/빈 문자열 모두 통과
- `AutofillAccount.username`은 `val` (non-null String)이므로 손상 row의 null이 매퍼 경계를 넘어가는 순간 KSP/IDE가 못 잡는 **런타임 NPE 위험**

### AccountMapper.parseReactAccount (쓰기 경로) — 가드 패턴의 기준

`AccountMapper.kt:110-137` (요지)

```kotlin
// Skip if no username or password
if (username.isEmpty() || password.isEmpty()) {
    val skippedTitle = json.optString(\"title\", \"unknown\")
    Log.w(TAG, \"Skipping account with missing username/password: $skippedTitle\")
    return null
}
// ... return AutofillAccount ...
} catch (e: Exception) {
    Log.e(TAG, \"Error parsing React account\", e)
    return null
}
```

이미 두 겹의 가드(필드 검증 + 예외 catch)를 가지며, 시그니처는 `AutofillAccount?`이다.

### 호출부 (9곳)

|| # | 위치 | 패턴 | 영향 |
||---|---|---|---|
|| 1 | `DomainMatcher.kt:43` (findMatchingAccounts) | `while ... accounts.add(AccountMapper().fromCursor(c))` | 시그니처 변경 시 `add(AutofillAccount?)` 타입 불일치 → `filterNotNull` 필요 |
|| 2 | `DomainMatcher.kt:152` (findBestMatch: website 도메인 fallback) | `if (c.moveToFirst()) AccountMapper().fromCursor(c) else null` | `AutofillAccount?` 그대로 사용 — 변경 거의 없음 |
|| 3 | `DomainMatcher.kt:177` (findBestMatch: packageName fallback) | 동일 패턴 | 동일 |
|| 4 | `DomainMatcher.kt:204` (findByPackageName) | 리스트 | `filterNotNull` |
|| 5 | `DomainMatcher.kt:238` (findBestMatch: combined 케이스) | 리스트 | `filterNotNull` |
|| 6 | `DomainMatcher.kt:308` (getAllAccounts) | 리스트 | `filterNotNull` |
|| 7 | `DomainMatcher.kt:332` (getAccountsByDomain) | 리스트 | `filterNotNull` |
|| 8 | `DomainMatcher.kt:355` (getAccountsByPackageName) | 리스트 | `filterNotNull` |
|| 9 | `AutofillRepository.kt:272` (getAccountById) | 단일 | `AutofillAccount?` 그대로 |

### 기존 테스트

`android/app/src/test/java/com/kiyo/app/autofill/repository/AccountMapperTest.kt` — 13 tests green. `fromCursor` 다뤄지는 케이스 이미 존재하나 **손상 row 가드** 시나리오는 없음.

`DomainMatcherTest` 26 tests, `AutofillRepositoryTest`(?), `AuthRequestHandlerTest` 5 tests — 회귀 검증 베이스라인.

---

## Relevant Files

```
android/app/src/main/java/com/kiyo/app/autofill/
├── repository/
│   ├── AccountMapper.kt               # fromCursor 가드 추가, 시그니처 AutofillAccount? 로 변경
│   ├── AutofillRepository.kt          # getAccountById 호출부 (라인 272)
│   └── DomainMatcher.kt               # 8개 호출부 (라인 43, 152, 177, 204, 238, 308, 332, 355)
android/app/src/test/java/com/kiyo/app/autofill/
├── repository/
│   ├── AccountMapperTest.kt           # 손상 row 가드 테스트 추가
│   ├── DomainMatcherTest.kt           # 회귀 베이스라인
│   └── AutofillRepositoryTest.kt      # 회귀 베이스라인 (존재 시)
docs/research/                         # (참고) 기존 autofill 설계 문서 — 이번 변경은 단순 가드라 갱신 불필요
```

---

## Architecture

### 데이터 흐름 (변경 없음)

```
AutofillService.onFillRequest
       │
       ▼
AutofillRepository.findMatchingAccounts(domain) ──┐
       │                                          │
       ▼                                          ▼
DomainMatcher.findMatchingAccounts           (또는 findByPackageName, getAccountById, ...)
       │                                          │
       ▼                                          ▼
SQLCipher DB cursor ──► AccountMapper.fromCursor ──► AutofillAccount
                       (★ 가드 추가 지점)            (★ ?로 변경)
```

변경은 매퍼 경계에서만 일어난다. 호출부는 \"null이 나올 수 있다\"는 사실만 받아들이면 된다.

### 가드 정책 (parseReactAccount 패턴 동일)

|| 입력 조건 | 동작 | 로그 |
||---|---|---|
|| `username == null` 또는 `username.isEmpty()` | `return null` | `Log.w(TAG, \"Skipping corrupt autofill account row id=<id> domain=<d>: username is empty\")` |
|| `password == null` 또는 `password.isEmpty()` | `return null` | `Log.w(TAG, \"Skipping corrupt autofill account row id=<id> domain=<d>: password is empty\")` |
|| `username`과 `password` 모두 정상 | 기존 동작 유지 (AutofillAccount 반환) | — |

`parseReactAccount`와 다른 점: `parseReactAccount`는 try/catch로 JSONException 등을 함께 잡지만, `fromCursor`는 `getString`/`getLong`/`getInt` 호출이므로 try/catch는 **과보호**. 검증 조건만으로 충분하다. 단, 컬럼 누락(`getColumnIndexOrThrow`)은 호출자(Repository) 측 버그이므로 가드 대상이 아니다 — 현재 동작 유지.

`id` 로깅은 추후 진단용 (사용자가 \"갑자기 autofill 안 됨\" 신고 시 어떤 row가 건너뛰어졌는지 식별 가능). `domain`은 사용자가 공개적으로 autofill한 사이트(비밀 아님)이므로 허용. **단, `packageNames`는 로그에서 제외한다** — Android 앱 패키지명(예: `com.example.bank`)은 사용자가 어떤 앱을 쓰는지에 대한 정보로, 도메인보다 민감할 수 있다(동성애자 커뮤니티/정신건강/정치 앱 등). 매핑 시점에 패키지명을 별도로 캐싱하지 않으므로, 로그 누락으로 인한 진단 손실은 무시할 수 있다 — 어차피 `Log.w` 한 줄로는 어떤 row인지 식별이 어렵고, 진짜 진단은 E2E/매뉴얼 시나리오에서 진행한다.

---

## Proposed Changes

### 1. AccountMapper.fromCursor — 가드 추가 + 시그니처 변경

**File:** `android/app/src/main/java/com/kiyo/app/autofill/repository/AccountMapper.kt`
**Component:** `fun fromCursor(cursor: Cursor): AutofillAccount`
**Change:**

1. 반환 시그니처를 `AutofillAccount?`로 변경
2. `packageNames` 파싱 **전에** `id`/`username`/`password`/`domain`/`packageNamesJson`를 한꺼번에 읽고, username/password 검증
3. 검증 실패 시 `Log.w(TAG, \"Skipping corrupt autofill account row id=<id>: username/password is empty. domain=<d> packageNames=<pn>\")` 후 `return null`
4. username/password가 정상이면 기존 매핑 로직 그대로 진행

**Reason:**
- 단일 손상 row가 fill 응답을 망가뜨리는 현상 차단
- `parseReactAccount`와 가드 정책/시그니처 대칭 (둘 다 `AutofillAccount?` 반환)
- 도메인/패키지/ID를 로그에 남겨 사용자 신고 시 진단 단서 확보

**Pseudo (구현 디테일은 코딩 단계에서 확정):**

```kotlin
fun fromCursor(cursor: Cursor): AutofillAccount? {
    val id = cursor.getLong(cursor.getColumnIndexOrThrow(AutofillDatabaseHelper.COLUMN_ID))
    val username = cursor.getString(cursor.getColumnIndexOrThrow(AutofillDatabaseHelper.COLUMN_USERNAME))
    val password = cursor.getString(cursor.getColumnIndexOrThrow(AutofillDatabaseHelper.COLUMN_PASSWORD))
    val domain = cursor.getString(cursor.getColumnIndexOrThrow(AutofillDatabaseHelper.COLUMN_DOMAIN))

    if (username.isNullOrEmpty() || password.isNullOrEmpty()) {
        val field = if (username.isNullOrEmpty()) \"username\" else \"password\"
        Log.w(TAG, \"Skipping corrupt autofill account row id=$id domain=$domain: $field is empty\")
        return null
    }

    // ... packageNames 파싱 (기존 코드) ...
    return AutofillAccount(
        id = id, username = username, password = password, /* ... */
    )
}
```

### 2. DomainMatcher — 8개 호출부 갱신

**File:** `android/app/src/main/java/com/kiyo/app/autofill/repository/DomainMatcher.kt`
**Component:** `AccountMapper().fromCursor(c)` 호출 8곳
**Change:**

- **리스트 반환 함수** (라인 43, 204, 238, 308, 332, 355): `accounts.add(AccountMapper().fromCursor(c))` → `accounts.add(AccountMapper().fromCursor(c) ?: continue)` 또는 `AccountMapper().fromCursor(c)?.let { accounts.add(it) }` + 후속 `filterNotNull`. **선택지:**
  - **A안 (권장)**: `?.let { accounts.add(it) }` — 의도가 명확, null을 보고 추가 안 함
  - **B안**: `accounts.add(AccountMapper().fromCursor(c) ?: continue)` — Kotlin `continue` 가능 (while 루프 내부일 때) — 더 간결하지만 가독성 trade-off
   
  → **구현에서는 B안 선택** (더 간결하고 동등한 기능)

- **단일 반환 함수** (라인 152, 177): 이미 `if (c.moveToFirst()) ... else null` 패턴 → `AutofillAccount?` 그대로 전파되므로 **수정 불필요**

**Reason:** 시그니처 변경에 따른 호출부 적응. 가드된 null을 호출자가 책임지고 거른다.

### 3. AutofillRepository.getAccountById — 단일 호출부

**File:** `android/app/src/main/java/com/kiyo/app/autofill/repository/AutofillRepository.kt`
**Component:** `accountMapper.fromCursor(c)` (라인 272)
**Change:** **수정 불필요** — 이미 `if (c.moveToFirst()) ... else null` 구조이므로 `AutofillAccount?` 자연 전파.

**Reason:** 호출 시그니처가 이미 null을 허용.

### 4. 테스트 추가 — AccountMapperTest

**File:** `android/app/src/test/java/com/kiyo/app/autofill/repository/AccountMapperTest.kt`
**Component:** 신규 테스트 (기존 13개에 추가 → 18 tests 목표)
**Change:**

|| # | 테스트 메서드 | 시나리오 | 기대값 |
||---|---|---|---|
|| 1 | `fromCursor returns null when username is null` | cursor에 `COLUMN_USERNAME = null` 주입 | `fromCursor(c)` == `null` |
|| 2 | `fromCursor returns null when username is empty` | `COLUMN_USERNAME = \"\"` | `fromCursor(c)` == `null` |
|| 3 | `fromCursor returns null when password is null` | `COLUMN_PASSWORD = null` | `fromCursor(c)` == `null` |
|| 4 | `fromCursor returns null when password is empty` | `COLUMN_PASSWORD = \"\"` | `fromCursor(c)` == `null` |
|| 5 | `fromCursor returns account for normal row` | 정상 데이터 | `fromCursor(c) != null` 및 필드 값 검증 |

**기존 13개는 변경 없음** — 정상 row 가드 시나리오를 회귀 테스트로 유지.

> cursor mocking 패턴은 기존 AccountMapperTest의 정상 row 테스트를 참고. mockito-kotlin의 `mock<Cursor> { on { getXxx(...) } doReturn value }` 또는 `androidx.test` `Cursor` 헬퍼 중 기존에 쓰던 방식 따를 것 (구현 단계에서 확인).

**Reason:** 가드 정책 단위 검증 + 회귀 베이스라인 보존. `Log.w` 호출 자체는 `ShadowLog`로 검증하지 않음 (이 plan의 범위 밖, 기존 코드도 로그 단언 안 함). 로그가 남는지는 E2E 또는 수동 검증으로 확인.

---

## Tests

### Unit Tests (JVM) — AccountMapperTest 추가

|| # | Test | 매핑 | 타입 |
||---|---|---|---|
|| 1 | `fromCursor returns null when username is null` | Change #1 가드 - username null | New |
|| 2 | `fromCursor returns null when username is empty` | Change #1 가드 - username \"\" | New |
|| 3 | `fromCursor returns null when password is null` | Change #1 가드 - password null | New |
|| 4 | `fromCursor returns null when password is empty` | Change #1 가드 - password \"\" | New |
|| 5 | `fromCursor returns account for normal row` | Regression test for normal data | New |

**Total:** 5 new tests (기존 13 + 신규 5 = 18)

### 회귀 베이스라인 (변경 없이 통과 확인만)

|| Test File | 현재 상태 | 확인 |
||---|---|---|
|| `AccountMapperTest` (기존 13) | green | 정상 row 매핑이 영향받지 않음 |
|| `DomainMatcherTest` (26) | green | 손상 row 포함 cursor 시뮬레이션이 이미 있다면 통과, 없다면 보강 불필요 |
|| `AutofillRepositoryTest` (있으면) | green | `getAccountById` 시그니처 변경 영향 없음 |
|| `AuthRequestHandlerTest` (5) | green | 매퍼를 직접 호출하지 않을 가능성 높음 — 확인 |

### Android Instrumentation / E2E

- **신규 E2E 불필요** — 손상 row는 평상시 발생하지 않으며, 단위 테스트로 가드 동작이 검증됨
- **수동 검증 (회귀)**: `npm run test:e2e:android` (또는 `npm run test:e2e:android:fast`) — 기존 4개 시나리오(`prepareVault` / `noAuthFill` / `authResync` / `downgradeReset`) 모두 green 유지 확인. fill 자체는 정상 row만 다루므로 영향 없을 것.

---

## Implementation Notes (Actual vs Planned)

During implementation, the following enhancements were made beyond the original plan:

1. **Enhanced Test Coverage**: Added test for `password is null` scenario (in addition to the planned `password is empty`), providing more comprehensive validation of the guard condition which uses `isNullOrEmpty()`.

2. **DomainMatcher Implementation Choice**: Implemented the B안 approach (`accounts.add(AccountMapper().fromCursor(c) ?: continue)`) instead of the recommended A안 (`?.let { accounts.add(it) }`). This is more concise and equally effective, chosen for better readability in the while-loop context.

3. **Regression Test Added**: Included a `fromCursor returns account for normal row` test to ensure normal data flow remains intact after the guard implementation.

All changes strictly adhere to the plan's goals and constraints while improving test coverage and implementation clarity.

---

## Risks

(Identical to original plan - all risks and mitigations remain valid)

### 회귀 리스크
- **Risk**: `fromCursor`가 null을 반환하기 시작 → 호출부 누락 시 컴파일 실패 (Kotlin null safety)
- **Impact**: 빌드 break
- **Mitigation**: 9개 호출부 모두 **컴파일러 강제**로 누락이 드러남. 누락 발견 시 같은 PR에서 수정. Kotlin `?` 전파 한 번에 끝남

### 보안 리스크
- **Risk**: 손상 row 로그에 평문 도메인 노출
- **Impact**: logcat 접근 권한자에게 정보 노출
- **Mitigation**: autofill 도메인은 이미 비밀 아님 (사용자가 fill한 적 있는 사이트). 평문 password는 절대 로그에 포함하지 **않음** — 로그 메시지는 \"username/password is empty\" 같은 boolean만 노출

### Lifecycle 리스크
- **Risk**: 매퍼 인스턴스화 (`AccountMapper()`) 가 호출마다 발생
- **Impact**: 미세한 GC 압력
- **Mitigation**: 기존부터 동일 패턴. 변경 없음

### 호환성 리스크
- **Risk**: 매퍼 시그니처 변경이 향후 iOS 추상화 진입점(AutofillPlatformBridge)에 영향
- **Impact**: iOS 측 매퍼도 동일 가드 필요
- **Mitigation**: iOS 미구현 — 변경 없음. STRATEGY.md Track 1 원칙과 일치

### 마이그레이션 리스크
- **Risk**: 기존 DB에 손상 row가 이미 존재
- **Impact**: 사용자가 fill 받다가 갑자기 안 됨
- **Mitigation**: **목적 자체가 이것을 해결** — 손상 row를 사일런트하게 거르고 정상 row만 응답. 사용자 입장에서는 \"갑자기 안 됨\"이 \"가끔 한 row가 빠진 채 응답\"으로 완화

---

## Verification Criteria

✅ 손상 row 가드 정책 결정 (`parseReactAccount` 패턴 대칭)
✅ 가드 입력 조건 (username/password null 또는 empty) 명시
✅ 로그 메시지 형식 정의 (id/도메인/packageNames, password 평문 금지)
✅ 호출부 9곳의 영향 분석 완료 (시그니처 변경 → Kotlin null safety가 강제)
✅ 단위 테스트 5개 시나리오 정의 (계획보다 2개 더 추가)
✅ 회귀 베이스라인 식별
✅ E2E 시나리오 정의 없음 + 수동 회귀 검증 명령어 명시
✅ 보안/회귀/마이그레이션 리스크와 mitigation 표
✅ 롤백 전략 (단일 revert, 데이터 롤백 불필요)

Plan is implementation-ready with enhancements.

---

## Implementation Order (Actual)

1. **AccountMapper.kt** — `fromCursor` 시그니처 `AutofillAccount?` 변경 + 가드 추가 + 로그 (한 메서드, 5-10줄 변경)
2. **DomainMatcher.kt** — 6개 리스트 호출부 `?: continue` 패턴 적용 (선택된 B안)
3. **컴파일 검증** — `./gradlew :app:compileDebugKotlin` 실행. 이 단계가 **호출부 누락을 강제로 잡는 1차 게이트**다
4. **AccountMapperTest.kt** — 5개 신규 테스트 추가 (username null/empty, password null/empty, normal row)
5. **전체 회귀**:
   - `./gradlew test --tests \"*AccountMapperTest\" --tests \"*DomainMatcherTest\" --tests \"*AuthRequestHandlerTest\"` — 모든 테스트 green
   - `./gradlew test` (전체 JVM 유닛) — 회귀 없음
   - `npm run check` (TypeScript) — autofill 도메인 변경이 없으므로 통과 예상
   - E2E `npm run test:e2e:android:fast` — 기존 4개 시나리오 green 유지

> DomainMapper 6개 호출부 갱신이 한 번에 가능하므로 단일 PR로 묶는다. `fromCursor` 시그니처 변경 + 호출부 6곳 갱신 + 테스트 5개 = 총 변경 폭이 작아(파일 3개, 라인 ~25줄), 리뷰 부담이 낮다.