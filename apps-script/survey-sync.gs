// ============================================================
// Google Apps Script: 만족도 조사 → Supabase 중앙 동기화
// ============================================================
// 구조:
//   이 스크립트가 붙어있는 "관리 시트"에 지점 목록이 있음
//   A열: 파일명, B열: 지점명, C열: 구글시트 ID
//   지점명(B열)으로 Supabase branches 테이블을 자동 조회하여 branch_id 매칭
//
// 사용법:
// 1. 이 관리 시트 → 확장프로그램 → Apps Script → 이 코드 붙여넣기
// 2. 프로젝트 설정 → 스크립트 속성에 SUPABASE_KEY 추가
// 3. 메뉴 → 만족도 동기화 → 전체 지점 동기화
// ============================================================

// ─── 설정 ───────────────────────────────────────────────────

const SUPABASE_URL = 'https://tvkoqazcymrygqpxgyym.supabase.co';
const SUPABASE_KEY = PropertiesService.getScriptProperties().getProperty('SUPABASE_KEY') || '';

/** 관리 시트에서 지점 목록을 읽는 시트 이름 */
const CONFIG_SHEET_NAME = 'ID추출';

// ─── 메뉴 등록 ──────────────────────────────────────────────

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('만족도 동기화')
    .addItem('전체 지점 동기화', 'syncAllBranches')
    .addItem('선택 행만 동기화', 'syncSelectedRow')
    .addSeparator()
    .addItem('설정 확인', 'checkConfig')
    .addItem('매일 자동 트리거 설치', 'installDailyTrigger')
    .addItem('자동 트리거 제거', 'removeDailyTrigger')
    .addToUi();
}

// ─── 설정 확인 ──────────────────────────────────────────────

function checkConfig() {
  const ui = SpreadsheetApp.getUi();
  const hasKey = !!SUPABASE_KEY;
  const configRows = getConfigRows_();

  let branchInfo = '(SUPABASE_KEY 미설정으로 조회 불가)';
  if (hasKey) {
    try {
      const branchMap = fetchBranchMap_();
      branchInfo = Object.keys(branchMap).length + '개 지점 조회됨';
    } catch (e) {
      branchInfo = '조회 오류: ' + e.message;
    }
  }

  ui.alert(
    '설정 확인',
    'SUPABASE_URL: ' + SUPABASE_URL +
    '\nSUPABASE_KEY: ' + (hasKey ? '설정됨 (길이: ' + SUPABASE_KEY.length + ')' : '미설정') +
    '\n등록된 시트 수: ' + configRows.length + '개' +
    '\nDB 지점 현황: ' + branchInfo +
    '\n\nSUPABASE_KEY 미설정 시: 프로젝트 설정 → 스크립트 속성에서 추가',
    ui.ButtonSet.OK
  );
}

// ─── Supabase에서 지점 목록 조회 ────────────────────────────

/**
 * branches 테이블에서 name → id 매핑 가져오기
 * @returns {Object<string, string>} { '인천점': 'uuid...', '강남점': 'uuid...' }
 */
function fetchBranchMap_() {
  const response = UrlFetchApp.fetch(
    SUPABASE_URL + '/rest/v1/branches?select=id,name&is_active=eq.true',
    {
      method: 'get',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY,
      },
      muteHttpExceptions: true,
    }
  );

  const code = response.getResponseCode();
  if (code < 200 || code >= 300) {
    throw new Error('branches 조회 실패 (HTTP ' + code + '): ' + response.getContentText());
  }

  const branches = JSON.parse(response.getContentText());
  const map = {};
  for (const b of branches) {
    map[b.name] = b.id;
  }
  return map;
}

// ─── 관리 시트에서 지점 목록 읽기 ───────────────────────────

/**
 * 관리 시트에서 A:파일명, B:지점명, C:시트ID 읽기
 * @returns {Array<{rowNum: number, fileName: string, branchName: string, sheetId: string}>}
 */
