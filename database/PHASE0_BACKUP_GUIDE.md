# Phase 0: 백업 시스템 구축 및 현재 데이터 검증

## 📋 목표
1. 안전한 백업 시스템 구축 (자동화 준비)
2. 현재 데이터 정합성 검증 및 기록
3. 복구 절차 테스트

---

## 🚀 Step 1: Supabase 연결 정보 확인

### 1-1. Supabase 프로젝트 설정 접속
1. https://supabase.com/dashboard 로그인
2. 프로젝트 선택
3. **Settings** → **Database** 메뉴

### 1-2. 필요 정보 수집
```
Project Reference ID: [예: abcdefghijklmnop]
Database Password: [프로젝트 생성 시 설정한 비밀번호]
Connection String: postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres
```

**⚠️ 비밀번호를 모르는 경우:**
- Settings → Database → "Reset Database Password" 클릭
- 새 비밀번호 설정 후 기록

---

## 🔧 Step 2: PostgreSQL 클라이언트 도구 설치

### Windows 환경
1. PostgreSQL 다운로드: https://www.postgresql.org/download/windows/
2. 설치 시 **"Command Line Tools"** 체크 필수
3. 설치 후 PowerShell 재시작
4. 설치 확인:
```powershell
pg_dump --version
# 출력 예: pg_dump (PostgreSQL) 16.1
```

### 환경 변수 확인
- `C:\Program Files\PostgreSQL\16\bin` 경로가 PATH에 있는지 확인
- 없으면 수동 추가 후 PowerShell 재시작

---

## 📦 Step 3: 백업 스크립트 설정

### 3-1. 스크립트 파일 수정
`database\backup_script.ps1` 파일 상단 수정:

```powershell
# 이 두 줄만 수정
$SUPABASE_PROJECT_REF = "실제_프로젝트_REF"  # 예: abcdefghijklmnop
$SUPABASE_DB_PASSWORD = "실제_DB_비밀번호"
```

### 3-2. 백업 디렉토리 확인
- 기본 경로: `C:\Users\k1her\OneDrive\바탕 화면\호스팅\drevers-erp-next\backups`
- 변경 필요시 스크립트에서 `$BACKUP_DIR` 수정

---

## 🎯 Step 4: 첫 백업 실행

### 4-1. PowerShell 관리자 권한으로 실행
```powershell
cd "C:\Users\k1her\OneDrive\바탕 화면\호스팅\drevers-erp-next"

# 실행 정책 변경 (최초 1회)
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# 전체 백업 (스키마 + 데이터)
.\database\backup_script.ps1 -BackupType "full"
```

### 4-2. 예상 출력
```
🔍 백업 시스템 체크 중...
✅ 백업 디렉토리 생성: C:\Users\...\backups

🚀 백업 시작: full
시간: 2025-01-26 14:30:00
📦 전체 백업 (스키마 + 데이터)...
✅ 백업 완료: erp_backup_full_20250126_143000.sql
파일 크기: 15.32 MB

📦 백업 파일 압축 중...
✅ 압축 완료: erp_backup_full_20250126_143000.sql.zip
압축 크기: 2.14 MB

✅ 백업 작업 완료!
```

### 4-3. 백업 타입 옵션
```powershell
# 전체 백업 (기본)
.\database\backup_script.ps1 -BackupType "full"

# 스키마만 백업 (테이블 구조, RPC 함수 등)
.\database\backup_script.ps1 -BackupType "schema-only"

# 데이터만 백업 (INSERT 문만)
.\database\backup_script.ps1 -BackupType "data-only"
```

---

## ✅ Step 5: 데이터 정합성 검증

### 5-1. 검증 함수 등록
Supabase SQL Editor에서 실행:

```sql
-- 파일 내용 복사 후 실행
-- database\data_integrity_checks.sql
```

### 5-2. 전체 검증 실행
```sql
SELECT * FROM run_full_integrity_check();
```

**예상 결과:**
```
check_name                         | issue_count | status
-----------------------------------+-------------+------------------
1. 재고 정합성 (FIFO 레이어)        | 0           | ✅ 정상
2. 고아 레코드                      | 0           | ✅ 정상
3. 음수 재고                        | 0           | ✅ 정상
4. 거래번호 중복                    | 0           | ✅ 정상
5. FIFO 순서                        | 0           | ✅ 정상
```

