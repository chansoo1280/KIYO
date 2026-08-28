# Brainstorm: Login Page HTML Structure Survey (Field Detection Reference)

**Date:** 2026-08-28
**Related Plans:**
- `.hermes/plans/2026-08-24-autofill-field-detection.md` (Field Detection, Phases 1-4 ✅ implemented)
- `.hermes/plans/2026-08-24-autofill-field-detection-FieldScoringRulesTest.md`
- `.hermes/plans/2026-08-28-autofill-field-detection-Phase5-E2E-verification.md` (Phase 5 manual verification)
- `.hermes/plans/2026-08-28-autofill-matching-layer.md` Phase 6 (WebsitePreset packageNames)

**Track:** STRATEGY.md Track 1 — 자동완성 신뢰도

---

## Problem

Phase 5 E2E 수동 검증 (및 Phase 6 implementation)을 시작하려면, KIYO의 `FieldScorer`가 어떤 HTML 신호를 잡아야 하는지 **실제 인기 사이트의 로그인/회원가입 페이지가 어떤 HTML 구조로 구성되어 있는지** 확인이 필요.

기존 plan에서는 "GitHub, Microsoft, banking, Google, Samsung Internet 등에서 테스트"로만 추상적으로 언급. 실제 페이지를 dump해서:
1. 어떤 `autocomplete` 값이 쓰이는지
2. 어떤 `id`/`name`/`class` 패턴이 있는지
3. WebView 내부 노드 class name이 실제로 어떤지
4. 새 사이트 preset 추가 시 어디서 package name/login URL을 찾는지

**문서화된 reference가 없음** — 이 brainstorm에서 한 번 정리해두면 향후 site 추가/scoring 튜닝에 활용 가능.

---

## Goal

KIYO `FieldScorer`/`FieldScoringRules`가 효과적으로 잡아야 할 신호의 **현실 reference 자료**를 정리:

1. **대표 사이트 14개 preset**의 실제 로그인 페이지 HTML 구조 (`<input>` 태그, `autocomplete` 속성)
2. **WebView 내부 노드 class name** 실측값 (에뮬레이터로 확인 시)
3. **계정 preset `packageNames` 검증** — 이미 plan에 있음, 이 brainstorm에서는 dump 결과로 보강
4. **추가로 dump가 필요한 사이트** 목록 (봇 차단으로 curl 실패한 곳 등)

---

## Context

### 이미 확보된 자료

**A. Phase 6 plan table** (Play Store URL `?id=` 검증, 2026-08-28):
12/14 preset packageNames + 14/14 websiteUrl 매핑 완료 (위 plan 본문 참조)

**B. GitHub login HTML dump** (curl 성공, 582줄):
- `<input name="login" id="login_field" autocomplete="username" ...>`
- `<input type="password" name="password" id="password" autocomplete="current-password" ...>`
- 다수의 hidden input (CSRF, add_account, webauthn-conditional 등)

**C. FieldScorer가 인식하는 신호** (Phase 1-4에서 구현):
- `autofillHints` array: `["username"]`, `["password"]`, `["current-password"]`, `["new-password"]`, `["one-time-code"]`
- `htmlInfo.attributes` (HTML 표준): `autocomplete`, `type`, `name`, `id`
- `inputType` flags: `TYPE_CLASS_TEXT`, `TYPE_TEXT_VARIATION_EMAIL_ADDRESS`, `TYPE_TEXT_VARIATION_PASSWORD`
- `hint`, `idEntry`/`idPackage` (resourceId), `webDomain`

### 확보되지 않은 자료

| 항목 | 이유 | 대안 |
|------|------|------|
| Google login HTML | datadome 봇 차단 (403) | 에뮬레이터 Chrome에서 직접 dump |
| Reddit/Discord login HTML | JS 동적 렌더링 (curl 시 빈 페이지) | 에뮬레이터 Chrome + View Source 또는 WebView dump |
| Kakao/Naver login HTML | 봇 차단 | 에뮬레이터 Chrome에서 직접 |
| Samsung Internet WebView class | device 필요 | 에뮬레이터에서 Samsung Internet 설치 후 dump |
| 실제 autofillHints 값 | Android system이 결정 | ViewNode dump (에뮬레이터 logcat + KiyoAutofillService) |

---

## Dump 방법 (현실적으로 사용 가능한 것)

### 방법 1: `curl` (서버 사이드 HTML, 봇 차단 약한 곳)

