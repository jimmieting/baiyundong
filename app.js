// 白云洞登山局 - 主程序 V1.0
// 核心哲学：向上的秩序 (Order Upwards)

App({
  // 物理锁死 - 地理围栏坐标
  GEOFENCE: {
    START: { lat: 26.070797, lng: 119.372559, name: '埠兴村登山口' },
    END: { lat: 26.075214, lng: 119.389145, name: '白云洞主洞平台' },
    RADIUS_METERS: 50  // 50米强制围栏
  },

  // 状态机定义
  STATE: {
    IDLE: 'IDLE',
    RUNNING: 'RUNNING',
    ARRIVED: 'ARRIVED',
    COMPLETED: 'COMPLETED'
  },

  // 有效时间区间（秒）
  TIME_CONSTRAINTS: {
    MIN: 15 * 60,   // 15分钟
    MAX: 600 * 60   // 10小时
  },

  // 海拔校验（米）
  ALTITUDE_DELTA: {
    EXPECTED: 280,
    TOLERANCE: 50  // 280m ± 50m
  },

  // 开发测试模式
  testMode: true,  // 设为true可跳过地理围栏校验

  // 启动页文案
  splashMessages: [
    "朱熹曾于此见'天路'，你今日所行亦然。",
    "向上的秩序，是与自己博弈。",
    "每一步都是修行，每一秒都是见证。",
    "山高人为峰，秩序心中立。",
    "登顶不是目的，超越才是。",
    "280米爬升，丈量的不只是距离。",
    "凌晨的黛青色，是未露头的力量。",
    "起点即终点，秩序即自由。"
  ],

  globalData: {
    userInfo: null,
    currentState: 'IDLE',
    currentWorkout: null,
    location: null,
    distanceToStart: null,
    distanceToEnd: null,
    showSplash: true,  // 启动页默认显示
    testMode: true  // 测试模式：默认关闭，上线前确保为false
  },

  onLaunch() {
    // ====== L1 优先级：启动页第一时间显示 ======
    // 启动页由各页面onLoad时初始化，这里只设置全局状态
    
    // 初始化云开发
    if (wx.cloud) {
      wx.cloud.init({
        traceUser: true,
        env: 'cloud1-5gbteglza5336c9b'
      });
    }

    // 检查位置权限
    this.checkLocationPermission();
  },

  // 检查位置权限
  checkLocationPermission() {
    wx.getSetting({
      success: (res) => {
        if (res.authSetting['scope.userLocation']) {
          this.startBackgroundLocation();
        } else {
          // 未授权，引导用户授权
          this.promptLocationAuth();
        }
      },
      fail: () => {
        this.promptLocationAuth();
      }
    });
  },

  // 提示用户授权定位 - 黛青风格弹窗
  promptLocationAuth() {
    wx.showModal({
      title: '需要位置权限',
      content: '攀登需要实时定位权限以确保证据链闭环。请点击"去设置"开启定位权限。',
      confirmText: '去设置',
      cancelText: '暂不',
      confirmColor: '#D34941',
      success: (res) => {
        if (res.confirm) {
          wx.openSetting({
            success: (settingRes) => {
              if (settingRes.authSetting['scope.userLocation']) {
                this.startBackgroundLocation();
              }
            }
          });
        }
      }
    });
  },

  // 启动后台定位 - 完善fail回调
  startBackgroundLocation() {
    wx.startLocationUpdateBackground({
      success: () => {
        console.log('后台定位已启动');
      },
      fail: (err) => {
        console.error('后台定位启动失败', err);
        // 权限被拒绝时的UI反馈
        if (err.errMsg && err.errMsg.includes('auth deny')) {
          wx.showModal({
            title: '定位权限被拒绝',
            content: '攀登需要实时定位权限来检测您是否到达起点/终点。请在设置中开启定位权限。',
            confirmText: '去设置',
            confirmColor: '#D34941',
            success: (res) => {
              if (res.confirm) {
                wx.openSetting();
              }
            }
          });
        } else {
          wx.showToast({
            title: '定位失败，请检查权限',
            icon: 'none'
          });
        }
      }
    });
  },

  // 获取随机启动页文案
  getRandomSplashMessage() {
    const index = Math.floor(Math.random() * this.splashMessages.length);
    return this.splashMessages[index];
  },

  // Haversine算法计算两点距离（米）
  getDistance(lat1, lng1, lat2, lng2) {
    const R = 6371000;
    const dLat = this.toRad(lat2 - lat1);
    const dLng = this.toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  },

  toRad(deg) {
    return deg * Math.PI / 180;
  },

  // 检查是否在围栏内（支持测试模式绕过）
  isInGeofence(lat, lng, target) {
    if (this.globalData.testMode) {
      return true; // 测试模式下跳过围栏校验
    }
    const distance = this.getDistance(lat, lng, target.lat, target.lng);
    return distance <= this.GEOFENCE.RADIUS_METERS;
  },

  // 云端任务重连 (Rehydration)
  // 注意：t_workout 集合需要对 status 字段建立索引以优化查询性能
  async reconnectWorkout() {
    const db = wx.cloud.database();
    const openid = await this.getOpenId();
    
    const result = await db.collection('t_workout').where({
      _openid: openid,
      status: 'RUNNING'
    }).get();

    if (result.data && result.data.length > 0) {
      this.globalData.currentWorkout = result.data[0];
      this.globalData.currentState = this.STATE.RUNNING;
      return result.data[0];
    }
    return null;
  },

  // 获取OpenID
  getOpenId() {
    return new Promise((resolve, reject) => {
      if (this.globalData.userInfo && this.globalData.userInfo._openid) {
        resolve(this.globalData.userInfo._openid);
        return;
      }
      
      wx.cloud.callFunction({
        name: 'getOpenId',
        success: (res) => {
          resolve(res.result.openid);
        },
        fail: reject
      });
    });
  }
});
