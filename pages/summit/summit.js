/**
 * 巅峰页 - 排行榜
 * 今日榜 / 本月榜 / 历史榜
 *
 * Phase 1: 页面骨架 + 静态 UI
 * Phase 3: 接入云函数查询
 */
const app = getApp();

Page({
  data: {
    // Tab 切换
    activeTab: 0, // 0=今日 1=本月 2=历史
    tabs: ['今日榜', '本月榜', '历史榜'],

    // 排行数据
    list: [],
    loading: true,
    empty: false,

    // 系统
    statusBarHeight: 0
  },

  onLoad() {
    const systemInfo = app.globalData.systemInfo;
    if (systemInfo) {
      this.setData({ statusBarHeight: systemInfo.statusBarHeight || 44 });
    }

    // Phase 3 将实现数据加载
    this.setData({ loading: false, empty: true });
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 });
    }
  },

  /**
   * 切换 Tab
   */
  switchTab(e) {
    const index = e.currentTarget.dataset.index;
    this.setData({ activeTab: index });
    // Phase 3: this._loadLeaderboard(index);
  }
});
