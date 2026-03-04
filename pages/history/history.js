// 白云洞登山局 - 历史记录 V1.0

const db = wx.cloud.database();

Page({
  data: {
    list: [],
    loading: true
  },

  onLoad() {
    this.loadHistory();
  },

  async loadHistory() {
    this.setData({ loading: true });
    wx.showLoading({ title: '加载中...', mask: true });

    try {
      const openid = await this.getOpenId();
      
      const result = await db.collection('t_workout')
        .where({ _openid: openid })
        .orderBy('start_time', 'desc')
        .get();
      
      wx.hideLoading();

      const processedList = result.data.map(item => {
        const date = item.start_time ? new Date(item.start_time) : null;
        return {
          ...item,
          formattedDate: date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` : '--',
          formattedDuration: this.formatDuration(item.duration_sec),
          statusText: this.getStatusText(item.status)
        };
      });

      this.setData({
        list: processedList,
        loading: false
      });

    } catch (err) {
      console.error('加载历史记录失败', err);
      wx.hideLoading();
      this.setData({ loading: false, list: [] });
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  formatDuration(seconds) {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  },

  getStatusText(status) {
    const map = {
      'RUNNING': '进行中',
      'COMPLETED': '已完成',
      'SUSPECT': '数据异常'
    };
    return map[status] || status;
  },

  // 返回上一页
  handleBack() {
    wx.navigateBack();
  },

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
