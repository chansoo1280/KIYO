# 2026-08-24 — Autofill 키 관리 캐시 제거 및 요청 단위 초기화 (v3)

> v2(세대 카운터 폐기 → 캐시 제거 방향)는 좋았으나, DataStore 멀티프로세스 stale 문제를
> "확정된 사실"로 단정하고 "매 요청 새 DataStore 인스턴스"로 해결하려 한 부분이
> **가정 기반의 불필요한 복잡성**을 낳을 수 있음.
>
> v3: **캐시 제거(1~3순위)만 먼저 적용 → DataStore stale은 실제 재현 시에만 별도 해결**
> 으로 단순화. 재래핑은 인덱스 alias 방식 유지. fallback은 최후 복구로 격하.
>
> v3.1 (동일일자): `KeyPermanentlyInvalidatedException` 정책 재정의.
> Autofill DB는 파생 데이터이므로 무효화된 wrapping을 "살리려" 시도하지 않음.
> 예외는 catch하되 같은 alias 재생성→복호화 재시도를 복구 수단으로 쓰지 않고,
> **리셋 → 새 wrapping 즉시 커밋 → 메인 앱 sync로 재구축**으로 단순화.
> 정상 재래핑은 포인터 전환으로 완결되며 서비스가 구 alias에서 이 예외를 받는 것 자체가 비정상 신호.

## Goal

- AutofillService가 stale 상태(옛날 마스터 키 캐시, 옛날 DB 핸들)를 **구조적으로 가질 수 없게** 한다.
- 메인 프로세스의 재래핑/리셋 이후 fill/save 요청이 별도 동기화 장치 없이 항상 현재 상태로 동작한다.
- 인증이 필요한 상황에서 인증 프롬프트가 조용히 사라지는 크래시 경로를 제거한다.
- fallback 예외 복구는 "정상 경로"가 아니라 "예상치 못한 상태의 최후 방어"로만 남긴다.

## Current State (핵심만)

### 데이터 계층
```
SQLCipher DB (kiyo_autofill.db)          ← 자동완성 계정 (파생 데이터, 재구축 가능)
    ↑ DB_KEY
DataStore (kiyo_security_prefs / db_encrypted_key)   ← 암호화된 DB_KEY 블롭
    ↑ 마스터 키 (kiyo_master_key)
Android Keystore                          ← 하드웨어 보호, auth-required 가능 (30분 캐시)
```

### 문제의 원인: 3개의 독립 캐시
```
[메인 앱 프로세스]           [AutofillService 프로세스]
KeystoreManager.cachedKey    KeystoreManager.cachedKey
DataStore 인스턴스           DataStore 인스턴스
AutofillRepository (캐시)    AutofillRepository (영구 캐시)  ← 가장 치명적
```

- `KiyoAutofillService`는 repository를 1회 생성 후 영구 보관 → 리셋 후에도 죽은 DB 핸들 사용 (결함 1)
- `KeystoreManager.cachedKey` 장기 보관 → 재래핑 후 구 키로 복호화 시도 → KeyPermanentlyInvalidatedException
- DataStore 멀티프로세스 stale 여부는 **실제 재현 로그로만 확인됨(AEADBadTag)** — 원인 특정 전엔 캐시 제거로 충분할 수 있음

### 오늘 재현된 실패
1. stale 마스터 키 캐시 → KeyPermanentlyInvalidatedException (이미 패치: 캐시 클리어+재시도)
2. stale DataStore 블롭 → AEADBadTagException (이미 패치: 리셋+재구축)
3. **stale repository (DB 핸들)** — 미패치 (이 계획의 1순위)

### 추가 결함
4. `createAuthResponse`의 `check()` 크래시 → 인증 프롬프트 누락
5. 재래핑 순서: 복호화 → **구키 삭제** → 신규 생성 → 재암호화 (delete 이후 실패 시 깨진 상태로 fallback)

## Relevant Files

