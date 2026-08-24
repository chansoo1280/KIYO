# KIYO 버저닝 명명 규칙

> 작성: 2026-08-24 · 상태: confirmed

---

## 시맨틱 버저닝 (SemVer 2.0) 준수

```
MAJOR.MINOR.PATCH[-PRERELEASE][+BUILD]
```

| 구분 | 규칙 | 예시 |
|------|------|------|
| **MAJOR** | 호환 안 되는 API 변경, 보안 모델 변경 | `1.0.0` → `2.0.0` |
| **MINOR** | 하위 호환 기능 추가 (자동완성 새 플랫폼, 새 템플릿 타입) | `1.0.0` → `1.1.0` |
| **PATCH** | 버그 픽스, 보안 패치, 마이그레이션 픽스 | `1.0.0` → `1.0.1` |
| **PRERELEASE** | `-alpha.N`, `-beta.N`, `-rc.N`, `-dev.N` | `1.1.0-alpha.1`, `1.0.1-dev.3` |
| **BUILD** | `+git.<commit-hash>`, `+build.<timestamp>` | `1.0.0+git.a1b2c3d` |

---

## 배포 채널별 버전 접미사

| 채널 | 접미사 | 용도 |
|------|--------|------|
| **개발 브랜치 (v2/develop)** | `-dev.N` | 일일 빌드, PR 검증용 |
| **릴리스 후보 (release/*)** | `-rc.N` | QA, 내부 테스트 |
| **베타 테스트 (Play 베타)** | `-beta.N` | 외부 테스터 |
| **프로덕션 (main)** | 없음 | 정식 출시 |

---

## 안드로이드 versionCode 계산 공식

```
versionCode = (MAJOR * 10000) + (MINOR * 100) + PATCH
```

| versionName | versionCode |
|-------------|-------------|
| `1.0.0` | `10000` |
| `1.1.0` | `10100` |
| `1.0.1` | `10001` |
| `2.0.0` | `20000` |

> 사유: Play Console 단조 증가 요구 충족, 시맨틱 버전과 1:1 매핑, 99개 패치/마이너까지 수용

---

## 현재 버전

| 구성요소 | 값 |
|----------|-----|
| **package.json** | `0.1.0-dev.1` |
| **android/app/build.gradle** | `versionCode 1`, `versionName "0.1.0-dev.1"` |

> 현재는 개발 초기(`0.y.z-dev.N`) 단계. 첫 정식 출시는 `1.0.0` 목표.

---

## 버전 관리 운영 규칙

1. **단일 소스 원칙**: `package.json`의 `version`을 기준으로 삼고, 안드로이드 `versionName`은 수동 동기화 (또는 향후 스크립트화 시 `version.json` 도입)
2. **versionCode는 수동 증가**: 시맨틱 버전 범프 시 공식에 맞춰 함께 증가
3. **태그 형식**: `v{versionName}` (예: `v0.1.0-dev.1`, `v1.0.0`)
4. **CHANGELOG**: 각 버전 범프 시 `CHANGELOG.md`에 기록 (수동)

---

## 향후 자동화 시 고려사항 (현재 범위 밖)

- `version.json` 단일 소스 파일 도입
- `npm run version:bump:<type>` 스크립트
- GitHub Actions 워크플로로 범프 → 동기화 → 태그 → 푸시 자동화
- CI에서 웹/안드로이드 버전 일치 검증

---

## 롤백 기준

- 잘못된 버전 태그: `git tag -d vX.Y.Z && git push origin :refs/tags/vX.Y.Z`
- 버전 범프 커밋: `git revert <commit>`