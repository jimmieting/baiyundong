/**
 * 地理围栏工具模块
 * Haversine 算法、围栏判断、阶梯采样频率
 */

const EARTH_RADIUS = 6371000; // 地球半径（米）

/**
 * Haversine 公式计算两点间的球面距离
 * @param {number} lat1 纬度1
 * @param {number} lng1 经度1
 * @param {number} lat2 纬度2
 * @param {number} lng2 经度2
 * @returns {number} 距离（米）
 */
function getDistance(lat1, lng1, lat2, lng2) {
  const toRad = (deg) => deg * Math.PI / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS * c;
}

/**
 * 判断坐标是否在围栏内
 * @param {number} lat 当前纬度
 * @param {number} lng 当前经度
 * @param {object} center { lat, lng } 围栏中心点
 * @param {number} radius 围栏半径（米）
 * @returns {boolean}
 */
function isInGeofence(lat, lng, center, radius) {
  const distance = getDistance(lat, lng, center.lat, center.lng);
  return distance <= radius;
}

/**
 * 根据距离计算地理状态
 * @param {number} distance 距离目标点的距离（米）
 * @returns {string} 'far' | 'near' | 'inside'
 */
function getGeoStatus(distance) {
  if (distance <= 50) return 'inside';
  if (distance <= 100) return 'near';
  return 'far';
}

/**
 * 根据距离获取状态条文案
 * @param {number} distance 距离（米）
 * @param {string} target 'start' | 'end'
 * @returns {string}
 */
function getGeoText(distance, target) {
  const targetName = target === 'start' ? '起点' : '终点';

  if (distance <= 50) {
    return target === 'start'
      ? '已进入起点区域，准备开始'
      : '已到达终点区域，确认到达';
  }
  if (distance <= 100) {
    return `即将到达${targetName}区域`;
  }

  // 格式化距离
  if (distance >= 1000) {
    return `距离${targetName} ${(distance / 1000).toFixed(1)} 公里`;
  }
  return `距离${targetName} ${Math.round(distance)} 米`;
}

/**
 * 阶梯式采样频率
 * 远距(>500m) = 10秒 | 近距(100-500m) = 3秒 | 精确(<100m) = 1秒
 * @param {number} distance 距离目标点（米）
 * @returns {number} 采样间隔（毫秒）
 */
function getSamplingInterval(distance) {
  if (distance <= 100) return 1000;
  if (distance <= 500) return 3000;
  return 10000;
}

module.exports = {
  getDistance,
  isInGeofence,
  getGeoStatus,
  getGeoText,
  getSamplingInterval
};