| 파일 | 역할 |
|---|---|
| `KiyoAutofillService.kt` | fill/save, repository 영구 캐시 (`ensureRepositoryInitialized`) |
| `KiyoAutofillPlugin.kt` | 메인 앱 동기화, repository 캐시 (현행 유지 권장) |
| `DatabaseKeyManager.kt` | DB_KEY 래핑/언래핑, 재래핑, 리셋, fallback catch |
| `KeystoreManager.kt` | 마스터 키 생성/로드/캐시, 재래핑 판정 |
| `AutofillRepository.kt` | SQLCipher DB 소유. `close()` 필요 |
| `FillResponseBuilder.kt` | fill/auth 응답 생성 |

## Architecture

### 목표 모델: 요청 단위 fresh 초기화 (서비스만)
```
Autofill request (fill/save)
       │
       ▼
DatabaseKeyManager.getKey()          ← 현재 Keystore 키로 unwrap (캐시 없음)
       │
       ▼
AutofillRepository.create()          ← 요청 시점 생성
       │
       ▼
DB 사용 (find/upsert)
       │
       ▼
repository.close()                   ← finally에서 핸들 반납
```

- **변경 감지 장치 없음.** 매 요청이 현재 상태를 다시 읽으므로 재래핑/리셋 후 자동 일관.
- **범위:** AutofillService(별도 프로세스, 장수명)만 적용. KiyoAutofillPlugin(메인 프로세스, React 수명)은 현행 유지 — 결함 1의 직접 원인이 서비스에만 있음.
- 성능: SQLCipher open 수십 ms — fill 빈도에서 무시 가능. 문제 시 별도 이슈로 재검토.

### 보안 문서화
- **키 소유권**: 마스터 키 = KeystoreManager, DB_KEY = DatabaseKeyManager (불변)
- **인증 경계**: auth-required 키 → UserNotAuthenticatedException → 서비스 `createAuthResponse()`로 프롬프트 반환 (결함 4 수정으로 누락 제거)
- **프로세스 경계**: 서비스 프로세스의 장기 캐시 제거로 경계 문제 소거. 공유 자원은 Keystore(항상 현재 값) + DataStore 파일뿐
- **실패 동작**: 복호화 불가(AEADBadTag) = 파생 데이터 리셋 후 재동기화 재구축 (기존 정책). 재래핑 실패 = 구 alias + 구 블롭 보존으로 롤백 (인덱스 alias 덕분)

## Proposed Changes (4개 핵심 변경)

> **구현 순서: 3 → 2 → 1 → 4** (변경 번호와 무관).
> 변경 2의 alias 파라미터화는 변경 3의 `current_master_key_alias` DataStore preference가 선행되어야 하며,
> 변경 1은 2/3이 확정된 키 조회 경로 위에 얹힌다.

### 1. [1번째 구현] AutofillService — repository 요청 단위 생성 + close (결함 1)
- 파일: `KiyoAutofillService.kt`, `AutofillRepository.kt`
- 변경:
  - `AutofillRepository`에 `close()` 구현 (`SupportDatabase.close()`)
  - `KiyoAutofillService`: `repository` 필드 + `ensureRepositoryInitialized()` 영구 캐시 **제거**
  - `onFillRequest`/`onSaveRequest` 내부에서:
    ```kotlin
    AutofillRepository.create(context, dbKey).use { repo ->
        // repo 사용
    }  // 자동 close
    ```
  - `KiyoAutofillPlugin`은 **현행 유지** (메인 프로세스, React 수명). 재현 시에만 동일 적용.
- 이유: stale DB 핸들이 존재할 수 없게 만드는 직접적 해결. `use`로 close 강제.

### 2. [2번째 구현] KeystoreManager — cachedKey 제거 + alias 파라미터화 (결함 1 보조)
- 파일: `KeystoreManager.kt`
- 변경:
  - `private var cachedKey: SecretKey? = null` **제거**
  - `getOrCreateKey(alias: String)`: **alias를 파라미터로 받음** (호출자 `DatabaseKeyManager`가 DataStore에서 읽은 `current_master_key_alias` 전달)
    ```kotlin
    override fun getOrCreateKey(alias: String): SecretKey {
        val keyStore = KeyStore.getInstance(KEYSTORE_PROVIDER)
        keyStore.load(null)
        return keyStore.getKey(alias, null) as SecretKey
            ?: generateNewKey(keyStore, alias)  // 없으면 해당 alias로 생성
    }
    ```
  - `generateNewKey(keyStore, alias)`: 파라미터로 받은 alias로 키 생성 (auth-required 여부는 `isSecureLockScreenEnabled()`로 판정)
  - `deleteKey(alias)` / `hasKey(alias)` 등도 alias 파라미터 추가
  - `KeyPermanentlyInvalidatedException`은 **catch해서 재생성으로 삼키지 않고 호출자(DatabaseKeyManager)에 그대로 전파**. 같은 alias로 무단 재생성하면 이후 복호화가 반드시 `AEADBadTag`로 실패하는 깨진 상태를 만들므로 금지. 무효화 판정과 복구 정책 결정권은 DatabaseKeyManager에만 있음
  - `testKeyUsability()` 등 캐시 방어 로직 단순화/제거
