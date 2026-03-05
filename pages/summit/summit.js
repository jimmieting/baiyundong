/**
 * 巅峰页 - 排行榜
 * 今日榜 / 本月榜 / 历史榜
 * 通过 getLeaderboard 云函数查询
 * Phase 6: 5s超时 + 本地缓存 + 离线友好
 */
const app = getApp();
const timeUtil = require('../../utils/time');
const network = require('../../utils/network');

const CACHE_KEY = 'leaderboard_cache';
const CLOUD_TIMEOUT = 5000;

Page({
  data: {
    activeTab: 0,
    tabs: ['今日榜', '本月榜', '历史榜'],
    modes: ['today', 'month', 'all'],

    list: [],
    loading: true,
    empty: false,
    loadError: false,   // 加载失败标志
    errorType: '',      // 'deploy' 或 'network'
    isOffline: false,   // 离线标志

    statusBarHeight: 0
  },

  onLoad() {
    const systemInfo = app.globalData.systemInfo;
    if (systemInfo) {
      this.setData({ statusBarHeight: systemInfo.statusBarHeight || 44 });
    }

    this.setData({ isOffline: !network.isOnline() });
    this._loadLeaderboard(0);
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 });
    }
    this.setData({ isOffline: !network.isOnline() });
  },

  /**
   * 下拉刷新
   */
  onPullDownRefresh() {
    this.setData({ isOffline: !network.isOnline() });
    this._loadLeaderboard(this.data.activeTab).then(() => {
      wx.stopPullDownRefresh();
    });
  },

  /**
   * 切换 Tab
   */
  switchTab(e) {
    const index = e.currentTarget.dataset.index;
    this.setData({ activeTab: index });
    this._loadLeaderboard(index);
  },

  /**
   * 从云函数加载排行榜数据
   * 带 5s 超时 + 本地缓存兜底
   */
  async _loadLeaderboard(tabIndex) {
    this.setData({ loading: true, empty: false, loadError: false, errorType: '', list: [] });

    const mode = this.data.modes[tabIndex];

    try {
      const { result } = await network.withTimeout(
        wx.cloud.callFunction({
          name: 'getLeaderboard',
          data: { mode, limit: 50 }
        }),
        CLOUD_TIMEOUT,
        '排行榜查询'
      );

      if (result.success && result.list.length > 0) {
        const list = result.list.map(item => ({
          ...item,
          durationText: timeUtil.formatDuration(item.duration_sec),
          dateText: timeUtil.formatDateShort(item.start_time)
        }));

        this.setData({ list, loading: false, empty: false });

        // 缓存到本地
        this._saveCache(mode, list);
      } else {
        this.setData({ list: [], loading: false, empty: true });
      }
    } catch (err) {
      console.error('加载排行榜失败', err);

      // 区分云函数未部署和网络问题
      const errMsg = (err && err.message) || '';
      const isNotDeployed = errMsg.includes('not found') || errMsg.includes('-404') || errMsg.includes('FunctionName');
      const errorType = isNotDeployed ? 'deploy' : 'network';

      // 尝试从本地缓存恢复
      const cached = this._loadCache(mode);
      if (cached && cached.length > 0) {
        this.setData({
          list: cached,
          loading: false,
          empty: false,
          loadError: true,
          errorType
        });
      } else {
        this.setData({ loading: false, empty: true, loadError: true, errorType });
      }
    }
  },

  /**
   * 缓存排行榜数据到本地
   */
  _saveCache(mode, list) {
    try {
      const cache = wx.getStorageSync(CACHE_KEY) || {};
      cache[mode] = { list, savedAt: Date.now() };
      wx.setStorageSync(CACHE_KEY, cache);
    } catch (e) {
      // 静默失败
    }
  },

  /**
   * 从本地缓存读取排行榜
   * 仅保留30分钟内的缓存
   */
  _loadCache(mode) {
    try {
      const cache = wx.getStorageSync(CACHE_KEY) || {};
      const entry = cache[mode];
      if (!entry) return null;

      // 30分钟过期
      if (Date.now() - entry.savedAt > 30 * 60 * 1000) return null;

      return entry.list;
    } catch (e) {
      return null;
    }
  }
});
