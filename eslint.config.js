import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'android/**', '.history/**']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
  // Plan-X: E2E Selector Hardening — User-Centric Selectors 가드
  // STRATEGY §5: "금지 셀렉터 (구조 의존)" 자동 차단
  {
    files: ['e2e/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          // tag + 3+ 클래스 (e.g., "button.rounded-full.px-3.py-1.5") 차단
          selector: "Literal[value=/^\\s?[a-z][a-z0-9]*(?:\\.[a-z][a-z0-9-]*){3,}\\s?$/]",
          message:
            'E2E 셀렉터는 tag + 3+ 클래스 의존 금지 (User-Centric Selectors). data-testid 또는 getByRole/getByLabel 사용. STRATEGY §5 참조.',
        },
        {
          // xpath + 클래스 (e.g., "xpath=ancestor::div[contains(@class, ...)]") 차단
          selector: "Literal[value=/xpath=[^]]*\\[contains\\(@class/]",
          message:
            'xpath + 클래스 패턴 금지. data-testid 또는 label 기반 셀렉터 사용. STRATEGY §5 참조.',
        },
      ],
    },
  },
])
