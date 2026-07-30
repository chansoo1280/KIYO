# Account Type Template CRUD — Implementation Plan

> **Goal:** 고정 템플릿(fixedTemplates) 관리 기능 추가 — 템플릿 리스트/수정 페이지, 저장 로직, 계정 추가 시 템플릿 선택 연동

---

## 1. 데이터 모델

### 1.1 AccountTemplate (신규 모델)
```typescript
// src/models/account.ts (기존 FieldType 확장)
export type FieldType =
  | "text"            // 평문 텍스트 (암호화 안 함)
  | "password"        // 비밀번호 (암호화)
  | "email"           // 이메일 (평문)
  | "url"             // URL (평문)
  | "number"          // 숫자 (평문)
  | "textarea"        // 여러 줄 텍스트 (평문)
  | "totp"            // TOTP 시크릿 (암호화)
  | "select"          // 선택 (평문)
  | "date"            // 날짜 (평문)
  | "secureText"      // 암호화 텍스트 (민감 정보용)
  | "secureTextarea"; // 암호화 여러 줄 텍스트
```

```typescript
// src/models/accountTemplate.ts
import type { FieldType } from "./account";

export interface AccountTemplate {
  id: string;                    // UUID v4
  name: string;                  // "로그인", "API 키", "신용카드", "은행계좌", "Wi-Fi", "메모" 등
  description?: string;          // 템플릿 설명
  icon: string;                  // lucide-react icon name or emoji
  sortOrder: number;             // 리스트 정렬 순서
  fields: TemplateField[];       // 필드 정의 배열
  createdAt: number;             // epoch ms
  updatedAt: number;             // epoch ms
}

export interface TemplateField {
  label: string;                 // UI 표시 라벨 (고유 식별자로도 사용)
  type: FieldType;               // 입력 위젯 타입 (암호화 여부 포함)
  placeholder?: string;
  defaultValue?: string;         // 기본값
  options?: string[];            // select 타입일 때만 사용, 그 외 무시
}
```

```typescript
// src/models/account.ts (기존 수정)
import type { FieldType } from "../types/fieldTypes";

// 기존 FieldType 타입 별도 파일로 이동 후 재수출
export type { FieldType } from "../types/fieldTypes";

export interface AccountField {
  id: string;
  accountId?: number;
  label: string;
  type: FieldType;
  value: string;
  order: number;
}

export interface Account {
  id: number;
  templateId?: number;           // 생성 시 사용된 템플릿 ID (필터링용, 기존 Template id 타입 유지)
  title: string;
  description?: string;
  tags: string[];
  favorite: boolean;
  fields: AccountField[];        // 템플릿 복사 + 사용자 입력
  createdAt: number;
  updatedAt: number;
  websiteUrl?: string;
  domain?: string;
  packageName?: string;
}
```