### 5-3. 이슈 발견 시 상세 조회
```sql
-- 재고 불일치 상세
SELECT * FROM check_inventory_integrity();

-- 고아 레코드 상세
SELECT * FROM check_orphan_records();

-- 음수 재고 상세 (Critical!)
SELECT * FROM check_negative_inventory();

-- 거래번호 중복 상세
SELECT * FROM check_duplicate_transaction_numbers();
```

### 5-4. 검증 결과 저장 (Excel/CSV)
Supabase SQL Editor에서 결과를 복사하여 문서화:

```
파일명: backups/integrity_check_20250126.txt
내용:
=== Phase 0 초기 검증 (2025-01-26 14:30) ===
전체 검증 결과: [위 5개 항목 결과 붙여넣기]

발견된 이슈:
- [없음] 또는 [상세 내역]
```

---

## 🧪 Step 6: 복구 테스트 (선택 사항, 권장)

### 6-1. 테스트 데이터베이스 생성
Supabase에서 새 프로젝트 생성 (무료 티어 2개까지 가능)

### 6-2. 백업 복구
```powershell
# 압축 해제
Expand-Archive -Path "backups\erp_backup_full_20250126_143000.sql.zip" `
               -DestinationPath "backups\restore"

# psql로 복구
$testConnectionString = "postgresql://postgres:[TEST_PASSWORD]@db.[TEST_REF].supabase.co:5432/postgres"
psql $testConnectionString -f "backups\restore\erp_backup_full_20250126_143000.sql"
```

### 6-3. 복구 검증
테스트 DB에서 검증 쿼리 재실행:
```sql
SELECT * FROM run_full_integrity_check();
SELECT COUNT(*) FROM purchases;
SELECT COUNT(*) FROM sales;
SELECT COUNT(*) FROM inventory_layers;
```

---

## 📅 Step 7: 자동 백업 설정 (Windows Task Scheduler)

### 7-1. Task Scheduler 실행
- Windows 검색: "작업 스케줄러" (Task Scheduler)

### 7-2. 새 작업 만들기
1. **일반** 탭:
   - 이름: `ERP 데이터베이스 자동 백업`
   - 가장 높은 수준의 권한으로 실행 체크

2. **트리거** 탭:
   - 새로 만들기 → 매일 오전 2시

3. **동작** 탭:
   - 새로 만들기
   - 프로그램: `powershell.exe`
   - 인수: `-ExecutionPolicy Bypass -File "C:\Users\k1her\OneDrive\바탕 화면\호스팅\drevers-erp-next\database\backup_script.ps1" -BackupType "full"`

4. **조건** 탭:
   - "컴퓨터의 AC 전원이 켜져 있을 때만 작업 시작" 해제

5. **설정** 탭:
   - "작업 실행 실패 시: 1분마다 다시 시작, 3회 시도"

---

## ✅ Phase 0 완료 체크리스트

- [ ] PostgreSQL 클라이언트 도구 설치 완료 (`pg_dump --version` 확인)
- [ ] Supabase 연결 정보 확인 (Project REF, DB Password)
- [ ] `backup_script.ps1` 설정 완료 (REF, Password 입력)
- [ ] 첫 전체 백업 실행 성공 (`.zip` 파일 생성 확인)
- [ ] `data_integrity_checks.sql` 함수 등록 완료
- [ ] 전체 데이터 검증 실행 (`run_full_integrity_check()`)
- [ ] 검증 결과 문서화 (`backups/integrity_check_YYYYMMDD.txt`)
- [ ] 복구 테스트 완료 (선택 사항)
- [ ] 자동 백업 스케줄 설정 (선택 사항)

---

## 🚨 문제 해결

### 문제 1: `pg_dump: command not found`
**원인:** PostgreSQL 클라이언트 도구 미설치
**해결:** Step 2 참고하여 설치

### 문제 2: `connection refused` 또는 `password authentication failed`
**원인:** 연결 정보 오류
**해결:**
1. Supabase 대시보드에서 Project REF 재확인
2. Database Password 리셋 후 재시도
3. 방화벽에서 Supabase IP 허용 확인

### 문제 3: `cannot be loaded because running scripts is disabled`
**원인:** PowerShell 실행 정책
**해결:**
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### 문제 4: 백업 파일이 너무 큼 (>100MB)
**해결:**
- 압축이 자동으로 적용되므로 `.zip` 파일 크기 확인
- 30일 이상 오래된 백업 자동 삭제됨
- OneDrive 동기화 제외 설정 권장

---

## 📞 다음 단계
Phase 0 완료 후:
1. 검증 결과 리뷰
2. 발견된 이슈 수정 (있는 경우)
3. Phase 1 (트랜잭션 처리 강화) 시작 승인 요청