- 이유: "옛날 캐시를 민" 사고를 구조적으로 불가능하게 함. **alias 결정권은 DatabaseKeyManager에만** 있음.

### 3. [3번째 구현 — alias 포인터 도입] DatabaseKeyManager — 재래핑 인덱스 alias 원자성 (결함 3)
- 파일: `DatabaseKeyManager.kt`
- 변경: **인덱스 붙은 alias(`kiyo_master_key_1`, `kiyo_master_key_2`, ...) + DataStore 포인터**
  - DataStore에 `current_master_key_alias` preference 추가 (초기값: `kiyo_master_key_1`)
  - **기존 기기 마이그레이션 (명시 규칙)**:
    - `current_master_key_alias` preference가 없으면(첫 접근) → Keystore에 구 `kiyo_master_key`(무인덱스) 존재 확인
    - 존재하면: `db_encrypted_key` 블롭도 존재하는지 확인 → 둘 다 있으면 **구 alias를 그대로 첫 current_alias로 사용** (`kiyo_master_key`)하고, 최초 재래핑 시에만 `_N+1` 인덱스로 전환. 무인덱스 → `_1` 강제 rename/재암호화는 하지 않음 (불필요한 위험 회피)
    - 구 키가 없는데 블롭만 있으면(비정상 상태): fallback 경로(변경 5)로 처리
  - 이후 모든 읽기/재래핑은 포인터가 가리키는 인덱스 alias만 사용
  - 재래핑 흐름:
    ```
    1. DataStore에서 current_alias(예: kiyo_master_key_1) 읽기
    2. KeystoreManager.getOrCreateKey(current_alias)로 현재 키 조회
    3. 현재 키로 DB_KEY 복호화 → plain DB_KEY 확보
    4. 다음 인덱스 alias(예: kiyo_master_key_2) 결정
    5. KeystoreManager.getOrCreateKey(new_alias)로 새 auth-required 키 생성
    6. 새 alias 키로 plain DB_KEY 재암호화
    7. DataStore edit 블록에서 (새 블롭 + 새 alias) 동시 저장
    8. 저장 성공 확정 후 KeystoreManager.deleteKey(old_alias)로 구 alias 삭제
    ```
  - 실패 시: 구 alias + 구 블롭 + 구 포인터 모두 보존 → 완전 롤백
  - alias rename/이전 불필요. 포인터만 갈아끼움.
  - 구 alias 삭제는 DataStore 커밋 **이후**에만.
- 이유: delete 이후 실패로 깨진 상태 진입 차단. 롤백 단순함.

### 3.1 [병행] `resetForSecurityDowngrade()` → `resetAutofillData()` 리네이밍
- 파일: `DatabaseKeyManager.kt` 및 호출부
- 변경: KPInvalidated(PIN/생체 변경)와 보안 다운그레이드가 **같은 reset 정책**을 공유하게 되므로,
  "다운그레이드 전용"이라는 부정확한 이름을 `resetAutofillData()`(또는 `resetEncryptedAutofillState()`)로 변경.
  구현 중 실제 호출 지점 확인 후 더 정확한 쪽으로 결정. 동작 변경 없음 (이름만).

### 4. [4순위] FillResponseBuilder.createAuthResponse — check() 제거 (결함 4)
- 파일: `FillResponseBuilder.kt`, `KiyoAutofillService.kt`
- 변경:
  - `check(autofillIds.isNotEmpty())` 제거
  - 서비스 호출부에서 가드:
    ```kotlin
    if (usernameId == null && passwordId == null) {
        Log.d(TAG, "No fields for auth response")
        handler.post { callback.onSuccess(null) }
        return
    }
    val response = FillResponseBuilder.createAuthResponse(this, usernameId, passwordId)
    ```
  - `createAuthResponse`는 non-null 전제로 단순화.
