# KIYO

**Offline-first, privacy-focused Android password manager with system-level autofill integration.**

KIYO는 사용자의 비밀번호를 로컬에만 저장하며, Android AutofillService를 통해 앱과 웹에서 시스템 레벨 자동완성을 제공합니다.

## Features

- **로컬 암호화 저장** - PBKDF2(100,000회) + AES-GCM으로 PIN 기반 데이터 암호화
- **Android Autofill 연동** - 시스템 자동완성 서비스(API 26+)로 앱/웹 로그인 폼 자동 채우기
- **오프라인 퍼스트** - 네트워크 권한 없음, 클라우드 동기화 없음, 모든 데이터 로컬 저장
- **다중 데이터 파일** - 여러 암호화된 볼트 생성/가져오기/백업/복원 지원
- **도메인/패키지 매칭** - 웹사이트 도메인과 앱 패키지명으로 계정 자동 매칭
- **비밀번호 생성기** - 길이, 문자 종류 커스터마이징 가능한 안전한 비밀번호 생성
- **즐겨찾기·태그·템플릿** - 계정 분류와 자주 쓰는 필드 템플릿 관리
- **안전한 세션 관리** - 암호화 키를 디스크에 저장하지 않고 메모리에만 보관
- **Android Keystore 연동** - 자동완성용 SQLite DB 마스터 키를 Keystore로 래핑하여 평문 저장 방지
- **Autofill 세션 저장** - DataStore로 프로세스 재시작 후에도 자동완성 세션 유지 (30분 만료)
- **자동 잠금 (Auto-lock)** - `none` / `1m` / `10m` / `30m` 4단계 설정 (활동 감지 시 타이머 리셋, 암호화 키 상실 시 즉시 잠금)

## Tech Stack

| Layer              | Technologies                                                    |
| ------------------ | --------------------------------------------------------------- |
| **Frontend**       | React 19, TypeScript, Vite, Tailwind CSS, Zustand, React Router |
| **Native Bridge**  | Capacitor 8 (Android)                                           |
| **Local DB**       | Dexie.js (IndexedDB)                                            |
| **Crypto**         | Web Crypto API (PBKDF2 + AES-GCM)                               |
| **Android Native** | Kotlin, AutofillService (API 26+), SQLiteOpenHelper, Android Keystore, DataStore (Preferences) |
| **Testing**        | Vitest (unit/integration)                                       |

## Architecture

```
┌─────────────┐     Capacitor Bridge      ┌──────────────────┐
│  React App  │ ◄──────────────────────► │  Android Native  │
│  (WebView)  │   Plugin: KiyoAutofill   │  AutofillService │
└──────┬──────┘                           └────────┬─────────┘
       │                                           │
       ▼                                           ▼
┌─────────────┐                           ┌──────────────────┐
│  IndexedDB  │                           │ SQLCipher DB     │
│  (Dexie)    │                           │ (Autofill Repo)  │
│  - 계정/설정 │                           │  - 자동완성용 계정 │
└─────────────┘                           └────────┬─────────┘
       │                                           │
       │ 파일 시스템 (Documents)                   │
       ▼                                           │
┌─────────────┐                           ┌────────▼────────┐
│  암호화 JSON │                           │  DB_KEY (AES-256)│
│  (PBKDF2+AES)│                           │  SQLCipher 암호화 │
└─────────────┘                           └────────┬────────┘
                                                   │
                                                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Android Keystore                            │
│  ┌────────────────────┐                                         │
│  │ kiyo_master_key    │                                         │
│  │ (AES-256-GCM, TEE) │                                         │
│  └─────────┬──────────┘                                         │
│            │                                                     │
│            ▼                                                     │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                  DatabaseKeyManager                       │    │
│  │  - DB_KEY: random 32-byte ByteArray                      │    │
│  │  - Encrypt with kiyo_master_key (AES-256-GCM)            │    │
│  │  - Store encrypted in kiyo_security_prefs DataStore      │    │
│  │  - getKey(): SecretKey (for SQLCipher)                   │    │
│  └─────────────────────┬────────────────────────────────────┘    │
└────────────────────────┼─────────────────────────────────────────┘
                         │
                         ▼
              ┌─────────────────────────┐
              │ kiyo_security_prefs     │
              │ DataStore               │
              │                         │
              │ - db_encrypted_key      │
              │   { "iv": "...",         │
              │     "ciphertext": "..." }│
              └─────────────────────────┘

    ┌─────────────────────────────────────────────┐
    │              autofill_prefs                  │
    │              DataStore (별도)                 │
    │                                             │
    │  - autofill_token (String)                  │
    │  - token_expire_at (Long, 30분)             │
    │  - is_encrypted (String "true"/"false")     │
    └─────────────────────────────────────────────┘
           ▲
           │ (AutofillService.onFillRequest 시에만 사용)
           │
    ┌──────┴──────┐
    │ Autofill    │
    │ Service     │
    └─────────────┘
```

