/**
 * 白云洞登山局 - 主程序入口
 * 核心哲学：向上的秩序 (Order Upwards)
 */
const network = require('./utils/network');

App({
  // ========== 全局常量 ==========

  // 地理围栏配置（锁死项）
  GEOFENCE: {
    START: { lat: 26.070797, lng: 119.372559, name: '埠兴村登山口' },
    END: { lat: 26.075214, lng: 119.389145, name: '白云洞主洞平台' },
    RADIUS: 50 // 米
  },

  // 状态机定义
  STATE: {
    IDLE: 'IDLE',
    RUNNING: 'RUNNING',
    ARRIVED: 'ARRIVED',
    COMPLETED: 'COMPLETED',
    SUSPECT: 'SUSPECT'
  },

  // 记录校验约束
  VALIDATION: {
    MIN_DURATION: 900,    // 15分钟（秒）
    MAX_DURATION: 36000,  // 600分钟（秒）
    ALT_EXPECTED: 280,    // 预期海拔增量（米）
    ALT_TOLERANCE: 50,    // 海拔容差（米）
    HARD_REJECT_DURATION: 600, // 10分钟，物理不可能区间（秒）
    HARD_REJECT_SPEED: 1800    // 垂直配速上限（米/时）
  },

  // 品牌色盘
  COLORS: {
    DEEP: '#003344',      // 黛青
    ACCENT: '#D34941',    // 深赤
    IVORY: '#F2F2F2',     // 象牙白
    MUTED: '#8899A6',     // 次要灰
    WARNING: '#FF4D4F'    // 高亮红
  },

  // 启动页文案库（本地备用，优先从云端 t_culture 加载）
  SPLASH_QUOTES: [
    '朱熹曾于此见"天路"，你今日所行亦然。',
    '每一步向上，都是与自己的博弈。',
    '秩序不在山顶等你，秩序在你脚下生长。',
    '凌晨的白云洞，只属于向上的人。',
    '没有捷径，只有节奏。',
    '山不言语，但记录一切。',
    '向上的秩序，从第一步开始。',
    '天路漫漫，心志为灯。'
  ],

  // 测试模式（true=跳过地理围栏校验，仅用于开发调试）
  TEST_MODE: false,

  // ========== 全局状态 ==========
  globalData: {
    openid: null,
    userInfo: null,   // t_user 表中的用户数据
    systemInfo: null
  },

  // ========== 生命周期 ==========

  onLaunch() {
    // 初始化云开发
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
      return;
    }

    wx.cloud.init({
      env: 'cloud1-5gbteglza5336c9b',
      traceUser: true
    });

    // 获取系统信息
    try {
      const systemInfo = wx.getSystemInfoSync();
      this.globalData.systemInfo = systemInfo;
    } catch (e) {
      console.error('获取系统信息失败', e);
    }

    // 初始化网络状态监听（Phase 6）
    network.init();

    // 获取 OpenID
    this._initOpenId();
  },

  // ========== 私有方法 ==========

  /**
   * 获取用户 OpenID
   * 使用 Promise 封装，避免重复调用
   */
  _openIdPromise: null,

  getOpenId() {
    if (this.globalData.openid) {
      return Promise.resolve(this.globalData.openid);
    }
    if (!this._openIdPromise) {
      this._openIdPromise = wx.cloud.callFunction({ name: 'getOpenId' })
        .then(res => {
          this.globalData.openid = res.result.openid;
          return res.result.openid;
        })
        .catch(err => {
          console.error('获取 OpenID 失败', err);
          this._openIdPromise = null;
          throw err;
        });
    }
    return this._openIdPromise;
  },

  _initOpenId() {
    this.getOpenId().catch(() => {});
  },

  /**
   * 获取随机启动文案
   */
  getRandomQuote() {
    const quotes = this.SPLASH_QUOTES;
    const index = Math.floor(Math.random() * quotes.length);
    return quotes[index];
  }
});
