/**
 * 攀登页 - 核心 C 位
 * 融合实时监测、环境感知与个人荣誉历史
 *
 * Phase 1: 页面骨架 + 静态 UI
 * Phase 2: 接入地理围栏、状态机、计时器
 */
const app = getApp();

Page({
  data: {
    // 状态机
    state: 'IDLE', // IDLE / RUNNING / ARRIVED / COMPLETED

    // 环境层
    dateText: '',     // 当前日期
    weatherIcon: '--',
    temperature: '--',

    // 地理状态条
    geoStatus: 'far',  // far / near / inside
    geoDistance: '--',  // 距起点距离
    geoText: '定位中...',

    // 核心数据（非计时态）
    totalClimbs: 0,    // 年度挑战次数
    personalPB: '--',  // 个人最佳

    // 核心数据（计时态）
    elapsed: 0,         // 已用时（秒）
    elapsedText: '00:00',

    // 历史背书
    yearClimbs: 0,
    yearAscent: 0,

    // 按钮状态
    buttonEnabled: false,
    buttonText: '等待定位',

    // 系统
    statusBarHeight: 0
  },

  onLoad() {
    // 获取状态栏高度
    const systemInfo = app.globalData.systemInfo;
    if (systemInfo) {
      this.setData({ statusBarHeight: systemInfo.statusBarHeight || 44 });
    }

    // 初始化日期
    this._initDate();
  },

  onShow() {
    // 设置 TabBar 选中态
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 });
    }
  },

  // ========== 私有方法 ==========

  _initDate() {
    const now = new Date();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
    const weekDay = weekDays[now.getDay()];
    this.setData({
      dateText: `${month}月${day}日 周${weekDay}`
    });
  },

  // Phase 2 将实现以下方法：
  // _initLocation()
  // _initCloudReconnect()
  // _handleButtonTap()
  // _startWorkout()
  // _arrivedWorkout()
  // _startTimer()
  // _stopTimer()

  /**
   * 查看历史记录
   */
  goHistory() {
    wx.navigateTo({ url: '/pages/history/history' });
  }
});
