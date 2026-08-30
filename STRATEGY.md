# KIYO Strategy

name: "KIYO"
last_updated: "2026-08-30"

---

## Purpose

**사용자가 클라우드·계정·동기화 없이, 자신의 기기에서 비밀번호를 안전하게 저장하게 한다. 첫 번째 타깃은 안드로이드(로컬 암호화 + Keystore). 자동완성은 안전한 볼트 위에 얹는 편의 기능.**

- "오프라인 퍼스트(네트워크 권한 0)"와 "검증 가능한 보안(로컬 암호화 + 하드웨어 키 보호)"는 타협 불가한 핵심 가치
- 자동완성(AutofillService)은 핵심 가치를 전달하는 주요 인터페이스
- 플랫폼별 네이티브 자동완성/키체인 연동(Android AutofillService, iOS Password AutoFill)을 **플러그인 아키텍처로 확장**한다

---

## Positioning

**지도적 베팅:** **"오프라인 퍼스트 + 검증 가능한 보안(로컬 암호화 + 하드웨어 키 보호)"**을 핵심 가치로 하는 비밀번호 관리자. 자동완성(AutofillService)은 **핵심 가치를 전달하는 주요 인터페이스**지만, 자동완성이 깨져도 로컬 볼트 암호화·백업·복원·보안 모델은 그대로 유지된다.

> **현실적 타협:** 안드로이드 자동완성을 위해 Keystore(`kiyo_master_key`)에 DB_KEY를 저장하는 것은 **불가피한 선택**이다. 이상적으로는 자동완성도 사용자 인증 없이 키를 노출하지 않길 원하지만, Android AutofillService 아키텍처상 별도 프로세스에서 DB 접근이 필요해 Keystore 래핑을 받아들였다. **설정 화면에서 "지문으로 파일 열기(볼트 언락)"와 "자동완성"을 명확히 분리해 안내**하며, 사용자가 둘의 보안 모델 차이를 인지하게 한다.

| 기존 대안 | KIYO의 차별점 |
|-----------|--------------|
| Bitwarden/1Password | 클라우드·계정 필수, 동기화 중심, 폐쇄 소스(일부) |
| KeePassDX | 안드로이드 한정, 자동완성 별도 설정·불안정, Keystore 연동 약함, UI 복잡 |
| Google/Apple/Microsoft Password Manager | 클라우드 강제, 데이터 주권 없음, 익스포트 제한, 크로스플랫폼이지만 종속적 |

**베팅의 논리:** 사용자가 "내 비밀번호가 내 기기를 떠나지 않는다"는 확신을 가질 수 있어야 한다. 네트워크 권한 0, PBKDF2 100k + AES-GCM, Android Keystore/Secure Enclave 하드웨어 키 보호 — 이것들이 **최상위 지표**다. 자동완성은 이 안전한 볼트 위에 얹는 **편의 기능**이다. 클라우드·계정 시스템·소셜 로그인 등 부가 기능은 의도적으로 배제한다. 플랫폼 확장은 **안드로이드·iOS·웹(볼트 관리만)**만 고려하며, 자동완성은 네이티브 자동완성 API + 하드웨어 키 보호가 있는 환경에서만 지원한다.

---

## Users

### Primary: 단일 기기 중심 개인 사용자 (첫 타깃: 안드로이드)
- 클라우드 동기화 필요 없음(기기 1대, 또는 수동 백업으로 충분)
- **비밀번호가 내 기기를 떠나지 않는다는 확신이 최우선** — 자동완성은 편의 기능
- **생체인증(지문/얼굴)으로 빠르게 언락**
- 기술적 배경 불문 — "설정 없이 설치 후 바로 씀"이 기준

### Secondary: 검증 가능성 중시하는 개발자/파워유저
- 오픈소스 코드 감사 가능, 네트워크 권한 0 확인 가능
- 직접 빌드·사이드로드·백업 파일 포맷 파악 가능
- 하지만 UX가 나쁘면 안 씀 — Primary와 UX 기준 공유

