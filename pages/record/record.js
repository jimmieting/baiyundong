/**
 * 记录详情页
 * 展示单次攀登的完整数据 + 分享海报
 *
 * Phase 1: 页面骨架
 * Phase 4: 完整功能
 */
const app = getApp();

Page({
  data: {
    // 记录数据
    record: null,
    loading: true,

    // 格式化后的展示数据
    durationText: '--:--',
    dateText: '',
    badge: '',
    isPB: false,
    altitudeDelta: '--',
    paceText: '--'
  },

  onLoad(options) {
    const id = options.id;
    if (id) {
      // Phase 4 将从云端加载记录
      this.setData({ loading: false });
    }
  },

  /**
   * 生成分享海报
   */
  generatePoster() {
    // Phase 4 实现
    wx.showToast({ title: '海报功能开发中', icon: 'none' });
  },

  /**
   * 返回首页
   */
  goHome() {
    wx.switchTab({ url: '/pages/climb/climb' });
  }
});
