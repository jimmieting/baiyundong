/**
 * 攀登页 - 核心 C 位
 * 完整状态机 + 地理围栏 + 计时器 + 云端持久化
 * Phase 6: 5s超时保底 + 本地优先恢复 + 每60s检查点 + 网络恢复自动同步
 */
const app = getApp();
const geo = require('../../utils/geo');
const timeUtil = require('../../utils/time');
const storage = require('../../utils/storage');
const identity = require('../../utils/identity');
const network = require('../../utils/network');

// 常量
const CHECKPOINT_INTERVAL = 60; // 状态检查点间隔（秒）
const CLOUD_TIMEOUT = 5000;     // 云操作超时（毫秒）

Page({
  data: {
    // 状态机
    state: 'IDLE', // IDLE / RUNNING / ARRIVED / COMPLETED

    // 环境层
    dateText: '',

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

    // 网络状态提示
    isOffline: false,

    // 系统
    statusBarHeight: 0,
    navBarTop: 0  // 胶囊按钮底部位置，用于顶部安全区
  },

  // 非响应式的实例变量
  _timerInterval: null,
  _locationWatcher: false,
  _currentLocation: null,
  _workoutId: null,
  _startTimestamp: null,
  _removeNetworkListener: null, // 网络恢复回调取消函数
  _pendingArrivalData: null,    // 断网时缓存的到达数据

  onLoad() {
    const systemInfo = app.globalData.systemInfo;
    if (systemInfo) {
      this.setData({ statusBarHeight: systemInfo.statusBarHeight || 44 });
    }

    // 获取胶囊按钮位置，避免内容与右上角按钮重叠
    try {
      const menuRect = wx.getMenuButtonBoundingClientRect();
      // 内容从胶囊底部 + 8px 间距开始
      this.setData({ navBarTop: menuRect.bottom + 8 });
    } catch (e) {
      this.setData({ navBarTop: (this.data.statusBarHeight || 44) + 44 });
    }

    this.setData({ isOffline: !network.isOnline() });

    // 测试模式：立即就绪，不依赖 GPS
    if (app.TEST_MODE) {
      this.setData({
        buttonEnabled: true,
        buttonText: '开始攀登',
        geoStatus: 'inside',
        geoText: '测试模式 · 围栏已跳过'
      });
    }

    this._initDate();
    this._initLocation();
    this._tryReconnect();   // 优先本地恢复，再尝试云端
    this._loadUserStats();
    this._registerNetworkRecovery();
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 });
    }
    // 刷新网络状态
    this.setData({ isOffline: !network.isOnline() });
  },

  onUnload() {
    this._clearTimer();
    this._stopLocationWatch();
    // 卸载前保存一次状态快照
    if (this.data.state === 'RUNNING') {
      this._saveCheckpoint();
    }
    // 取消网络监听
    if (this._removeNetworkListener) {
      this._removeNetworkListener();
      this._removeNetworkListener = null;
    }
  },

  onHide() {
    // 切后台时也保存检查点
    if (this.data.state === 'RUNNING') {
      this._saveCheckpoint();
    }
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

      const isTest = app.TEST_MODE;
      this.setData({
        geoStatus: isTest ? 'inside' : geo.getGeoStatus(dist),
        geoText: isTest ? '测试模式 · 围栏已跳过' : geo.getGeoText(dist, 'start'),
        buttonEnabled: inZone || isTest,
        buttonText: (inZone || isTest) ? '开始攀登' : '等待进入起点'
      });
    } else if (state === 'RUNNING') {
      // 计算到终点的距离
      const dist = geo.getDistance(
        location.latitude, location.longitude,
        geofence.END.lat, geofence.END.lng
      );
      const inZone = dist <= geofence.RADIUS;

      const isTest = app.TEST_MODE;
      this.setData({
        geoStatus: isTest ? 'inside' : geo.getGeoStatus(dist),
        geoText: isTest ? '测试模式 · 围栏已跳过' : geo.getGeoText(dist, 'end'),
        buttonEnabled: inZone || isTest,
        buttonText: (inZone || isTest) ? '确认到达' : '攀登中'
      });

      // 采样海拔数据
      storage.pushSample({
        lat: location.latitude,
        lng: location.longitude,
        alt: location.altitude || 0,
        timestamp: Date.now()
      });

      // 每60秒写一次检查点
      if (storage.getSecondsSinceCheckpoint() >= CHECKPOINT_INTERVAL) {
        this._saveCheckpoint();
      }
    }
  },

  // ========== 网络恢复监听 ==========

  _registerNetworkRecovery() {
    this._removeNetworkListener = network.onRecover(() => {
      // 网络恢复
      this.setData({ isOffline: false });

      // 如果有待提交的到达数据，自动重试
      if (this._pendingArrivalData) {
        // 自动重试到达提交
        this._syncArrivalToCloud(this._pendingArrivalData);
      }

      // 如果处于 RUNNING 状态，尝试同步当前状态到云端
      if (this.data.state === 'RUNNING' && this._workoutId) {
        this._syncRunningStateToCloud();
      }
    });
  },

  /**
   * RUNNING 状态下网络恢复，同步采样数据到云端
   */
  async _syncRunningStateToCloud() {
    try {
      const db = wx.cloud.database();
      const samples = storage.getSamples();
      if (samples.length > 0) {
        await network.withTimeout(
          db.collection('t_workout').doc(this._workoutId).update({
            data: { altitude_samples: samples }
          }),
          CLOUD_TIMEOUT,
          '同步采样数据'
        );
        // 采样数据同步成功
      }
    } catch (err) {
      console.warn('采样数据同步失败，下次恢复再试', err);
    }
  },

  // ========== 状态恢复（本地优先 + 云端兜底）==========

  /**
   * 尝试恢复进行中的攀登状态
   * 策略：先查本地快照（0延迟），再查云端记录（5s超时）
   */
  async _tryReconnect() {
    const MAX_STALE_MS = 12 * 60 * 60 * 1000; // 12小时视为过期

    // 第一步：本地快照恢复（瞬时完成）
    const localState = storage.getClimbState();
    if (localState && localState.state === 'RUNNING' && localState.workoutId) {
      // 超过12小时，视为废弃记录，直接清除
      if (localState.startTimestamp && (Date.now() - localState.startTimestamp > MAX_STALE_MS)) {
        storage.clearClimbState();
        storage.clearWorkout();
      } else {
        this._restoreFromSnapshot(localState);
        if (network.isOnline()) {
          this._verifyCloudRecord(localState.workoutId);
        }
        return;
      }
    }

    // 本地无记录，查本地 workout 缓存
    const localWorkout = storage.getWorkout();
    if (localWorkout && localWorkout.status === 'RUNNING' && localWorkout._id) {
      // 超过12小时，视为废弃
      if (localWorkout.start_timestamp && (Date.now() - localWorkout.start_timestamp > MAX_STALE_MS)) {
        storage.clearWorkout();
      } else {
        this._workoutId = localWorkout._id;
        this._startTimestamp = localWorkout.start_timestamp || Date.now();
        const isTest = app.TEST_MODE;
        this.setData({
          state: 'RUNNING',
          buttonText: isTest ? '确认到达' : '攀登中',
          buttonEnabled: isTest
        });
        this._startTimer();
        if (network.isOnline()) {
          this._verifyCloudRecord(localWorkout._id);
        }
        return;
      }
    }

    // 第二步：本地无任何记录，尝试云端恢复（5s超时）
    if (network.isOnline()) {
      this._reconnectFromCloud();
    }
  },

  /**
   * 从本地快照恢复页面状态
   */
  _restoreFromSnapshot(snapshot) {
    this._workoutId = snapshot.workoutId;
    this._startTimestamp = snapshot.startTimestamp;

    if (snapshot.currentLocation) {
      this._currentLocation = snapshot.currentLocation;
    }

    const isTest = app.TEST_MODE;
    this.setData({
      state: 'RUNNING',
      buttonText: isTest ? '确认到达' : '攀登中',
      buttonEnabled: isTest,
      geoStatus: snapshot.geoStatus || 'far',
      geoText: snapshot.geoText || '恢复中...'
    });

    this._startTimer();
  },

  /**
   * 异步校验云端记录是否仍有效
   * 如果云端记录已被终止（比如在其他端操作），则重置本地状态
   */
  async _verifyCloudRecord(docId) {
    try {
      const db = wx.cloud.database();
      const { data: record } = await network.withTimeout(
        db.collection('t_workout').doc(docId).get(),
        CLOUD_TIMEOUT,
        '校验云端记录'
      );

      if (record.status !== 'RUNNING') {
        // 云端记录已非 RUNNING，重置本地状态
        storage.clearWorkout();
        storage.clearClimbState();
        this._clearTimer();
        this._resetToIdle();
      }
    } catch (err) {
      // 校验失败不影响本地状态，下次再试
      console.warn('云端记录校验失败，保持本地状态', err);
    }
  },

  /**
   * 从云端恢复（5s超时保底）
   */
  async _reconnectFromCloud() {
    try {
      const openid = await app.getOpenId();
      const db = wx.cloud.database();

      const { data } = await network.withTimeout(
        db.collection('t_workout')
          .where({ _openid: openid, status: 'RUNNING' })
          .orderBy('start_time', 'desc')
          .limit(1)
          .get(),
        CLOUD_TIMEOUT,
        '云端重连查询'
      );

      if (data.length > 0) {
        const record = data[0];
        this._workoutId = record._id;
        this._startTimestamp = new Date(record.start_time).getTime();

        // 写入本地缓存以备下次快速恢复
        storage.saveWorkout({
          _id: record._id,
          status: 'RUNNING',
          start_timestamp: this._startTimestamp
        });

        const isTest = app.TEST_MODE;
        this.setData({
          state: 'RUNNING',
          buttonText: isTest ? '确认到达' : '攀登中',
          buttonEnabled: isTest
        });
        this._startTimer();
        this._saveCheckpoint();
      }
    } catch (err) {
      console.error('云端重连失败（可能超时）', err);
      // 超时不阻塞页面使用
    }
  },

  // ========== 加载用户数据 ==========

  async _loadUserStats() {
    try {
      const openid = await app.getOpenId();
      const db = wx.cloud.database();

      const { data: users } = await network.withTimeout(
        db.collection('t_user')
          .where({ _openid: openid })
          .limit(1)
          .get(),
        CLOUD_TIMEOUT,
        '加载用户数据'
      );

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
      // 超时或断网：保持默认值，不阻塞
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
   * 离线保底：先本地创建临时记录，联网后同步
   */
  async _startWorkout() {
    if (!this._currentLocation && !app.TEST_MODE) {
      wx.showToast({ title: '正在获取定位', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '准备中...' });

    const loc = this._currentLocation || { latitude: 0, longitude: 0, altitude: 0 };
    const startTimestamp = Date.now();

    try {
      const openid = await app.getOpenId();
      const db = wx.cloud.database();

      const { _id } = await network.withTimeout(
        db.collection('t_workout').add({
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
        }),
        CLOUD_TIMEOUT,
        '创建攀登记录'
      );

      this._workoutId = _id;
      this._startTimestamp = startTimestamp;

      storage.saveWorkout({ _id, status: 'RUNNING', start_timestamp: startTimestamp });
      this._onWorkoutStarted();
      wx.hideLoading();
      wx.showToast({ title: '攀登开始！', icon: 'none' });

    } catch (err) {
      wx.hideLoading();

      // 网络失败保底：本地启动计时，记录待同步
      if (!network.isOnline() || err.message.includes('超时')) {
        console.warn('云端创建失败，启用本地保底模式', err);
        const tempId = 'LOCAL_' + Date.now();
        this._workoutId = tempId;
        this._startTimestamp = startTimestamp;

        storage.saveWorkout({
          _id: tempId,
          status: 'RUNNING',
          start_timestamp: startTimestamp,
          isLocal: true,
          startLoc: { latitude: loc.latitude, longitude: loc.longitude },
          startAlt: loc.altitude || 0
        });

        this._onWorkoutStarted();
        wx.showToast({ title: '离线模式，攀登开始', icon: 'none' });
      } else {
        console.error('创建记录失败', err);
        wx.showToast({ title: '启动失败，请重试', icon: 'none' });
      }
    }
  },

  /**
   * 开始攀登后的通用初始化
   */
  _onWorkoutStarted() {
    // 测试模式下直接启用"确认到达"按钮，不等定位更新
    const isTest = app.TEST_MODE;
    this.setData({
      state: 'RUNNING',
      buttonText: isTest ? '确认到达' : '攀登中',
      buttonEnabled: isTest
    });
    this._startTimer();
    this._saveCheckpoint();
  },

  /**
   * 到达终点 - 更新云端记录
   * 弱网容错：缓存到达数据，网络恢复后自动同步
   */
  async _arrivedWorkout() {
    if (!this._workoutId) return;

    this._clearTimer();
    const durationSec = Math.floor((Date.now() - this._startTimestamp) / 1000);
    const elapsedText = this.data.elapsedText;

    // ===== 测试模式：完全跳过云端，直接出结果 =====
    if (app.TEST_MODE) {
      this.setData({ state: 'COMPLETED', buttonEnabled: false, buttonText: '已完成' });
      storage.clearClimbState();
      storage.clearWorkout();

      // 尝试写入云端（失败也无所谓）
      try {
        const db = wx.cloud.database();
        if (!this._workoutId.startsWith('LOCAL_')) {
          await db.collection('t_workout').doc(this._workoutId).update({
            data: { status: 'COMPLETED', end_time: db.serverDate(), duration_sec: durationSec, is_valid: true, validation_flags: ['TEST_MODE'] }
          });
        }
      } catch (e) {
        console.warn('测试模式：云端写入跳过', e);
      }

      // 测试模式完成：也弹出分享引导
      const testWorkoutId = this._workoutId;
      wx.showModal({
        title: '完成！用时 ' + elapsedText,
        content: '去查看记录并分享成绩吧',
        confirmText: '去分享',
        cancelText: '稍后',
        success: (modalRes) => {
          if (modalRes.confirm && !testWorkoutId.startsWith('LOCAL_')) {
            wx.navigateTo({
              url: `/pages/record/record?id=${testWorkoutId}`
            });
          }
        }
      });
      setTimeout(() => {
        this._resetToIdle();
      }, 500);
      return;
    }

    // ===== 正式模式：完整云端流程 =====
    wx.showLoading({ title: '确认中...' });

    const loc = this._currentLocation || { latitude: 0, longitude: 0, altitude: 0 };
    const samples = storage.getSamples();

    const arrivalData = {
      workoutId: this._workoutId,
      endLoc: { latitude: loc.latitude, longitude: loc.longitude },
      endAlt: loc.altitude || 0,
      samples: samples,
      isLocal: this._workoutId.startsWith('LOCAL_')
    };

    this.setData({
      state: 'ARRIVED',
      buttonEnabled: false,
      buttonText: '校验中...',
      geoText: '已到达白云洞主洞平台'
    });

    wx.hideLoading();

    if (network.isOnline()) {
      await this._syncArrivalToCloud(arrivalData);
    } else {
      console.warn('离线状态，缓存到达数据等待同步');
      this._pendingArrivalData = arrivalData;
      storage.saveWorkout({
        _id: this._workoutId,
        status: 'ARRIVED',
        start_timestamp: this._startTimestamp,
        arrivalData: arrivalData
      });
      wx.showToast({ title: '已缓存，联网后自动同步', icon: 'none', duration: 3000 });
    }
  },

  /**
   * 将到达数据同步到云端
   */
  async _syncArrivalToCloud(arrivalData) {
    try {
      const db = wx.cloud.database();

      // 如果是本地创建的记录，先同步创建到云端
      if (arrivalData.isLocal) {
        const openid = await app.getOpenId();
        const localWorkout = storage.getWorkout();

        const { _id } = await network.withTimeout(
          db.collection('t_workout').add({
            data: {
              _openid: openid,
              status: 'ARRIVED',
              start_time: new Date(this._startTimestamp),
              end_time: db.serverDate(),
              start_loc: localWorkout.startLoc || { latitude: 0, longitude: 0 },
              end_loc: arrivalData.endLoc,
              start_alt: localWorkout.startAlt || 0,
              end_alt: arrivalData.endAlt,
              altitude_samples: arrivalData.samples,
              is_anonymous: !(app.globalData.userInfo && app.globalData.userInfo.identity === 'HONOR'),
              is_valid: false,
              validation_flags: [],
              appeal_status: 'NONE'
            }
          }),
          CLOUD_TIMEOUT,
          '同步本地记录到云端'
        );

        // 更新 workoutId 为真实的云端 ID
        this._workoutId = _id;
        arrivalData.workoutId = _id;
        // 本地记录已同步到云端

      } else {
        // 正常云端记录，更新到达数据
        await network.withTimeout(
          db.collection('t_workout').doc(arrivalData.workoutId).update({
            data: {
              status: 'ARRIVED',
              end_time: db.serverDate(),
              end_loc: arrivalData.endLoc,
              end_alt: arrivalData.endAlt,
              altitude_samples: arrivalData.samples
            }
          }),
          CLOUD_TIMEOUT,
          '更新到达数据'
        );
      }

      // 清除待提交缓存
      this._pendingArrivalData = null;
      storage.clearWorkout();

      // 调用校验
      this._validateAndComplete();

    } catch (err) {
      console.error('云端同步到达数据失败', err);

      // 加入待同步队列
      if (!arrivalData.isLocal) {
        network.addPendingSync({
          type: 'UPDATE_WORKOUT',
          data: {
            docId: arrivalData.workoutId,
            updateData: {
              status: 'ARRIVED',
              end_time: new Date(),
              end_loc: arrivalData.endLoc,
              end_alt: arrivalData.endAlt,
              altitude_samples: arrivalData.samples
            }
          }
        });
      }

      // 缓存到达数据
      this._pendingArrivalData = arrivalData;

      // 区分云函数未部署和网络问题
      const errMsg = (err && err.message) || '';
      const isNotDeployed = errMsg.includes('not found') || errMsg.includes('-404') || errMsg.includes('FunctionName');

      if (isNotDeployed) {
        wx.showModal({
          title: '云函数/数据库未就绪',
          content: '请先在微信开发者工具中创建数据库集合 t_workout 并部署全部云函数',
          showCancel: false
        });
      } else {
        wx.showToast({ title: '同步失败，网络恢复后自动重试', icon: 'none', duration: 3000 });
      }

      // 3秒后重置状态，避免永远卡在"校验中"
      setTimeout(() => this._resetToIdle(), 3000);
    }
  },

  /**
   * 调用 validateRecord 云函数进行服务端校验
   * 带 5s 超时 + 重试
   */
  async _validateAndComplete() {
    try {
      const { result } = await network.withRetry(
        () => network.withTimeout(
          wx.cloud.callFunction({
            name: 'validateRecord',
            data: { workoutId: this._workoutId }
          }),
          CLOUD_TIMEOUT,
          '记录校验'
        ),
        1, // 失败后再试1次
        2000
      );

      if (result.success) {
        this.setData({ state: result.status });

        if (result.isValid) {
          // 校验通过：弹出分享提示，引导用户去记录页生成海报
          wx.showModal({
            title: '挑战成功！',
            content: '太棒了！去分享你的攀登成绩吧',
            confirmText: '去分享',
            cancelText: '稍后再说',
            success: (modalRes) => {
              wx.navigateTo({
                url: `/pages/record/record?id=${this._workoutId}`
              });
            }
          });
        } else {
          wx.showModal({
            title: '记录异常',
            content: result.reasons.join('；'),
            confirmText: '查看详情',
            showCancel: false,
            success: () => {
              wx.navigateTo({
                url: `/pages/record/record?id=${this._workoutId}`
              });
            }
          });
        }

        setTimeout(() => this._resetToIdle(), 500);
      } else {
        wx.showModal({
          title: '校验失败',
          content: result.error || '服务端返回错误，记录已保存',
          showCancel: false
        });
        setTimeout(() => this._resetToIdle(), 500);
      }
    } catch (err) {
      console.error('校验云函数调用失败', err);

      // 校验失败，加入待同步队列稍后重试
      network.addPendingSync({
        type: 'CALL_FUNCTION',
        data: {
          name: 'validateRecord',
          params: { workoutId: this._workoutId }
        }
      });

      // 区分云函数未部署和网络问题
      const errMsg = (err && err.message) || '';
      const isNotDeployed = errMsg.includes('not found') || errMsg.includes('-404') || errMsg.includes('FunctionName');
      wx.showModal({
        title: isNotDeployed ? '云函数未部署' : '网络不稳定',
        content: isNotDeployed
          ? '请先在微信开发者工具中部署 validateRecord 云函数'
          : '记录已保存，校验结果将在网络恢复后更新',
        showCancel: false
      });

      setTimeout(() => this._resetToIdle(), 500);
    }
  },

  _resetToIdle() {
    this._workoutId = null;
    this._startTimestamp = null;
    this._pendingArrivalData = null;

    storage.clearClimbState();

    const isTest = app.TEST_MODE;
    this.setData({
      state: 'IDLE',
      elapsed: 0,
      elapsedText: '00:00',
      buttonEnabled: isTest,
      buttonText: isTest ? '开始攀登' : '等待定位',
      geoStatus: isTest ? 'inside' : 'far',
      geoText: isTest ? '测试模式 · 围栏已跳过' : '定位中...'
    });

    this._loadUserStats();
  },

  // ========== 状态检查点 ==========

  /**
   * 保存状态快照到本地
   * 计时中每60秒自动调用一次 + 状态变更/切后台时调用
   */
  _saveCheckpoint() {
    if (this.data.state !== 'RUNNING') return;

    storage.saveClimbState({
      state: 'RUNNING',
      workoutId: this._workoutId,
      startTimestamp: this._startTimestamp,
      elapsed: this.data.elapsed,
      geoStatus: this.data.geoStatus,
      geoText: this.data.geoText,
      currentLocation: this._currentLocation
        ? {
            latitude: this._currentLocation.latitude,
            longitude: this._currentLocation.longitude,
            altitude: this._currentLocation.altitude
          }
        : null
    });

    // 检查点已保存
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

      // 每60秒触发一次检查点
      if (elapsed % CHECKPOINT_INTERVAL === 0 && elapsed > 0) {
        this._saveCheckpoint();
      }
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
