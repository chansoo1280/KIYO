# KIYO Android 프로젝트 구조 분석 문서

## 1. 전체 프로젝트 개요

KIYO는 **Capacitor 기반의 크로스 플랫폼 비밀번호 관리자 앱**으로, 웹(React/TypeScript) 코드베이스를 Android/iOS 네이티브 앱으로 래핑합니다. 핵심 기능은 **Android Autofill Service**를 통한 자동완성 기능입니다.

### 기술 스택
- **프레임워크**: Capacitor 6.x (Android/iOS 네이티브 브릿지)
- **웹 프레임워크**: React 18 + TypeScript + Vite
- **네이티브 언어**: Kotlin (Android), Swift (iOS - 미확인)
- **빌드 시스템**: Gradle 8.x (Kotlin DSL)
- **최소 SDK**: API 26 (Android 8.0 Oreo) - Autofill Service 요구사항
- **타겟 SDK**: API 36 (Android 14)
- **컴파일 SDK**: API 36

---

## 2. Android 디렉터리 구조 분석

```
android/
├── .gitignore
├── build.gradle                    # 루트 빌드 설정
├── capacitor.settings.gradle       # Capacitor 플러그인 모듈 포함 설정 (자동 생성)
├── gradle.properties               # Gradle 속성
├── gradlew                         # Gradle 래퍼 (Unix)
├── gradlew.bat                     # Gradle 래퍼 (Windows)
├── settings.gradle                 # 프로젝트 설정 (모듈 포함)
├── variables.gradle                # 버전 변수 중앙 관리
├── gradle/                         # Gradle 래퍼 파일들
│   └── wrapper/
│       ├── gradle-wrapper.jar
│       └── gradle-wrapper.properties
├── app/                            # 메인 앱 모듈
│   ├── build.gradle                # 앱 모듈 빌드 설정
│   ├── proguard-rules.pro          # ProGuard 난독화 규칙
│   ├── capacitor.build.gradle      # Capacitor 자동 적용 설정
│   ├── google-services.json        # Firebase 설정 (선택적)
│   └── src/
│       ├── main/
│       │   ├── AndroidManifest.xml # 앱 매니페스트
│       │   ├── java/
│       │   │   └── com/kiyo/app/   # 메인 패키지
│       │   │       ├── MainActivity.java
│       │   │       ├── autofill/   # Autofill Service 패키지 (핵심)
│       │   │       ├── capacitor/  # Capacitor 플러그인 브릿지
│       │   │       └── security/   # 보안 세션 관리
│       │   ├── res/                # 리소스 파일
│       │   │   ├── drawable/       # 드로어블 (아이콘 등)
│       │   │   ├── layout/         # 레이아웃 XML
│       │   │   ├── mipmap/         # 앱 아이콘
│       │   │   ├── values/         # 문자열, 색상, 스타일
│       │   │   └── xml/            # XML 설정 (autofill_service 등)
│       │   └── assets/             # 웹 자산 (Capacitor가 dist 복사)
│       ├── androidTest/            # 안드로이드 계측 테스트
│       └── test/                   # 단위 테스트
└── capacitor-cordova-android-plugins/  # Cordova 플러그인 래퍼 모듈
```

---

## 3. 패키지 구조 분석

### 3.1 메인 패키지: `com.kiyo.app`

```
com.kiyo.app/
├── MainActivity.java                    # 앱 진입점 (Capacitor BridgeActivity)
├── autofill/                            # 🔑 핵심: Android Autofill Service 구현
│   ├── AutofillAccount.kt               # 데이터 클래스 (AutofillRepository 내부)
│   ├── AutofillCrypto.kt                # AES-GCM 암호화 유틸리티
│   ├── AutofillDatabaseHelper.kt        # SQLiteOpenHelper (DB 스키마 v5)
│   ├── AutofillRepository.kt            # 계정 CRUD + React 동기화 로직
│   ├── AutofillSettingsActivity.kt      # 자동완성 설정 액티비티
│   ├── CredentialExtractor.kt           # ViewNode에서 자격증명 추출
│   ├── FieldCandidate.kt                # 필드 후보 데이터 클래스
│   ├── FieldDetector.kt                 # ViewNode 순회 + 최적 필드 탐지
│   ├── FieldScorer.kt                   # 필드 점수 계산 (username/password)
│   ├── FillResponseBuilder.kt           # FillResponse/Dataset 생성
│   ├── IconResourceMapper.kt            # 도메인/패키지별 아이콘 매핑
│   ├── KiyoAutofillService.kt           # 🔑 AutofillService 구현체
│   ├── KiyoBiometricActivity.kt         # 생체인증 액티비티
│   └── ViewNodeUtils.kt                 # ViewNode 유틸리티 (HTML 속성 추출 등)
├── capacitor/                           # Capacitor 플러그인 브릿지
│   └── KiyoAutofillPlugin.java          # JS ↔ Native 브릿지 (핵심)
└── security/
    └── SecuritySession.kt               # 인메모리 보안 세션 (프로세스 수명)
```

