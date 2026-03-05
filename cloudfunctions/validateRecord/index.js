/**
 * 云函数：记录校验（服务端权威校验）
 * 三重校验：时间逻辑 / 海拔增量 / 地理闭环
 * 校验通过 → COMPLETED | 校验失败 → SUSPECT
 */
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

// 校验常量
const CONSTRAINTS = {
  MIN_DURATION: 900,       // 15分钟
  MAX_DURATION: 10800,     // 3小时
  ALT_EXPECTED: 280,
  ALT_TOLERANCE: 50,
  GEOFENCE_RADIUS: 50,
  HARD_REJECT_DURATION: 600  // 10分钟，物理不可能
};

// 围栏坐标
const GEOFENCE = {
  START: { lat: 26.070797, lng: 119.372559 },
  END: { lat: 26.075214, lng: 119.389145 }
};

/**
 * Haversine 距离计算
 */
function getDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

exports.main = async (event) => {
  const { workoutId } = event;
  const wxContext = cloud.getWXContext();

  if (!workoutId) {
    return { success: false, error: '缺少 workoutId' };
  }

  try {
    // 读取记录
    const { data: record } = await db.collection('t_workout').doc(workoutId).get();

    // 权限校验：只能校验自己的记录
    if (record._openid !== wxContext.OPENID) {
      return { success: false, error: '无权操作' };
    }

    // 计算用时
    const startTime = new Date(record.start_time).getTime();
    const endTime = new Date(record.end_time).getTime();
    const durationSec = Math.floor((endTime - startTime) / 1000);

    const flags = [];
    const reasons = [];

    // === 1. 时间校验 ===
    if (durationSec < CONSTRAINTS.HARD_REJECT_DURATION) {
      flags.push('TIME_HARD_REJECT');
      reasons.push(`用时${Math.floor(durationSec / 60)}分钟，违背物理常识`);
    } else if (durationSec < CONSTRAINTS.MIN_DURATION) {
      flags.push('TIME_TOO_SHORT');
      reasons.push('用时不足15分钟');
    } else if (durationSec > CONSTRAINTS.MAX_DURATION) {
      flags.push('TIME_TOO_LONG');
      reasons.push('用时超过10小时');
    } else {
      flags.push('TIME_OK');
    }

    // === 2. 海拔校验 ===
    const startAlt = record.start_alt;
    const endAlt = record.end_alt;

    if ((!startAlt && startAlt !== 0) || (!endAlt && endAlt !== 0)) {
      flags.push('ALT_MISSING');
      reasons.push('海拔数据缺失');
    } else {
      const altDelta = endAlt - startAlt;
      const altMin = CONSTRAINTS.ALT_EXPECTED - CONSTRAINTS.ALT_TOLERANCE;
      const altMax = CONSTRAINTS.ALT_EXPECTED + CONSTRAINTS.ALT_TOLERANCE;

      if (altDelta < altMin || altDelta > altMax) {
        flags.push('ALT_ABNORMAL');
        reasons.push(`海拔增量${Math.round(altDelta)}米，不在${altMin}-${altMax}范围`);
      } else {
        flags.push('ALT_OK');
      }
    }

    // === 3. 地理闭环校验 ===
    const startLoc = record.start_loc;
    const endLoc = record.end_loc;

    if (!startLoc || !endLoc) {
      flags.push('GEO_MISSING');
      reasons.push('坐标数据缺失');
    } else {
      const startDist = getDistance(startLoc.latitude, startLoc.longitude, GEOFENCE.START.lat, GEOFENCE.START.lng);
      const endDist = getDistance(endLoc.latitude, endLoc.longitude, GEOFENCE.END.lat, GEOFENCE.END.lng);

      if (startDist > CONSTRAINTS.GEOFENCE_RADIUS) {
        flags.push('GEO_START_FAIL');
        reasons.push(`起点超出围栏${Math.round(startDist)}米`);
      } else if (endDist > CONSTRAINTS.GEOFENCE_RADIUS) {
        flags.push('GEO_END_FAIL');
        reasons.push(`终点超出围栏${Math.round(endDist)}米`);
      } else {
        flags.push('GEO_OK');
      }
    }

    // === 判定结果 ===
    const isValid = flags.every(f => f.endsWith('_OK'));
    const newStatus = isValid ? 'COMPLETED' : 'SUSPECT';

    // 更新记录
    await db.collection('t_workout').doc(workoutId).update({
      data: {
        status: newStatus,
        duration_sec: durationSec,
        is_valid: isValid,
        validation_flags: flags
      }
    });

    // 如果校验通过，更新用户统计
    if (isValid) {
      await _updateUserStats(record._openid, durationSec, record.end_alt - record.start_alt);
    }

    return {
      success: true,
      isValid,
      status: newStatus,
      durationSec,
      flags,
      reasons
    };
  } catch (err) {
    console.error('校验失败', err);
    return { success: false, error: err.message };
  }
};

/**
 * 更新用户统计数据
 */
async function _updateUserStats(openid, durationSec, altDelta) {
  const _ = db.command;

  try {
    const { data: users } = await db.collection('t_user')
      .where({ _openid: openid })
      .limit(1)
      .get();

    if (users.length === 0) return;

    const user = users[0];
    const updateData = {
      total_climbs: _.inc(1),
      total_ascent: _.inc(Math.max(0, Math.round(altDelta))),
      updated_at: db.serverDate()
    };

    // 更新个人最佳
    if (!user.personal_pb || durationSec < user.personal_pb) {
      updateData.personal_pb = durationSec;
    }

    await db.collection('t_user').doc(user._id).update({ data: updateData });
  } catch (err) {
    console.error('更新用户统计失败', err);
  }
}