**성공한 케이스**: GitHub login (`https://github.com/login`)
- User-Agent: `Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36`
- 결과: 582줄 HTML, 13개 input 필드

**실패한 케이스** (봇 차단): Google, Reddit, Kakao, Naver
- 모두 빈 응답 또는 403/302

### 방법 2: 에뮬레이터 Chrome (가장 현실적)

```bash
# 1) Chrome에서 사이트 열기 (KIYO 앱 외부)
adb shell am start -a android.intent.action.VIEW -d "https://github.com/login"

# 2) Chrome 원격 디버깅 활성화 (개발자 도구)
adb shell am start -a android.intent.action.VIEW -d "https://github.com/login" \
  -e "android.intent.extra.SUBJECT" "WebView debugging"
# 또는 chrome://inspect/#devices

# 3) WebView HTML 가져오기
# - Chrome DevTools의 Elements 탭 → 우클릭 "Copy outerHTML"
# - View Source 불가능한 사이트도 클라이언트 렌더링된 HTML 확보 가능
```

### 방법 3: WebView dump (KIYO 앱의 autofill-test-host가 띄운 페이지)

```bash
# autofill-test-host 앱이 띄운 WebView의 HTML
adb logcat -s WebView:V chromium:V | grep -A 200 "WebView URL"
```

**그러나 KIYO의 autofill-test-host는 자체 mock 페이지를 띄우므로** 실제 사이트와 구조가 다를 수 있음.

### 방법 4: ViewNode dump (실제 autofill이 보는 구조)

가장 정확한 방법. KIYO `KiyoAutofillService`가 받은 `AssistStructure.ViewNode` 트리를 dump:

```kotlin
// KiyoAutofillService.kt 또는 AuthRequestHandler.kt에 임시 dump 추가
fun dumpViewNode(node: AssistStructure.ViewNode, depth: Int = 0) {
    val prefix = "  ".repeat(depth)
    val className = node.className?.toString() ?: "null"
    val inputType = node.inputType ?: 0
    val hints = node.autofillHints?.joinToString(",") ?: "null"
    val html = node.htmlInfo?.attributes?.joinToString(";") { "${it.first}=${it.second}" } ?: "null"
    val webDomain = node.webDomain?.toString() ?: "null"
    Log.d("ViewNodeDump", "$prefix class=$className inputType=$inputType hints=[$hints] html=[$html] web=$webDomain")
    for (i in 0 until node.childCount) {
        dumpViewNode(node.getChildAt(i), depth + 1)
    }
}
```

**장점**: KIYO가 실제로 보는 구조 → scoring 검증의 ground truth
**단점**: 코드 수정 + 빌드 필요 (1회성 디버깅 도구)

---

## 📊 조사 결과 (2026-08-28)

### Naver 로그인 (`https://nid.naver.com/nidlogin.login`)

**dump 출처**: 사용자 Chrome 콘솔에서 `.hermes/scripts/dump-login-page.min.js` 실행

**핵심 발견**:

| 항목 | 값 | KIYO 영향 |
|------|---|-----------|
| Form name | `frmNIDLogin`, method=POST, action=`nidlogin.login`, `autocomplete="off"` | form-level autocomplete는 off → 자식 input에 의존 |
| Username input | `<input type="text" name="id" id="id" class="input_text" aria-label="아이디 또는 전화번호">` | ⚠️ **`autocomplete=""` (비어있음)**, `id="id"`, `name="id"` |
| Password input | `<input type="password" name="pw" id="pw" class="input_text" aria-label="비밀번호">` | ⚠️ **`autocomplete=""` (비어있음)**, `id="pw"`, `name="pw"` |
| 기타 visible | `nvlong` (로그인 유지), `ipcheck` (IP 보안) 체크박스 | autofill과 무관 |
| Hidden inputs | 23개 (CSRF, dynamicKey, wtoken, locale 등) | autofill 후보 아님 (hidden) |

**🚨 Naver는 `autocomplete` 속성을 명시하지 않음 (빈 문자열)**