function getConfigRows_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = CONFIG_SHEET_NAME ? ss.getSheetByName(CONFIG_SHEET_NAME) : ss.getSheets()[0];
  const data = sheet.getDataRange().getValues();
  const rows = [];

  for (let i = 1; i < data.length; i++) {
    const fileName = String(data[i][0] || '').trim();
    const branchName = String(data[i][1] || '').trim();
    const sheetId = String(data[i][2] || '').trim();

    if (sheetId && branchName) {
      rows.push({
        rowNum: i + 1,
        fileName: fileName,
        branchName: branchName,
        sheetId: sheetId,
      });
    }
  }

  return rows;
}

// ─── 전체 지점 동기화 ───────────────────────────────────────

function syncAllBranches() {
  if (!SUPABASE_KEY) {
    SpreadsheetApp.getUi().alert('오류', 'SUPABASE_KEY가 설정되지 않았습니다.\n프로젝트 설정 → 스크립트 속성에서 추가하세요.', SpreadsheetApp.getUi().ButtonSet.OK);
    return;
  }

  // 지점명 → branch_id 매핑 조회 (1회)
  let branchMap;
  try {
    branchMap = fetchBranchMap_();
  } catch (e) {
    SpreadsheetApp.getUi().alert('오류', '지점 목록 조회 실패: ' + e.message, SpreadsheetApp.getUi().ButtonSet.OK);
    return;
  }

  const configRows = getConfigRows_();
  if (configRows.length === 0) {
    SpreadsheetApp.getUi().alert('동기화할 지점이 없습니다.\nA열: 파일명, B열: 지점명, C열: 시트ID를 확인하세요.');
    return;
  }

  const results = [];
  let totalSuccess = 0;
  let totalError = 0;
  let totalSkipped = 0;

  for (const config of configRows) {
    const branchId = branchMap[config.branchName];

    if (!branchId) {
      results.push(config.branchName + ': 지점명 매칭 실패 (DB에 없음)');
      Logger.log('지점명 매칭 실패: "' + config.branchName + '" — DB에 등록된 지점: ' + Object.keys(branchMap).join(', '));
      continue;
    }

    Logger.log('동기화 시작: ' + config.branchName + ' → ' + branchId);

    try {
      const result = syncOneSheet_(config.sheetId, branchId, config.branchName);
      results.push(config.branchName + ': 성공 ' + result.success + ', 실패 ' + result.error + ', 건너뜀 ' + result.skipped);
      totalSuccess += result.success;
      totalError += result.error;
      totalSkipped += result.skipped;
    } catch (e) {
      results.push(config.branchName + ': 오류 - ' + e.message);
      Logger.log('동기화 오류 (' + config.branchName + '): ' + e.message);
    }
  }

  const summary = '=== 전체 동기화 결과 ===\n\n' +
    '처리 지점: ' + configRows.length + '개\n' +
    '총 성공: ' + totalSuccess + '건\n' +
    '총 실패: ' + totalError + '건\n' +
    '총 건너뜀: ' + totalSkipped + '건\n\n' +
    '--- 지점별 ---\n' +
    results.join('\n');

  SpreadsheetApp.getUi().alert('동기화 완료', summary, SpreadsheetApp.getUi().ButtonSet.OK);
}

// ─── 선택 행만 동기화 ───────────────────────────────────────

