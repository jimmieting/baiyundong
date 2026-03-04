/**
 * 攀登页 - 核心 C 位
 * 完整状态机 + 地理围栏 + 计时器 + 云端持久化
 */
const app = getApp();
const geo = require('../../utils/geo');
const timeUtil = require('../../utils/time');
const storage = require('../../utils/storage');
const identity = require('../../utils/identity');
const weather = require('../../utils/weather');

Page({
  data: {
    // 状态机
    state: 'IDLE', // IDLE / RUNNING / ARRIVED / COMPLETED

    // 环境层
    dateText: '',
    weatherIcon: '--',
    temperature: '--',

    // 地理状态条
    geoStatus: 'far',
    geoText: '定位中...',

    // 核心数据（非计时态）
    totalClimbs: 0,
    personalPB: '--',

    // 核心数据（计时态）
    elapsed: 0,
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

  // 非响应式的实例变量
  _timerInterval: null,
  _locationWatcher: false,
  _currentLocation: null,
  _workoutId: null,
  _startTimestamp: null,

  onLoad() {
    const systemInfo = app.globalData.systemInfo;
    if (systemInfo) {
      this.setData({ statusBarHeight: systemInfo.statusBarHeight || 44 });
    }

    this._initDate();
    this._initLocation();
    this._reconnectFromCloud();
    this._loadUserStats();
    this._loadWeather();
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 });
    }
  },

  onUnload() {
    this._clearTimer();
    this._stopLocationWatch();
  },

  // ========== 初始化 ==========

  _initDate() {
    const now = new Date();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
    this.setData({
      dateText: `${month}月${day}日 周${weekDays[now.getDay()]}`
    });
  },

  /**
   * 初始化定位
   */
  _initLocation() {
    wx.getSetting({
      success: (res) => {
        if (res.authSetting['scope.userLocation']) {
          this._startLocationWatch();
        } else {
          wx.authorize({
            scope: 'scope.userLocation',
            success: () => this._startLocationWatch(),
            fail: () => {
              this.setData({
                geoText: '请授权位置权限',
                buttonText: '需要定位'
              });
            }
          });
        }
      }
    });
  },

  /**
   * 启动实时定位监听
   */
  _startLocationWatch() {
    if (this._locationWatcher) return;

    wx.startLocationUpdateBackground({
      success: () => {
        this._locationWatcher = true;
        wx.onLocationChange((loc) => this._onLocationUpdate(loc));
      },
      fail: () => {
        // 降级为前台定位
        wx.startLocationUpdate({
          success: () => {
            this._locationWatcher = true;
            wx.onLocationChange((loc) => this._onLocationUpdate(loc));
          },
          fail: () => {
            this.setData({ geoText: '定位启动失败' });
          }
        });
      }
    });
  },

  _stopLocationWatch() {
    if (this._locationWatcher) {
      wx.stopLocationUpdate({});
      this._locationWatcher = false;
    }
  },

  /**
   * 位置更新回调
   */
  _onLocationUpdate(location) {
    this._currentLocation = location;
    storage.saveLastLocation(location);

    const state = this.data.state;
    const geofence = app.GEOFENCE;

    if (state === 'IDLE') {
      // 计算到起点的距离
      const dist = geo.getDistance(
        location.latitude, location.longitude,
        geofence.START.lat, geofence.START.lng
      );
      const inZone = dist <= geofence.RADIUS;

      this.setData({
        geoStatus: geo.getGeoStatus(dist),
        geoText: geo.getGeoText(dist, 'start'),
        buttonEnabled: inZone || app.TEST_MODE,
        buttonText: inZone ? '开始攀登' : '等待进入起点'
      });
    } else if (state === 'RUNNING') {
      // 计算到终点的距离
      const dist = geo.getDistance(
        location.latitude, location.longitude,
        geofence.END.lat, geofence.END.lng
      );
      const inZone = dist <= geofence.RADIUS;

      this.setData({
        geoStatus: geo.getGeoStatus(dist),
        geoText: geo.getGeoText(dist, 'end'),
        buttonEnabled: inZone || app.TEST_MODE,
        buttonText: inZone ? '确认到达' : '攀登中'
      });

      // 采样海拔数据
      storage.pushSample({
        lat: location.latitude,
        lng: location.longitude,
        alt: location.altitude || 0,
        timestamp: Date.now()
      });
    }
  },

  // ========== 云端重连 ==========

  async _reconnectFromCloud() {
    try {
      const openid = await app.getOpenId();
      const db = wx.cloud.database();

      const { data } = await db.collection('t_workout')
        .where({ _openid: openid, status: 'RUNNING' })
        .orderBy('start_time', 'desc')
        .limit(1)
        .get();

      if (data.length > 0) {
        const record = data[0];
        this._workoutId = record._id;
        this._startTimestamp = new Date(record.start_time).getTime();

        this.setData({
          state: 'RUNNING',
          buttonText: '攀登中'
        });
        this._startTimer();
        console.log('已从云端恢复任务', record._id);
      }
    } catch (err) {
      console.error('云端重连失败', err);
    }
  },

  // ========== 加载用户数据 ==========

  async _loadUserStats() {
    try {
      const openid = await app.getOpenId();
      const db = wx.cloud.database();

      const { data: users } = await db.collection('t_user')
        .where({ _openid: openid })
        .limit(1)
        .get();

      if (users.length > 0) {
        const user = users[0];
        app.globalData.userInfo = user;

        this.setData({
          totalClimbs: user.total_climbs || 0,
          personalPB: user.personal_pb
            ? timeUtil.formatDuration(user.personal_pb)
            : '--',
          yearClimbs: user.total_climbs || 0,
          yearAscent: user.total_ascent || 0
        });
      }
    } catch (err) {
      console.error('加载用户数据失败', err);
    }
  },

  // ========== 天气 ==========

  async _loadWeather() {
    try {
      // 使用白云洞附近坐标
      const result = await weather.fetchWeather(26.073, 119.381);
      this.setData({
        weatherIcon: result.icon,
        temperature: result.temp
      });
    } catch (err) {
      console.error('天气加载失败', err);
    }
  },

  // ========== 按钮交互 ==========

  handleButtonTap() {
    if (!this.data.buttonEnabled) return;

    if (this.data.state === 'IDLE') {
      this._startWorkout();
    } else if (this.data.state === 'RUNNING') {
      this._arrivedWorkout();
    }
  },

  /**
   * 开始攀登 - 创建云端记录
   */
  async _startWorkout() {
    if (!this._currentLocation && !app.TEST_MODE) {
      wx.showToast({ title: '正在获取定位', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '准备中...' });

    try {
      const openid = await app.getOpenId();
      const db = wx.cloud.database();
      const loc = this._currentLocation || { latitude: 0, longitude: 0, altitude: 0 };

      const { _id } = await db.collection('t_workout').add({
        data: {
          _openid: openid,
          status: 'RUNNING',
          start_time: db.serverDate(),
          end_time: null,
          duration_sec: 0,
          start_loc: { latitude: loc.latitude, longitude: loc.longitude },
          end_loc: null,
          start_alt: loc.altitude || 0,
          end_alt: 0,
          altitude_samples: [],
          is_anonymous: !(app.globalData.userInfo && app.globalData.userInfo.identity === 'HONOR'),
          is_valid: false,
          validation_flags: [],
          appeal_status: 'NONE'
        }
      });

      this._workoutId = _id;
      this._startTimestamp = Date.now();

      storage.saveWorkout({ _id, status: 'RUNNING', start_timestamp: this._startTimestamp });

      this.setData({
        state: 'RUNNING',
        buttonText: '攀登中',
        buttonEnabled: false
      });

      this._startTimer();
      wx.hideLoading();
      wx.showToast({ title: '攀登开始！', icon: 'none' });
    } catch (err) {
      wx.hideLoading();
      console.error('创建记录失败', err);
      wx.showToast({ title: '启动失败，请重试', icon: 'none' });
    }
  },

  /**
   * 到达终点 - 更新云端记录
   */
  async _arrivedWorkout() {
    if (!this._workoutId) return;

    wx.showLoading({ title: '确认中...' });

    try {
      const db = wx.cloud.database();
      const loc = this._currentLocation || { latitude: 0, longitude: 0, altitude: 0 };
      const samples = storage.getSamples();

      await db.collection('t_workout').doc(this._workoutId).update({
        data: {
          status: 'ARRIVED',
          end_time: db.serverDate(),
          end_loc: { latitude: loc.latitude, longitude: loc.longitude },
          end_alt: loc.altitude || 0,
          altitude_samples: samples
        }
      });

      this._clearTimer();
      storage.clearWorkout();

      this.setData({
        state: 'ARRIVED',
        buttonEnabled: false,
        buttonText: '校验中...',
        geoText: '已到达白云洞主洞平台'
      });

      wx.hideLoading();

      // 调用云函数执行服务端三重校验
      this._validateAndComplete();
    } catch (err) {
      wx.hideLoading();
      console.error('更新记录失败', err);
      wx.showToast({ title: '提交失败，请重试', icon: 'none' });
    }
  },

  /**
   * 调用 validateRecord 云函数进行服务端校验
   */
  async _validateAndComplete() {
    try {
      const { result } = await wx.cloud.callFunction({
        name: 'validateRecord',
        data: { workoutId: this._workoutId }
      });

      if (result.success) {
        this.setData({ state: result.status });

        if (result.isValid) {
          wx.showToast({ title: '挑战成功！', icon: 'success' });
        } else {
          wx.showModal({
            title: '记录异常',
            content: result.reasons.join('；'),
            showCancel: false
          });
        }

        // 跳转到记录详情
        wx.navigateTo({
          url: `/pages/record/record?id=${this._workoutId}`
        });

        setTimeout(() => this._resetToIdle(), 500);
      } else {
        wx.showToast({ title: '校验失败：' + result.error, icon: 'none' });
      }
    } catch (err) {
      console.error('校验云函数调用失败', err);
      wx.showToast({ title: '校验失败，请稍后重试', icon: 'none' });
    }
  },

  _resetToIdle() {
    this._workoutId = null;
    this._startTimestamp = null;

    this.setData({
      state: 'IDLE',
      elapsed: 0,
      elapsedText: '00:00',
      buttonEnabled: false,
      buttonText: '等待定位',
      geoStatus: 'far',
      geoText: '定位中...'
    });

    this._loadUserStats();
  },

  // ========== 计时器 ==========

  _startTimer() {
    this._clearTimer();
    this._timerInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - this._startTimestamp) / 1000);
      this.setData({
        elapsed,
        elapsedText: timeUtil.formatDuration(elapsed)
      });
    }, 1000);
  },

  _clearTimer() {
    if (this._timerInterval) {
      clearInterval(this._timerInterval);
      this._timerInterval = null;
    }
  },

  goHistory() {
    wx.navigateTo({ url: '/pages/history/history' });
  }
});