### 3.2 패키지별 상세 역할

#### `com.kiyo.app` (루트)
- **MainActivity.java**: Capacitor `BridgeActivity` 확장, `KiyoAutofillPlugin` 등록
- 앱 진입점, 웹뷰 로드, 플러그인 브릿지 초기화 담당

#### `com.kiyo.app.autofill` (핵심 모듈 - 14개 파일)
Android Autofill Framework (API 26+) 완전 구현:

| 파일 | 역할 | 핵심 기능 |
|------|------|-----------|
| **KiyoAutofillService.kt** | AutofillService 구현체 | `onFillRequest`, `onSaveRequest` 처리, 생체인증 연동 |
| **AutofillRepository.kt** | 데이터 계층 (Repository 패턴) | SQLite CRUD, 암호화/복호화, React JSON 동기화, 다중 패키지명 지원 |
| **AutofillDatabaseHelper.kt** | SQLite 스키마 관리 | `autofill_accounts` 테이블, 인덱스, 마이그레이션 (v5) |
| **AutofillCrypto.kt** | 암호화 유틸리티 | AES-GCM + PBKDF2 (100k iterations), 키 캐싱 최적화 |
| **FieldScorer.kt** | 필드 점수 계산 | username/password 필드 탐지를 위한 휴리스틱 점수 시스템 |
| **FieldDetector.kt** | 필드 탐지 엔진 | 후위 순회로 최적 후보 탐색, 로그인 폼 판별 |
| **ViewNodeUtils.kt** | ViewNode 헬퍼 | HTML 속성 추출(autocomplete, type, name, id), 도메인/패키지 추출 |
| **FillResponseBuilder.kt** | 응답 구성 | Dataset/RemoteViews 생성, SaveInfo 설정, 아이콘 매핑 |
| **IconResourceMapper.kt** | 아이콘 리소스 매핑 | 주요 사이트(Google, GitHub 등) 프리셋 아이콘 + 기본 아이콘 |
| **CredentialExtractor.kt** | 자격증명 추출 | 특정 AutofillId에서 username/password 텍스트 추출 |
| **KiyoBiometricActivity.kt** | 생체인증 UI | BiometricPrompt 연동, 잠금 해제 시 세션 키 저장 |
| **AutofillSettingsActivity.kt** | 설정 액티비티 | 자동완성 서비스 설정 화면 진입점 |
| **FieldCandidate.kt** | 데이터 클래스 | 필드 후보 정보 (점수, 이유, 힌트, HTML 속성 등) |
| **AutofillAccount.kt** | 데이터 클래스 | 계정 엔티티 (packageNames JSON 배열, 도메인, 즐겨찾기 등) |

#### `com.kiyo.app.capacitor` (브릿지 모듈)
| 파일 | 역할 |
|------|------|
| **KiyoAutofillPlugin.java** | Capacitor 플러그인 - JS ↔ Native 통신 브릿지. 15개 메서드 제공 |

#### `com.kiyo.app.security` (보안 모듈)
| 파일 | 역할 |
|------|------|
| **SecuritySession.kt** | 인메모리 세션 관리 (프로세스 수명, 디스크 비저장, @Volatile + @Synchronized) |

---

## 4. 주요 모듈 상세 분석

### 4.1 Autofill Service 모듈 (`com.kiyo.app.autofill`)

#### 아키텍처 패턴
- **Repository Pattern**: `AutofillRepository`가 데이터 접근 캡슐화
- **Single-thread Executor**: 모든 DB 연산은 백그라운드 단일 스레드에서 순차 실행
- **Score-based Field Detection**: 휴리스틱 점수 시스템으로 username/password 필드 식별
- **Post-order Traversal**: ViewNode 트리 바닥부터 탐색하여 가장 구체적인 필드 우선 선택