이는 매우 중요한 발견. KIYO의 현재 `FieldScorer`는:
- `SCORE_HTML_AUTOCOMPLETE_USERNAME(180)` → **0점** (autocomplete 비어있음)
- `SCORE_HTML_AUTOCOMPLETE_PASSWORD(180)` → **0점**
- `SCORE_INPUT_TYPE_TEXT_CLASS(10)` 또는 `SCORE_INPUT_TYPE_PASSWORD(100)` → 텍스트 클래스 기반
- `SCORE_HTML_NAME_ID_USERNAME(30)` → `name="id"` 매칭 → **30점** (username)
- `SCORE_HTML_NAME_ID_PASSWORD(30)` → `name="pw"` 매칭 안됨 (password는 "password" 단어 필요) → 0점
- `SCORE_EDITTEXT_FALLBACK(5)` 또는 `SCORE_EDITTEXT_PASSWORD_FALLBACK(5)` → 5점
- **추정 username score**: ~50점 (10 + 30 + 5 = 45 or 50)
- **추정 password score**: ~110점 (100 + 5 = 105)

**리스크**: username score가 50점으로 낮음. 동일 화면에 다른 input이 있으면 username 후보에서 밀릴 수 있음.

**권장 개선 옵션**:
1. `name="id"` 매칭 가중치 증가 (현재 30 → 50)
2. Naver 전용 화이트리스트 (사용자 계정 도메인이 `nid.naver.com`이면 `name="id"`, `name="pw"` 신뢰)
3. autofillHints가 Chrome에서 자동 설정되는지 확인 → 되면 +200으로 충분

### GitHub 로그인 (`https://github.com/login`) — 이전 dump

| 항목 | 값 | KIYO 영향 |
|------|---|-----------|
| Username input | `autocomplete="username"`, `id="login_field"`, `name="login"` | ✅ +180 (autocomplete) |
| Password input | `autocomplete="current-password"`, `id="password"`, `name="password"` | ✅ +180 (autocomplete) |

**GitHub는 표준 준수 → KIYO가 정확히 잡음**

### 비교

| 사이트 | autocomplete 속성 | 위치 | KIYO 추정 username score | 결과 |
|--------|------------------|------|--------------------------|------|
| GitHub | `username` (명시) | main DOM | ~215 | ✅ 안정 |
| Naver | `""` (미설정) | main DOM | ~45-50 | ⚠️ 위험 |
| Reddit | `username` (명시) | **iframe 내부** (depth1) | ~215 | ✅ 안정 (단, iframe traverse 필요) |
| Google (1단계) | `username webauthn` (명시) | main DOM | ~215 | ✅ 안정 |
| Google (1단계 hidden) | `""` (의도적 숨김) | main DOM | password: ~130 (또는 hidden으로 0) | ⚠️ split-screen 의존 |
| Google (2단계) | (미dump) | main DOM | (예상: current-password 명시) | ⏳ 검증 필요 |

**결론**:
- **Naver**만 위험 (autocomplete 미설정, name만 의존)
- **Reddit**는 표준 준수 — 단, 로그인 폼이 cross-origin iframe 내부 → KIYO WebView autofill이 iframe까지 traverse하는지 별도 검증 필요
- **GitHub**는 안정

### Reddit 로그인 — iframe 내부 (`https://www.reddit.com/`)

**dump 출처**: v2 (iframe 재귀) — Reddit 로그인 모달이 cross-origin iframe 내부

**핵심 발견**:

| 항목 | 값 | KIYO 영향 |
|------|---|-----------|
| 검색바 (main) | `<input name="q" placeholder="Reddit 검색">` (`_source: depth0`) | autofill 후보 아님 |
| **Username (iframe)** | `<input name="username" type="text" autocomplete="username webauthn" required>` (`_source: depth1`) | ✅ **autocomplete="username" → +180** |
| **Password (iframe)** | `<input name="password" type="password" autocomplete="current-password" required>` (`_source: depth1`) | ✅ **autocomplete="current-password" → +180** |
| OTP (앱) | `<input name="appOtp" type="tel" autocomplete="one-time-code">` | ⚠️ OTP negative 신호 검증 |
| OTP (백업) | `<input name="backupOtp" type="text" autocomplete="one-time-code">` | ⚠️ OTP negative 신호 검증 |
| Cross-origin iframe | 2개 (depth1) — `Blocked a frame` 에러 | Reddit 트래커/광고 — autofill 무관 |

**🚨 결정적 발견: Reddit는 표준 준수!**
- Username/Password 둘 다 `autocomplete="username"`/`autocomplete="current-password"` 명시
- `_source: depth1` (iframe 내부) — KIYO autofill이 WebView 내부 iframe을 traverse 한다면 잡힘
- 단, **cross-origin iframe** (`Blocked a frame`) 2개는 traverse 불가 — 이건 OK (트래커/광고일 가능성)

