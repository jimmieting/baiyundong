/**
 * 记录校验模块
 * 三重校验：时间逻辑 / 海拔增量 / 地理闭环
 */
const geo = require('./geo');

// 校验常量
const CONSTRAINTS = {
  MIN_DURATION: 900,     // 15分钟
  MAX_DURATION: 36000,   // 600分钟
  ALT_EXPECTED: 280,     // 预期海拔增量
  ALT_TOLERANCE: 50,     // 海拔容差
  GEOFENCE_RADIUS: 50,   // 围栏半径（米）
  HARD_REJECT_DURATION: 600, // 10分钟，物理不可能
  HARD_REJECT_SPEED: 1800    // 垂直配速上限（米/时）
};

// 围栏坐标
const GEOFENCE = {
  START: { lat: 26.070797, lng: 119.372559 },
  END: { lat: 26.075214, lng: 119.389145 }
};

/**
 * 校验时间逻辑合理性
 * @param {number} durationSec 总用时（秒）
 * @returns {{ valid: boolean, flag: string, reason: string }}
 */
function validateTime(durationSec) {
  if (durationSec < CONSTRAINTS.HARD_REJECT_DURATION) {
    return {
      valid: false,
      flag: 'TIME_HARD_REJECT',
      reason: `用时${Math.floor(durationSec / 60)}分钟，违背物理常识`
    };
  }
  if (durationSec < CONSTRAINTS.MIN_DURATION) {
    return {
      valid: false,
      flag: 'TIME_TOO_SHORT',
      reason: `用时不足15分钟，判定为异常`
    };
  }
  if (durationSec > CONSTRAINTS.MAX_DURATION) {
    return {
      valid: false,
      flag: 'TIME_TOO_LONG',
      reason: `用时超过10小时，判定为异常`
    };
  }
  return { valid: true, flag: 'TIME_OK', reason: '' };
}

/**
 * 校验海拔增量
 * @param {number} startAlt 起点海拔
 * @param {number} endAlt 终点海拔
 * @returns {{ valid: boolean, flag: string, reason: string }}
 */
function validateAltitude(startAlt, endAlt) {
  // 海拔数据缺失
  if (!startAlt && startAlt !== 0 || !endAlt && endAlt !== 0) {
    return {
      valid: false,
      flag: 'ALT_MISSING',
      reason: '海拔数据缺失，待人工核实'
    };
  }

  const delta = endAlt - startAlt;
  const min = CONSTRAINTS.ALT_EXPECTED - CONSTRAINTS.ALT_TOLERANCE; // 230m
  const max = CONSTRAINTS.ALT_EXPECTED + CONSTRAINTS.ALT_TOLERANCE; // 330m

  if (delta < min || delta > max) {
    return {
      valid: false,
      flag: 'ALT_ABNORMAL',
      reason: `海拔增量${Math.round(delta)}米，不在${min}-${max}米范围内`
    };
  }

  return { valid: true, flag: 'ALT_OK', reason: '' };
}

/**
 * 校验地理闭环
 * @param {object} startLoc { latitude, longitude }
 * @param {object} endLoc { latitude, longitude }
 * @returns {{ valid: boolean, flag: string, reason: string }}
 */
function validateGeoLoop(startLoc, endLoc) {
  if (!startLoc || !endLoc) {
    return {
      valid: false,
      flag: 'GEO_MISSING',
      reason: '坐标数据缺失'
    };
  }

  const startDist = geo.getDistance(
    startLoc.latitude, startLoc.longitude,
    GEOFENCE.START.lat, GEOFENCE.START.lng
  );

  const endDist = geo.getDistance(
    endLoc.latitude, endLoc.longitude,
    GEOFENCE.END.lat, GEOFENCE.END.lng
  );

  if (startDist > CONSTRAINTS.GEOFENCE_RADIUS) {
    return {
      valid: false,
      flag: 'GEO_START_FAIL',
      reason: `起点距离围栏${Math.round(startDist)}米，超出50米限制`
    };
  }

  if (endDist > CONSTRAINTS.GEOFENCE_RADIUS) {
    return {
      valid: false,
      flag: 'GEO_END_FAIL',
      reason: `终点距离围栏${Math.round(endDist)}米，超出50米限制`
    };
  }

  return { valid: true, flag: 'GEO_OK', reason: '' };
}

/**
 * 执行完整的三重校验
 * @param {object} record 打卡记录
 * @returns {{ isValid: boolean, flags: string[], reasons: string[] }}
 */
function validateRecord(record) {
  const flags = [];
  const reasons = [];

  // 1. 时间校验
  const timeResult = validateTime(record.duration_sec);
  flags.push(timeResult.flag);
  if (!timeResult.valid) reasons.push(timeResult.reason);

  // 2. 海拔校验
  const altResult = validateAltitude(record.start_alt, record.end_alt);
  flags.push(altResult.flag);
  if (!altResult.valid) reasons.push(altResult.reason);

  // 3. 地理闭环校验
  const geoResult = validateGeoLoop(record.start_loc, record.end_loc);
  flags.push(geoResult.flag);
  if (!geoResult.valid) reasons.push(geoResult.reason);

  const isValid = timeResult.valid && altResult.valid && geoResult.valid;

  return { isValid, flags, reasons };
}

/**
 * 判断是否在硬性拒绝区间（不提供申诉入口）
 * @param {number} durationSec
 * @param {number} altDelta
 * @returns {boolean}
 */
function isHardReject(durationSec, altDelta) {
  if (durationSec < CONSTRAINTS.HARD_REJECT_DURATION) return true;

  // 垂直配速检查
  if (altDelta > 0 && durationSec > 0) {
    const speed = (altDelta / durationSec) * 3600;
    if (speed > CONSTRAINTS.HARD_REJECT_SPEED) return true;
  }

  return false;
}

module.exports = {
  validateTime,
  validateAltitude,
  validateGeoLoop,
  validateRecord,
  isHardReject,
  CONSTRAINTS
};