function syncSelectedRow() {
  if (!SUPABASE_KEY) {
    SpreadsheetApp.getUi().alert('오류', 'SUPABASE_KEY가 설정되지 않았습니다.', SpreadsheetApp.getUi().ButtonSet.OK);
    return;
  }

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const row = sheet.getActiveRange().getRow();

  if (row < 2) {
    SpreadsheetApp.getUi().alert('데이터 행을 선택하세요 (2행 이상).');
    return;
  }

  const values = sheet.getRange(row, 1, 1, 3).getValues()[0];
  const branchName = String(values[1] || '').trim();
  const sheetId = String(values[2] || '').trim();

  if (!sheetId || !branchName) {
    SpreadsheetApp.getUi().alert('선택한 행에 지점명(B열) 또는 시트ID(C열)가 없습니다.');
    return;
  }

  // 지점명 → branch_id 조회
  let branchMap;
  try {
    branchMap = fetchBranchMap_();
  } catch (e) {
    SpreadsheetApp.getUi().alert('오류', '지점 목록 조회 실패: ' + e.message, SpreadsheetApp.getUi().ButtonSet.OK);
    return;
  }

  const branchId = branchMap[branchName];
  if (!branchId) {
    SpreadsheetApp.getUi().alert('오류', '"' + branchName + '" 지점이 DB에 없습니다.\n등록된 지점: ' + Object.keys(branchMap).join(', '), SpreadsheetApp.getUi().ButtonSet.OK);
    return;
  }

  try {
    const result = syncOneSheet_(sheetId, branchId, branchName);
    SpreadsheetApp.getUi().alert(
      branchName + ' 동기화 완료',
      '성공: ' + result.success + '건\n실패: ' + result.error + '건\n건너뜀: ' + result.skipped + '건',
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  } catch (e) {
    SpreadsheetApp.getUi().alert('오류', branchName + ' 동기화 실패: ' + e.message, SpreadsheetApp.getUi().ButtonSet.OK);
  }
}

// ─── 개별 시트 동기화 (핵심 로직) ───────────────────────────

/**
 * 하나의 구글 시트를 열어 데이터를 읽고 Supabase로 전송
 * @param {string} spreadsheetId - 구글 시트 파일 ID
 * @param {string} branchId - Supabase branches 테이블의 UUID
 * @param {string} branchName - 지점명 (로그용)
 * @returns {{success: number, error: number, skipped: number}}
 */
function syncOneSheet_(spreadsheetId, branchId, branchName) {
  const ss = SpreadsheetApp.openById(spreadsheetId);

  // 응답 데이터가 있는 시트 탭 찾기
  const sheet = findResponseSheet_(ss);
  if (!sheet) {
    Logger.log('[' + branchName + '] 응답 데이터 시트를 찾을 수 없음. 시트 목록: ' + ss.getSheets().map(function(s) { return s.getName() + '(' + s.getLastRow() + '행)'; }).join(', '));
    return { success: 0, error: 0, skipped: 0 };
  }

  Logger.log('[' + branchName + '] 시트 "' + sheet.getName() + '" 사용 (' + sheet.getLastRow() + '행)');
  const data = sheet.getDataRange().getValues();

  let successCount = 0;
  let errorCount = 0;
  let skippedCount = 0;

  if (data.length < 2) {
    Logger.log('[' + branchName + '] 데이터 없음 (행 수: ' + data.length + ')');
    return { success: 0, error: 0, skipped: 0 };
  }

  const rows = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];

    if (!row[0]) continue;

    const timestamp = parseTimestamp_(row[0]);
    if (!timestamp) {
      skippedCount++;
      Logger.log('[' + branchName + '] 타임스탬프 파싱 실패 (행 ' + (i + 1) + '): ' + row[0]);
      continue;
    }

    rows.push({
      external_id: spreadsheetId + '_' + i,
      branch_id: branchId,
      submitted_at: timestamp,
      gender: cleanText_(row[2]),
      visit_type: cleanText_(row[3]),
      age_group: cleanText_(row[4]),
      phone: cleanText_(row[5]),
      visit_frequency: cleanText_(row[6]),
      discovery_channel: cleanText_(row[7]),
      selection_reason: cleanText_(row[8]),
      skin_concern: cleanText_(row[9]),
      score_consultation: parseScore_(row[10]),
      score_staff: parseScore_(row[11]),
      score_wait_time: parseScore_(row[12]),
      score_procedure: parseScore_(row[13]),
      score_result: parseScore_(row[14]),
      score_overall: parseScore_(row[15]),
      feedback_praise: cleanText_(row[16]),
      feedback_improvement: cleanText_(row[17]),
      feedback_comment: cleanText_(row[18]),
    });
  }

  if (rows.length === 0) {
    return { success: 0, error: 0, skipped: skippedCount };
  }

  // 배치 전송 (100건씩)
  const batchSize = 100;

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);

    try {
      const response = UrlFetchApp.fetch(SUPABASE_URL + '/rest/v1/survey_responses', {
        method: 'post',
        contentType: 'application/json',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': 'Bearer ' + SUPABASE_KEY,
          'Prefer': 'resolution=ignore-duplicates',
        },
        payload: JSON.stringify(batch),
        muteHttpExceptions: true,
      });

      const code = response.getResponseCode();
      if (code >= 200 && code < 300) {
        successCount += batch.length;
      } else {
        errorCount += batch.length;
        Logger.log('[' + branchName + '] Supabase 오류: ' + response.getContentText());
      }
    } catch (e) {
      errorCount += batch.length;
      Logger.log('[' + branchName + '] 전송 오류: ' + e.message);
    }
  }

  Logger.log('[' + branchName + '] 완료 - 성공: ' + successCount + ', 실패: ' + errorCount + ', 건너뜀: ' + skippedCount);
  return { success: successCount, error: errorCount, skipped: skippedCount };
}