#### 데이터 플로우

```
┌─────────────────────────────────────────────────────────────────┐
│                      React App (웹)                              │
│  IndexedDB (accounts)  ──syncAccountsFromReact()──►             │
└─────────────────────────────┬───────────────────────────────────┘
                              │ Capacitor Plugin (JS ↔ Java)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                  KiyoAutofillPlugin.java                         │
│  syncAccountsFromReact(accountsJson) → AutofillRepository       │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                  AutofillRepository                              │
│  - JSON 파싱 (React Account 모델 → AutofillAccount)             │
│  - AES-GCM 암호화 (AutofillCrypto)                              │
│  - SQLite Upsert (username + packageNames/domain 기준)          │
│  - packageNames: JSON 배열로 다중 앱 패키지 지원                │
└─────────────────────────────┬───────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
       ┌────────────┐  ┌────────────┐  ┌────────────┐
       │  Fill      │  │  Save      │  │  Settings  │
       │  Request   │  │  Request   │  │  UI        │
       └─────┬──────┘  └─────┬──────┘  └─────┬──────┘
             │               │               │
             ▼               ▼               ▼
       KiyoAutofillService  │        AutofillSettingsActivity
       (onFillRequest)      │        KiyoBiometricActivity
                            │
                     (onSaveRequest)
```

#### 필드 탐지 알고리즘 (FieldScorer + FieldDetector)

**점수 체계 (우선순위 순):**

| 우선순위 | 조건 | 점수 | 비고 |
|---------|------|------|------|
| 1 | `autofillHints` = username/email/userName/emailAddress | +200 | 최우선 |
| 2 | HTML `autocomplete` = username/email/user/login | +150 | 웹뷰 지원 |
| 3 | HTML `type` = email | +100 | |
| 4 | `inputType` = TYPE_TEXT_VARIATION_EMAIL_ADDRESS | +100 | |
| 5 | HTML `name`/`id`에 username 키워드 | +30 | |
| 6 | `hint`/`resourceId`에 username 키워드 | +30 | |
| 7 | Google accounts.google.com 분할 화면 처리 | +50 | 특수 케이스 |
| 8 | EditText 클래스 + TEXT_CLASS | +10 | 폴백 |

**비밀번호 필드도 유사한 체계 (password/current-password/new-password 중심)**

**제외 대상**: TextView, View, ViewGroup, Layout 계열, WebView(단, autofillHints 있는 경우 허용), 컨테이너 뷰

#### 암호화 스펙 (AutofillCrypto)
- **알고리즘**: AES-GCM (256-bit key, 12-byte IV, 128-bit auth tag)
- **키 파생**: PBKDF2WithHmacSHA256, 100,000 iterations
- **솔트**: 16바이트 랜덤 (암호문당 고유)
- **포맷**: `Base64(salt || iv || ciphertext || authTag)`
- **캐싱**: 세션당 솔트별 파생 키 메모리 캐시 (ConcurrentHashMap)
- **마스터 시크릿**: 하드코딩 상수 (프로덕션에서는 Android Keystore 권장)

#### 데이터베이스 스키마 (v5)
```sql
CREATE TABLE autofill_accounts (
    _id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    password TEXT NOT NULL,           -- 암호화된 비밀번호
    title TEXT,                       -- 사이트 제목
    package_names TEXT,               -- JSON 배열: ["com.app1", "com.app2"]
    app_name TEXT,                    -- 앱 표시명
    domain TEXT,                      -- 웹 도메인
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    favorite INTEGER DEFAULT 0
);

-- 인덱스
CREATE INDEX idx_autofill_package_names ON autofill_accounts(package_names);
CREATE INDEX idx_autofill_domain ON autofill_accounts(domain);
CREATE INDEX idx_autofill_username ON autofill_accounts(username);
CREATE INDEX idx_autofill_app_name ON autofill_accounts(app_name);
```

---

### 4.2 Capacitor 플러그인 브릿지 (`com.kiyo.app.capacitor.KiyoAutofillPlugin`)

#### 제공 메서드 (15개)