### Future: 멀티 디바이스 사용자 (플랫폼 확장 시)
- 안드로이드 + iOS/데스크톱 중 2대 이상 쓰는 사용자
- 볼트 파일 수동 이동(내보내기/가져오기)으로 기기 간 동기화 수용 가능
- 각 플랫폼 네이티브 자동완성이 동등하게 작동해야 함

---

## Boundaries

**절대 하지 않을 것 (전략적 선 긋기):**

1. **클라우드 동기화/계정 시스템/서버 인프라 도입 안 함** — 네트워크 권한 추가는 프라이버시 모델 붕괴
2. **플랫폼 확장은 안드로이드·iOS·웹(볼트 관리만)만 고려** — 자동완성은 네이티브 자동완성 API + 하드웨어 키 보호가 있는 환경(Android AutofillService+Keystore, iOS Password AutoFill+Secure Enclave)에서만 지원. 웹은 볼트 관리(조회/편집)용 웹 앱만 제공, 자동완성은 미지원. 그 외 플랫폼(Windows/macOS/브라우저 확장)은 현재 범위 밖.
3. **암호화 알고리즘/키 관리 약화 안 함** — PBKDF2 100k, AES-GCM, 하드웨어 키 보호(Keystore/Secure Enclave/TPM)는 협상 불가
4. **비밀번호 공유/가족 요금제/조직 기능 안 만듦** — 단일 사용자·단일 볼트 모델 유지 (멀티 볼트는 로컬 파일 단위로만)
5. **광고/분석/텔레메트리/크래시 리포팅 수집 안 함** — 완전 오프라인, 데이터 잔존 0
6. **자동완성 품질 저하로 핵심 보안(암호화/키 보호/오프라인 모델) 훼손 안 함** — 자동완성은 편의 기능, 품질 이슈는 허용하되 보안 모델 침범은 금지

---

## Key Metrics

전략이 작동하는지 측정할 지표 — **앱은 완전 오프라인(네트워크 권한 0)이므로 텔레메트리 수집 불가**. 외부에서만 관측 가능한 지표:

1. **Play Store 평점/리뷰 감정** — 자동완성 관련 불만(매칭 안 됨, 크래시, 인증 루프) 비율, "오프라인이라 안심" 긍정 언급
2. **GitHub 이슈/디스커션** — 버그 리포트 중 자동완성·암호화·키 분실·백업 복원 관련 비율, 기능 요청 중 "클라우드 동기화" 요청 빈도(경계 테스트)
3. **설치 수/활성 설치 수(Play Console)** — 업데이트 후 활성 설치 유지율(프록시로 7일 유지율 대체)
4. **크래시 없는 사용자 비율(Play Console vitals)** — 네이티브 크래시(AutofillService 포함) 발생률
5. **릴리스 주기/핫픽스 빈도** — 중대 버그(데이터 손실, 키 분실, 자동완성 완전 동작 안 함) 대응 속도

> 측정 주기: 월 1회 Play Console + GitHub 집계. 목표 숫자 설정은 런칭 후 베이스라인 잡은 뒤.

---

## Tracks

현재/앞으로 투자할 5개 트랙 (우선순위 순 — 1번이 최우선):

