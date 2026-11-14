# KIYO

**Offline-first, privacy-focused Android password manager with system-level autofill integration.**

KIYO는 사용자의 비밀번호를 로컬에만 저장하며, Android AutofillService를 통해 앱과 웹에서 시스템 레벨 자동완성을 제공합니다. 네트워크 권한이 없고 클라우드 동기화도 없습니다.

## Features

- **로컬 암호화 저장** - PBKDF2(100,000회) + AES-GCM으로 PIN 기반 데이터 암호화
- **Android Autofill 연동** - 시스템 자동완성 서비스(API 26+)로 앱/웹 로그인 폼 자동 채우기
- **오프라인 퍼스트** - 네트워크 권한 없음, 클라우드 동기화 없음, 모든 데이터 로컬 저장
- **다중 데이터 파일 (Files-only Vault)** - 여러 암호화된 볼트 생성/가져오기/백업/복원 지원
- **도메인/패키지 매칭** - 웹사이트 도메인과 앱 패키지명으로 계정 자동 매칭
- **비밀번호 생성기** - 길이, 문자 종류 커스터마이징 가능한 안전한 비밀번호 생성
- **즐겨찾기·태그·템플릿** - 계정 분류와 자주 쓰는 필드 템플릿 관리
- **안전한 세션 관리** - 암호화 키를 디스크에 저장하지 않고 메모리에만 보관
- **Android Keystore 연동** - 자동완성용 DB 마스터 키(`kiyo_master_key`)와 생체인증 볼트 언락 키(`kiyo_secure_master_key`)를 각각 별도 Keystore 마스터 키로 보호
- **자동완성 인증 캐싱** - Android Keystore를 통한 사용자 인증 캐싱 (30분, 프로세스 재시작 후 유지)
- **자동 잠금 (Auto-lock)** - `none` / `1m` / `10m` / `30m` 4단계 설정
- **생체인증 로그인 (Biometric Unlock)** - 지문/얼굴 인증으로 볼트 잠금 해제
- **자동 백업 (Auto-backup)** - 설정 기반 자동 백업 트리거, 첫 백업 자동 실행

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS 4, Zustand 5, React Router 7 |
| Native Bridge | Capacitor 8 (Android) |
| Local DB | Dexie.js (IndexedDB) — `files` 테이블만, 볼트 전체 암호화 JSON |
| App Settings | Zustand → localStorage persist |
| Crypto | Web Crypto API (PBKDF2 + AES-GCM) |
| Android Native | Kotlin, AutofillService, SQLiteOpenHelper, Android Keystore, DataStore, SharedPreferences |
| Testing | Vitest, Playwright, Robolectric + Espresso |

## Security

- **키 파생**: PBKDF2-HMAC-SHA256, 100,000회 반복, 16바이트 랜덤 솔트
- **데이터 암호화**: AES-GCM 256비트, 12바이트 IV, 인증 태그 내장
- **암호화 단위**: 볼트 전체를 단일 AES-GCM 블롭으로 암호화 (파일 단위)
- **키 관리**: `cryptoKey`는 메모리에만 보관 (디스크 미Persist)
- **Android Keystore**: `kiyo_master_key`(autofill DB)와 `kiyo_secure_master_key`(biometric vault) 완전 분리, 생체인증 STRONG만 허용
- **자동 잠금**: 키 상실 시 즉시 잠금

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

# 타입 체크 + 테스트
npm run check

# 단위/통합 테스트만
npm run test
```

### Android Build

```bash
# 웹 빌드 + Capacitor 동기화 + Android Studio 열기
npm run android:build

# 또는 직접 실행 (디버그 APK 빌드 후 설치)
npm run android:run
```

### E2E Tests (emulator required)

```bash
# Autofill E2E
npm run test:e2e:android
npm run test:e2e:android:fast

# Biometric Unlock E2E
npm run test:e2e:biometric
npm run test:e2e:biometric:fast

# Autosave E2E
npm run test:e2e:autosave
npm run test:e2e:autosave:fast

# React E2E (Playwright)
npm run test:e2e
```

## Usage

1. **초기 설정**: 앱 실행 → "새 파일 만들기" → 파일명 입력 → PIN 설정 (4~6자리)
2. **계정 추가**: 하단 '+' 버튼 → 웹사이트/앱 선택 또는 직접 입력 → 필드 커스터마이징
3. **자동완성 활성화**: Android 설정 → 자동완성 서비스 → KIYO 선택 → 권한 허용
4. **사용**: 앱/웹 로그인 화면에서 필드 포커스 → KIYO 제안 표시 → PIN/생체인증으로 잠금 해제 → 자동 채우기
5. **백업/복원**: 설정 → 데이터 백업 (PIN 입력) → 암호화된 JSON 파일 저장/가져오기
6. **자동 백업**: 설정 → 자동 백업 켬 → 계정 생성/변경 시 자동 백업 트리거

## Development Status

### Implemented ✅

- React + Capacitor 하이브리드 앱 구조
- PBKDF2 + AES-GCM 암호화/복호화 (React Vault)
- Files-only Vault: 단일 암호화 JSON 파일 소스 오브 트루스
- 다중 데이터 파일 생성/열기/백업/가져오기
- PIN 기반 인증 및 세션 관리
- Android AutofillService (API 26+) - 필드 탐지, 도메인/패키지 매칭, FillResponse
- Capacitor 플러그인 브리지 (KiyoAutofill, SecureKey, KiyoFile)
- IndexedDB (Dexie) 로컬 데이터베이스 (`files` 테이블, 볼트 전체 암호화 JSON)
- 계정 CRUD, 즐겨찾기, 태그, 템플릿
- 비밀번호 생성기
- 테마/폰트/자동잠금 설정
- 단위/통합 테스트 (Vitest)
- 자동 완성 필드 탐지/점수/매칭 단위 테스트
- KiyoAutofillPlugin 스모크 테스트
- 자동 백업 (Auto-backup) 트리거 및 로그
- 에러 타입 분할 (FileStorageError by concern)
- 용어 사전 (GLOSSARY.md)
- APP_VERSION 상수 (package.json 기반)

### In Progress 🚧

- 앱스토어 배포준비

### Planned 📋

- iOS 지원 (iOS Password AutoFill + Secure Enclave, 볼트 관리)
- 자동완성 저장 UI (SaveInfo) 개선
- 웹뷰/브라우저 자동완성 지원 확대
- 데이터 내보내기/가져오기 포맷 표준화 (CSV, Bitwarden JSON)
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

> **Note**: Android 변경 후 `npx cap sync android` 필수. `npm run check` (typecheck + test) 통과 필수.

## Links

- [Capacitor Documentation](https://capacitorjs.com/docs)
- [Android AutofillService Guide](https://developer.android.com/guide/topics/text/autofill-services)
- [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
- [Dexie.js Documentation](https://dexie.org/)
- [GLOSSARY.md](docs/GLOSSARY.md) — 프로젝트 캐노니컬 용어 사전
- [STRATEGY.md](STRATEGY.md) — KIYO 제품 전략 및 설계 경계