| 메서드 | 설명 | 파라미터 | 반환값 |
|--------|------|----------|--------|
| `isAutofillEnabled()` | 자동완성 서비스 활성화 상태 확인 | - | `AutofillStatus` |
| `requestAutofillEnable()` | 자동완성 설정 화면으로 이동 유도 | - | `void` |
| `ping()` | 플러그인 통신 테스트 | - | `PingResponse` |
| `getAutofillServiceInfo()` | 상세 서비스 정보 조회 | - | `AutofillServiceInfo` |
| `syncAccountsFromReact()` | React 계정 동기화 (핵심) | `accountsJson: string` | `SyncAccountsResult` |
| `getAccountCount()` | 저장된 계정 수 조회 | - | `CountResult` |
| `setBiometricEnabled()` | 생체인증 활성화 설정 | `enabled: boolean` | `void` |
| `getBiometricEnabled()` | 생체인증 설정 조회 | - | `{enabled: boolean}` |
|| `saveSession()` | 보안 세션 키 저장 | `key?, isEncrypted: boolean` | `void` ||
| `clearSession()` | 세션 클리어 | - | `void` |
| `hasSession()` | 세션 존재 여부 | - | `{hasSession: boolean}` |

#### 웹 폴백 구현 (`src/plugins/kiyautofill.web.ts`)
- 모든 네이티브 메서드는 웹에서 `console.warn` 후 더미 값 반환
- `saveSession`/`clearSession`/`hasSession`만 인메모리 구현

---

### 4.3 보안 세션 (`com.kiyo.app.security.SecuritySession`)

```kotlin
object SecuritySession {
    @Volatile private var sessionKey: String? = null
    private var sessionIsEncrypted: Boolean? = null
    
    @Synchronized fun save(key: String, isEncrypted: Boolean)
    @Synchronized fun get(): String?
    @Synchronized fun hasSession(): Boolean
    @Synchronized fun isEncrypted(): Boolean
    @Synchronized fun clear()
}
```

- **특징**: 프로세스 수명만 유지, 디스크 미저장, 프로세스 종료 시 자동 클리어
- **용도**: 생체인증 성공 시 세션 키 저장 → AutofillService에서 복호화 키로 사용
- **스레드 안전**: `@Volatile` + `@Synchronized` 조합

---

### 4.4 리소스 및 설정 파일

#### AndroidManifest.xml 주요 구성요소
```xml
<!-- 메인 액티비티 -->
<activity android:name=".MainActivity" ... android:launchMode="singleTask" />

<!-- 자동완성 설정 액티비티 -->
<activity android:name=".autofill.AutofillSettingsActivity" android:exported="true" />

<!-- 생체인증 액티비티 -->
<activity android:name=".autofill.KiyoBiometricActivity" android:exported="false" />

<!-- FileProvider -->
<provider android:name="androidx.core.content.FileProvider" ... />

<!-- 🔑 Autofill Service (핵심) -->
<service
    android:name=".autofill.KiyoAutofillService"
    android:permission="android.permission.BIND_AUTOFILL_SERVICE"
    android:exported="true">
    <intent-filter>
        <action android:name="android.service.autofill.AutofillService" />
    </intent-filter>
    <meta-data
        android:name="android.autofill"
        android:resource="@xml/autofill_service" />
</service>
```

#### res/xml/autofill_service.xml
```xml
<autofill-service
    xmlns:android="http://schemas.android.com/apk/res/android"
    android:description="@string/autofill_service_description"
    android:settingsActivity="com.kiyo.app.autofill.AutofillSettingsActivity" />
```

#### 레이아웃 파일 (res/layout/)
| 파일 | 용도 |
|------|------|
| `activity_main.xml` | 메인 웹뷰 컨테이너 |
| `autofill_dataset_item.xml` | 자동완성 제안 항목 (아이콘 + 사이트명 + 도메인 + 사용자명) |
| `autofill_auth_item.xml` | 잠금 해제 안내 메시지 |
| `autofill_save_item.xml` | 저장 확인 항목 (아이콘 + 사이트명 + 사용자명) |

---

## 5. 빌드 설정 분석

### 5.1 루트 build.gradle
```gradle
buildscript {
    repositories { google(); mavenCentral() }
    dependencies {
        classpath 'com.android.tools.build:gradle:8.13.0'
        classpath 'com.google.gms:google-services:4.4.4'
        classpath 'org.jetbrains.kotlin:kotlin-gradle-plugin:2.1.0'
    }
}
allprojects { repositories { google(); mavenCentral() } }
```

