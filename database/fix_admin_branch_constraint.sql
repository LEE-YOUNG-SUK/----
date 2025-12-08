-- ============================================
-- 시스템 관리자 지점 제약 조건 수정
-- ============================================
-- 작성일: 2025-01-26
-- 문제: 시스템 관리자(0000)가 branch_id를 가질 수 없음
-- 해결: 제약 조건 삭제 또는 수정

-- 1. 현재 제약 조건 확인
SELECT 
  conname AS constraint_name,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conname = 'users_branch_requirement'
  AND conrelid = 'users'::regclass;

-- 2. 기존 제약 조건 삭제
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_branch_requirement;

-- 3. 새로운 제약 조건 추가 (시스템 관리자는 branch_id NULL 허용)
-- 시스템 관리자(0000): branch_id는 NULL이어야 함 (전체 지점 관리)
-- 기타 역할: branch_id가 반드시 있어야 함
ALTER TABLE users ADD CONSTRAINT users_branch_requirement 
  CHECK (
    (role = '0000' AND branch_id IS NULL) OR
    (role != '0000' AND branch_id IS NOT NULL)
  );

COMMENT ON CONSTRAINT users_branch_requirement ON users IS 
  '시스템 관리자(0000)는 branch_id NULL, 기타 역할은 branch_id 필수';

-- 4. 시스템 관리자 branch_id를 NULL로 설정
UPDATE users 
SET branch_id = NULL
WHERE role = '0000';

-- 5. 확인
SELECT 
  id,
  username,
  display_name,
  role,
  branch_id,
  CASE 
    WHEN role = '0000' AND branch_id IS NULL THEN '✅ 정상'
    WHEN role = '0000' AND branch_id IS NOT NULL THEN '❌ 시스템 관리자에게 지점이 설정됨'
    WHEN role != '0000' AND branch_id IS NULL THEN '❌ 지점이 없음'
    WHEN role != '0000' AND branch_id IS NOT NULL THEN '✅ 정상'
  END AS status
FROM users
ORDER BY role, username;

-- 6. 제약 조건 다시 확인
SELECT 
  conname AS constraint_name,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conname = 'users_branch_requirement'
  AND conrelid = 'users'::regclass;

SELECT '✅ 시스템 관리자 제약 조건 수정 완료!' AS result;

