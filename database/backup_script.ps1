# =====================================================
# Supabase PostgreSQL 백업 스크립트
# =====================================================
# 사용법:
# 1. Supabase 프로젝트 설정에서 DB 비밀번호 확인
# 2. 아래 변수 설정 후 실행: .\database\backup_script.ps1
# 3. Task Scheduler로 자동화 가능

param(
    [string]$BackupType = "full"  # "full", "schema-only", "data-only"
)

# =====================================================
# 설정 (반드시 수정 필요)
# =====================================================
$SUPABASE_PROJECT_REF = "YOUR_PROJECT_REF_HERE"  # 예: abcdefghijklmnop
$SUPABASE_DB_PASSWORD = "YOUR_DB_PASSWORD_HERE"  # Supabase 프로젝트 설정에서 확인

# 백업 저장 경로
$BACKUP_DIR = "C:\Users\k1her\OneDrive\바탕 화면\호스팅\drevers-erp-next\backups"
$TIMESTAMP = Get-Date -Format "yyyyMMdd_HHmmss"
$BACKUP_FILE = "$BACKUP_DIR\erp_backup_$BackupType`_$TIMESTAMP.sql"

# 백업 보관 기간 (일)
$RETENTION_DAYS = 30

# =====================================================
# 사전 체크
# =====================================================
Write-Host "🔍 백업 시스템 체크 중..." -ForegroundColor Cyan

# pg_dump 설치 확인
$pgDumpPath = Get-Command pg_dump -ErrorAction SilentlyContinue
if (-not $pgDumpPath) {
    Write-Host "❌ pg_dump가 설치되어 있지 않습니다." -ForegroundColor Red
    Write-Host "PostgreSQL 클라이언트 도구를 설치해주세요: https://www.postgresql.org/download/windows/" -ForegroundColor Yellow
    exit 1
}

# 백업 디렉토리 생성
if (-not (Test-Path $BACKUP_DIR)) {
    New-Item -ItemType Directory -Path $BACKUP_DIR -Force | Out-Null
    Write-Host "✅ 백업 디렉토리 생성: $BACKUP_DIR" -ForegroundColor Green
}

# 설정 확인
if ($SUPABASE_PROJECT_REF -eq "YOUR_PROJECT_REF_HERE" -or $SUPABASE_DB_PASSWORD -eq "YOUR_DB_PASSWORD_HERE") {
    Write-Host "❌ Supabase 연결 정보를 설정해주세요." -ForegroundColor Red
    Write-Host "스크립트 상단의 SUPABASE_PROJECT_REF와 SUPABASE_DB_PASSWORD를 수정하세요." -ForegroundColor Yellow
    exit 1
}

# =====================================================
# 백업 실행
# =====================================================
Write-Host "`n🚀 백업 시작: $BackupType" -ForegroundColor Cyan
Write-Host "시간: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Gray

$connectionString = "postgresql://postgres:$SUPABASE_DB_PASSWORD@db.$SUPABASE_PROJECT_REF.supabase.co:5432/postgres"