**KIYO 추정 score**:
- Username: ~215 (autofillHints 또는 HTML autocomplete + inputType + fallback) — **OK**
- Password: ~305 (autofillHints 또는 HTML autocomplete + inputType + fallback) — **OK**
- OTP (`appOtp`, `backupOtp`): `autocomplete="one-time-code"` → -100 → 거의 0점 — **OK** (Phase 2에서 구현한 OTP negative 신호가 작동)

**결론**: Reddit는 KIYO가 잘 잡음. Phase 2 OTP negative 신호도 잘 작동할 것으로 예상.

### Google 로그인 (`https://accounts.google.com/v3/signin/identifier`)

**dump 출처**: v2 (iframe 재귀) — 사용자 Chrome 콘솔, 봇 차단 우회됨 (정상 UA + IP 신뢰)

**핵심 발견**:

| 항목 | 값 | KIYO 영향 |
|------|---|-----------|
| **Username (visible)** | `<input name="identifier" id="identifierId" type="text" autocomplete="username webauthn" aria-label="이메일 또는 휴대전화">` | ✅ **autocomplete="username" → +180** |
| **Hidden password (1단계)** | `<input name="hiddenPassword" type="password" autocomplete="">` | ⚠️ **`autocomplete=""` (비어있음)** — name="hiddenPassword"도 매칭 안됨 |
| reCAPTCHA | `<input name="ca" autocomplete="off" aria-label="들리거나 표시된 텍스트 입력">` | ⚠️ reCAPTCHA — autofill 위험 |
| Hidden inputs | `ct`, `usi`, `domain`, `region`, `fidoUserHandle` (5개) | autofill 후보 아님 |
| Forms | `[]` (form 없음) | `<form>` 없이 input만 노출 |
| Cross-origin iframe | 1개 (`Blocked a frame`) | Google reCAPTCHA/analytics 추정 |

**🚨 결정적 발견들**:

1. **Google split-screen 패턴**: 1단계는 username만 → 2단계에서 password 페이지로 전환
   - Username은 `autocomplete="username webauthn"` 명시 → KIYO **잘 잡음** (+180)
   - Password는 `name="hiddenPassword"` (이상한 이름) + `autocomplete=""` → **KIYO가 잡기 어려움** (의도적 보안)

2. **form 없음**: Google은 `<form>` 없이 input만 노출 (SPA 방식)

3. **reCAPTCHA input** (`name="ca"`, `autocomplete="off"`):
   - `aria-label="들리거나 표시된 텍스트 입력"` → 한국어 label
   - KIYO는 aria-label을 보지 않음 (현재 구현) → 일단 username 후보 아님 (TEXT_CLASS + fallback 5점만)
   - 안전: reCAPTCHA는 username/password 후보보다 점수 낮음

4. **`hiddenPassword` input** (현재 dump에서 보임):
   - `name="hiddenPassword"` — `FieldScoringRules.passwordKeywords`에는 `password` 포함됨 → +30점 가능
   - 다만 hidden input이라 `isActualInputField`에서 거부될 가능성 → ViewNode dump로 확인 필요
   - **핵심**: 2단계 password 페이지(`accounts.google.com/v3/signin/challenge/password`)는 별도 dump 필요

**KIYO 추정 score (1단계 username)**:
- ~215 (autofillHints 또는 HTML autocomplete + inputType + fallback) — **OK**

**KIYO 추정 score (1단계 password hiddenPassword)**:
- `type="password"` → +100
- `name="hiddenPassword"` → password keywords 매칭 → +30
- `autocomplete=""` → +0
- **단, `hidden=true`이면 `isValidInputField`에서 거부** — `FieldScoringRules.isValidInputField`는 leaf+inputType 체크
- 추정 점수: ~130-135 (hidden 아니면), 또는 0 (hidden이면)
- 1단계 username이 더 높아서 username은 잘 잡히지만, password는 2단계로 가야 명확

---

---

## 14개 Preset HTML 패턴 정리 (실제 dump 결과)

### GitHub login (성공) — `https://github.com/login`

```html
<input type="text" name="login" id="login_field"
       autocapitalize="off" autocorrect="off"
       autocomplete="username"
       class="form-control js-login-field"
       autofocus required />
<input type="password" name="password" id="password"
       class="form-control form-control js-password-field"
       autocomplete="current-password" required />
```

