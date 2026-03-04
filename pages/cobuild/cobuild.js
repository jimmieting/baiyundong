// 白云洞登山局 - 共建页面 V1.0

const db = wx.cloud.database();

Page({
  data: {
    cobuilderList: [],
    showModal: false
  },

  onLoad() {
    this.loadCobuilderList();
  },

  // 加载共建者名录
  async loadCobuilderList() {
    try {
      const result = await db.collection('t_cobuilder')
        .orderBy('honor_level', 'desc')
        .orderBy('created_at', 'asc')
        .limit(20)
        .get();

      this.setData({
        cobuilderList: result.data || []
      });
    } catch (err) {
      console.error('加载共建者列表失败', err);
    }
  },

  // 显示支持/反馈模态框
  showSupportModal() {
    this.setData({ showModal: true });
    // 淡化底部标签栏
    const tabBar = this.selectComponent('#tab-bar');
    if (tabBar) {
      tabBar.setData({ dimmed: true });
    }
  },

  // 隐藏模态框
  hideModal() {
    this.setData({ showModal: false });
    // 恢复底部标签栏
    const tabBar = this.selectComponent('#tab-bar');
    if (tabBar) {
      tabBar.setData({ dimmed: false });
    }
  },

  // 跳转反馈
  goToFeedback() {
    this.hideModal();
    // TODO: 跳转到反馈页面
    wx.showToast({
      title: '反馈功能开发中',
      icon: 'none'
    });
  },

  // 显示捐助
  showDonation() {
    this.hideModal();
    wx.showModal({
      title: '捐助支持',
      content: '感谢你的支持！捐助功能正在开发中。',
      showCancel: false
    });
  },

  // 跳转数据初始化页
  goToInit() {
    wx.navigateTo({
      url: '/pages/init/init'
    });
  },

  // 提交投票
  async submitVote() {
    this.hideModal();
    
    try {
      const openid = await this.getOpenId();
      
      // 检查是否已投票
      const checkRes = await db.collection('t_votes').where({
        _openid: openid,
        type: 'SPIRITUAL'
      }).get();

      if (checkRes.data && checkRes.data.length > 0) {
        wx.showToast({
          title: '今天已投票',
          icon: 'none'
        });
        return;
      }

      // 记录投票
      await db.collection('t_votes').add({
        data: {
          type: 'SPIRITUAL',
          created_at: db.serverDate()
        }
      });

      wx.showToast({
        title: '感谢你的共鸣！',
        icon: 'success'
      });
    } catch (err) {
      console.error('投票失败', err);
    }
  },

  // 获取OpenID
  getOpenId() {
    return new Promise((resolve, reject) => {
      wx.cloud.callFunction({
        name: 'getOpenId',
        success: (res) => resolve(res.result.openid),
        fail: reject
      });
    });
  }
});