try {
    switch ($BackupType) {
        "full" {
            Write-Host "📦 전체 백업 (스키마 + 데이터)..." -ForegroundColor Yellow
            & pg_dump $connectionString `
                --schema=public `
                --format=plain `
                --file=$BACKUP_FILE `
                --verbose
        }
        "schema-only" {
            Write-Host "📋 스키마만 백업..." -ForegroundColor Yellow
            & pg_dump $connectionString `
                --schema=public `
                --schema-only `
                --format=plain `
                --file=$BACKUP_FILE `
                --verbose
        }
        "data-only" {
            Write-Host "💾 데이터만 백업..." -ForegroundColor Yellow
            & pg_dump $connectionString `
                --schema=public `
                --data-only `
                --format=plain `
                --file=$BACKUP_FILE `
                --verbose
        }
        default {
            Write-Host "❌ 잘못된 백업 타입: $BackupType" -ForegroundColor Red
            Write-Host "사용 가능: full, schema-only, data-only" -ForegroundColor Yellow
            exit 1
        }
    }

    if ($LASTEXITCODE -ne 0) {
        throw "pg_dump 실행 실패 (Exit Code: $LASTEXITCODE)"
    }

    # 백업 파일 확인
    if (-not (Test-Path $BACKUP_FILE)) {
        throw "백업 파일이 생성되지 않았습니다: $BACKUP_FILE"
    }

    $fileSize = (Get-Item $BACKUP_FILE).Length / 1MB
    Write-Host "✅ 백업 완료: $BACKUP_FILE" -ForegroundColor Green
    Write-Host "파일 크기: $([math]::Round($fileSize, 2)) MB" -ForegroundColor Gray

    # =====================================================
    # 압축 (선택 사항)
    # =====================================================
    Write-Host "`n📦 백업 파일 압축 중..." -ForegroundColor Cyan
    $zipFile = "$BACKUP_FILE.zip"
    Compress-Archive -Path $BACKUP_FILE -DestinationPath $zipFile -Force
    
    if (Test-Path $zipFile) {
        $zipSize = (Get-Item $zipFile).Length / 1MB
        Write-Host "✅ 압축 완료: $zipFile" -ForegroundColor Green
        Write-Host "압축 크기: $([math]::Round($zipSize, 2)) MB" -ForegroundColor Gray
        
        # 원본 .sql 파일 삭제 (압축본만 보관)
        Remove-Item $BACKUP_FILE -Force
        Write-Host "원본 .sql 파일 삭제 (압축본 보관)" -ForegroundColor Gray
    }

    # =====================================================
    # 오래된 백업 정리
    # =====================================================
    Write-Host "`n🗑️  오래된 백업 정리 중..." -ForegroundColor Cyan
    $oldBackups = Get-ChildItem $BACKUP_DIR -Filter "*.zip" | 
        Where-Object { $_.CreationTime -lt (Get-Date).AddDays(-$RETENTION_DAYS) }
    
    if ($oldBackups.Count -gt 0) {
        $oldBackups | ForEach-Object {
            Write-Host "삭제: $($_.Name) ($(Get-Date $_.CreationTime -Format 'yyyy-MM-dd'))" -ForegroundColor Gray
            Remove-Item $_.FullName -Force
        }
        Write-Host "✅ $($oldBackups.Count)개 백업 파일 삭제됨" -ForegroundColor Green
    } else {
        Write-Host "삭제할 오래된 백업 없음" -ForegroundColor Gray
    }

    # =====================================================
    # 백업 목록 표시
    # =====================================================
    Write-Host "`n📋 현재 백업 목록:" -ForegroundColor Cyan
    $backups = Get-ChildItem $BACKUP_DIR -Filter "*.zip" | Sort-Object CreationTime -Descending | Select-Object -First 10
    $backups | ForEach-Object {
        $size = [math]::Round($_.Length / 1MB, 2)
        $date = Get-Date $_.CreationTime -Format 'yyyy-MM-dd HH:mm'
        Write-Host "  $($_.Name) - $size MB - $date" -ForegroundColor Gray
    }

    Write-Host "`n✅ 백업 작업 완료!" -ForegroundColor Green
    Write-Host "백업 위치: $BACKUP_DIR" -ForegroundColor Cyan

} catch {
    Write-Host "`n❌ 백업 실패: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "스택 트레이스:" -ForegroundColor Yellow
    Write-Host $_.ScriptStackTrace -ForegroundColor Gray
    exit 1
}

# =====================================================
# 복구 방법 안내
# =====================================================
Write-Host "`n📖 복구 방법:" -ForegroundColor Cyan
Write-Host "1. 압축 해제: Expand-Archive -Path '$zipFile' -DestinationPath '$BACKUP_DIR\restore'" -ForegroundColor Gray
Write-Host "2. psql로 복구: psql `$connectionString -f '$BACKUP_DIR\restore\erp_backup_*.sql'" -ForegroundColor Gray
Write-Host "   또는 Supabase SQL Editor에서 파일 내용 복사 후 실행" -ForegroundColor Gray