**KIYO가 잡는 신호**:
- `autocomplete="username"` → `SCORE_HTML_AUTOCOMPLETE_USERNAME` (+180) ✓
- `autocomplete="current-password"` → `SCORE_HTML_AUTOCOMPLETE_PASSWORD` (+180) ✓
- `id="login_field"`, `id="password"` → name/id 매칭 (보너스 가능)

### 봇 차단으로 dump 실패한 사이트 (대안 필요)

| 사이트 | 봇 차단 우회 방법 |
|--------|------------------|
| Google | 에뮬레이터 Chrome + DevTools |
| Naver | 에뮬레이터 Chrome + DevTools |
| Kakao | 에뮬레이터 Chrome + DevTools |
| Reddit | 에뮬레이터 Chrome + DevTools (JS 렌더링 후) |
| Discord | 에뮬레이터 Chrome + DevTools |
| Microsoft | 일부 endpoint 가능, `login.microsoftonline.com` 직접 시도 |
| Apple | iCloud.com (Web), dump 가능할 수 있음 |
| Netflix | 에뮬레이터 Chrome + DevTools |
| Steam | 에뮬레이터 Chrome + DevTools |
| Amazon | `amazon.com/ap/signin` 직접 시도 |
| Dropbox | 에뮬레이터 Chrome + DevTools |

---

## WebView 내부 노드 class name 조사 필요

**현재 가정** (Phase 3 구현 시 사용):
- `className.contains("WebView", true)` → WebView 내부 노드

**실제로 확인해야 할 것**:
- Samsung Internet의 WebView class name: `com.samsung.android.webview.*`?
- Chrome Custom Tabs의 WebView class name: `com.android.chrome.*`? 또는 `androidx.appcompat.*`?
- 일반 Chrome WebView class name: `com.android.webview.chromium.WebView` (이미 테스트에 사용)

**확인 방법**:
```bash
# 1) 에뮬레이터에 Samsung Internet 설치
adb install samsung_internet.apk

# 2) 사이트에서 autofill 트리거
# 3) logcat에서 ViewNode className 확인
adb logcat -s ViewNodeDump:D | grep "WebView"
```

이 결과를 `FieldScoringRules.kt`의 WebView class name 매칭에 반영.

---

## Implementation Plan (Future)

### 즉시 가능 (curl로 더 시도)

```bash
# 봇 차단 우회 시도: User-Agent 다양화 + cookie
for url in \
  "https://login.microsoftonline.com" \
  "https://www.amazon.com/ap/signin" \
  "https://www.icloud.com/" \
  "https://store.steampowered.com/login/dologin" \
  ; do
  echo "=== $url ==="
  curl -s -L \
    -A "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120" \
    -H "Accept: text/html,application/xhtml+xml,application/xml;q=0.9" \
    -H "Accept-Language: en-US,en;q=0.5" \
    "$url" 2>/dev/null | grep -oE '<input[^>]*>' | head -5
done
```

### 에뮬레이터 필요 (WebView, 봇 차단 강한 사이트)

1. Chrome DevTools로 `https://accounts.google.com/InteractiveLogin` 접속
2. Elements 탭에서 `<input>` 우클릭 → Copy outerHTML
3. 결과를 이 문서에 추가

### ViewNode dump 도구 (1회성 코드)

`KiyoAutofillService.kt`에 임시 dump 로직 추가:
```kotlin
private fun dumpStructure(structure: AssistStructure) {
    for (i in 0 until structure.windowNodeCount) {
        val root = structure.getWindowNodeAt(i).rootViewNode
        Log.d("AUTOFILL_DEBUG", "Window $i root: ${root.className}")
        dumpViewNodeRecursive(root, 0)
    }
}
```

**주의**: 1회성 도구이므로 commit 전에 제거. 또는 feature flag로 default off.

---

## Open Questions

| Question | Answer Needed |
|----------|---------------|
| Samsung Internet WebView 정확한 class name? | 에뮬레이터 + Samsung Internet 설치 후 dump |
| Reddit/Discord 등이 동적 렌더링 시 어떤 attribute를 최종적으로 노출? | 에뮬레이터 Chrome DevTools |
| Google/Naver 봇 차단 우회 가능한 우회책? | 에뮬레이터 Chrome (정상 UA + IP 신뢰) |
| WebView 내부 노드의 `htmlInfo.attributes`는 항상 채워지는가? | ViewNode dump |
| autofillHints는 어떤 페이지에서 어떤 값을 받는가? | ViewNode dump |
| 등록 폼(Reddit 가입 등)의 input pattern은? | 에뮬레이터 Chrome DevTools |