- 이유: 인증 필요한 순간에 프롬프트가 크래시로 사라지는 경로 제거.

### 5. [유지] fallback catch들 — 역할 재정의
- `KeyPermanentlyInvalidatedException` / `AEADBadTagException` 복구 경로 **유지하되 역할 변경**:
  - **핵심 원칙: 기존 DB_KEY를 "살리려" 시도하지 않는다.** Autofill DB는 파생 데이터(원본 = React vault, sync로 전량 덮어쓰기)이므로, 무효화된 wrapping 복구에 복잡한 로직을 쓸 가치가 없음.
  - **`KeyPermanentlyInvalidatedException`의 의미 재정의**:
    - 정상 상태라면 current_alias가 항상 유효한 현재 키를 가리킴 → 이 예외 수신은 **PIN/생체 등록 변경으로 auth-required 키가 시스템 무효화된 상태**(또는 이상 상태)를 의미. "정상 재래핑 처리 대상"이 아님 — 정상 재래핑은 포인터 전환으로 끝나며 서비스가 구 alias를 볼 일이 없음
    - 예외 자체는 catch 유지 (무효화 사실의 통지 수단), 단 **같은 alias 재생성 → 복호화 재시도를 복구 수단으로 사용하지 않음**
    - 복구 정책: **Autofill DB 리셋 → 새 DB_KEY + 새 wrapping 즉시 커밋 → 메인 앱 sync로 재구축**. 리셋 시 새 wrapping을 DataStore에 즉시 커밋하지 않으면 매 fill마다 리셋이 반복되므로 필수
  - **정상 동기화 메커니즘이 아님.** "현재 alias + 현재 마스터 키로도 복호화 불가" 같은 **예상치 못한 상태의 최후 복구**로만 발동.
  - 1~4가 적용되면 실제 발동은 드물어야 함 (로그로 모니터링).
  - `AEADBadTag` 발생 시: 현재 alias 확인 → 현재 마스터 키 확인 → 그래도 실패 → 리셋+재구축 (공격적 리셋 지양).
  - **동시성(메인 앱 재래핑 ↔ 서비스 리셋 경합)**: 요청 단위 fresh 읽기(변경 1~2)로 경합 창이 최소화됨. DataStore 멀티프로세스 stale이 실제 재현되면 그때 별도 해결 (v3 원칙 유지).

## Tests

- **회귀**: `run-autofill-e2e.ps1` (1단계 noAuth + 2단계 authRequired) 전체 통과
- **E2E (기존 커버)**: 2단계는 재래핑 직후 testHost fill 수행 → "재래핑 → 즉시 fill" 회귀 검증 포함
- **필수 시나리오 (구현 완료 판정 기준)**:

  1. **재래핑**: no-auth → PIN 설정 → sync → `_1`→`_2` → 즉시 fill 정상
  2. **인증 제거**: auth-required → PIN 제거 → fill → `KPInvalidated` → reset + 새 wrapping commit → 빈 DB → sync → fill 정상
  3. **PIN 변경**: auth-required → PIN 변경 → fill → `KPInvalidated` → reset + 새 wrapping commit → sync → fill 정상
  4. **연속 fill**: fill #1 → close → fill #2 → 새로운 `Repository.create()` → 정상
  5. **리셋 커밋 회귀 (가장 중요)**: fill #1에서 KPInvalidated → reset → 새 DB_KEY + 새 master key → DataStore commit → fill #2는 **새 상태 정상 조회, 또 reset ❌**.
     리셋 후 새 wrapping 즉시 커밋이 빠지면 매 fill마다 리셋 반복 — 이 시나리오로 반드시 검증
  6. **재생성 안티패턴 회귀 (정적 확인)**: `KPInvalidated → generateNewKey(currentAlias)` 경로가
     KeystoreManager 어디에도 남아 있지 않은지 코드/로그 양쪽에서 확인

