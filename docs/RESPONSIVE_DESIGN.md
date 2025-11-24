# 반응형 디자인 가이드

## 개요
drevers-erp-next 프로젝트의 모든 페이지는 **통일된 레이아웃 시스템**과 **Tailwind CSS 반응형 유틸리티**를 사용하여 모바일, 태블릿, 데스크톱 환경을 지원합니다.

## 브레이크포인트 (Tailwind 기본)

| 접두사 | 최소 너비 | 디바이스 |
|--------|-----------|----------|
| (기본) | 0px | 모바일 (~640px) |
| `sm:` | 640px | 큰 모바일 / 작은 태블릿 |
| `md:` | 768px | 태블릿 |
| `lg:` | 1024px | 데스크톱 |
| `xl:` | 1280px | 큰 데스크톱 |
| `2xl:` | 1536px | 초대형 화면 |

## 핵심 레이아웃 컴포넌트

### 1. PageLayout
**위치**: `components/shared/PageLayout.tsx`

**용도**: 모든 페이지의 최상위 래퍼. 최대 너비와 일관된 여백 제공.

```tsx
import PageLayout from '@/components/shared/PageLayout'

export default function MyPage() {
  return (
    <PageLayout>
      {/* 페이지 콘텐츠 */}
    </PageLayout>
  )
}
```

**특징**:
- `max-w-[1400px]` - 초대형 화면에서 과도한 확장 방지
- `px-4 sm:px-6 lg:px-8` - 화면 크기별 좌우 여백
- `py-8` - 상하 일관된 여백
- `min-h-screen bg-gray-50` - 전체 화면 배경

### 2. PageHeader
**위치**: `components/shared/PageHeader.tsx`

**용도**: 페이지 제목, 설명, 액션 버튼 영역.

```tsx
import PageHeader from '@/components/shared/PageHeader'

<PageHeader
  title="입고 관리"
  description="물품 입고 내역을 관리합니다."
  actions={
    <Button onClick={handleAction}>추가</Button>
  }
/>
```

**반응형 동작**:
- 모바일: 제목과 버튼이 세로 배치 (`flex-col`)
- 데스크톱: 제목과 버튼이 가로 배치 (`sm:flex-row sm:justify-between`)

### 3. ContentCard
**위치**: `components/shared/ContentCard.tsx`

**용도**: 섹션별 카드 래퍼. 옵션으로 타이틀과 헤더 액션 지원.

```tsx
import ContentCard from '@/components/shared/ContentCard'

<ContentCard
  title="입고 내역"
  headerActions={<Button>필터</Button>}
>
  {/* 테이블 또는 콘텐츠 */}
</ContentCard>
```

**반응형 동작**:
- `p-4 sm:p-6` - 모바일 4, 데스크톱 6 패딩
- 헤더도 `flex-col` → `sm:flex-row` 전환

## 주요 패턴

### 1. 그리드 레이아웃
**입고/판매 폼 예시**:
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
  {/* 모바일: 1열, 태블릿: 2열, 데스크톱: 4열 */}
</div>
```

**통계 카드 예시**:
```tsx
<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
  {/* 모바일: 2열, 작은 태블릿: 3열, 데스크톱: 5열 */}
</div>
```

### 2. 테이블 오버플로우
모든 데이터 테이블은 최소 너비를 설정하고 수평 스크롤 가능:

```tsx
<div className="overflow-x-auto">
  <table className="min-w-[800px] w-full">
    {/* 테이블 내용 */}
  </table>
</div>
```

**주요 테이블 min-width**:
- `InventoryTable`: `min-w-[900px]` (8개 컬럼)
- `PurchaseHistoryTable`: `min-w-[800px]` (9개 컬럼)
- `SaleHistoryTable`: `min-w-[1000px]` (11개 컬럼)

### 3. 페이지네이션
**표준 패턴**:
```tsx
{totalPages > 1 && (
  <div className="px-4 sm:px-6 py-4 border-t flex flex-col sm:flex-row items-center justify-between gap-4">
    <div className="text-sm text-gray-600 text-center sm:text-left">
      전체 {total}건 중 {start}-{end}건 표시
    </div>
    <div className="flex items-center gap-2">
      <button className="px-3 py-2 text-sm border rounded-lg ...">이전</button>
      {/* 페이지 번호 */}
      <button className="px-3 py-2 text-sm border rounded-lg ...">다음</button>
    </div>
  </div>
)}
```

### 4. Navigation (모바일 메뉴)
**위치**: `components/shared/Navigation.tsx`

- **데스크톱 (lg+)**: 가로 메뉴 (`hidden lg:flex`)
- **모바일**: 햄버거 버튼 → 드롭다운 메뉴 (`lg:hidden`)

```tsx
<button className="lg:hidden p-2 ...">☰</button>
{mobileMenuOpen && (
  <div className="lg:hidden absolute ...">
    {/* 모바일 메뉴 항목 */}
  </div>
)}
```

## 버튼 스타일 (Button 컴포넌트)

**위치**: `components/ui/Button.tsx`

**사용법**:
```tsx
import { Button } from '@/components/ui/Button'