// ─── 시트 탭 찾기 ───────────────────────────────────────────

/**
 * 응답 데이터가 있는 시트 탭을 자동으로 찾기
 * 우선순위:
 *   1. "설문지 응답" 이 포함된 시트명 (정확한 매칭 우선)
 *   2. "응답" 또는 "Response"가 포함된 시트명 (단, "결과" 제외)
 *   3. "타임스탬프" 헤더가 있는 시트
 *   4. 가장 데이터가 많은 시트
 */
function findResponseSheet_(ss) {
  const sheets = ss.getSheets();

  // 1) "설문지 응답" 포함 시트 (최우선)
  for (const s of sheets) {
    const name = s.getName();
    if (name.indexOf('설문지 응답') >= 0) {
      return s;
    }
  }

  // 2) "응답" 또는 "Response" 포함 (단, "결과"가 들어간 시트는 제외)
  for (const s of sheets) {
    const name = s.getName();
    if ((name.indexOf('응답') >= 0 || name.toLowerCase().indexOf('response') >= 0) && name.indexOf('결과') < 0) {
      return s;
    }
  }

  // 2) 1행에 "타임스탬프" 헤더가 있는 시트
  for (const s of sheets) {
    if (s.getLastRow() < 2) continue;
    const header = s.getRange(1, 1).getValue();
    if (String(header).indexOf('타임스탬프') >= 0 || String(header).toLowerCase().indexOf('timestamp') >= 0) {
      return s;
    }
  }

  // 3) 가장 행이 많은 시트 (2행 이상)
  let bestSheet = null;
  let maxRows = 1;
  for (const s of sheets) {
    const rows = s.getLastRow();
    if (rows > maxRows) {
      maxRows = rows;
      bestSheet = s;
    }
  }

  return bestSheet;
}

// ─── 유틸리티 함수 ──────────────────────────────────────────

function parseScore_(val) {
  const num = parseInt(val, 10);
  return (isNaN(num) || num < 1 || num > 5) ? null : num;
}

function cleanText_(val) {
  const s = String(val || '').trim();
  return s === '' ? null : s;
}

function parseTimestamp_(value) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  const str = String(value).trim();

  const koreanMatch = str.match(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/);
  if (koreanMatch) {
    const [, year, month, day] = koreanMatch;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day)).toISOString();
  }

  const isoMatch = str.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day)).toISOString();
  }

  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString();
  }

  return null;
}

// ─── 자동 트리거 ────────────────────────────────────────────

function installDailyTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  for (const trigger of triggers) {
    if (trigger.getHandlerFunction() === 'syncAllBranches') {
      ScriptApp.deleteTrigger(trigger);
    }
  }

  ScriptApp.newTrigger('syncAllBranches')
    .timeBased()
    .everyDays(1)
    .atHour(2)
    .create();

  SpreadsheetApp.getUi().alert('매일 오전 2시 자동 동기화 트리거가 설정되었습니다.');
}

function removeDailyTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  let removed = 0;
  for (const trigger of triggers) {
    if (trigger.getHandlerFunction() === 'syncAllBranches') {
      ScriptApp.deleteTrigger(trigger);
      removed++;
    }
  }
  SpreadsheetApp.getUi().alert(removed + '개의 트리거가 제거되었습니다.');
}
