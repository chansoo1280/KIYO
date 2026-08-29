# Plan — SAF Picker Cancellation Regression Test (Plan-2)

- Date: 2026-08-29
- Worktree: `feat/vault-integrity` (base `origin/dev`)
- Brainstorm ref: `docs/brainstorms/2026-08-29-vault-file-integrity.md`
- Scope: `exportBackupFile` → `KiyoFile.saveFile` 사용자 picker 취소 분기 회귀 테스트 1건 추가
- Status: Ready for implementation

---

## 1. Goal

`exportBackupFile` 내부에서 `KiyoFile.saveFile` 호출 시 사용자가 SAF picker를 취소(`cancelled: true`)하는 경우, **"User cancelled backup"** 메시지와 함께 `FileStorageErrorCode.WRITE_FAILED` 에러가 정확히 던져지는지 검증하는 회귀 테스트 1건 추가.

**완료 기준:**
- [ ] `fileStorage.error.integration.test.ts`에 `exportBackupFile` 취소 분기 테스트 추가
- [ ] `KiyoFile.saveFile` mock으로 `cancelled: true` 반환 시 정확히 `"User cancelled backup"` 메시지 확인
- [ ] `npm run test` 전체 통과 (기존 76개 테스트 회귀 없음)

---

## 2. Current State

### 2.1 대상 코드 (`src/database/fileExport.ts:18-75`)

```typescript
export const exportBackupFile = async (
  fileName: string,
  data: EncryptedKiyoVaultData | KiyoVaultData
): Promise<{ success: boolean; uri?: string }> => {
  // ... validation ...

  if (!isNativeFileStorageAvailable()) {
    // Web fallback: download blob
    return { success: true, uri: `blob:${normalizedFileName}` };
  }

  try {
    const result = await KiyoFile.saveFile({
      fileName: normalizedFileName,
      mimeType: "application/json",
      data: JSON.stringify(data, null, 2),
    });

    if (!result.success) {
      throw FileStorageError.create(
        FileStorageErrorCode.WRITE_FAILED,
        result.cancelled ? "User cancelled backup" : "Failed to save backup file",
        { operation: "exportBackupFile", fileName: normalizedFileName },
      );
    }

    return { success: true, uri: result.uri };
  } catch (error) {
    if (error instanceof FileStorageError) throw error;
    // ... wrap error ...
  }
};
```

**핵심 분기:** `result.cancelled === true` → `"User cancelled backup"` 메시지로 `WRITE_FAILED` 에러

### 2.2 현재 테스트 현황 (`fileStorage.error.integration.test.ts`)

| 테스트 영역 | 테스트 수 | 비고 |
|------------|-----------|------|
| `openImportedDataFile` JSON 파싱 | 1 | ✅ |
| `openImportedDataFile` PIN 불일치 | 1 | ✅ |
| `openImportedDataFile` 파일 형식 | 1 | ✅ |
| `exportDataFile` (Capacitor Filesystem) 실패 | 1 | ✅ |
| `openImportedDataFile` salt 길이 불일치 | 1 | ✅ |
| `openImportedDataFile` salt 누락/null | 2 | ✅ |
| **`exportBackupFile` (SAF) 취소/실패** | **0** | ❌ **이 계획의 대상** |

**기존 `exportDataFile` 테스트(line 41-46)**는 Capacitor `Filesystem.writeFile` mock을 사용 — **SAF 경로(`KiyoFile.saveFile`)와 무관**

---

## 3. Relevant Files

| 파일 | 역할 | 변경 필요성 |
|------|------|-------------|
| `src/database/fileExport.ts` | `exportBackupFile`, `KiyoFile.saveFile` 호출 | 분석용 (변경 없음) |
| `src/database/fileStorage.error.integration.test.ts` | 에러 처리 테스트 | **테스트 1건 추가** |
| `src/plugins/kiyofile.ts` | `KiyoFile` 플러그인 인터페이스 (`SaveFileResult`) | 분석용 |
| `src/errors/FileStorageError.ts` | `FileStorageErrorCode.WRITE_FAILED` | 분석용 |
| `src/plugins/kiyofile.web.ts` | Web fallback 구현 | 분석용 |

---

## 4. Architecture / Data Flow

```
exportBackupFile(fileName, data)
    │
    ├─▶ validate fileName
    │
    ├─▶ isNativeFileStorageAvailable() → false (Web)
    │       └─▶ blob download → return success
    │
    ├─▶ isNativeFileStorageAvailable() → true (Android)
    │       └─▶ KiyoFile.saveFile({ fileName, mimeType, data })
    │               │
    │               ├─▶ success: true, cancelled: false → return { success, uri }
    │               │
    │               ├─▶ success: false, cancelled: true  → throw "User cancelled backup"
    │               │
    │               └─▶ success: false, cancelled: false → throw "Failed to save backup file"
    │
    └─▶ catch FileStorageError → rethrow
        catch other → wrap as WRITE_FAILED
```

**테스트 대상:** `KiyoFile.saveFile` → `{ success: false, cancelled: true }` 반환 시 → `FileStorageError` with `code: WRITE_FAILED`, `message: "User cancelled backup"`

---

## 5. Proposed Changes

### 5.1 테스트 추가 (`src/database/fileStorage.error.integration.test.ts`)

