/**
 * 历史记录列表页
 * 按日期倒序展示个人所有攀登记录
 * 支持分页加载
 * Phase 6: 5s超时 + 本地缓存 + 离线友好
 */
const app = getApp();
const timeUtil = require('../../utils/time');
const network = require('../../utils/network');

const PAGE_SIZE = 20;
const CACHE_KEY = 'history_cache';
const CLOUD_TIMEOUT = 5000;

Page({
  data: {
    list: [],
    loading: true,
    empty: false,
    hasMore: true,
    loadError: false,
    errorType: ''    // 'deploy' 或 'network'
  },

  _page: 0,

  onLoad() {
    this._loadRecords(true);
  },

  onPullDownRefresh() {
    this._loadRecords(true).then(() => {
      wx.stopPullDownRefresh();
    });
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this._loadRecords(false);
    }
  },

  /**
   * 加载记录（带5s超时 + 本地缓存兜底）
   * @param {boolean} refresh 是否重新加载
   */
  async _loadRecords(refresh) {
    if (refresh) {
      this._page = 0;
      this.setData({ list: [], loading: true, empty: false, hasMore: true, loadError: false });
    } else {
      this.setData({ loading: true });
    }

    try {
      const openid = await app.getOpenId();
      const db = wx.cloud.database();

      const { data } = await network.withTimeout(
        db.collection('t_workout')
          .where({ _openid: openid })
          .orderBy('start_time', 'desc')
          .skip(this._page * PAGE_SIZE)
          .limit(PAGE_SIZE)
          .get(),
        CLOUD_TIMEOUT,
        '历史记录查询'
      );

      const formatted = data.map(record => {
        const statusMap = {
          'RUNNING': '进行中',
          'ARRIVED': '校验中',
          'COMPLETED': '已完成',
          'SUSPECT': '数据异常'
        };

        return {
          ...record,
          dateText: timeUtil.formatDateTime(record.start_time),
          durationText: record.duration_sec
            ? timeUtil.formatDuration(record.duration_sec)
            : '--:--',
          statusText: statusMap[record.status] || record.status,
          badge: _getBadge(record.duration_sec)
        };
      });

      const newList = refresh ? formatted : [...this.data.list, ...formatted];

      this.setData({
        list: newList,
        loading: false,
        empty: newList.length === 0,
        hasMore: data.length === PAGE_SIZE,
        loadError: false
      });

      this._page++;

      // 缓存首页数据
      if (refresh && newList.length > 0) {
        this._saveCache(newList);
      }
    } catch (err) {
      console.error('加载历史记录失败', err);

      // 区分云函数未部署和网络问题
      const errMsg = (err && err.message) || '';
      const isNotDeployed = errMsg.includes('not found') || errMsg.includes('-404') || errMsg.includes('FunctionName');
      const errorType = isNotDeployed ? 'deploy' : 'network';

      // 首次加载失败，尝试本地缓存
      if (refresh) {
        const cached = this._loadCache();
        if (cached && cached.length > 0) {
          this.setData({
            list: cached,
            loading: false,
            empty: false,
            hasMore: false,
            loadError: true,
            errorType
          });
        } else {
          this.setData({ loading: false, empty: true, loadError: true, errorType });
        }
      } else {
        this.setData({ loading: false, loadError: true, errorType });
        wx.showToast({ title: '加载失败，请重试', icon: 'none' });
      }
    }
  },

  /**
   * 缓存首页数据
   */
  _saveCache(list) {
    try {
      wx.setStorageSync(CACHE_KEY, {
        list: list.slice(0, PAGE_SIZE),
        savedAt: Date.now()
      });
    } catch (e) {
      // 静默失败
    }
  },

  /**
   * 读取缓存（30分钟有效期）
   */
  _loadCache() {
    try {
      const cache = wx.getStorageSync(CACHE_KEY);
      if (!cache) return null;
      if (Date.now() - cache.savedAt > 30 * 60 * 1000) return null;
      return cache.list;
    } catch (e) {
      return null;
    }
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/record/record?id=${id}` });
  },

  goBack() {
    wx.navigateBack();
  }
});

/**
 * 根据用时生成称号
 */
function _getBadge(durationSec) {
  if (!durationSec) return '';
  const min = durationSec / 60;
  if (min <= 20) return '⚡ 闪电';
  if (min <= 30) return '🔥 疾风';
  if (min <= 45) return '🌟 矫健';
  if (min <= 60) return '🏃 稳健';
  return '🏅 坚毅';
}
