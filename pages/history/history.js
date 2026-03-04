/**
 * 历史记录列表页
 * 按日期倒序展示个人所有攀登记录
 *
 * Phase 1: 页面骨架
 * Phase 4: 完整功能
 */
const app = getApp();

Page({
  data: {
    list: [],
    loading: true,
    empty: false
  },

  onLoad() {
    // Phase 4 将从云端加载数据
    this.setData({ loading: false, empty: true });
  },

  /**
   * 查看记录详情
   */
  goDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/record/record?id=${id}`
    });
  },

  /**
   * 返回
   */
  goBack() {
    wx.navigateBack();
  }
});
