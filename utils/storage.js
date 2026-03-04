/**
 * 本地缓存管理模块
 * 坐标采样缓存、状态机持久化备份、网络容错
 */

const KEYS = {
  WORKOUT: 'local_workout',          // 当前进行中的任务
  SAMPLES: 'local_samples',          // 坐标采样数据
  LAST_LOCATION: 'last_location',    // 最后已知位置
  CLIMB_STATE: 'climb_state_backup', // 状态机完整快照
  LAST_CHECKPOINT: 'last_checkpoint' // 最后检查点时间戳
};

// ========== 任务缓存 ==========

/**
 * 保存当前任务到本地
 * @param {object} data { _id, status, start_time, ... }
 */
function saveWorkout(data) {
  try {
    wx.setStorageSync(KEYS.WORKOUT, data);
  } catch (e) {
    console.error('保存本地任务失败', e);
  }
}

/**
 * 获取本地缓存的任务
 * @returns {object|null}
 */
function getWorkout() {
  try {
    return wx.getStorageSync(KEYS.WORKOUT) || null;
  } catch (e) {
    return null;
  }
}

/**
 * 清除本地任务缓存
 */
function clearWorkout() {
  try {
    wx.removeStorageSync(KEYS.WORKOUT);
    wx.removeStorageSync(KEYS.SAMPLES);
    wx.removeStorageSync(KEYS.CLIMB_STATE);
    wx.removeStorageSync(KEYS.LAST_CHECKPOINT);
  } catch (e) {
    console.error('清除本地任务失败', e);
  }
}

// ========== 坐标采样 ==========

/**
 * 追加一条坐标采样
 * @param {object} sample { lat, lng, alt, timestamp }
 */
function pushSample(sample) {
  try {
    const samples = wx.getStorageSync(KEYS.SAMPLES) || [];
    samples.push(sample);
    wx.setStorageSync(KEYS.SAMPLES, samples);
  } catch (e) {
    console.error('保存采样数据失败', e);
  }
}

/**
 * 获取所有采样数据
 * @returns {Array}
 */
function getSamples() {
  try {
    return wx.getStorageSync(KEYS.SAMPLES) || [];
  } catch (e) {
    return [];
  }
}

// ========== 位置缓存 ==========

/**
 * 保存最后已知位置
 * @param {object} location { latitude, longitude, altitude }
 */
function saveLastLocation(location) {
  try {
    wx.setStorageSync(KEYS.LAST_LOCATION, {
      ...location,
      timestamp: Date.now()
    });
  } catch (e) {
    console.error('保存位置失败', e);
  }
}

/**
 * 获取最后已知位置
 * @returns {object|null}
 */
function getLastLocation() {
  try {
    return wx.getStorageSync(KEYS.LAST_LOCATION) || null;
  } catch (e) {
    return null;
  }
}

// ========== 状态机快照（Phase 6 新增）==========

/**
 * 保存攀登页完整状态快照
 * 每60秒由 climb.js 调用一次，以及每次状态变更时调用
 *
 * @param {object} snapshot {
 *   state, workoutId, startTimestamp, elapsed,
 *   geoStatus, geoText, currentLocation
 * }
 */
function saveClimbState(snapshot) {
  try {
    wx.setStorageSync(KEYS.CLIMB_STATE, {
      ...snapshot,
      savedAt: Date.now()
    });
    wx.setStorageSync(KEYS.LAST_CHECKPOINT, Date.now());
  } catch (e) {
    console.error('保存状态快照失败', e);
  }
}

/**
 * 获取攀登页状态快照
 * @returns {object|null}
 */
function getClimbState() {
  try {
    return wx.getStorageSync(KEYS.CLIMB_STATE) || null;
  } catch (e) {
    return null;
  }
}

/**
 * 清除状态快照
 */
function clearClimbState() {
  try {
    wx.removeStorageSync(KEYS.CLIMB_STATE);
    wx.removeStorageSync(KEYS.LAST_CHECKPOINT);
  } catch (e) {
    console.error('清除状态快照失败', e);
  }
}

/**
 * 获取上次检查点距现在的秒数
 * 用于判断是否需要写新检查点
 * @returns {number} 秒数，无记录返回 Infinity
 */
function getSecondsSinceCheckpoint() {
  try {
    const ts = wx.getStorageSync(KEYS.LAST_CHECKPOINT);
    if (!ts) return Infinity;
    return Math.floor((Date.now() - ts) / 1000);
  } catch (e) {
    return Infinity;
  }
}

module.exports = {
  saveWorkout,
  getWorkout,
  clearWorkout,
  pushSample,
  getSamples,
  saveLastLocation,
  getLastLocation,
  // Phase 6 新增
  saveClimbState,
  getClimbState,
  clearClimbState,
  getSecondsSinceCheckpoint
};