- **수동 검증**:
  1. 재래핑 직후 fill → 드롭다운 정상, 로그에 `Clearing key cache`/`AEADBadTag`/`Error in onFillRequest` 없음
  2. 잠금화면 제거 → 동기화 → 리셋 재구축 → fill 정상
  3. 연속 fill 2회 이상 → 두 번째도 정상 (close→재생성 경로)
- **성능 관찰**: fill 요청당 소요 시간 로그. 문제 시 별도 이슈로 재검토
- **E2E 인증 캐시 상호작용 주의**: authRequired 2단계는 Keystore 30분 인증 캐시에 의존.
  요청 단위 close→재생성 경로가 인증 프롬프트 타이밍과 어떻게 상호작용하는지
  수동 검증 3번(연속 fill 2회)에서 반드시 확인 — 두 번째 fill이 프롬프트를 건너뛰거나
  중복 프롬프트를 띄우지 않는지 확인할 것

## Risks

- **보안**: 캐시 제거는 보안 약화 아님(오히려 항상 현재 auth-required 키 사용).
  재래핑에서 auth-required 속성 누락 시 보안 강화 누락 → 구현 후 `WITH user authentication` 로그 확인 필수
- **회귀**: close 누락 방지는 `use` 패턴으로 구조적 차단
- **라이프사이클**: 코루틴 비동기 처리 중 `finally`에서 close 보장
- **호환성**: `AutofillRepository.create()` 시그니처 변경 없음. Plugin 캐시 미변경은 외부 영향 없음.
- **재래핑 alias 마이그레이션**: 기존 `kiyo_master_key`(무인덱스) 기기는 변경 3의 명시 규칙대로 처리 —
  preference 부재 시 구 alias를 첫 current_alias로 그대로 사용하고, 최초 재래핑 시에만 `_N+1`로 전환.
  무인덱스 → `_1` 강제 rename/재암호화 없음.

## Rollback

- 변경 4개 파일 독립 커밋 → 개별 revert 가능
- 캐시 제거/요청 단위는 동작 변경만 — 데이터/스키마 변경 없음 → 즉시 복구
- 인덱스 alias 재래핑 실패 시 구 alias+구 블롭+구 포인터 보존 → 수동 복구 가능
- 최악: 자동완성 DB 파생 데이터 → 리셋+재동기화로 재구축 (기존 정책)

## Verification

- `run-autofill-e2e.ps1` 전체 통과
- 재래핑 직후 fill 로그에 `Error in onFillRequest` / `AEADBadTagException` / `Clearing key cache` 없음
- `WITH user authentication` 로그로 auth-required 재래핑 유지 확인
- 연속 fill에서 close→재생성 경로 정상 확인
- **리셋 커밋 회귀**: KPInvalidated → reset → commit 이후의 두 번째 fill에서 reset이 **재발하지 않음** (로그 기준)
- **재생성 안티패턴 부재**: `KPInvalidated → generateNewKey(currentAlias)` 코드 경로 없음 (grep + 로그)

---

## 시나리오별 동작 검증표 (구현 후 확인용)

### 1️⃣ 인증 없음 → 최초 PIN/생체인증 설정

| 단계 | 상태 | 동기화 버튼 | 자동완성 요청 (동기화 전) | 자동완성 요청 (동기화 후) | **사용자 인증 요청** |
|---|---|---|---|---|---|
| **초기** | 잠금화면 없음, `_1` non-auth | — | ✅ 정상 (non-auth) | — | ❌ 없음 |
| **PIN 설정** | 잠금화면 활성화, 기존 `_1` 살아있음 | — | ✅ 정상 | — | ❌ 없음 |
| **동기화 누름** | `needsSecurityUpgrade()`=TRUE → **재래핑** `_1`→`_2`(auth) | `securityUpgrade=true` | — | ✅ 정상 (캐시 유효) | ❌ 없음 (PIN 입력으로 캐시 채워짐) |
| **30분 후** | 인증 캐시 만료 | — | — | 🔐 프롬프트 표시 | ✅ **발생** — `createAuthResponse()` → 시스템 인증 프롬프트 (지문/PIN) |

> ✅ 데이터 보존, 보안 강화만 일어남. **인증 요청은 30분 뒤 자동완성 요청 시에만 발생**.