<Button variant="primary" size="lg">저장</Button>
<Button variant="outline" size="sm">취소</Button>
<Button variant="danger" disabled>삭제</Button>
```

**Variants**:
- `primary` / `default`: 파란색 (주요 액션)
- `secondary`: 회색 (보조 액션)
- `outline`: 테두리만 (취소, 리셋)
- `ghost`: 배경 없음 (링크 스타일)
- `danger` / `destructive`: 빨간색 (삭제)

**Sizes**:
- `sm`: `px-3 py-1.5 text-sm`
- `md`: `px-4 py-2 text-base` (기본)
- `lg`: `px-6 py-3 text-lg`

## 간격 표준

### Padding/Margin
- **카드 내부**: `p-4 sm:p-6`
- **섹션 간격**: `mb-6` 또는 `mb-8`
- **요소 간 간격**: `gap-4` (flex/grid)
- **버튼 그룹**: `gap-2`

### 여백 스케일 (Tailwind)
- `2` = 0.5rem (8px)
- `4` = 1rem (16px)
- `6` = 1.5rem (24px)
- `8` = 2rem (32px)

## AG Grid (입고/판매 페이지)

**반응형 처리**:
- 부모 컨테이너: `flex-1` (남은 공간 채우기)
- AG Grid 래퍼: `ag-theme-alpine` (자체 반응형 지원)
- 모바일에서 가로 스크롤 자동 활성화

```tsx
<div className="flex flex-col h-full">
  <div className="p-4 border-b">
    {/* 헤더 버튼 */}
  </div>
  <div className="flex-1 ag-theme-alpine">
    <AgGridReact ... />
  </div>
</div>
```

## 로그인 페이지

**특별 레이아웃**:
- 전체 화면 중앙 정렬: `min-h-screen flex items-center justify-center`
- 그라디언트 배경: `bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50`
- 카드 최대 너비: `max-w-md`
- 모바일 패딩: `px-4` (좌우 여백)

## 체크리스트 (새 페이지 추가 시)

- [ ] `PageLayout`으로 페이지 래핑
- [ ] `PageHeader`로 제목/설명/액션 구성
- [ ] `ContentCard`로 섹션 구분
- [ ] 폼 입력은 `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4`
- [ ] 테이블은 `overflow-x-auto` + `min-w-[XXXpx]`
- [ ] 페이지네이션은 표준 패턴 사용
- [ ] 버튼은 `Button` 컴포넌트 사용
- [ ] 모바일에서 `flex-col`, 데스크톱에서 `sm:flex-row`

## 테스트 권장 화면 크기

### Chrome DevTools
1. **모바일**: iPhone SE (375px)
2. **태블릿**: iPad (768px)
3. **데스크톱**: 1440px 이상

### 확인 사항
- [ ] Navigation 햄버거 메뉴 작동 (모바일)
- [ ] 폼 그리드 전환 (1열 → 2열 → 4열)
- [ ] 테이블 가로 스크롤 (모바일)
- [ ] 페이지네이션 레이아웃 (세로 → 가로)
- [ ] 버튼 텍스트 줄바꿈 방지 (`whitespace-nowrap`)

## 기술 스택

- **CSS 프레임워크**: Tailwind CSS v3
- **브레이크포인트**: Tailwind 기본값
- **폰트**: `font-sans` (시스템 폰트 스택)
- **아이콘**: 이모지 + 일부 SVG

## 주의사항

1. **인라인 스타일 금지**: 모든 스타일은 Tailwind 클래스 사용
2. **커스텀 브레이크포인트 추가 금지**: Tailwind 기본값만 사용
3. **globals.css 최소화**: 전역 스타일은 최소한으로 제한
4. **컴포넌트 재사용**: PageLayout, ContentCard, Button 적극 활용
5. **AG Grid 스타일 오버라이드 주의**: 가능한 기본 테마 사용

---

**최종 업데이트**: 2025년 1월 24일  
**적용 범위**: 전체 페이지 (로그인, 대시보드, 입고, 판매, 재고, 거래처, 품목, 사용자 관리)