- **React App**: UI, 계정 관리, 설정, 암호화/복호화 수행
- **Capacitor Plugin**: React ↔ Native 통신 브리지 (세션 키 전달, 계정 동기화, 자동완성 상태 확인, 토큰 관리)
- **AutofillService**: Android 시스템 자동완성 제공 (필드 탐지, 계정 매칭, FillResponse 구성, `autofill_prefs` 토큰 검증)
- **AuthRequestHandler**: 인증 요청 처리 (토큰 검증, 인증 응답 생성)
- **KeystoreManager**: Android Keystore 마스터 키(`kiyo_master_key`) 생성/관리, DB_KEY 암호화/복호화
- **DatabaseKeyManager**: `kiyo_security_prefs` DataStore에서 암호화된 DB_KEY 읽기/쓰기, Keystore로 래핑/언래핑
- **AutofillAuthStore**: `autofill_prefs` Preferences DataStore 래퍼, 자동완성 토큰/만료/암호화 상태 저장 (30분 만료, **Keystore와 무관**)
- **SQLCipher DB**: `AutofillRepository`가 사용하는 암호화된 SQLite DB (DB_KEY로 암호화)
- **AutofillRepository**: 자동완성용 계정 리포지토리
- **DomainMatcher**: 도메인 매칭 로직 (정확/서브도메인)
- **AccountMapper**: React JSON → AutofillAccount 파싱

## Security

### 암호화 방식 (React Vault)

- **키 파생**: PBKDF2-HMAC-SHA256, 100,000회 반복, 16바이트 랜덤 솔트
- **데이터 암호화**: AES-GCM 256비트, 12바이트 IV, 인증 태그 내장
- **레코드 단위 암호화**: 각 Account/Template 객체를 통째로 직렬화하여 단일 AES-GCM 블롭으로 암호화 (필드별 암호화 미사용)
- **파일 포맷**: 버전, 솔트, IV, 암호문을 Base64로 인코딩하여 JSON 저장

### 키 관리

- **PIN 검증**: 저장된 솔트로 키 파생 → 복호화 시도 → 성공 시 세션에 키 보관 (메모리만)
- **Autofill 세션**: DataStore(`autofill_prefs`)에 토큰/만료/암호화 상태 저장, 30분 만료, 프로세스 재시작 후 유지

### Android Keystore 연동 (Autofill DB 보호)

자동완성 서비스용 SQLite 데이터베이스(SQLCipher)의 마스터 키(DB_KEY)는 Android Keystore로 보호됩니다:

- **마스터 키**: `kiyo_master_key` (AES-256-GCM, AndroidKeyStore)
- **키 생성/로드**: `KeystoreManager.getOrCreateKey()` - 최초 1회 생성 후 캐싱
- **DB_KEY 래핑**: `DatabaseKeyManager.getKey()` 호출 시
  1. DataStore(`kiyo_security_prefs`)에서 암호화된 DB_KEY 읽기 (`db_encrypted_key`)
  2. Keystore 마스터 키로 복호화 → 평문 DB_KEY 획득
  3. 최초 호출 시: 새 DB_KEY 생성 → 마스터 키로 암호화 → DataStore 저장
- **EncryptedKey 포맷**: JSON `{ "iv": "...", "ciphertext": "..." }` (12바이트 IV + AES-GCM 태그 포함 ciphertext)
- **이점**: DB_KEY가 평문으로 DataStore에 저장되지 않음, 프로세스 종료 후에도 안전하게 복구 가능

### 데이터 저장소별 보안

| 데이터           | 저장소                   | 암호화             | 비고                            |
| ---------------- | ------------------------ | ------------------ | ------------------------------- |
| 메인 계정 데이터 | 파일 시스템 (Documents)  | AES-GCM (PIN 기반) | 사용자 파일로 백업/이동 가능    |
| 자동완성용 계정  | SQLite Database (Native) | SQLCipher + Keystore | AutofillService 전용, Keystore로 DB_KEY 보호 |
| IndexedDB 계정   | IndexedDB (Dexie)        | AES-GCM 레코드 단위 | 전체 Account/Template 객체 암호화 |
| 앱 설정          | IndexedDB (Dexie)        | 평문               | 테마, 폰트 등 비민감 설정       |
| Autofill 토큰    | DataStore (autofill_prefs) | 평문 (토큰 만료 30분) | 프로세스 재시작 후에도 세션 유지 |
| Keystore 마스터 키 | Android Keystore         | 하드웨어/TEE 보호  | 앱 삭제 시 함께 소멸, 추출 불가 |

### Autofill 세션 저장 (DataStore, 30분 만료)