---

### 2️⃣ 인증 있음 → 잠금화면 제거 (PIN/생체 삭제)

| 단계 | 상태 | 동기화 버튼 | 자동완성 요청 (동기화 전) | 자동완성 요청 (동기화 후) | **사용자 인증 요청** |
|---|---|---|---|---|---|
| **초기** | 잠금화면 있음, `_N` auth-required | — | — | — | ❌ 없음 |
| **잠금 제거** | 시스템이 auth-required 키 영구 무효화 | — | — | — | ❌ 없음 |
| **자동완성 요청** | — | — | ⚠️ **fallback 발동** (non-auth 임시 키 생성) — 최후 복구 경로이며 정상 경로 아님. 로그로 관찰 필수 | — | ❌ 없음 |
| **동기화 누름** | `isSecurityDowngrade()`=TRUE → **전체 리셋** → `_1` non-auth 신규 | 리셋 후 빈 DB로 동기화 | — | ✅ 정상 (리셋 후 non-auth) | ❌ 없음 (non-auth 상태) |

> ⚠️ **전 과정 인증 요청 없음**. 잠금화면 제거 시 non-auth로 강제 다운그레이드.

---

### 3️⃣ 인증 변경 (PIN 변경 / 생체 재등록)

| 단계 | 상태 | 동기화 버튼 | 자동완성 요청 (동기화 전) | 자동완성 요청 (동기화 후) | **사용자 인증 요청** |
|---|---|---|---|---|---|
| **초기** | 잠금화면 있음, `_N` auth-required | — | — | — | ❌ 없음 |
| **PIN 변경** | 시스템이 auth-required 키 영구 무효화, DB_KEY는 구 `_N`로 암호화된 채 존재 | — | — | — | ❌ 없음 (시스템 PIN 변경 화면은 별도) |
| **자동완성 요청** (동기화 전) | — | — | ❌ **실패** (fallback 리셋 → 빈 결과) | — | ❌ 없음 (리셋 후 빈 DB, 인증 불필요) |
| **동기화 누름** | `isSecurityDowngrade()`=FALSE → 일반 진행 → `AEADBadTagException` → **리셋** → 재동기화 | 리셋 후 재동기화 | — | ✅ 정상 (새 `_N+1` auth 키로 재암호화) | ✅ **발생 가능** — 첫 fill 시 30분 캐시 만료면 `createAuthResponse()` → 프롬프트 |

> ⚠️ **동기화 전 첫 자동완성은 리셋으로 실패 (인증 요청 없음)**. 동기화 후 정상 상태에서 **첫 fill 시 인증 캐시 만료면 프롬프트 발생**.

---

## 한눈에 보는 표: 동기화 전 vs 동기화 후 자동완성

| 시나리오 | 동기화 **전** 자동완성 | 동기화 **후** 자동완성 | 비고 |
|---|---|---|---|
| **1. 인증 없음 → 생성** | ✅ 정상 (non-auth) | ✅ 정상 (auth-required, 30분 뒤 프롬프트) | 재래핑 1회 |
| **2. 인증 있음 → 제거** | ⚠️ fallback 발동 (최후 복구, 로그 관찰 필요) | ✅ 정상 (리셋 후 non-auth) | 데이터 소실, 재동기화로 복구 |
| **3. 인증 변경 (PIN 변경)** | ❌ **실패** (리셋 발생) | ✅ 정상 (리셋 후 재동기화) | **유일하게 첫 자동완성 실패** |

---

## 구현 후 검증 포인트

| # | 검증 내용 | 기대 로그 |
|---|---|---|
| 1 | 시나리오 1: 동기화 → 재래핑 완료 직후 fill | `WITH user authentication`, `AEADBadTag` 없음, fill 성공 |
| 2 | 시나리오 2: 잠금 제거 → fill → 동기화 → fill | fill 정상 → `Security downgrade detected` → 리셋 → fill 정상 |
| 3 | 시나리오 3: PIN 변경 → fill(동기화 전) → 동기화 → fill(동기화 후) | 첫 fill: `AEADBadTag` → 리셋 → 빈 결과 / 동기화: 리셋 → 재동기화 / 두 번째 fill: 정상 |