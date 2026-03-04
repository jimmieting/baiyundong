/**
 * 共建页
 * 文化卡片 + 共建者名录 + 支持/反馈
 *
 * Phase 1: 页面骨架
 * Phase 5: 完整功能
 */
const app = getApp();

Page({
  data: {
    // 文化卡片
    cultureCards: [
      { content: '朱熹曾于鼓山白云洞题"天路"二字，意指通往精神高处的道路。' },
      { content: '白云洞海拔约400米，从埠兴村登山口出发，垂直爬升约280米。' }
    ],

    // 共建者名录
    builders: [],
    buildersLoading: true,

    // 半屏模态框
    showModal: false,

    // 系统
    statusBarHeight: 0
  },

  onLoad() {
    const systemInfo = app.globalData.systemInfo;
    if (systemInfo) {
      this.setData({ statusBarHeight: systemInfo.statusBarHeight || 44 });
    }

    // Phase 5 将从云端加载数据
    this.setData({ buildersLoading: false });
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2 });
    }
  },

  /**
   * 打开支持/反馈模态框
   */
  openModal() {
    this.setData({ showModal: true });
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setDimmed(true);
    }
  },

  /**
   * 关闭模态框
   */
  closeModal() {
    this.setData({ showModal: false });
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setDimmed(false);
    }
  }
});