자동완성 서비스에서 PIN 인증 후 발급된 세션 토큰을 `androidx.datastore:datastore-preferences`로 저장합니다 (프로세스 재시작 후에도 유지, 30분 후 만료):

| 키 | 타입 | 설명 |
|-----|------|-------------|
| `autofill_token` | String | PIN 인증 성공 시 발급된 세션 토큰 (암호화 키 export 또는 unencrypted_vault_token) |
| `token_expire_at` | Long | 토큰 만료 타임스탬프 (epoch ms), 기본 30분 (1800000 ms) |
| `is_encrypted` | Boolean (String) | 현재 볼트가 암호화된 상태인지 여부 (`"true"`/`"false"`) |

**채우기 요청 처리 로직** (`KiyoAutofillService.onFillRequest`):

1. `isEncrypted` 확인 → `false`면 바로 채우기 응답 반환 (비암호화 볼트)
2. 암호화 볼트면 토큰 유효성 검사 (`token != null && now < expireAt`)
3. 유효한 토큰 없음 → `FillResponseBuilder.createAuthResponse()`로 인증 요청 반환
4. 유효한 토큰 있음 → 채우기 응답 반환

**토큰 발급/갱신** (React → Native):
- `setAutofillToken(token, expireAt, isEncrypted)` - PIN 인증 성공 시 호출
- `clearAutofillToken()` - 로그아웃, 볼트 전환 시 호출
- `setVaultEncryptionStatus(isEncrypted)` - 볼트 생성/열기 시 호출

## Installation

### Prerequisites

- Node.js 20+
- Android Studio (Android 빌드용)
- JDK 17+

### Development

```bash
# 의존성 설치
npm install

# 개발 서버 (웹 프리뷰)
npm run dev

# 타입 체크
npm run typecheck

# 린트
npm run lint

# 테스트
npm run test
```

### Android Build

```bash
# 웹 빌드 + Capacitor 동기화 + Android Studio 열기
npm run android:build

# 또는 직접 실행 (디버그 APK 빌드 후 설치)
npm run android:run
```

## Usage

1. **초기 설정**: 앱 실행 → "새 파일 만들기" → 파일명 입력 → PIN 설정 (4~6자리)
2. **계정 추가**: 하단 '+' 버튼 → 웹사이트/앱 선택 또는 직접 입력 → 필드 커스터마이징
3. **자동완성 활성화**: Android 설정 → 자동완성 서비스 → KIYO 선택 → 권한 허용
4. **사용**: 앱/웹 로그인 화면에서 필드 포커스 → KIYO 제안 표시 → PIN으로 잠금 해제 → 자동 채우기
5. **백업/복원**: 설정 → 데이터 백업 (PIN 입력) → 암호화된 JSON 파일 저장/가져오기

## Development Status

### Implemented ✅

- React + Capacitor 하이브리드 앱 구조
- PBKDF2 + AES-GCM 암호화/복호화 (React Vault)
- 다중 데이터 파일 생성/열기/백업/가져오기
- PIN 기반 인증 및 세션 관리
- Android AutofillService (API 26+) - 필드 탐지, 도메인/패키지 매칭, FillResponse
- AuthRequestHandler - 인증 요청 처리 (토큰 검증, 인증 응답 생성)
- AutofillAuthStore 영구 토큰 저장 (30분 만료)
- Capacitor 플러그인 브리지 (React ↔ Native)
- IndexedDB (Dexie) 로컬 데이터베이스
- 계정 CRUD, 즐겨찾기, 태그, 템플릿
- 비밀번호 생성기
- 테마/폰트/자동잠금 설정
- 단위/통합 테스트 (Vitest, Robolectric)
- 자동완성 필드 탐지/점수/매칭 단위 테스트
- AuthRequestHandler, AutofillAuthStore, DomainMatcher, AccountMapper, FieldScoringRules 단위 테스트
- KiyoAutofillPlugin 스모크 테스트

### In Progress 🚧

- 자동완성 저장 UI (SaveInfo) 개선
- 웹뷰/브라우저 자동완성 지원 확대
- 데이터 내보내기/가져오기 포맷 표준화 (CSV, Bitwarden JSON)
- 생체 인증 연동 (@aparajita/capacitor-biometric-auth) - Secure Storage 키 저장/복원

### Planned 📋

- 다국어 지원 (영어, 일본어)
- 접근성 개선 (TalkBack)
- F-Droid 및 Google Play Store 배포 준비

## License

MIT License - see [LICENSE](LICENSE) for details.

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Links

- [Capacitor Documentation](https://capacitorjs.com/docs)
- [Android AutofillService Guide](https://developer.android.com/guide/topics/text/autofill-services)
- [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
- [Dexie.js Documentation](https://dexie.org/)