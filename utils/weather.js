/**
 * 天气模块
 * 和风天气免费版 API
 * 结果缓存 30 分钟
 */

// 和风天气免费 API（需注册获取 key）
// 免费版：每天 1000 次调用
const API_BASE = 'https://devapi.qweather.com/v7/weather/now';
const API_KEY = ''; // 待填入和风天气 API Key

const CACHE_KEY = 'weather_cache';
const CACHE_DURATION = 30 * 60 * 1000; // 30 分钟

/**
 * 和风天气图标代码 -> emoji 映射
 */
const ICON_MAP = {
  '100': '☀️', '101': '🌤', '102': '⛅', '103': '🌥', '104': '☁️',
  '150': '🌙', '151': '🌤', '152': '⛅', '153': '🌥',
  '300': '🌧', '301': '🌧', '302': '⛈', '303': '⛈', '304': '🌩',
  '305': '🌦', '306': '🌧', '307': '🌧', '308': '🌧',
  '309': '🌦', '310': '🌧', '311': '🌧', '312': '🌧',
  '313': '🌨', '314': '🌦', '315': '🌧', '316': '🌧',
  '399': '🌧', '400': '🌨', '401': '🌨', '402': '❄️',
  '403': '❄️', '404': '🌨', '405': '🌨', '406': '🌨',
  '407': '🌨', '500': '🌫', '501': '🌫', '502': '🌫',
  '503': '🌫', '504': '🌫', '507': '🌪', '508': '🌪'
};

/**
 * 获取天气数据（带缓存）
 * @param {number} lat 纬度
 * @param {number} lng 经度
 * @returns {Promise<{icon: string, temp: string, text: string}>}
 */
async function fetchWeather(lat, lng) {
  // 检查缓存
  try {
    const cache = wx.getStorageSync(CACHE_KEY);
    if (cache && Date.now() - cache.timestamp < CACHE_DURATION) {
      return cache.data;
    }
  } catch (e) {}

  // 如果没有 API Key，返回默认值
  if (!API_KEY) {
    return { icon: '⛰', temp: '--', text: '未配置天气' };
  }

  try {
    const location = `${lng.toFixed(2)},${lat.toFixed(2)}`;
    const url = `${API_BASE}?location=${location}&key=${API_KEY}`;

    const res = await new Promise((resolve, reject) => {
      wx.request({
        url,
        timeout: 2000, // 2秒超时
        success: resolve,
        fail: reject
      });
    });

    if (res.data && res.data.code === '200' && res.data.now) {
      const now = res.data.now;
      const result = {
        icon: ICON_MAP[now.icon] || '🌡',
        temp: now.temp,
        text: now.text
      };

      // 写入缓存
      try {
        wx.setStorageSync(CACHE_KEY, {
          data: result,
          timestamp: Date.now()
        });
      } catch (e) {}

      return result;
    }

    return _getDefault();
  } catch (err) {
    console.error('天气请求失败', err);
    return _getDefault();
  }
}

/**
 * 返回默认天气（请求失败时）
 */
function _getDefault() {
  // 尝试返回上次缓存
  try {
    const cache = wx.getStorageSync(CACHE_KEY);
    if (cache && cache.data) return cache.data;
  } catch (e) {}

  return { icon: '⛰', temp: '--', text: '' };
}

module.exports = {
  fetchWeather
};