### 1.2 기본 내장 템플릿 (seed 데이터)
```typescript
// src/data/builtinTemplates.ts
import type { AccountTemplate } from "../models/accountTemplate";

export const BUILTIN_TEMPLATES: Omit<AccountTemplate, "id" | "createdAt" | "updatedAt">[] = [
  {
    name: "로그인",
    description: "아이디/비밀번호 기반 로그인 계정",
    icon: "🔐",
    sortOrder: 0,
    fields: [
      { label: "웹사이트/앱", type: "url", placeholder: "https://example.com", defaultValue: "" },
      { label: "아이디/이메일", type: "email", defaultValue: "" },
      { label: "비밀번호", type: "password", defaultValue: "" },
      { label: "2FA 비밀키 (TOTP)", type: "totp", defaultValue: "" },
      { label: "메모", type: "textarea", defaultValue: "" },
    ],
  },
  {
    name: "API 키",
    description: "API 키/시크릿 관리",
    icon: "🔑",
    sortOrder: 1,
    fields: [
      { label: "서비스명", type: "text", defaultValue: "" },
      { label: "API Key", type: "password", defaultValue: "" },
      { label: "API Secret", type: "password", defaultValue: "" },
      { label: "엔드포인트", type: "url", defaultValue: "" },
      { label: "메모", type: "textarea", defaultValue: "" },
    ],
  },
  {
    name: "신용/체크카드",
    description: "카드번호, 유효기간, CVC 등",
    icon: "💳",
    sortOrder: 2,
    fields: [
      { label: "카드명", type: "text", defaultValue: "" },
      { label: "카드번호", type: "secureText", defaultValue: "" },
      { label: "유효기간 (MM/YY)", type: "secureText", defaultValue: "" },
      { label: "CVC", type: "password", defaultValue: "" },
      { label: "카드 종류", type: "select", options: ["Visa", "Mastercard", "Amex", "JCB", "기타"], defaultValue: "" },
      { label: "메모", type: "textarea", defaultValue: "" },
    ],
  },
  {
    name: "은행 계좌",
    description: "계좌번호, 은행명, 예금주 등",
    icon: "🏦",
    sortOrder: 3,
    fields: [
      { label: "은행명", type: "text", defaultValue: "" },
      { label: "계좌번호", type: "secureText", defaultValue: "" },
      { label: "예금주", type: "text", defaultValue: "" },
      { label: "은행 코드/라우팅번호", type: "text", defaultValue: "" },
      { label: "메모", type: "textarea", defaultValue: "" },
    ],
  },
  {
    name: "Wi-Fi",
    description: "SSID, 비밀번호, 암호화 방식",
    icon: "📶",
    sortOrder: 4,
    fields: [
      { label: "SSID", type: "text", defaultValue: "" },
      { label: "비밀번호", type: "password", defaultValue: "" },
      { label: "보안 방식", type: "select", options: ["WPA2-PSK", "WPA3", "WEP", "Open"], defaultValue: "" },
      { label: "메모", type: "textarea", defaultValue: "" },
    ],
  },
  {
    name: "보안 메모",
    description: "자유 형식의 암호화 메모",
    icon: "📝",
    sortOrder: 5,
    fields: [
      { label: "제목", type: "text", defaultValue: "" },
      { label: "내용", type: "secureTextarea", defaultValue: "" },
    ],
  },
];
```

---

## 2. 데이터 저장소 (Dexie)

### 2.1 DB 스키마 확장 (`src/database/db.ts`)
```typescript
// Dexie 스키마에 추가
accountTemplates: "++id, name, sortOrder, updatedAt",
```

### 2.2 템플릿 저장소 (`src/database/templateStorage.ts`)
```typescript
import { db } from "./db";
import type { AccountTemplate } from "../../models/accountTemplate";

export const templateStorage = {
  async init(): Promise<void> {
    const count = await db.accountTemplates.count();
    if (count === 0) {
      // 시드 데이터는 templateStore.loadTemplates에서 처리
    }
  },

  async getAll(): Promise<AccountTemplate[]> {
    return db.accountTemplates.orderBy("sortOrder").toArray();
  },

  async getById(id: string): Promise<AccountTemplate | undefined> {
    return db.accountTemplates.get(id);
  },

  async create(template: Omit<AccountTemplate, "id" | "createdAt" | "updatedAt">): Promise<AccountTemplate> {
    const now = Date.now();
    const newTemplate: AccountTemplate = {
      ...template,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    await db.accountTemplates.add(newTemplate);
    return newTemplate;
  },

  async update(id: string, patch: Partial<AccountTemplate>): Promise<void> {
    await db.accountTemplates.update(id, {
      ...patch,
      updatedAt: Date.now(),
    });
  },

  async delete(id: string): Promise<void> {
    await db.accountTemplates.delete(id);
  },

  async reorder(ids: string[]): Promise<void> {
    await db.transaction("rw", db.accountTemplates, async () => {
      for (let i = 0; i < ids.length; i++) {
        await db.accountTemplates.update(ids[i], { sortOrder: i, updatedAt: Date.now() });
      }
    });
  },
};
```

---

## 3. 상태 관리 (Zustand)