```typescript
// 파일 상단에 import 추가
import { KiyoFile } from "@/plugins/kiyofile";

// exportBackupFile import (기존 fileStorage에서)
import { exportBackupFile } from "@/database/fileStorage";

// describe 블록 추가 (기존 describe("exportDataFile") 다음 또는 별도)
describe("exportBackupFile - SAF picker cancellation", () => {
  const validFile = createValidKiyoFile();
  const fileName = "test-backup.json";

  beforeEach(() => {
    vi.clearAllMocks();
    // Web 환경이 아닌 것으로 설정 (SAF 경로 테스트용)
    vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(true);
  });

  it("사용자가 SAF picker에서 취소 → 'User cancelled backup' 에러", async () => {
    // Arrange: KiyoFile.saveFile mock → cancelled: true
    vi.mocked(KiyoFile.saveFile).mockResolvedValueOnce({
      success: false,
      cancelled: true,
      uri: "",
    });

    // Act & Assert
    await expect(exportBackupFile(fileName, validFile)).rejects.toMatchObject({
      code: FileStorageErrorCode.WRITE_FAILED,
      message: "User cancelled backup",
    });

    // 호출 검증
    expect(KiyoFile.saveFile).toHaveBeenCalledWith(
      expect.objectContaining({
        fileName: expect.stringContaining(".json"),
        mimeType: "application/json",
      })
    );
  });

  it("SAF picker 실패 (cancelled: false) → 'Failed to save backup file' 에러", async () => {
    vi.mocked(KiyoFile.saveFile).mockResolvedValueOnce({
      success: false,
      cancelled: false,
      uri: "",
    });

    await expect(exportBackupFile(fileName, validFile)).rejects.toMatchObject({
      code: FileStorageErrorCode.WRITE_FAILED,
      message: "Failed to save backup file",
    });
  });
});
```

**Mock 설정 포인트:**
- `Capacitor.isNativePlatform` → `true` (SAF 경로 강제)
- `KiyoFile.saveFile` → `vi.mocked(KiyoFile.saveFile).mockResolvedValueOnce(...)`

### 5.2 Mock 설정 확인

`src/plugins/kiyofile.ts`의 `SaveFileResult` 인터페이스:
```typescript
export interface SaveFileResult {
  success: boolean;
  uri: string;
  cancelled: boolean;
}
```

---

## 6. Tests

| 테스트 유형 | 대상 | 비고 |
|-------------|------|------|
| **Integration (신규)** | `exportBackupFile` SAF picker 취소 | **핵심** — 1건 |
| **Integration (신규)** | `exportBackupFile` SAF picker 실패 (cancelled: false) | 추가 검증 — 1건 |
| **Integration (기존)** | 기존 7개 테스트 | 회귀 방지 |
| **Manual** | `npm run test` 전체 통과 | 필수 |

---

## 7. Risks

| 위험 | 완화 |
|------|------|
| **Mock 타입 불일치** | `SaveFileResult` 인터페이스 정확히 따름 (`kiyofile.ts` 참조) |
| **Capacitor mock 누락** | `vi.spyOn(Capacitor, "isNativePlatform")`로 명시적 제어 |
| **기존 테스트 충돌** | `vi.clearAllMocks()` + `afterEach` 리셋으로 격리 |
| **Web fallback 경로 테스트 안 함** | 본 테스트는 Android/SAF 경로만 — Web은 별도 영역 |

---

## 8. Rollback

- 테스트 파일만 수정 → `git checkout src/database/fileStorage.error.integration.test.ts`로 즉시 복구
- 프로덕션 코드 변경 없음

---

## 9. Implementation Order

1. **파일 열기** (1분): `src/database/fileStorage.error.integration.test.ts`
2. **Import 추가** (2분): `KiyoFile`, `exportBackupFile`, `Capacitor`
3. **Describe 블록 작성** (10분): 2개 테스트 케이스
3. **실행 검증** (5분): `npm run test` → 새 테스트 2개 통과, 기존 7개 통과
4. **커밋** (1분): 단일 커밋으로 테스트 추가

---

## 10. Open Questions (해결됨)

- **Mock 방식**: `vi.mocked(KiyoFile.saveFile)` 사용 — 기존 테스트 패턴과 일치
- **Capacitor mock**: `vi.spyOn(Capacitor, "isNativePlatform")` — 기존 `exportDataFile` 테스트와 동일 패턴
- **에러 메시지 정확성**: `"User cancelled backup"` / `"Failed to save backup file"` — 소스 코드와 정확히 일치

---

## 11. Output

- Plan 문서: `.hermes/plans/2026-08-29-saf-picker-cancellation-test.md`
- 테스트 추가: `src/database/fileStorage.error.integration.test.ts` (2개 테스트)
- 코드 변경: **없음** (테스트만)
- 검증: `npm run test` 통과

---

## 12. Status Tracking

| 항목 | 상태 | 비고 |
|------|------|------|
| 테스트 코드 작성 | ⏳ 대기 | 구현 시작 시 ✅ |
| `npm run test` 통과 | ⏳ 대기 | 구현 후 검증 |
| 기존 테스트 회귀 없음 | ⏳ 대기 | 구현 후 검증 |