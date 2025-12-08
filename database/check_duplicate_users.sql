-- ============================================
-- 기존 중복 아이디 확인
-- ============================================
-- 지점별 로그인 시스템 적용 전 필수 확인 사항

-- 1. 중복 아이디 확인
SELECT 
    username AS "중복 아이디",
    COUNT(*) AS "중복 개수",
    STRING_AGG(b.name, ', ') AS "소속 지점"
FROM users u
LEFT JOIN branches b ON u.branch_id = b.id
GROUP BY username 
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC;

-- 예상 결과: 중복이 없으면 빈 결과 반환
-- 중복이 있으면 해당 아이디와 개수 표시

-- 2. 전체 사용자 현황 (지점별)
SELECT 
    b.name AS "지점명",
    u.username AS "아이디",
    u.display_name AS "이름",
    u.role AS "권한"
FROM users u
LEFT JOIN branches b ON u.branch_id = b.id
ORDER BY b.name, u.username;

-- 3. 지점별 사용자 수
SELECT 
    b.name AS "지점명",
    COUNT(u.id) AS "사용자 수"
FROM branches b
LEFT JOIN users u ON b.id = u.branch_id
GROUP BY b.name
ORDER BY b.name;