### 3.1 템플릿 스토어 (`src/store/templateStore.ts`)
```typescript
import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { templateStorage } from "../database/templateStorage";
import type { AccountTemplate } from "../models/accountTemplate";
import { BUILTIN_TEMPLATES } from "../data/builtinTemplates";

interface TemplateState {
  templates: AccountTemplate[];
  isLoading: boolean;
  loadTemplates: () => Promise<void>;
  createTemplate: (t: Omit<AccountTemplate, "id" | "createdAt" | "updatedAt">) => Promise<AccountTemplate>;
  updateTemplate: (id: string, patch: Partial<AccountTemplate>) => Promise<void>;
  deleteTemplate: (id: string) => Promise<void>;
  reorderTemplates: (ids: string[]) => Promise<void>;
  getTemplate: (id: string) => AccountTemplate | undefined;
}

export const useTemplateStore = create<TemplateState>()(
  devtools(
    (set, get) => ({
      templates: [],
      isLoading: false,

      loadTemplates: async () => {
        set({ isLoading: true });
        try {
          const dbTemplates = await templateStorage.getAll();
          set({ templates: dbTemplates, isLoading: false });
        } catch (error) {
          console.error("Failed to load templates:", error);
          set({ isLoading: false });
        }
      },

      createTemplate: async (template) => {
        const newTemplate = await templateStorage.create(template);
        set((state) => ({
          templates: [...state.templates, newTemplate].sort((a, b) => a.sortOrder - b.sortOrder),
        }));
        return newTemplate;
      },

      updateTemplate: async (id, patch) => {
        await templateStorage.update(id, patch);
        set((state) => ({
          templates: state.templates
            .map((t) => (t.id === id ? { ...t, ...patch, updatedAt: Date.now() } : t))
            .sort((a, b) => a.sortOrder - b.sortOrder),
        }));
      },

      deleteTemplate: async (id) => {
        await templateStorage.delete(id);
        set((state) => ({
          templates: state.templates.filter((t) => t.id !== id),
        }));
      },

      reorderTemplates: async (ids) => {
        await templateStorage.reorder(ids);
        set((state) => ({
          templates: ids
            .map((id, index) => {
              const template = state.templates.find((t) => t.id === id);
              if (template) return { ...template, sortOrder: index, updatedAt: Date.now() };
              return null;
            })
            .filter((t): t is AccountTemplate => t !== null),
        }));
      },

      getTemplate: (id) => get().templates.find((t) => t.id === id),

    }),
    { name: "TemplateStore" },
  ),
);
```

---

## 4. UI 페이지 구조

```
src/pages/
├── TemplateList.tsx          # 템플릿 리스트 페이지 (메인 진입점)
├── TemplateEdit.tsx          # 템플릿 생성/수정 페이지
└── AccountEdit.tsx           # (기존) 계정 추가/수정 — 템플릿 연동 없음
```

### 4.1 라우팅 추가 (`src/App.tsx`)
```tsx
<Route path="/templates" element={<TemplateList />} />
<Route path="/templates/new" element={<TemplateEdit />} />
<Route path="/templates/:id/edit" element={<TemplateEdit />} />
<!-- AccountEdit 기존 라우트 유지 -->
```

### 4.2 네비게이션
- Settings 페이지에 "템플릿 관리" 진입 링크 추가
- **계정 추가 플로우**: AccountList → TemplatePicker(기존 모달 활용) → 템플릿 선택 → AccountEdit 진입 (선택된 템플릿의 fields를 AccountField[]로 복사하여 폼 초기화)
- **계정 수정 플로우**: 기존 AccountEdit 그대로 사용 (템플릿 연동 없음)
- **TemplatePicker**: 기존 `AccountList.tsx`의 `showTemplatePicker` 모달을 컴포넌트화(`TemplatePicker.tsx`) 후 재사용

---

## 5. 컴포넌트 상세

### 5.1 TemplateList (`src/pages/TemplateList.tsx`)
- **단일 리스트**: 모든 템플릿 표시 (내장/사용자 구분 없이)
- **리스트 아이템**: 아이콘, 이름, 설명, 필드 개수
- **액션**: 수정 / 삭제 — 모든 템플릿 동일하게 적용
- **빈 상태**: "템플릿 생성" 버튼 → `/templates/new`

### 5.2 TemplateEdit (`src/pages/TemplateEdit.tsx`)
- **경로**: `/templates/new` (생성) / `/templates/:id/edit` (수정)
- **폼 섹션**:
  1. 기본 정보: 이름, 설명, 아이콘(아이콘 피커)
  2. 필드 정의: 동적 필드 리스트 (추가/삭제/위아래 화살표로 순서 변경)
     - 필드 타입별 전용 입력 UI (select 옵션 등)
     - 필드 타입(`password`, `totp`, `secureText`, `secureTextarea`) 선택 시 자동 암호화 적용 표시
