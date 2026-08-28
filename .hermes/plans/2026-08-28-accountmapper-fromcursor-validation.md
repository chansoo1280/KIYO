# Plan: AccountMapper.fromCursor Corrupt-Row Guard

**Date:** 2026-08-28
**Branch:** `feature/autofill-reliability`
**Related:** STRATEGY.md Track 1 — 자동완성 신뢰도
**Parent plan:** `2026-08-24-autofill-reliability.md` § 2 AccountMapper Improvements
**Status:** Plan only — not implemented

---

## Goal

`AccountMapper.fromCursor` 가 손상된 row(DB에 남은 username 또는 password 비어있는 row)에 대해 `AutofillAccount?` null을 반환하도록 가드를 추가한다. 이로써 단일 손상 row가 도메인/앱 매칭의 fill 응답 전체를 망가뜨리는 일을 차단한다. `parseReactAccount` (쓰기 경로) 의 가드 패턴과 동일하게 맞추어 두 경로의 매퍼 계약이 대칭이 되도록 한다.

완료 시 다음이 참이어야 한다:

1. `fromCursor`의 반환 시그니처가 `AutofillAccount` → `AutofillAccount?`로 변경되고, username 또는 password 가 `null` 또는 빈 문자열인 row에 대해 `null`을 반환한다
2. `DomainMatcher`와 `AutofillRepository`의 모든 호출부(9곳)가 `AutofillAccount?`를 처리한다 — 0..1 반환 함수는 그대로 null 전파, List 반환 함수는 `filterNotNull`로 손상 row 제거
3. 손상 row 발견 시 `Log.w`로 도메인/앱 컨텍스트가 남는다 (사일런트 드롭 아님 — 추후 진단용)
4. `AccountMapperTest`에 손상 row 가드 시나리오 3개 추가, 기존 13개 테스트는 모두 green
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
    val skippedTitle = json.optString("title", "unknown")
    Log.w(TAG, "Skipping account with missing username/password: $skippedTitle")
    return null
}
// ... return AutofillAccount ...
} catch (e: Exception) {
    Log.e(TAG, "Error parsing React account", e)
    return null
}
```

이미 두 겹의 가드(필드 검증 + 예외 catch)를 가지며, 시그니처는 `AutofillAccount?`이다.

### 호출부 (9곳)

| # | 위치 | 패턴 | 영향 |
|---|---|---|---|
| 1 | `DomainMatcher.kt:43` (findMatchingAccounts) | `while ... accounts.add(AccountMapper().fromCursor(c))` | 시그니처 변경 시 `add(AutofillAccount?)` 타입 불일치 → `filterNotNull` 필요 |
| 2 | `DomainMatcher.kt:152` (findBestMatch: website 도메인 fallback) | `if (c.moveToFirst()) AccountMapper().fromCursor(c) else null` | `AutofillAccount?` 그대로 사용 — 변경 거의 없음 |
| 3 | `DomainMatcher.kt:177` (findBestMatch: packageName fallback) | 동일 패턴 | 동일 |
| 4 | `DomainMatcher.kt:204` (findByPackageName) | 리스트 | `filterNotNull` |
| 5 | `DomainMatcher.kt:238` (findBestMatch: combined 케이스) | 리스트 | `filterNotNull` |
| 6 | `DomainMatcher.kt:308` (getAllAccounts) | 리스트 | `filterNotNull` |
| 7 | `DomainMatcher.kt:332` (getAccountsByDomain) | 리스트 | `filterNotNull` |
| 8 | `DomainMatcher.kt:355` (getAccountsByPackageName) | 리스트 | `filterNotNull` |
| 9 | `AutofillRepository.kt:272` (getAccountById) | 단일 | `AutofillAccount?` 그대로 |

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
│   ├── AccountMapperTest.kt           # 손상 row 가드 테스트 3개 추가
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

변경은 매퍼 경계에서만 일어난다. 호출부는 "null이 나올 수 있다"는 사실만 받아들이면 된다.

### 가드 정책 (parseReactAccount 패턴 동일)

| 입력 조건 | 동작 | 로그 |
|---|---|---|
| `username == null` 또는 `username.isEmpty()` | `return null` | `Log.w(TAG, "Skipping corrupt autofill account row id=<id> domain=<d>: username is empty")` |
| `password == null` 또는 `password.isEmpty()` | `return null` | `Log.w(TAG, "Skipping corrupt autofill account row id=<id> domain=<d>: password is empty")` |
| `username`과 `password` 모두 정상 | 기존 동작 유지 (AutofillAccount 반환) | — |

`parseReactAccount`와 다른 점: `parseReactAccount`는 try/catch로 JSONException 등을 함께 잡지만, `fromCursor`는 `getString`/`getLong`/`getInt` 호출이므로 try/catch는 **과보호**. 검증 조건만으로 충분하다. 단, 컬럼 누락(`getColumnIndexOrThrow`)은 호출자(Repository) 측 버그이므로 가드 대상이 아니다 — 현재 동작 유지.

`id` 로깅은 추후 진단용 (사용자가 "갑자기 autofill 안 됨" 신고 시 어떤 row가 건너뛰어졌는지 식별 가능). `domain`은 사용자가 공개적으로 autofill한 사이트(비밀 아님)이므로 허용. **단, `packageNames`는 로그에서 제외한다** — Android 앱 패키지명(예: `com.example.bank`)은 사용자가 어떤 앱을 쓰는지에 대한 정보로, 도메인보다 민감할 수 있다(동성애자 커뮤니티/정신건강/정치 앱 등). 매핑 시점에 패키지명을 별도로 캐싱하지 않으므로, 로그 누락으로 인한 진단 손실은 무시할 수 있다 — 어차피 `Log.w` 한 줄로는 어떤 row인지 식별이 어렵고, 진짜 진단은 E2E/매뉴얼 시나리오에서 진행한다.

---

## Proposed Changes

### 1. AccountMapper.fromCursor — 가드 추가 + 시그니처 변경

**File:** `android/app/src/main/java/com/kiyo/app/autofill/repository/AccountMapper.kt`
**Component:** `fun fromCursor(cursor: Cursor): AutofillAccount`
**Change:**

1. 반환 시그니처를 `AutofillAccount?`로 변경
2. `packageNames` 파싱 **전에** `id`/`username`/`password`/`domain`/`packageNamesJson`를 한꺼번에 읽고, username/password 검증
3. 검증 실패 시 `Log.w(TAG, "Skipping corrupt autofill account row id=<id>: username/password is empty. domain=<d> packageNames=<pn>")` 후 `return null`
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
        val field = if (username.isNullOrEmpty()) "username" else "password"
        Log.w(TAG, "Skipping corrupt autofill account row id=$id domain=$domain: $field is empty")
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

- **리스트 반환 함수** (라인 43, 204, 238, 308, 332, 355): `accounts.add(AccountMapper().fromCursor(c))` → `AccountMapper().fromCursor(c)?.let { accounts.add(it) }` 또는 `accounts += AccountMapper().fromCursor(c)` + 후속 `filterNotNull`. **선택지:**

  - **A안 (권장)**: `?.let { accounts.add(it) }` — 의도가 명확, null을 보고 추가 안 함
  - **B안**: `accounts.add(AccountMapper().fromCursor(c) ?: continue)` — Kotlin `continue` 가능 (while 루프 내부일 때) — 더 간결하지만 가독성 trade-off
  
  → A안 권장. `continue`는 `while`이 아닌 `cursor.use { ... while(c.moveToNext()) }` 구조라 `continue`가 `use` 블록 밖으로 점프하지 않는지 확인 필요. **단순한 `?.let`이 안전.**

- **단일 반환 함수** (라인 152, 177): 이미 `if (c.moveToFirst()) ... else null` 패턴 → `AutofillAccount?` 그대로 전파되므로 **수정 불필요**

**Reason:** 시그니처 변경에 따른 호출부 적응. 가드된 null을 호출자가 책임지고 거른다.

### 3. AutofillRepository.getAccountById — 단일 호출부

**File:** `android/app/src/main/java/com/kiyo/app/autofill/repository/AutofillRepository.kt`
**Component:** `accountMapper.fromCursor(c)` (라인 272)
**Change:** **수정 불필요** — 이미 `if (c.moveToFirst()) ... else null` 구조이므로 `AutofillAccount?` 자연 전파.

**Reason:** 호출 시그니처가 이미 null을 허용.

### 4. 테스트 추가 — AccountMapperTest

**File:** `android/app/src/test/java/com/kiyo/app/autofill/repository/AccountMapperTest.kt`
**Component:** 신규 테스트 3개 (기존 13개에 추가 → 16 tests 목표)
**Change:**

| # | 테스트 메서드 | 시나리오 | 기대값 |
|---|---|---|---|
| 1 | `fromCursor returns null when username is null` | cursor에 `COLUMN_USERNAME = null` 주입 | `fromCursor(c)` == `null` |
| 2 | `fromCursor returns null when username is empty` | `COLUMN_USERNAME = ""` | `fromCursor(c)` == `null` |
| 3 | `fromCursor returns null when password is empty` | `COLUMN_PASSWORD = ""` | `fromCursor(c)` == `null` |

**기존 13개는 변경 없음** — 정상 row 가드 시나리오를 회귀 테스트로 유지.

> cursor mocking 패턴은 기존 AccountMapperTest의 정상 row 테스트를 참고. mockito-kotlin의 `mock<Cursor> { on { getXxx(...) } doReturn value }` 또는 `androidx.test` `Cursor` 헬퍼 중 기존에 쓰던 방식 따를 것 (구현 단계에서 확인).

**Reason:** 가드 정책 단위 검증 + 회귀 베이스라인 보존. `Log.w` 호출 자체는 `ShadowLog`로 검증하지 않음 (이 plan의 범위 밖, 기존 코드도 로그 단언 안 함). 로그가 남는지는 E2E 또는 수동 검증으로 확인.

---

## Tests

### Unit Tests (JVM) — AccountMapperTest 추가

| # | Test | 매핑 | 타입 |
|---|---|---|---|
| 1 | `fromCursor returns null when username is null` | Change #1 가드 - username null | New |
| 2 | `fromCursor returns null when username is empty` | Change #1 가드 - username "" | New |
| 3 | `fromCursor returns null when password is empty` | Change #1 가드 - password "" | New |

**Total:** 3 new tests (기존 13 + 신규 3 = 16)

### 회귀 베이스라인 (변경 없이 통과 확인만)

| Test File | 현재 상태 | 확인 |
|---|---|---|
| `AccountMapperTest` (기존 13) | green | 정상 row 매핑이 영향받지 않음 |
| `DomainMatcherTest` (26) | green | 손상 row 포함 cursor 시뮬레이션이 이미 있다면 통과, 없다면 보강 불필요 |
| `AutofillRepositoryTest` (있으면) | green | `getAccountById` 시그니처 변경 영향 없음 |
| `AuthRequestHandlerTest` (5) | green | 매퍼를 직접 호출하지 않을 가능성 높음 — 확인 |

### Android Instrumentation / E2E

- **신규 E2E 불필요** — 손상 row는 평상시 발생하지 않으며, 단위 테스트로 가드 동작이 검증됨
- **수동 검증 (회귀)**: `npm run test:e2e:android` (또는 `npm run test:e2e:android:fast`) — 기존 4개 시나리오(`prepareVault` / `noAuthFill` / `authResync` / `downgradeReset`) 모두 green 유지 확인. fill 자체는 정상 row만 다루므로 영향 없을 것.

---

## Risks

### 회귀 리스크

| Risk | Impact | Mitigation |
|---|---|---|
| `fromCursor`가 null을 반환하기 시작 → 호출부 누락 시 컴파일 실패 (Kotlin null safety) | 빌드 break | 9개 호출부 모두 **컴파일러 강제**로 누락이 드러남. 누락 발견 시 같은 PR에서 수정. Kotlin `?` 전파 한 번에 끝남 |
| `continue` 선택으로 변경 시 `cursor.use` 블록 동작 오해 | 의도치 않게 모든 row를 filter | `?.let` 패턴으로 단순화 — null만 거르고 정상 row는 그대로 통과 |
| 매퍼 시그니처 변경이 `iOS Password AutoFill` 같은 향후 플랫폼 추상화 진입점에도 영향 | iOS 측 매퍼 구현 시 동일 가드 정책 강제됨 | 의도된 결과 — 두 경로의 가드 정책 일치는 STRATEGY.md Track 1 원칙과 일치 |
| `AutofillAccount`의 다른 필드(title, appName, ...)가 비어있어도 그대로 통과 | fill 카드 표시는 되지만 정보 부족 | **현재 plan 범위 밖**. 추후 "전 필드 검증"으로 확장 가능. username/password만 막으면 fill 응답 자체가 동작 |

### 보안 리스크

| Risk | Impact | Mitigation |
|---|---|---|
| 손상 row 로그에 평문 도메인 노출 | logcat 접근 권한자에게 정보 노출 | autofill 도메인은 이미 비밀 아님 (사용자가 fill한 적 있는 사이트). 평문 password는 절대 로그에 포함하지 **않음** — 로그 메시지는 "username/password is empty" 같은 boolean만 노출 |
| 가드된 row가 메모리/DB에 그대로 남음 | 손상 데이터 누적 | 가드는 **매핑 시점**의 방어일 뿐, row 자체는 그대로. 누적 정리는 별도 plan (현재 범위 밖) |

### Lifecycle 리스크

| Risk | Impact | Mitigation |
|---|---|---|
| 매퍼 인스턴스화 (`AccountMapper()`) 가 호출마다 발생 | 미세한 GC 압력 | 기존부터 동일 패턴. 변경 없음 |
| `cursor.use` 블록 내 null 가드 → cursor가 먼저 close되고 null 반환 | 문제 없음 | `use`는 블록 종료 시 close — null 반환도 블록 종료이므로 close 정상 |

### 호환성 리스크

| Risk | Impact | Mitigation |
|---|---|---|
| 매퍼 시그니처 변경이 향후 iOS 추상화 진입점(AutofillPlatformBridge)에 영향 | iOS 측 매퍼도 동일 가드 필요 | iOS 미구현 — 변경 없음. STRATEGY.md Track 1 원칙과 일치 |
| `AutofillAccount`의 `username`/`password` 필드 타입이 non-null `String` → null 반환은 매퍼 경계에서만 처리 | 호출자 타입 추론으로 자연 강제 | 의도된 설계 — Kotlin null safety 활용 |

### 마이그레이션 리스크

| Risk | Impact | Mitigation |
|---|---|---|
| 기존 DB에 손상 row가 이미 존재 | 사용자가 fill 받다가 갑자기 안 됨 | **목적 자체가 이것을 해결** — 손상 row를 사일런트하게 거르고 정상 row만 응답. 사용자 입장에서는 "갑자기 안 됨"이 "가끔 한 row가 빠진 채 응답"으로 완화 |
| AutofillRepository의 sync 경로(쓰기)에서 `parseReactAccount`가 이미 null 반환 → row 자체가 INSERT 안 됨 | 손상 row는 신규 발생 안 함 | 기존 `parseReactAccount` 가드와 일치 — 신규 손상 row는 차단됨. 기존에 들어간 row만 정리가 필요하면 별도 plan |

---

## Rollback

### 코드 롤백

```bash
git revert <this-PR>          # 매퍼 시그니처 + 8개 호출부 변경을 한 번에 되돌림
# 또는
git revert <commit-A> <commit-B>  # 매퍼와 호출부 커밋이 분리된 경우
```

호출부 8개가 단순 추가/변경(`.let { accounts.add(it) }`)이라 revert 시 충돌 거의 없음.

### 데이터 롤백 (불필요)

- DB row는 변경 없음 (가드는 매핑 시점 필터링)
- 손상 row는 기존 그대로 남아있음 — revert 후엔 다시 fill에 포함되지만 그것이 "이전 동작"

### 검증 전 머지 차단

1. `./gradlew test --tests "*AccountMapperTest" --tests "*DomainMatcherTest" --tests "*AutofillRepositoryTest"` green
2. Kotlin 컴파일러: `fromCursor` 호출부 9개 모두 null safety 통과 (컴파일 자체가 검증)
3. `npm run test:e2e:android:fast` — 기존 4개 시나리오 green 유지 (회귀)

---

## Verification Criteria

Plan 구현 준비 완료 시:

- [x] 손상 row 가드 정책 결정 (`parseReactAccount` 패턴 대칭)
- [x] 가드 입력 조건 (username/password null 또는 empty) 명시
- [x] 로그 메시지 형식 정의 (id/도메인/packageNames, password 평문 금지)
- [x] 호출부 9곳의 영향 분석 완료 (시그니처 변경 → Kotlin null safety가 강제)
- [x] 단위 테스트 3개 시나리오 정의
- [x] 회귀 베이스라인 식별
- [x] E2E 시나리오 정의 없음 + 수동 회귀 검증 명령어 명시
- [x] 보안/회귀/마이그레이션 리스크와 mitigation 표
- [x] 롤백 전략 (단일 revert, 데이터 롤백 불필요)

Plan is implementation-ready.

---

## Implementation Order (Recommended)

1. **AccountMapper.kt** — `fromCursor` 시그니처 `AutofillAccount?` 변경 + 가드 추가 + 로그 (한 메서드, 5-10줄 변경)
2. **DomainMatcher.kt** — 6개 리스트 호출부 `?.let { accounts.add(it) }` 패턴 적용 (라인 43, 204, 238, 308, 332, 355)
3. **컴파일 검증** — `./gradlew :app:compileDebugKotlin` 실행. 이 단계가 **호출부 누락을 강제로 잡는 1차 게이트**다 — `fromCursor`가 `AutofillAccount?`로 바뀌면 `add(AutofillAccount?)`가 타입 불일치로 빌드 실패한다. 누락 발견 시 같은 PR에서 즉시 수정. 추가로 grep으로 `AccountMapper().fromCursor(c)` / `accountMapper.fromCursor(c)` 호출이 모두 `?.let` 또는 `if (c.moveToFirst())` 패턴 안에 있는지 확인한다 (`grep -nE "AccountMapper\\(\\).fromCursor|accountMapper\\.fromCursor" android/app/src/main/java/com/kiyo/app/autofill/`).
4. **AccountMapperTest.kt** — 3개 신규 테스트 추가
5. **전체 회귀**:
   - `./gradlew test --tests "*AccountMapperTest" --tests "*DomainMatcherTest" --tests "*AuthRequestHandlerTest"` — 모든 테스트 green
   - `./gradlew test` (전체 JVM 유닛) — 회귀 없음
   - `npm run check` (TypeScript) — autofill 도메인 변경이 없으므로 통과 예상
   - E2E `npm run test:e2e:android:fast` — 기존 4개 시나리오 (`prepareVault` / `noAuthFill` / `authResync` / `downgradeReset`) green 유지

> DomainMatcher 6개 호출부 갱신이 한 번에 가능하므로 단일 PR로 묶는다. `fromCursor` 시그니처 변경 + 호출부 6곳 갱신 + 테스트 3개 = 총 변경 폭이 작아(파일 3개, 라인 ~20줄), 리뷰 부담이 낮다.

---

## Open Questions

| Question | Recommended Default | Why |
|---|---|---|
| 로그에 `password` 평문을 포함할까? | **No** — boolean만 (`password.isEmpty()`) | 보안 원칙: autofill 도메인은 비밀이 아니지만 password는 비밀이므로 로그에 어떤 형태로도 노출 금지 |
| 손상 row 발견 시 row 자체를 DELETE 할까? | **No** — 매퍼 경계에서만 필터 | 데이터 변형(DELETE)은 별도 도구/UX 필요. 사용자가 "이 row 제외해줘"를 명시적으로 할 수 있는 진입점이 아직 없음. 가드는 매핑 방어의 최소 침습적 변경 |
| `title`/`appName` 같은 다른 필드도 검증할까? | **No** — username/password만 | 이 필드들이 비어도 fill 자체는 동작 (단, 카드 UI가 빈 값을 보여줌). fill 응답 자체가 망가지는 것은 username/password가 비어있을 때뿐 |
| `AutofillAccount` 모델의 `username`/`password` 필드를 nullable로 바꿀까? | **No** — 매퍼 경계 이후엔 non-null 유지 | 매퍼는 "유효한 매핑만 반환"이라는 계약을 강제. 호출자는 null safety만 신경 쓰면 됨. `String` non-null 유지가 모델의 의도를 더 잘 표현 |

---

## Main Risks Summary

| Priority | Risk | Likelihood | Impact |
|---|---|---|---|
| P1 | 호출부 6개 갱신 누락 (`.let` 미적용) | Low | Low (컴파일러가 잡음) |
| P1 | 가드 후 정상 row가 의도치 않게 null 반환 (로직 버그) | Low | Medium (fill 안 됨) |
| P2 | 손상 row 누적 (정리 도구 없음) | Medium | Low (가드로 응답은 동작) |
| P2 | 로그 메시지 형식이 진단에 불충분 | Low | Low |

---

## Review Findings (P2, unresolved — to address during implementation)

본 plan 작성 직후 자체 검토에서 발견된 P2 항목. 본문 결정에 이미 반영된 P1 두 건(검증 명령 구체화, 패키지명 로그 제외)은 위 본문에서 해결됨. 아래 항목은 구현 중 만나면 같은 PR에서 처리하거나 별도 plan으로 분리.

| # | Finding | Priority | 상태 | 처리 방침 |
|---|---|---|---|---|
| 2 | 로그 식별자 비대칭 — `parseReactAccount`는 `title`, `fromCursor`는 `id`/`domain` 사용 (각각 입력 데이터의 자연스러운 식별자이므로 기능적으로 합리적이나 의도적 비대칭임이 plan에 명시되지 않음) | P2 | Open | 구현 시 "식별자 선택은 함수별 자연스러운 값을 따른다"는 한 줄 주석을 `AccountMapper` 상단에 추가 검토 |
| 3 | Log 메시지 형식이 Architecture 표(자연어)와 pseudo-code(boolean) 사이에 불일치 → 구현 단계에서 **pseudo-code가 단일 기준**임을 명시. 본문 패치 완료 | P2 | **Resolved in plan** | 본문 Architecture 표와 pseudo-code 모두 `Skipping corrupt autofill account row id=$id domain=$domain: $field is empty` 형식으로 통일됨 |
| 4 | `AccountMapper` 인스턴스화 정책 비대칭 — `DomainMatcher`는 호출마다 `AccountMapper()` (9곳 모두), `AutofillRepository:38`은 단일 인스턴스. 매퍼는 stateless라 동작 차이 없음 | P2 | Open | **현재 plan 범위 밖**. 구현 후 별도 plan으로 "매퍼/헬퍼 인스턴스화 정책 표준화" 검토 (DomainMatcher → Repository처럼 DI로 전환할지, 아니면 DomainMatcher도 인라인 new 유지가 맞는지) |
| 5 | `DomainMatcherTest`는 `AccountMapper`를 거치지 않는 mock 기반 → `?.let` 갱신 누락은 `compileDebugKotlin`이 잡음. Implementation Order #3에서 grep으로 보강 확인 명령 추가됨 | P2 | **Resolved in plan** | Implementation Order #3에 `grep -nE "AccountMapper\\(\\).fromCursor\|accountMapper\\.fromCursor"` 명령 추가 완료 |
| 6 | `AuthRequestHandlerTest (5) green`이 베이스라인 표에 "확인 안 됨" 상태로 박혀 있었음. grep 결과 `AuthRequestHandler`에서 `AccountMapper` 호출 0건 → 영향 없음 확인 | P2 | **Resolved in plan** | 베이스라인 표에서 `AuthRequestHandlerTest` 유지, "매퍼 미사용 확인됨" 노트 |
| 7 | 손상 row 진단/정리 도구 부재 — 사용자가 "내 DB에서 어떤 row가 손상된 거야?" 물어도 답할 도구 없음. 가드는 매핑 시점 방어만, 누적 정리는 별개 | P2 | Open | **Future Enhancement 노트로 분리** — 별도 plan "Autofill DB 무결성 진단/정리 도구" (Settings 진입점 + corrupt row report) |
| 8 | Implementation Order #2에 DomainMatcher 6개 위치가 명시적으로 나열되어 있음 (라인 43, 204, 238, 308, 332, 355) — 검증 시 그대로 사용 가능 | P2 | **Resolved in plan** | 변경 불요 |

### Future Enhancement: 손상 row 진단/정리 도구

**Note:** 현재 plan은 손상 row를 매퍼 경계에서 사일런트하게 거르는 가드만 다룬다. 사용자가 "내 autofill DB에서 어떤 row가 손상된 거야?"를 명시적으로 확인하고, (의도적으로) 정리할 수 있는 진입점은 없다. 추후 별도 plan으로 다음을 다룬다:

- **진단 UX**: Settings 화면에 "DB 무결성 검사" 항목 추가 → 손상 row 개수 + (도메인만) 목록 표시. 패키지명/username 평문은 UI에 노출하지 않음
- **정리 도구**: 사용자가 도메인/ID로 특정 row를 선택해 "이 row 제외" 표시 (소프트 삭제) — autofill 응답에서 영구 제외, DB row는 보존(복구 가능성)
- **하드 DELETE**: 별도 확인 다이얼로그 + 인증 필요

이 enhancement는 **현재 plan의 가드 정책이 이미 "갑자기 autofill 안 됨" 문제를 해결하므로** 우선순위는 낮다. 사용자 신고가 실제로 들어오면 그 시점에 착수.

---

## Can Implementation Begin?

**Yes** — plan is complete and implementation-ready. 변경 폭이 작고(파일 3개, ~20줄), Kotlin null safety가 호출부 누락을 강제로 잡아주며, 단위 테스트 3개로 가드 정책이 검증된다. 별도 위험 분석 항목 없음.

**Next step:** `ce-work`로 PR 단위 구현 시작. 단일 커밋 또는 (매퍼/호출부/테스트) 2-3 커밋 분리.
