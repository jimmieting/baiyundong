/**
 * 时间工具模块
 * 时间格式化、服务器时间校准
 */

/**
 * 格式化秒数为 MM:SS 或 HH:MM:SS
 * @param {number} totalSeconds 总秒数
 * @returns {string}
 */
function formatDuration(totalSeconds) {
  if (!totalSeconds || totalSeconds < 0) return '00:00';

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);

  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');

  if (hours > 0) {
    const hh = String(hours).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  }
  return `${mm}:${ss}`;
}

/**
 * 格式化日期为 YYYY-MM-DD HH:mm
 * @param {Date|string|number} date
 * @returns {string}
 */
function formatDateTime(date) {
  const d = new Date(date);
  if (isNaN(d.getTime())) return '--';

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

/**
 * 格式化日期为简短格式 M月D日
 * @param {Date|string|number} date
 * @returns {string}
 */
function formatDateShort(date) {
  const d = new Date(date);
  if (isNaN(d.getTime())) return '--';

  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

/**
 * 计算垂直配速（米/时）
 * @param {number} altitudeDelta 海拔增量（米）
 * @param {number} durationSec 用时（秒）
 * @returns {number} 垂直配速（米/时）
 */
function calcVerticalPace(altitudeDelta, durationSec) {
  if (!durationSec || durationSec <= 0) return 0;
  return Math.round((altitudeDelta / durationSec) * 3600);
}

module.exports = {
  formatDuration,
  formatDateTime,
  formatDateShort,
  calcVerticalPace
};
