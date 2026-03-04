// 白云洞登山局 - 攀登页面逻辑 V1.0
// 核心哲学：向上的秩序

const app = getApp();
const db = wx.cloud.database();

Page({
  data: {
    // 启动页
    showSplash: true,
    splashMessage: '',
    
    // 顶部安全边距
    statusBarHeight: 20,

    // 海拔状态
    currentAltitude: null,
    altitudeStatus: '海拔信号搜索中...',

    // 环境数据
    date: '',
    weatherIcon: '☀️',
    temperature: '--',

    // 状态机
    currentState: 'IDLE',

    // 测试模式
    testMode: false,

    // 地理围栏状态
    geofenceClass: 'far',
    geofenceText: '等待定位...',
    distanceToStart: null,
    distanceToEnd: null,

    // 计时相关
    elapsedTime: '00:00',
    timerInterval: null,
    startTime: null,
    startTimestamp: null,  // 本地时间戳用于计时
    timerProgress: 0,

    // 按钮状态
    buttonText: '开始攀登',
    buttonClass: '',
    canStart: false,

    // 用户数据
    personalPB: null,
    totalClimbs: 0,
    totalAscent: 0,

    // 网络状态
    showNetworkTip: false
  },

  onLoad() {
    // ====== L1 优先级：第一时间显示启动页 ======
    this.setData({ showSplash: true });
    
    // 获取系统信息计算顶部安全边距
    wx.getSystemInfo({
      success: (res) => {
        this.setData({
          statusBarHeight: res.statusBarHeight || 20
        });
      }
    });
    
    // 并行初始化：启动页文案 + 日期 + 定位 + 用户数据 + 云端任务
    this.initSplash();
    this.initDate();
    this.initLocation();
    this.loadUserStats();
    this.reconnectWorkout();
    
    // 获取测试模式
    this.setData({
      testMode: app.globalData.testMode
    });
    
    // L1完成后隐藏启动页（定位成功或超时后）
    setTimeout(() => {
      this.setData({ showSplash: false });
    }, 2000);
  },

  onShow() {
    // 每次显示时检查状态
    if (this.data.currentState === 'RUNNING') {
      this.startTimer();
    }
  },

  onHide() {
    if (this.data.timerInterval) {
      clearInterval(this.data.timerInterval);
    }
  },

  // 初始化启动页
  initSplash() {
    const message = app.getRandomSplashMessage();
    this.setData({
      showSplash: app.globalData.showSplash,
      splashMessage: message
    });
  },

  // 初始化日期
  initDate() {
    const now = new Date();
    const months = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
    const days = ['日', '一', '二', '三', '四', '五', '六'];
    this.setData({
      date: `${months[now.getMonth()]}${now.getDate()}日 星期${days[now.getDay()]}`
    });
  },

  // 初始化定位
  initLocation() {
    wx.startLocationUpdateBackground({
      success: () => {
        this.updateLocation();
        this.locationTimer = setInterval(() => {
          this.updateLocation();
        }, 3000);
      },
      fail: (err) => {
        console.error('定位失败', err);
        this.setData({
          geofenceText: '定位失败，请检查权限'
        });
      }
    });

    wx.onLocationChange((res) => {
      this.handleLocationChange(res.latitude, res.longitude, res.altitude);
    });
  },

  // 更新位置
  async updateLocation() {
    try {
      const location = await wx.getLocation({
        type: 'gcj02',
        isHighAccuracy: true
      });
      this.handleLocationChange(location.latitude, location.longitude, location.altitude);
    } catch (err) {
      console.error('获取位置失败', err);
    }
  },

  // 处理位置变化
  handleLocationChange(lat, lng, altitude) {
    const { GEOFENCE, STATE } = app;
    const currentState = this.data.currentState;
    const { testMode } = this.data;

    // 处理海拔数据
    let altitudeStatus = '海拔信号搜索中...';
    let currentAltitude = null;
    if (altitude && altitude > 0) {
      currentAltitude = Math.round(altitude);
      altitudeStatus = `海拔 ${currentAltitude}m`;
    }

    const distToStart = app.getDistance(lat, lng, GEOFENCE.START.lat, GEOFENCE.START.lng);
    const distToEnd = app.getDistance(lat, lng, GEOFENCE.END.lat, GEOFENCE.END.lng);

    this.setData({
      distanceToStart: distToStart,
      distanceToEnd: distToEnd,
      currentAltitude: currentAltitude,
      altitudeStatus: altitudeStatus
    });

    this.updateGeofenceUI(distToStart, distToEnd, currentState);

    // IDLE状态下：检查是否可以开始
    if (currentState === STATE.IDLE) {
      const canStart = testMode || (distToStart <= GEOFENCE.RADIUS_METERS);
      this.setData({ canStart });
    }
  },

  // 更新地理围栏UI
  updateGeofenceUI(distToStart, distToEnd, currentState) {
    const { GEOFENCE } = app;
    const { testMode } = this.data;

    if (currentState === 'IDLE') {
      if (testMode || distToStart <= GEOFENCE.RADIUS_METERS) {
        this.setData({
          geofenceClass: 'inside',
          geofenceText: testMode ? '[测试模式] 已进入起点区域' : '已进入起点区域，准备开始'
        });
      } else if (distToStart <= 100) {
        this.setData({
          geofenceClass: 'near',
          geofenceText: `距离起点 ${Math.round(distToStart)} 米`
        });
      } else {
        this.setData({
          geofenceClass: 'far',
          geofenceText: `距离起点 ${Math.round(distToStart)} 米`
        });
      }
    } else if (currentState === 'RUNNING') {
      if (testMode || distToEnd <= GEOFENCE.RADIUS_METERS) {
        this.setData({
          geofenceClass: 'inside',
          geofenceText: testMode ? '[测试模式] 已进入终点区域' : '已进入终点区域，点击到达'
        });
      } else if (distToEnd <= 100) {
        this.setData({
          geofenceClass: 'near',
          geofenceText: `距离终点 ${Math.round(distToEnd)} 米`
        });
      } else {
        this.setData({
          geofenceClass: 'far',
          geofenceText: `距离终点 ${Math.round(distToEnd)} 米`
        });
      }
    }
  },

  // 加载用户统计
  async loadUserStats() {
    try {
      const openid = await app.getOpenId();
      const userRes = await db.collection('t_user').where({
        _openid: openid
      }).limit(1).get();

      if (userRes.data && userRes.data.length > 0) {
        const user = userRes.data[0];
        this.setData({
          personalPB: this.formatDuration(user.personal_pb),
          totalClimbs: user.total_climbs || 0,
          totalAscent: user.total_ascent || 0
        });
      }
    } catch (err) {
      console.error('加载用户统计失败', err);
    }
  },

  // 云端任务重连
  async reconnectWorkout() {
    try {
      const workout = await app.reconnectWorkout();
      if (workout) {
        // 计算已过时间
        const startDate = new Date(workout.start_time);
        const startTimestamp = startDate.getTime();
        
        this.setData({
          currentState: 'RUNNING',
          startTime: workout._id,
          startTimestamp: startTimestamp,
          buttonText: '到达终点'
        });
        this.startTimer();
      }
    } catch (err) {
      console.error('重连失败', err);
    }
  },

  // 按钮点击处理
  async handleButtonTap() {
    const { currentState } = this.data;
    const { STATE, GEOFENCE, globalData } = app;

    // 测试模式跳过围栏校验
    if (globalData.testMode) {
      if (currentState === STATE.IDLE) {
        await this.startWorkout();
      } else if (currentState === STATE.RUNNING) {
        await this.endWorkout();
      }
      return;
    }

    // 正式模式：严格执行50m围栏校验
    if (currentState === STATE.IDLE) {
      if (this.data.canStart) {
        await this.startWorkout();
      } else {
        wx.showToast({ title: '请先到达起点围栏', icon: 'none' });
      }
    } else if (currentState === STATE.RUNNING) {
      if (this.data.canEnd) {
        await this.endWorkout();
      } else {
        wx.showToast({ title: '请先到达终点围栏', icon: 'none' });
      }
    }
  },

  // 地理状态条点击 - 重新授权定位
  reAuthLocation() {
    wx.vibrateShort();
    wx.getSetting({
      success: (res) => {
        if (!res.authSetting['scope.userLocation']) {
          wx.showModal({
            title: '需要位置权限',
            content: '攀登需要位置权限来检测您是否到达起点/终点。请前往设置开启。',
            confirmText: '去设置',
            confirmColor: '#D34941',
            success: (result) => {
              if (result.confirm) {
                wx.openSetting();
              }
            }
          });
        } else {
          wx.showToast({ title: '定位已开启', icon: 'success' });
        }
      }
    });
  },

  // 开始攀登
  async startWorkout() {
    try {
      let location;
      try {
        location = await wx.getLocation({
          type: 'gcj02',
          isHighAccuracy: true
        });
      } catch (locErr) {
        console.warn('获取定位失败，使用默认坐标', locErr);
        location = { latitude: 0, longitude: 0, altitude: 0 };
      }

      const startTime = db.serverDate();
      const timestamp = Date.now(); // 本地时间戳用于计时

      try {
        await db.collection('t_workout').add({
          data: {
            status: 'RUNNING',
            start_time: startTime,
            start_loc: {
              latitude: location.latitude,
              longitude: location.longitude
            },
            start_alt: location.altitude || 0,
            is_anonymous: true,
            appeal_status: 'NONE'
          }
        });
      } catch (dbErr) {
        console.warn('云端记录创建失败，继续本地计时', dbErr);
      }

      this.setData({
        currentState: 'RUNNING',
        startTime: '',
        startTimestamp: timestamp,
        buttonText: '到达终点',
        buttonClass: 'arrived',
        canStart: false
      });

      // 立即启动计时器
      this.startTimer();
      
      wx.showToast({ title: '开始攀登！', icon: 'success' });

    } catch (err) {
      console.error('开始攀登失败', err);
      wx.showToast({
        title: '开始失败，请重试',
        icon: 'none'
      });
    }
  },

  // 结束攀登
  async endWorkout() {
    wx.showLoading({ title: '保存中...' });
    
    try {
      let location;
      try {
        location = await wx.getLocation({
          type: 'gcj02',
          isHighAccuracy: true
        });
      } catch (locErr) {
        location = { latitude: 0, longitude: 0, altitude: 0 };
      }

      const endTime = db.serverDate();
      const durationSec = Math.floor((Date.now() - this.data.startTimestamp) / 1000);
      const openid = await app.getOpenId();

      // 保存记录 - 状态设为COMPLETED
      await db.collection('t_workout').doc(this.data.startTime).update({
        data: {
          status: 'COMPLETED',
          end_time: endTime,
          duration_sec: durationSec,
          end_loc: {
            latitude: location.latitude,
            longitude: location.longitude
          },
          end_alt: location.altitude || 0,
          _openid: openid  // 确保绑定openid
        }
      });

      // 更新PB
      await this.updatePersonalPB(durationSec);

      wx.hideLoading();

      if (this.data.timerInterval) {
        clearInterval(this.data.timerInterval);
      }

      // 跳转到记录详情页
      wx.redirectTo({
        url: `/pages/recordDetail/recordDetail?id=${this.data.startTime}`
      });

    } catch (err) {
      console.error('结束挑战失败', err);
      wx.hideLoading();
      wx.showToast({
        title: '保存失败，请重试',
        icon: 'none'
      });
    }
  },

  // 启动计时器
  startTimer() {
    if (this.data.timerInterval) {
      clearInterval(this.data.timerInterval);
    }

    this.data.timerInterval = setInterval(() => {
      if (this.data.startTimestamp) {
        const now = Date.now();
        const elapsed = Math.floor((now - this.data.startTimestamp) / 1000);

        this.setData({
          elapsedTime: this.formatDuration(elapsed),
          timerProgress: Math.min(elapsed / 3600, 1)  // 1小时=100%
        });
      }
    }, 1000);
  },

  // 格式化时长
  formatDuration(seconds) {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  },

  // 增加挑战次数
  async incrementClimbCount() {
    try {
      const openid = await app.getOpenId();
      await db.collection('t_user').where({
        _openid: openid
      }).limit(1).update({
        data: {
          total_climbs: db.command.inc(1)
        }
      });
    } catch (err) {
      console.error('更新挑战次数失败', err);
    }
  },

  // 更新个人最佳成绩
  async updatePersonalPB(durationSec) {
    try {
      const openid = await app.getOpenId();
      
      // 先获取当前PB
      const userRes = await db.collection('t_user').where({
        _openid: openid
      }).limit(1).get();

      const currentPB = userRes.data[0]?.personal_pb || 0;
      
      // 如果打破纪录或无PB，则更新
      if (currentPB === 0 || durationSec < currentPB) {
        await db.collection('t_user').where({
          _openid: openid
        }).limit(1).update({
          data: {
            personal_pb: durationSec
          }
        });
        wx.showToast({ title: '🎉 打破个人纪录！', icon: 'none' });
      }
    } catch (err) {
      console.error('更新PB失败', err);
    }
  },

  // 长按标题5秒开启测试模式
  enableTestMode() {
    let pressTime = 0;
    const interval = setInterval(() => {
      pressTime += 100;
      if (pressTime >= 5000) {
        clearInterval(interval);
        app.globalData.testMode = true;
        this.setData({ testMode: true });
        wx.showToast({ title: '测试模式已开启', icon: 'none' });
      }
    }, 100);
    
    setTimeout(() => clearInterval(interval), 5000);
  },

  onUnload() {
    if (this.data.timerInterval) {
      clearInterval(this.data.timerInterval);
    }
    if (this.locationTimer) {
      clearInterval(this.locationTimer);
    }
  }
});