### 5.2 variables.gradle (버전 중앙 관리)
```gradle
ext {
    minSdkVersion = 26          // Autofill Service 최소 요구사항
    compileSdkVersion = 36
    targetSdkVersion = 36
    androidxAppCompatVersion = '1.7.1'
    androidxCoreVersion = '1.17.0'
    // ... 기타 버전
    cordovaAndroidVersion = '14.0.1'
}
```

### 5.3 앱 모듈 build.gradle 주요 의존성
```gradle
dependencies {
    // Capacitor 핵심
    implementation project(':capacitor-android')
    implementation project(':capacitor-cordova-android-plugins')
    
    // AndroidX
    implementation "androidx.appcompat:appcompat:$androidxAppCompatVersion"
    implementation "androidx.core:core-splashscreen:$coreSplashScreenVersion"
    
    // 🔑 Autofill Service
    implementation "androidx.autofill:autofill:1.3.0"
    implementation "androidx.biometric:biometric:1.2.0-alpha04"
    implementation "androidx.localbroadcastmanager:localbroadcastmanager:1.1.0"
    
    // 테스트
    testImplementation "junit:junit:$junitVersion"
    androidTestImplementation "androidx.test.espresso:espresso-core:$androidxEspressoCoreVersion"
}
```

### 5.4 capacitor.settings.gradle (자동 생성)
```gradle
include ':capacitor-android'
project(':capacitor-android').projectDir = new File('../node_modules/@capacitor/android/capacitor')

include ':aparajita-capacitor-biometric-auth'
project(':aparajita-capacitor-biometric-auth').projectDir = new File('../node_modules/@aparajita/capacitor-biometric-auth/android')

include ':aparajita-capacitor-secure-storage'
project(':aparajita-capacitor-secure-storage').projectDir = new File('../node_modules/@aparajita/capacitor-secure-storage/android')

include ':capacitor-filesystem'
project(':capacitor-filesystem').projectDir = new File('../node_modules/@capacitor/filesystem/android')
```

---

## 6. 웹(React) ↔ 네이티브 연동 구조

### 6.1 플러그인 타입 정의 (`src/plugins/kiyautofill.ts`)
```typescript
export interface AutofillStatus {
  enabled: boolean;
  hasService: boolean;
  servicePackageName: string | null;
  isOurService: boolean;
  isEnabled: boolean;
  hasEnabledServices: boolean;
  serviceClassName: string | null;
}

export interface KiyoAutofillPlugin {
  isAutofillEnabled(): Promise<AutofillStatus>;
  requestAutofillEnable(): Promise<void>;
  ping(): Promise<PingResponse>;
  getAutofillServiceInfo(): Promise<AutofillServiceInfo>;
  syncAccountsFromReact(options: { accountsJson: string }): Promise<SyncAccountsResult>;
  getAccountCount(): Promise<CountResult>;
  setBiometricEnabled(options: { enabled: boolean }): Promise<void>;
  getBiometricEnabled(): Promise<{ enabled: boolean }>;
  saveSession(options: { key?: string; isLock: boolean }): Promise<void>;
  clearSession(): Promise<void>;
  hasSession(): Promise<{ hasSession: boolean }>;
}
```

### 6.2 플러그인 등록 (`src/plugins/kiyautofill.ts`)
```typescript
const KiyoAutofill = registerPlugin<KiyoAutofillPlugin>("KiyoAutofill", {
  web: () => import("./kiyautofill.web").then((m) => new m.KiyoAutofillWeb()),
});
```

### 6.3 Capacitor 설정 (`capacitor.config.ts`)
```typescript
const config: CapacitorConfig = {
  appId: "com.kiyo.app",
  appName: "kiyo",
  webDir: "dist",
  plugins: {
    KiyoAutofill: {},
    BiometricAuth: { /* 생체인증 설정 */ },
    SecureStorage: {},
  },
};
```

---

## 7. 주요 데이터 플로우 시나리오

