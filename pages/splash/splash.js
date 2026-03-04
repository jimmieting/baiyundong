/**
 * 启动页
 * 黛青背景 + 品牌名 + 随机文案
 * 2秒后自动跳转至攀登页
 */
const app = getApp();

Page({
  data: {
    quote: '',
    fadeOut: false
  },

  onLoad() {
    // 显示随机文案
    this.setData({
      quote: app.getRandomQuote()
    });

    // 2秒后淡出并跳转
    setTimeout(() => {
      this.setData({ fadeOut: true });
      setTimeout(() => {
        wx.switchTab({ url: '/pages/climb/climb' });
      }, 300); // 等待淡出动画完成
    }, 2000);
  }
});