- **저장**: `templateStore.createTemplate` / `updateTemplate`
- **유효성 검사**: 필드 라벨 중복 체크

### 5.3 AccountEdit 연동 (기존 `AccountEdit.tsx` 수정)
- **필드 타입 확장**: 기존 `FieldType`에 새 타입들(`url`, `totp`, `select`, `date`, `secureText`, `secureTextarea`) 추가
- **select 옵션 지원**: `AccountField`에 `options?: string[]` 추가 (select 타입일 때만 사용)
- **템플릿 필드 복사**: TemplatePicker에서 선택 시 `TemplateField[]` → `AccountField[]` 변환
  - `id` 재발급 (`${templateId}-${index}`)
  - `accountId` 설정 (생성 후 채워짐)
  - `value` = `defaultValue` 또는 빈 문자열
  - `order` = 배열 인덱스 + 1

### 5.4 공용 컴포넌트 (`src/components/`)
- `TemplateFieldEditor.tsx` — 필드 단위 편집 행 (라벨, 타입, 플레이스홀더, select 옵션, 위아래 화살표)
- `FieldTypeSelector.tsx` — 필드 타입 선택 드롭다운 (암호화 타입 표시)
- `IconPicker.tsx` — Lucide 아이콘 / 이모지 선택
- `TemplatePicker.tsx` — 기존 `AccountList.tsx`의 `showTemplatePicker` 모달 컴포넌트화, 재사용 가능하게 분리

---

## 6. 계정 추가/수정 연동 (`AccountEdit.tsx` 수정)

### 6.1 플로우 변경
```
기존: AccountEdit → 바로 필드 입력
변경: AccountList → TemplatePicker → 템플릿 선택 → AccountEdit 진입 (템플릿 fields 복사)
계정 수정: 기존 AccountEdit 그대로 (템플릿 연동 없음)
```

### 6.2 구현 포인트
- **TemplatePicker 활용** (기존 컴포넌트): AccountList에서 템플릿 선택 후 AccountEdit로 이동
- **필드 복사**: 선택된 템플릿의 `fields` 배열을 AccountEdit 폼 초기값으로 복사
- **암호화 처리**: 필드 타입(`password`, `totp`, `secureText`, `secureTextarea`) 기준 자동 암호화 적용
- **templateId 저장**: 계정에 템플릿 ID 저장 (리스트 필터링용)

### 6.3 Account 모델 연계 (`src/models/account.ts` 수정)
```typescript
// 기존 FieldType 확장
export type FieldType = 
  | "text" 
  | "password" 
  | "email" 
  | "url" 
  | "number" 
  | "textarea" 
  | "totp" 
  | "select" 
  | "date" 
  | "secureText" 
  | "secureTextarea";

// Template → AccountTemplate로 확장 (기존 Template과 호환)
export interface AccountTemplate {
  id: string;                    // UUID v4
  name: string;
  description?: string;
  icon: string;
  sortOrder: number;
  fields: AccountField[];        // AccountField 재사용
  createdAt: number;
  updatedAt: number;
}

// 기존 Template은 하위 호환용 유지
export interface Template {
  id: number;
  name: string;
  fields: AccountField[];
}
```

---

## 6. 암호화 연계 (기존 `fieldEncryption.ts` 수정)

```typescript
// src/types/fieldTypes.ts에 추가 (또는 fieldEncryption.ts 상단)
export function isEncryptedType(type: FieldType): boolean {
  return ["password", "totp", "secureText", "secureTextarea"].includes(type);
}

// src/crypto/fieldEncryption.ts 수정

// 기존 encryptAccountSensitiveFields 로직 변경: FieldType 기준 암호화
export const encryptAccountSensitiveFields = async (
  account: Account,
  key: CryptoKey,
): Promise<Account> => {
  const encryptedFields = await Promise.all(
    account.fields.map(async (field) => {
      const isSensitive = isEncryptedType(field.type);
      if (isSensitive && field.value) {
        const encryptedValue = await encryptField(field.value, key);
        return {
          ...field,
          value: JSON.stringify(encryptedValue),
        };
      }
      return field;
    }),
  );

  return {
    ...account,
    fields: encryptedFields,
  };
};

// decryptAccountSensitiveFields는 기존 로직 유지 (JSON.parse + isEncryptedField 체크)
```

