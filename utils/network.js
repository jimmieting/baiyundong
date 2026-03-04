/**
 * 网络状态管理模块
 * 监听网络变化、超时包装、失败操作排队重试
 */

let _isOnline = true;
let _networkType = 'unknown';
const _listeners = []; // 网络恢复回调列表

/**
 * 初始化网络监听
 * 在 app.js onLaunch 中调用
 */
function init() {
  // 获取当前网络状态
  wx.getNetworkType({
    success: (res) => {
      _networkType = res.networkType;
      _isOnline = res.networkType !== 'none';
    }
  });

  // 监听网络变化
  wx.onNetworkStatusChange((res) => {
    const wasOffline = !_isOnline;
    _isOnline = res.isConnected;
    _networkType = res.networkType;

    console.log(`网络状态变化: ${_networkType}, 在线: ${_isOnline}`);

    // 从离线恢复到在线，触发所有恢复回调
    if (wasOffline && _isOnline) {
      console.log('网络恢复，触发同步回调...');
      _flushPendingSync();
      _notifyListeners();
    }
  });
}

/**
 * 当前是否在线
 */
function isOnline() {
  return _isOnline;
}

/**
 * 获取网络类型
 */
function getNetworkType() {
  return _networkType;
}

/**
 * 注册网络恢复回调
 * @param {Function} fn 网络恢复时执行的函数
 * @returns {Function} 取消注册的函数
 */
function onRecover(fn) {
  _listeners.push(fn);
  return () => {
    const idx = _listeners.indexOf(fn);
    if (idx > -1) _listeners.splice(idx, 1);
  };
}

function _notifyListeners() {
  _listeners.forEach(fn => {
    try { fn(); } catch (e) { console.error('网络恢复回调执行失败', e); }
  });
}

// ========== 待同步队列 ==========

const PENDING_KEY = 'pending_sync_queue';

/**
 * 将失败的云操作加入待同步队列
 * @param {object} operation { type, data, timestamp }
 */
function addPendingSync(operation) {
  try {
    const queue = wx.getStorageSync(PENDING_KEY) || [];
    queue.push({
      ...operation,
      timestamp: Date.now(),
      retryCount: 0
    });
    wx.setStorageSync(PENDING_KEY, queue);
    console.log('已加入待同步队列', operation.type);
  } catch (e) {
    console.error('加入待同步队列失败', e);
  }
}

/**
 * 获取待同步队列
 */
function getPendingSync() {
  try {
    return wx.getStorageSync(PENDING_KEY) || [];
  } catch (e) {
    return [];
  }
}

/**
 * 清空待同步队列
 */
function clearPendingSync() {
  try {
    wx.removeStorageSync(PENDING_KEY);
  } catch (e) {
    console.error('清空待同步队列失败', e);
  }
}

/**
 * 移除队列中指定索引的项
 */
function removePendingAt(index) {
  try {
    const queue = wx.getStorageSync(PENDING_KEY) || [];
    queue.splice(index, 1);
    wx.setStorageSync(PENDING_KEY, queue);
  } catch (e) {
    console.error('移除队列项失败', e);
  }
}

/**
 * 网络恢复后，逐条执行待同步操作
 */
async function _flushPendingSync() {
  const queue = getPendingSync();
  if (queue.length === 0) return;

  console.log(`开始同步 ${queue.length} 条待处理操作`);

  // 逐条处理，成功则移除
  for (let i = queue.length - 1; i >= 0; i--) {
    const op = queue[i];
    try {
      if (op.type === 'UPDATE_WORKOUT') {
        const db = wx.cloud.database();
        await db.collection('t_workout').doc(op.data.docId).update({
          data: op.data.updateData
        });
        removePendingAt(i);
        console.log('同步成功', op.type, op.data.docId);
      } else if (op.type === 'CALL_FUNCTION') {
        await wx.cloud.callFunction({
          name: op.data.name,
          data: op.data.params
        });
        removePendingAt(i);
        console.log('同步成功', op.type, op.data.name);
      }
    } catch (err) {
      console.error('同步失败，保留在队列中', op.type, err);
      // 超过3次重试则放弃
      if (op.retryCount >= 3) {
        removePendingAt(i);
        console.warn('超过最大重试次数，丢弃操作', op.type);
      } else {
        // 更新重试计数
        op.retryCount++;
        const q = wx.getStorageSync(PENDING_KEY) || [];
        q[i] = op;
        wx.setStorageSync(PENDING_KEY, q);
      }
    }
  }
}

// ========== 超时包装器 ==========

/**
 * 为 Promise 添加超时限制
 * @param {Promise} promise 原始 Promise
 * @param {number} ms 超时毫秒数，默认 5000ms
 * @param {string} label 用于日志标识
 * @returns {Promise}
 */
function withTimeout(promise, ms = 5000, label = '') {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`操作超时(${ms}ms): ${label}`));
    }, ms);

    promise
      .then(res => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch(err => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

/**
 * 带重试的 Promise 执行
 * @param {Function} fn 返回 Promise 的函数
 * @param {number} retries 重试次数
 * @param {number} delay 重试间隔(ms)
 * @returns {Promise}
 */
async function withRetry(fn, retries = 2, delay = 1000) {
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === retries) throw err;
      console.log(`重试第${i + 1}次，${delay}ms后...`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

module.exports = {
  init,
  isOnline,
  getNetworkType,
  onRecover,
  addPendingSync,
  getPendingSync,
  clearPendingSync,
  withTimeout,
  withRetry
};