### 1. 자동완성 신뢰도 (Autofill Reliability)
- 도메인/패키지 매칭 정확도 향상
- Keystore 인증 캐시(30분)·KPInvalidated 복구·재래핑 무결성
- 인증 프롬프트 UX(바이오메트릭·PIN/패스프레이즈 폴백) 매끄러움
- **플러그인 인터페이스 정의** — 안드로이드 구현을 레퍼런스로 타 플랫폼 확장 시 재사용
- **진척 (2026-08-29):** [`2026-08-24-autofill-reliability.md`](.hermes/plans/2026-08-24-autofill-reliability.md) 메인 plan ~90% 완료
  - ✅ DomainMatcher (와일드카드/서브도메인/prefix package/normalize/findBestMatch) + AccountMapper (packageNames/corrupt-row 가드) — `DomainMatcherTest`/`AccountMapperTest` JVM 검증 완료
  - ✅ FieldScorer + FieldScoringRules (WebView TODO 해결, OTP `one-time-code` 네거티브, `new-password` 등록 폼 시그널, Naver 튜닝 + `MIN_CANDIDATE_SCORE=20`) — `FieldScorerTest`/`FieldScoringRulesTest` JVM 검증 완료
  - ✅ Keystore auth flow 신규 테스트 — `DatabaseKeyManagerTest`(9) + `KeystoreManagerTest`(5) (isSecurityDowngrade, resetAutofillData, needsSecurityUpgrade, KPInvalidated 시뮬레이션)
  - ✅ Plugin Interface — [`2026-08-24-autofill-plugin-interface.md`](.hermes/plans/2026-08-24-autofill-plugin-interface.md) 별도 plan으로 완료 (커밋 `329d800c`): `AutofillSyncManager` 추출 + `AutofillPlatformBridge`/`AndroidAutofillPlatformBridge` + TS 타입, `AutofillSyncManagerTest` 7/7 green
  - ✅ Autofill E2E `downgradeReset` 신규 (lockscreen 제거 → 자동 리셋) — 플랜 5개 E2E 중 1개 신규 추가 (나머지 4개는 baseline 유지)
  - ✅ Matching layer (2026-08-28) — [`2026-08-28-autofill-matching-layer.md`](.hermes/plans/2026-08-28-autofill-matching-layer.md) 별도 plan으로 완료 (인덱스 DB + `DatabaseKeyManager.getIndexKey` 경로 분리)
  - ⏸️ SaveInfo — 의도적 보류, 후속 plan 예정 (E2E 시 system save dialog 회피 목적)
  - ⏸️ E2E 3개 시나리오 (`autofillAfterProcessDeath_authCacheValid`, `autofillMultiplePackageNames`, `autofillWildcardSubdomain`) — JVM 단위 테스트로 검증됨, 후속 plan에서 E2E 추가 예정
- **최근 신호:** alias pointer re-wrap(v3.1), packageNames 지원, E2E 인증 검증, AuthRequestHandler 정리, 자동완성 신뢰도 plan ~90% 완료

### 2. 볼트 파일 안정성 (Vault File Integrity)
- 암호화 볼트 생성/열기/백업/복원/마이그레이션 무결성
- PIN/패스프레이즈 변경 시 데이터 손실 0, salt 재사용 방지
- SAF(Storage Access Framework) 기반 파일 선택·복원 신뢰도
- **파일 자동 저장(autosave) 지원** — 계정/템플릿 변경 시 즉시 암호화 저장, 수동 저장 불필요
- **볼트 암호화 강화: 숫자 PIN(6자리) → 텍스트 패스프레이즈 지원** — PBKDF2 100k 유지, 엔트로피 실시간 측정·표시(zxcvbn 등), 최소 강도 가이드라인 적용
- **크로스플랫폼 볼트 파일 포맷 표준화** — 플랫폼 간 내보내기/가져오기 호환성
- **진척 (2026-08-30):** 6개 요구사항 중 4개 완료, 1개 보류 (Q6 §3.4), 1개 후속 결정 보류
  - ✅ Plan-1 — `changePin` atomicity — [`2026-08-29-changePin-atomicity.md`](.hermes/plans/2026-08-29-changePin-atomicity.md): `replaceDatabaseData`(`db.ts:213-232`)가 단일 Dexie 트랜잭션으로 원자적 처리 확인 → **강화 불필요**, 코드 변경 0, 기존 7개 invariant 테스트로 충분
  - ✅ Plan-4 — PIN 정책 완화 + zxcvbn strength meter — [`2026-08-30-pin-policy-relaxation.md`](docs/plans/2026-08-30-pin-policy-relaxation.md): 4~20자 mixed 허용 + zxcvbn 실시간 강도 표시 + secure context 가드 + FormDialog 에러 통합 (커밋 `ba4928a0`)
  - ✅ Plan-5 — SAF 영구 URI 자동 백업 — [`2026-08-30-saf-persistent-uri-auto-backup.md`](docs/plans/2026-08-30-saf-persistent-uri-auto-backup.md): Settings "자동 백업 위치" 토글 + `ACTION_OPEN_DOCUMENT_TREE` 폴더 선택 + `takePersistableUriPermission` 영구 권한 + `persistVaultSnapshot` 성공 시 동일 스냅샷 URI 미러링 (커밋 `058e6369`)
  - ✅ Plan-6 — autosave 안정화 & 동시성 — [`2026-08-29-autosave-stability-concurrency.md`](.hermes/plans/2026-08-29-autosave-stability-concurrency.md): `src/database/syncQueue.ts` 직렬화 큐 신규 + `accountStore`/`templateStore` → `enqueuePersistVaultSnapshot(getParamsFn)` 연결 + race/lock→unlock/연속 mutation 시나리오 4건 추가 + Android `AutosaveE2ETest` + 호스트 스크립트 `run-autosave-e2e.ps1` (커밋 `179368fc`)
  - ⏸️ Plan-3 — 크로스플랫폼 볼트 파일 포맷 표준화 — **보류** (brainstorm §3.4 Q6): v2 트리거(KDF 변경, 레코드 필드 추가, iOS/Web 확장 결정) 발생 시 별도 brainstorm. 현 v1 hardcoding은 안전
  - ❓ Plan-2 — SAF picker 취소 분기 회귀 테스트 — **보류** (brainstorm §11 Q7): 5줄 삼항 분기의 메시지 문자열 검증 가치가 좁고 native/E2E 회귀는 커버 못함. 재방문 트리거 기반 (brainstorm §11.6)