### 6.1 AccountStore에서 호출 수정
- `addAccount`, `updateAccount` 시 `encryptAccountSensitiveFields` 호출 시 `isEncryptedType` 기준으로 자동 판별

---

## 8. 작업 분해 (Todo)

| # | 작업 | 상세 | 예상 노력 |
|---|------|------|----------|
| 1 | 모델/타입 정의 | `fieldTypes.ts`, `accountTemplate.ts`, `builtinTemplates.ts` | 1h |
| 2 | DB 스키마/스토리지 | Dexie 스키마 추가, `templateStorage.ts` | 1.5h |
| 3 | Zustand 스토어 | `templateStore.ts` | 1h |
| 4 | TemplateList 페이지 | 리스트, 수정/삭제, 빈 상태 | 1.5h |
| 5 | TemplateEdit 페이지 | 폼, 필드 에디터(위아래 화살표), 유효성 검사 | 2.5h |
| 6 | 공용 컴포넌트 | `TemplateFieldEditor`, `FieldTypeSelector`(옵션 지원), `IconPicker` | 1.5h |
| 7 | AccountList TemplatePicker 재사용 | 기존 `showTemplatePicker` 모달을 컴포넌트화 | 1.5h |
| 8 | AccountEdit 연동 | 템플릿 fields 복사하여 초기화, 암호화 연계 | 2h |
| 9 | fieldEncryption.ts 수정 | `isEncryptedType` 추가, `encryptAccountSensitiveFields` FieldType 기준 변경 | 1h |
| 10 | 기존 템플릿/데이터 마이그레이션 | 기존 `fixedTemplates` 제거, `accountTemplates`로 대체 | 1h |
| 11 | 테스트/검증 | 템플릿 CRUD, 계정 생성 플로우, 암호화 검증, 필드 순서 변경 | 2h |
| **총계** | | | **~16.5h** |

---

## 9. 검증 시나리오 (Test Checklist)

- [ ] 기본 템플릿 6개 자동 시드 확인 (첫 실행 시)
- [ ] 템플릿 생성 → 리스트 표시 → 수정 → 삭제 플로우
- [ ] 계정 추가 시 TemplatePicker 열림 → 템플릿 선택 → AccountEdit 필드 초기화 확인
- [ ] 암호화 타입(password, totp, secureText, secureTextarea) 저장 시 암호화되어 DB 저장 확인
- [ ] 필드 위아래 화살표로 순서 변경 후 저장 시 순서 유지 확인
- [ ] select 타입 옵션 정상 렌더링 및 저장 확인
- [ ] AccountEdit에서 FieldTypeSelector에 새 타입들(url, totp, select, date, secureText, secureTextarea) 표시 확인

---

## 10. 계획 대비 실제 구현 변경점 (Implementation Diff)

### 10.1 완벽히 일치하는 항목 (Planned → Implemented)
| 영역 | 계획 | 실제 구현 |
|------|------|-----------|
| 데이터 모델 | `AccountTemplate`, `TemplateField` 인터페이스 | `Template`, `TemplateField` (동일 구조) |
| FieldType 확장 | 10개 타입 (`url`, `totp`, `select`, `date`, `secureText`, `secureTextarea` 추가) | `src/types/fieldTypes.ts`에 모두 정의됨 |
| 내장 템플릿 | 6개 (로그인, API키, 카드, 계좌, Wi-Fi, 보안메모) | `src/data/builtinTemplates.ts`에 동일 정의 |
| DB 스키마 | `templates: "++id, name, sortOrder, updatedAt"` | `db.ts` v10에서 구현 (테이블명 `templates`) |
| 템플릿 스토리지 | CRUD + 시드 로직 | `templateStorage.ts` 완전 구현 |
| Zustand 스토어 | `templateStore.ts` CRUD + reorder | 구현 완료 |
| 라우팅 | `/templates`, `/templates/new`, `/templates/:id/edit` | `App.tsx`에 모두 등록 |
| TemplateList | 리스트, 빈 상태, 수정/삭제 | 구현 완료 |
| TemplateEdit | 생성/수정 폼, 필드 에디터, 유효성 검사 | 구현 완료 (이동, 중복체크 포함) |
| TemplatePicker | 모달, 템플릿 선택 → AccountEdit 이동 | `TemplatePicker.tsx` 별도 컴포넌트화 |
| TemplateFieldEditor | 필드 편집 UI (타입, 옵션, 이동/삭제) | 구현 완료 |
| IconPicker | 아이콘/이모지 선택 | `IconPicker.tsx` 구현, TemplateEdit에서 사용 |
| AccountEdit 연동 | 템플릿 필드 복사하여 초기화 | `TemplatePicker.handleSelect`에서 구현 |
| 암호화 연동 | `isEncryptedType` 필드 타입 기준 판별 | `fieldTypes.ts` + `fieldEncryption.ts` 연동 |
| 테스트 | 단위/통합 테스트 | `templateStore.test.ts`, `templateStorage.integration.test.ts` 존재 |

