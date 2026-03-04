/**
 * 自定义底部导航栏
 * 左：巅峰 | 中：攀登（C位大圆） | 右：共建
 */
Component({
  data: {
    selected: 1, // 默认选中攀登（中间）
    list: [
      { pagePath: '/pages/summit/summit', text: '巅峰', index: 0 },
      { pagePath: '/pages/climb/climb', text: '攀登', index: 1 },
      { pagePath: '/pages/cobuild/cobuild', text: '共建', index: 2 }
    ],
    // 模态框打开时淡化 TabBar
    dimmed: false
  },

  methods: {
    switchTab(e) {
      const index = e.currentTarget.dataset.index;
      const url = this.data.list[index].pagePath;
      wx.switchTab({ url });
    },

    /**
     * 外部调用：设置模态框淡化状态
     */
    setDimmed(dimmed) {
      this.setData({ dimmed });
    }
  }
});