### 7.1 계정 동기화 (React → Native)
```
React (AccountList.tsx) 
  → KiyoAutofill.syncAccountsFromReact(JSON.stringify(accounts))
  → Capacitor Bridge (JS → Java)
  → KiyoAutofillPlugin.syncAccountsFromReact()
  → AutofillRepository.syncAccountsFromReact(accountsJson)
  → JSON 파싱 → React Account → AutofillAccount 변환
  → 암호화 (AutofillCrypto.encryptPassword)
  → SQLite Upsert (username + packageNames/domain 기준)
```

### 7.2 자동완성 요청 (Native → React 데이터 활용)
```
사용자가 앱에서 로그인 필드 포커스
  → Android System → KiyoAutofillService.onFillRequest()
  → ViewNode 트리 순회 (FieldDetector + FieldScorer)
  → username/password 필드 AutofillId 식별
  → 도메인/패키지명 추출 (ViewNodeUtils)
  → AutofillRepository.findMatchingAccounts(domain)
  → 복호화 (AutofillCrypto.decryptPassword) - 세션 키 필요
  → FillResponseBuilder.createFillResponse() → Dataset 생성
  → Android System → 사용자에게 자동완성 UI 표시
```

### 7.3 저장 요청
```
사용자가 로그인 폼 제출
  → Android System → KiyoAutofillService.onSaveRequest()
  → ViewNode에서 username/password 텍스트 추출 (CredentialExtractor)
  → 로그인 폼 판별 (FieldDetector.hasLoginForm)
  → AutofillRepository.upsertAccount() 저장
  → Android System에 저장 완료 알림 (callback.onSuccess())
```

### 7.4 생체인증 플로우
```
AutofillService.onFillRequest() 
  → SecuritySession.get() 확인
  → 세션 없음 → KiyoBiometricActivity 시작 (startActivityForResult)
  → BiometricPrompt 인증 성공
  → SecuritySession.save(sessionKey, isLock=false)
  → AutofillService 재시도 → 복호화 성공 → FillResponse 반환
```

---

## 8. 테스트 구조

```
android/app/src/
├── test/                                    # 단위 테스트 (JUnit + Robolectric)
│   └── com/kiyo/app/
│       └── autofill/
│           ├── AutofillCryptoTest.kt
│           ├── AutofillRepositoryTest.kt
│           ├── FieldDetectorTest.kt
│           ├── FieldScorerTest.kt
│           ├── ViewNodeUtilsTest.kt
│           └── testutils/
│               └── TestViewNodeBuilder.kt
└── androidTest/                             # 계측 테스트
    └── com/kiyo/app/
        └── ExampleInstrumentedTest.kt
```

---

## 9. 요약: 핵심 아키텍처 포인트

| 영역 | 핵심 기술/패턴 | 비고 |
|------|----------------|------|
| **자동완성** | Android AutofillService (API 26+) | 시스템 레벨 통합 |
| **필드 탐지** | 휴리스틱 점수 + 후위 순회 | WebView/네이티브 모두 지원 |
| **데이터 저장** | SQLite + Repository Pattern | React IndexedDB와 별도 동기화 |
| **암호화** | AES-GCM + PBKDF2 (100k) | 세션 키 캐싱으로 성능 최적화 |
| **브릿지** | Capacitor Plugin (Java ↔ TypeScript) | 웹 폴백 구현 포함 |
| **생체인증** | BiometricPrompt + 인메모리 세션 | 프로세스 종료 시 자동 클리어 |
| **멀티 패키지** | package_names JSON 배열 | 하나의 계정으로 여러 앱 지원 |
| **도메인 매칭** | 도메인 + 패키지명 듀얼 매칭 | 웹/앱 통합 자동완성 |

---

## 10. 확장 시 고려사항

1. **마스터 키 관리**: 현재 하드코딩된 `MASTER_SECRET` → Android Keystore 또는 StrongBox 마이그레이션 필요
2. **동기화 충돌**: React ↔ Native 양방향 동기화 시 충돌 해결 전략 필요 (현재는 React → Native 단방향)
3. **백업/복원**: Autofill DB는 별도 백업 대상에서 제외 권장 (React IndexedDB가 마스터)
4. **성능**: FieldScorer 점수 계산 캐싱, ViewNode 트리 순회 최적화 여지 있음
5. **다중 사용자**: 현재 단일 사용자 가정, 멀티 유저 지원 시 세션/DB 분리 필요

---

*문서 생성일: 2025-07-26*
*분석 대상: KIYO Android 프로젝트 (commit: b41140b)*