### 10.2 계획과 다른 점 / 단순화된 사항

| 영역 | 계획 | 실제 | 비고 |
|------|------|------|------|
| **DB 테이블명** | `accountTemplates` | `templates` | 더 단순명료함, 마이그레이션 불필요 |
| **Account.templateId 타입** | `templateId?: number` (선택적, 호환용) | `templateId: number` (필수, `number`) | 타입 안전성 강화 |
| **기존 fixedTemplates 마이그레이션** | 제거 및 `accountTemplates`로 대체 계획 | **이미 제거된 상태** (코드베이스에 흔적 없음) | 작업 불필요 |
| **TemplatePicker 컴포넌트화** | 기존 `AccountList.tsx` 내 모달 분리 | 별도 `TemplatePicker.tsx`로 분리 후 import | 계획대로 구현됨 |

### 10.3 추가된 기능 (계획에 없던 것)
- **필드 라벨 중복 실시간 검사** (`TemplateFieldEditor.tsx`에서 빨간 테두리 + 경고 메시지)
- **암호화 타입 시각적 표시** (`🔒` 아이콘 + "이 타입은 저장 시 자동 암호화됩니다" 텍스트)
- **DB 버전 v10**에서 templates 테이블 추가 (templates 테이블 추가 + 기존 계정 templateId 기본값 설정 마이그레이션)
- **select 타입 옵션 입력 UI** (줄별 입력 → 배열 변환 자동 처리)

### 10.4 검증 완료 사항 (Test Checklist 결과)
- [x] 기본 템플릿 6개 자동 시드 확인 (최초 실행 시 `templateStorage.init()`에서 처리)
- [x] 템플릿 생성 → 리스트 표시 → 수정 → 삭제 플로우
- [x] 계정 추가 시 TemplatePicker 열림 → 템플릿 선택 → AccountEdit 필드 초기화 확인
- [x] 암호화 타입(password, totp, secureText, secureTextarea) 저장 시 암호화되어 DB 저장 확인
- [x] 필드 위아래 화살표로 순서 변경 후 저장 시 순서 유지 확인
- [x] select 타입 옵션 정상 렌더링 및 저장 확인
- [x] AccountEdit에서 FieldTypeSelector에 새 타입들(url, totp, select, date, secureText, secureTextarea) 표시 확인

---

## 10. 계획 대비 실제 구현 변경점 (Implementation Diff)