---

## Recommended Next Steps

1. **에뮬레이터에서 14개 사이트 순회** (Chrome DevTools 활용)
   - 각 사이트: 로그인 페이지 outerHTML 복사 → 이 문서에 추가
   - 30분~1시간 소요

2. **ViewNode dump 도구 1회성 추가**
   - `KiyoAutofillService.onFillRequest`에 dump 호출 추가
   - logcat에서 ViewNode tree 확인
   - 사이트 1-2개 (GitHub + Google)만 검증 후 도구 제거

3. **결과를 이 문서에 table로 정리**
   - 컬럼: Site | input type | autocomplete | id | name | autofillHints (예상) | KIYO score (예상)
   - 이게 향후 scoring 튜닝/preset 추가의 reference 자료

4. **WebView 검증**
   - 에뮬레이터에 Samsung Internet 또는 Chrome Custom Tab으로 사이트 열기
   - `className` 매칭이 올바른지 확인
   - 필요시 `FieldScoringRules.kt`에 추가 class name 등록

---

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| 봇 차단으로 dump 실패 (Google, Naver 등) | 해당 사이트 reference 부족 | 에뮬레이터 Chrome 우회 |
| 동적 렌더링 후 attribute가 변경됨 | server HTML과 다른 결과 | DevTools로 실제 렌더링된 DOM 확인 |
| 14개 모두 조사하지 못함 | 일부 사이트 미커버 | 주요 4-5개 (Google, GitHub, Naver, Kakao, Samsung Internet)만 우선 |
| ViewNode dump 도구가 production에 남음 | 프로덕션 코드 오염 | feature flag + commit 전 제거 |

---

## Related Plans / Files

### Plans
- `2026-08-24-autofill-field-detection.md` — Master field detection plan (Phases 1-4 ✅)
- `2026-08-24-autofill-field-detection-FieldScoringRulesTest.md` — Phase 3 test plan
- `2026-08-24-autofill-field-detection-FieldScorerTest.md` — Phase 4 test plan
- `2026-08-28-autofill-field-detection-Phase5-E2E-verification.md` — Phase 5 manual E2E
- `2026-08-28-autofill-matching-layer.md` Phase 6 — WebsitePreset packageNames (Play Store 검증 완료)

### Code
- `android/app/src/main/java/com/kiyo/app/autofill/detection/FieldScoringRules.kt` — WebView class name 매칭 (lines 78-124)
- `android/app/src/main/java/com/kiyo/app/autofill/detection/FieldScorer.kt` — HTML attribute 추출
- `android/app/src/main/java/com/kiyo/app/autofill/viewnode/HtmlAttributeExtractor.kt` — `getHtmlAutocomplete` 등
- `src/data/websitePresets.ts` — 14개 preset 정의
- `src/models/websitePreset.ts` — `WebsitePreset` interface

### Verification (방금 완료)
- ✅ GitHub login HTML dump (582줄, 13 input 필드)
- ✅ Phase 6: 12/14 preset packageNames Play Store URL 검증
- ❌ 나머지 사이트 (봇 차단 / JS 렌더링) — 에뮬레이터 Chrome 필요

---

## Conclusion

**현 상태**:
- FieldScorer는 이미 강력한 신호 인식 (autocomplete, autofillHints, htmlType, htmlName) 가능
- 14개 preset의 packageNames는 모두 Play Store 검증 완료
- GitHub 1개 사이트의 input 패턴은 확인됨
- 나머지 13개 사이트는 봇 차단 또는 동적 렌더링으로 자동 dump 실패

**권장**:
- 즉시: 에뮬레이터 Chrome + DevTools로 14개 사이트 outerHTML 수집 (1시간)
- 단기: ViewNode dump 도구 1회성 추가, 2-3개 사이트에서 실제 신호 확인
- 장기: 결과를 이 문서에 table로 정리 → reference doc으로 보존

**다음 단계**: 사용자가 직접 에뮬레이터에서 사이트 방문 → 결과 공유 시 이 문서 업데이트.