- **최근 신호:** sync flow 리팩터 + SAF 백업/복원, changePin 파이프라인 순서 수정, fileStorage pipeline 리팩터, autosave 직렬화 큐, PIN 정책 완화, SAF 영구 URI 자동 백업

### 3. UX·접근성·인터랙션 품질 (UX & Accessibility)
- 로딩 상태/스켈레톤 UI — 암호화/복호화·동기화·파일 I/O 중 시각적 피드백
- 더블클릭/중복 제출 방지 — 버튼·폼·리스트 액션에 debounce·disabled 상태 적용
- 키보드 네비게이션/포커스 순서 — 웹·데스크톱 확장 대비, 스크린리더 대응
- 에러 토스트/인라인 에러 — 네이티브/브리지 에러를 사용자 언어로 매핑
- 다크/라이트 테마 전환 시 깜빡임 없음, 시스템 설정 연동
- **후속 후보 — Plan-7a: 파일 생성 모달 → 다단계 페이지 분리** ([brainstorm](docs/brainstorms/2026-08-30-track3-ux-accessibility.md) §7 E, [plan](docs/plans/2026-08-30-plan-7a-create-vault-multistep.md)) — 2단계 (이름 → PIN) 단일 라우트(`/create-vault`) 흐름. Progress bar + 단계 라벨 Stepper. **Plan-7a/7b 분리 결정 (2026-08-30)**: 폴더 선택 + 자동 백업 통합은 **Plan-7b로 분리** (STRATEGY §2 후속, 별도 brainstorm). 모든 새 파일은 암호화 (체크박스 제거, Plan-4 정책 통일)
- **진척 (2026-08-30):**
  - ✅ Multi-Vault Support — 완료, Home 파일 리스트 UI + Dexie v14 + 21 파일/334 테스트
  - 📋 **Plan-7a** — 다단계 페이지 (2단계), [plan](docs/plans/2026-08-30-plan-7a-create-vault-multistep.md) 작성 완료. 구현 대기
  - 📋 Plan-A1: 에러 가시화 (`mapError()` + 호출처 6곳 try/catch + `SyncErrorBanner`). 토스트 없음 (Q1)
  - 📋 Plan-A2: 초기 진입 Skeleton (3개 페이지)
  - 📋 Plan-B: 버튼/폼 일관성 (`Button.loading`, FormDialog throw 유지)
  - 📋 Plan-D: 테마 FOUC 가드 (Playwright 실측 후 작업)
  - 📋 a11y audit: 별도 plan (axe-core CI + 키보드 Playwright)
  - 📋 Plan-7b: 폴더 선택 + 자동 백업 통합 (STRATEGY §2 후속, 별도 brainstorm)
  - 진행 순서: Plan-7a → Plan-A1 → Plan-A2 → Plan-B → Plan-D → a11y audit → Plan-7b
