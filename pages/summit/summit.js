/**
 * 巅峰页 - 排行榜
 * 今日榜 / 本月榜 / 历史榜
 * 通过 getLeaderboard 云函数查询
 */
const app = getApp();
const timeUtil = require('../../utils/time');

Page({
  data: {
    activeTab: 0,
    tabs: ['今日榜', '本月榜', '历史榜'],
    modes: ['today', 'month', 'all'],

    list: [],
    loading: true,
    empty: false,

    statusBarHeight: 0
  },

  onLoad() {
    const systemInfo = app.globalData.systemInfo;
    if (systemInfo) {
      this.setData({ statusBarHeight: systemInfo.statusBarHeight || 44 });
    }

    this._loadLeaderboard(0);
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 });
    }
  },

  /**
   * 下拉刷新
   */
  onPullDownRefresh() {
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
   */
  async _loadLeaderboard(tabIndex) {
    this.setData({ loading: true, empty: false, list: [] });

    const mode = this.data.modes[tabIndex];

    try {
      const { result } = await wx.cloud.callFunction({
        name: 'getLeaderboard',
        data: { mode, limit: 50 }
      });

      if (result.success && result.list.length > 0) {
        const list = result.list.map(item => ({
          ...item,
          durationText: timeUtil.formatDuration(item.duration_sec),
          dateText: timeUtil.formatDateShort(item.start_time)
        }));

        this.setData({ list, loading: false, empty: false });
      } else {
        this.setData({ list: [], loading: false, empty: true });
      }
    } catch (err) {
      console.error('加载排行榜失败', err);
      this.setData({ loading: false, empty: true });
    }
  }
});
