/**
 * 本地缓存管理模块
 * 坐标采样缓存、状态备份
 */

const KEYS = {
  WORKOUT: 'local_workout',      // 当前进行中的任务
  SAMPLES: 'local_samples',      // 坐标采样数据
  LAST_LOCATION: 'last_location' // 最后已知位置
};

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
  } catch (e) {
    console.error('清除本地任务失败', e);
  }
}

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

module.exports = {
  saveWorkout,
  getWorkout,
  clearWorkout,
  pushSample,
  getSamples,
  saveLastLocation,
  getLastLocation
};