- **최근 신호:** Tailwind CSS 4, Ionic 컴포넌트 기반, AutoLockIndicator 등 상태 표시 컴포넌트 존재, `FileCreateDialog`가 `Home.tsx` (생성) + `DataSection.tsx` (백업) 양쪽에서 사용 — Q4-a "완전 제거"는 호출처 100% 마이그레이션 후 (Plan-7a 1차 PR 잔존, 2차 PR에서 제거)

### 4. 세션·자동잠금 보안 (Session & Auto-lock Security)
- 자동잠금 4단계(none/1m/10m/30m) + 활동 감지 리셋
- 암호화 키 메모리-only 보장, 세션 만료 시 즉시 키 상실
- 바이오메트릭 언락(CryptoObject, 별도 Keystore 키, 등록 변경 시 무효화)
- **플랫폼별 키체인/TPM 연동 인터페이스** — Secure Enclave, Windows Hello, TPM 추상화
- **최근 신호:** auto-lock feature, biometric login with Keystore CryptoObject, useAutoLock 훅

### 5. 프로덕션 릴리스 파이프라인 (Production Release Pipeline)
- Play 내부 테스트 → 프로덕션 트랙 자동화 (안드로이드 첫 출시)
- 릴리스 서명·ProGuard/R8·버저닝·네트워크 권한 0 검증
- CI: typecheck/lint/단위통합/Playwright E2E/안드로이드 E2E(수동) 게이트
- **멀티플랫폼 빌드/릴리스 파이프라인 기반** — 향후 iOS/데스크톱 확장 시 재사용
- **최근 신호:** CI 워크플로, Playwright E2E 39개 구현, 로드맵 Phase 0~4

---

## Stress Test (내부 검증)

| 유혹적 제안 | 저항 근거 (Boundary 연결) |
|-------------|--------------------------|
| "비상용 클라우드 백업 옵션만 추가하자" | Boundary #1, #3 위반 — 네트워크 권한 0이 프라이버시 셀링포인트 |
| "웹뷰로 웹 버전도 만들자 (Capacitor로)" | Boundary #2 예외 허용 — 볼트 관리용 웹 앱은 제공, 자동완성은 미지원 |
| "PIN 대신 더 간편한 패턴/단순 비밀번호 허용하자" | Boundary #3 위반 — PBKDF2 100k는 브루트포스 대비 최소 방어선 |
| "자동완성 매칭률 낮아도 UI로 수동 선택하게 하자" | Boundary #6 위반 — 자동완성은 편의 기능, 품질 낮아도 핵심 보안(암호화/키 보호) 훼손 안 됨 |
| "크래시 리포팅(Sentry 등)만 살짝 넣자" | Boundary #5 위반 — 완전 오프라인이 사용자 신뢰의 기반 |
| "iOS용 Capacitor 앱에 웹뷰 자동완성 넣자" | Boundary #2 위반 — iOS는 Password AutoFill + Secure Enclave 네이티브 연동 검증된 경우에만 플러그인으로 진행, 웹뷰 자동완성 불가 |

**Resist a change when:** 오프라인 순수성·볼트 무결성·키 보안·암호화 강도 중 하나라도 훼손되는 변경이면, 그 기능이 아무리 매력적이라도 거절한다. 자동완성 품질 저하는 허용하되 핵심 보안은 절대 타협 안 함.

---

## Brand (초안)

- **로고**: 파란 교차(X) 심볼(현재 런처 아이콘) — "잠금/차단/보호" 직관적 메타포
- **컬러**: Primary `#863bff`(보라, favicon) + Accent `#0066FF`(파란 X) — 런처와 웹 파비콘 통일 필요
- **톤**: 기술적 자신감 + 평범한 사용자도 이해하는 직관적 언어. "암호화" 대신 "안전하게 잠금", "동기화" 대신 "기기에만 저장"

---

> **Note**: 이 문서는 상위 앵커다. 하위 스킬(`ce-ideate`, `ce-brainstorm`, `ce-plan`, `ce-work`)이 이 문서를 읽고 제안을 가중한다. 변경 시 `/ce-strategy`로 재인터뷰 후 갱신.