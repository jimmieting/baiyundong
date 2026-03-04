// 自定义底部导航栏 V1.0

Component({
  data: {
    currentIndex: 1,
    isModalOpen: false
  },

  methods: {
    switchTab(e) {
      const index = e.currentTarget.dataset.index;
      this.setData({ currentIndex: index });
      
      const pages = [
        '/pages/leaderboard/leaderboard',
        '/pages/index/index',
        '/pages/cobuild/cobuild'
      ];
      
      wx.switchTab({
        url: pages[index]
      });
    },

    // 供页面调用：显示模态框时淡化
    setModalOpen(open) {
      this.setData({ isModalOpen: open });
    }
  }
});