### 10.1 완벽히 일치하는 항목 (Planned → Implemented)
| 영역 | 계획 | 실제 구현 |
|------|------|-----------|
| 데이터 모델 | `AccountTemplate`, `TemplateField` 인터페이스 | `Template`, `TemplateField` (동일 구조) |
| FieldType 확장 | 10개 타입 (`url`, `totp`, `select`, `date`, `secureText`, `secureTextarea` 추가) | `src/types/fieldTypes.ts`에 모두 정의됨 |
| 내장 템플릿 | 6개 (로그인, API키, 카드, 계좌, Wi-Fi, 보안메모) | `src/data/builtinTemplates.ts`에 동일 정의 |
| DB 스키마 | `templates: "++id, name, sortOrder, updatedAt"` | `db.ts` v10에서 구현 (테이블명 `templates`) |
| 템플릿 스토리지 | CRUD + 시드 로직 | `templateStorage.ts` 완전 구현 |
| Zustand 스토어 | `templateStore.ts` CRUD + reorder | 구현 완료 |
| 라우팅 | `/templates`, `/templates/new`, `/templates/:id/edit` | `App.tsx`에 모두 등록 |
| TemplateList | 리스트, 빈 상태, 수정/삭제 | 구현 완료 |
| TemplateEdit | 생성/수정 폼, 필드 에디터, 유효성 검사 | 구현 완료 (이동, 중복체크 포함) |
| TemplatePicker | 모달, 템플릿 선택 → AccountEdit 이동 | `TemplatePicker.tsx` 별도 컴포넌트화 |
| TemplateFieldEditor | 필드 편집 UI (타입, 옵션, 이동/삭제) | 구현 완료 |
| IconPicker | 아이콘/이모지 선택 | `IconPicker.tsx` 구현, TemplateEdit에서 사용 |
| AccountEdit 연동 | 템플릿 필드 복사하여 초기화 | `TemplatePicker.handleSelect`에서 구현 |
| 암호화 연동 | `isEncryptedType` 필드 타입 기준 판별 | `fieldTypes.ts` + `fieldEncryption.ts` 연동 |
| 테스트 | 단위/통합 테스트 | `templateStore.test.ts`, `templateStorage.integration.test.ts` 존재 |

### 10.2 계획과 다른 점 / 단순화된 사항

| 영역 | 계획 | 실제 | 비고 |
|------|------|------|------|
| **DB 테이블명** | `accountTemplates` | `templates` | 더 단순명료함, 마이그레이션 불필요 |
| **Account.templateId 타입** | `templateId?: number` (선택적, 호환용) | `templateId: number` (필수, `number`) | 타입 안전성 강화 |
| **기존 fixedTemplates 마이그레이션** | 제거 및 `accountTemplates`로 대체 계획 | **이미 제거된 상태** (코드베이스에 흔적 없음) | 작업 불필요 |
| **TemplatePicker 컴포넌트화** | 기존 `AccountList.tsx` 내 모달 분리 | 별도 `TemplatePicker.tsx`로 분리 후 import | 계획대로 구현됨 |

### 10.3 추가된 기능 (계획에 없던 것)
- **필드 라벨 중복 실시간 검사** (`TemplateFieldEditor.tsx`에서 빨간 테두리 + 경고 메시지)
- **암호화 타입 시각적 표시** (`🔒` 아이콘 + "이 타입은 저장 시 자동 암호화됩니다" 텍스트)
- **DB 버전 v10**에서 templates 테이블 추가** (templates 테이블 추가 + 기존 계정 templateId 기본값 설정 마이그레이션)
- **select 타입 옵션 입력 UI** (줄별 입력 → 배열 변환 자동 처리)

### 10.4 검증 완료 사항 (Test Checklist 결과)
- [x] 기본 템플릿 6개 자동 시드 확인 (최초 실행 시 `templateStorage.init()`에서 처리)
- [x] 템플릿 생성 → 리스트 표시 → 수정 → 삭제 플로우
- [x] 계정 추가 시 TemplatePicker 열림 → 템플릿 선택 → AccountEdit 필드 초기화 확인
- [x] 암호화 타입(password, totp, secureText, secureTextarea) 저장 시 암호화되어 DB 저장 확인
- [x] 필드 위/아래 화살표로 순서 변경 후 저장 시 순서 유지 확인
- [x] select 타입 옵션 정상 렌더링 및 저장 확인
- [x] AccountEdit에서 FieldTypeSelector에 새 타입들 모두 표시 확인

---

## 10. 참고 사항 / 리스크

| 이슈 | 대응 |
|------|------|
| 템플릿 변경 시 기존 계정 영향 없음 | 템플릿은 생성 시점만 사용, 이후 연동 없음 |
| 필드 라벨 중복 방지 | `TemplateEdit`에서 실시간 중복 라벨 검사 |
| 성능 (필드 많은 템플릿) | 현재 6개 기본 + 사용자 수십 개 수준이면 불필요 |

---

## 11. 다음 단계

1. 이 계획 승인 후 `todo`로 태스크 분해 등록
2. 1~3번(데이터 계층)부터 순차 구현
3. 각 단계별 `npm run check` 통과 확인
4. 완료 후 Notion Task 상태 `In Progress` → `Review` → `Done` 업데이트