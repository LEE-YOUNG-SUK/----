# Copilot Instructions for drevers-erp-next

## 프로젝트 개요
- **Next.js 기반 ERP**: 이 프로젝트는 Next.js(App Router)로 구축된 ERP 시스템입니다. 주요 도메인은 사용자, 지점, 거래처, 품목, 입고, 판매, 재고입니다.
- **역할 기반 권한 시스템**: `types/permissions.ts`와 `lib/permissions.ts`에 정의된 4단계 역할(시스템 관리자, 원장, 매니저, 사용자)별 권한 매핑이 핵심입니다. 메뉴, 데이터 접근, 액션은 권한에 따라 제어됩니다.

## 주요 구조 및 패턴
- **폴더 구조**
  - `app/`: 각 도메인별 페이지(예: `/purchases`, `/sales`, `/inventory`)와 API 라우트(`app/api/`)가 위치합니다.
  - `components/`: 도메인별 UI 컴포넌트(예: `components/purchases/`, `components/sales/`)와 공통 UI(`components/shared/`, `components/ui/`).
  - `lib/`: 권한, Supabase 클라이언트 등 비즈니스 로직 유틸리티.
  - `hooks/`: 커스텀 훅(예: `usePermissions`).
  - `types/`: 타입 정의(도메인별, 권한 등).

- **권한 체크**
  - 서버/클라이언트 모두 `PermissionChecker`(`lib/permissions.ts`)와 `usePermissions` 훅(`hooks/usePermissions.ts`)을 사용해 권한을 판별합니다.
  - 메뉴, 버튼, 데이터 노출 등은 `can`, `canAny`, `canAll`, `isSystemAdmin` 등으로 제어합니다.
  - 예시: `components/shared/Navigation.tsx`에서 메뉴 노출을 권한별로 분기.

- **세션/인증**
  - Supabase와 커스텀 세션 토큰(`erp_session_token`)을 사용합니다. 세션 검증은 `app/*/page.tsx`의 `getSession()` 참고.

## 개발 워크플로우
- **개발 서버 실행**: `npm run dev` (포트 3000)
- **코드 스타일**: ESLint(`eslint.config.mjs`), Tailwind CSS(`postcss.config.mjs`, `globals.css`)
- **타입스크립트**: 전역 타입은 `types/`에 정의, 도메인별로 분리 관리
- **컴포넌트 네이밍**: 도메인/기능별 폴더 및 PascalCase 컴포넌트 사용
- **상태/데이터 흐름**: 대부분 서버 컴포넌트에서 데이터 fetch, props로 하위 컴포넌트에 전달

## 통합/외부 연동
- **Supabase**: 인증, DB 연동(`lib/supabase/`)
- **권한/역할**: `types/permissions.ts`의 ROLE_PERMISSIONS, ROLE_LABELS, ROLE_ICONS 활용

## 참고 파일
- `lib/permissions.ts`, `hooks/usePermissions.ts`, `types/permissions.ts`: 권한 시스템 전반
- `components/shared/Navigation.tsx`: 권한별 메뉴 노출 예시
- `app/*/page.tsx`: 세션/권한 체크, 데이터 fetch 패턴
- `README.md`: 기본 실행법

## 기타
- **새 기능 추가 시**: 도메인별 폴더에 타입, 컴포넌트, 페이지, 액션을 분리해 추가
- **권한/역할 추가 시**: `types/permissions.ts`와 관련 로직을 반드시 동기화

---
이 문서는 AI 에이전트가 drevers-erp-next 코드베이스에서 일관된 패턴과 워크플로우를 빠르게 파악하고, 기존 구조에 맞는 코드를 작성할 수 있도록 안내합니다.
