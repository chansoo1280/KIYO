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
- **안전한 세션 관리** - 암호화 키를 디스크에 저장하지 않고 인메모리 SecuritySession으로 관리

## Tech Stack

| Layer              | Technologies                                                    |
| ------------------ | --------------------------------------------------------------- |
| **Frontend**       | React 19, TypeScript, Vite, Tailwind CSS, Zustand, React Router |
| **Native Bridge**  | Capacitor 8 (Android)                                           |
| **Local DB**       | Dexie.js (IndexedDB)                                            |
| **Crypto**         | Web Crypto API (PBKDF2 + AES-GCM)                               |
| **Android Native** | Kotlin, AutofillService (API 26+), SQLiteOpenHelper             |
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
│  IndexedDB  │                           │ SQLite Database  │
│  (Dexie)    │                           │ (Autofill Repo)  │
│  - 계정/설정 │                           │  - 자동완성용 계정 │
└─────────────┘                           └──────────────────┘
       │
       │ 파일 시스템 (Documents)
       ▼
┌─────────────┐
│  암호화 JSON │
│  (PBKDF2+AES)│
└─────────────┘
```

- **React App**: UI, 계정 관리, 설정, 암호화/복호화 수행
- **Capacitor Plugin**: React ↔ Native 통신 브리지 (세션 키 전달, 계정 동기화, 자동완성 상태 확인)
- **AutofillService**: Android 시스템 자동완성 제공 (필드 탐지, 계정 매칭, FillResponse 구성)
- **SecuritySession**: React에서 생성된 암호화 키를 Native AutofillService에서 사용할 수 있도록 프로세스 메모리에 유지하는 세션 계층

## Security

### 암호화 방식 (React Vault)

- **키 파생**: PBKDF2-HMAC-SHA256, 100,000회 반복, 16바이트 랜덤 솔트
- **데이터 암호화**: AES-GCM 256비트, 12바이트 IV, 인증 태그 내장
- **파일 포맷**: 버전, 솔트, IV, 암호문을 Base64로 인코딩하여 JSON 저장

### 키 관리

- **PIN 검증**: 저장된 솔트로 키 파생 → 복호화 시도 → 성공 시 세션에 키 보관
- **SecuritySession**: 암호화 키를 프로세스 메모리에만 보관 (`@Volatile` + `@Synchronized`), 앱 종료 시 자동 삭제

### 데이터 저장소별 보안

| 데이터           | 저장소                   | 암호화             | 비고                            |
| ---------------- | ------------------------ | ------------------ | ------------------------------- |
| 메인 계정 데이터 | 파일 시스템 (Documents)  | AES-GCM (PIN 기반) | 사용자 파일로 백업/이동 가능    |
| 자동완성용 계정  | SQLite Database (Native) | 앱 내부 저장소     | AutofillService 전용 캐시       |
| 앱 설정          | IndexedDB (Dexie)        | 평문               | 테마, 폰트 등 비민감 설정       |
| 세션 키          | 메모리 (SecuritySession) | N/A                | 인메모리, 프로세스 종료 시 소멸 |

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
- SecuritySession 인메모리 키 관리
- Capacitor 플러그인 브리지 (React ↔ Native)
- IndexedDB (Dexie) 로컬 데이터베이스
- 계정 CRUD, 즐겨찾기, 태그, 템플릿
- 비밀번호 생성기
- 테마/폰트/자동잠금 설정
- 단위/통합 테스트 (Vitest)

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
