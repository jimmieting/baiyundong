/**
 * 历史记录列表页
 * 按日期倒序展示个人所有攀登记录
 * 支持分页加载
 */
const app = getApp();
const timeUtil = require('../../utils/time');

const PAGE_SIZE = 20;

Page({
  data: {
    list: [],
    loading: true,
    empty: false,
    hasMore: true
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
   * 加载记录
   * @param {boolean} refresh 是否重新加载
   */
  async _loadRecords(refresh) {
    if (refresh) {
      this._page = 0;
      this.setData({ list: [], loading: true, empty: false, hasMore: true });
    } else {
      this.setData({ loading: true });
    }

    try {
      const openid = await app.getOpenId();
      const db = wx.cloud.database();

      const { data } = await db.collection('t_workout')
        .where({ _openid: openid })
        .orderBy('start_time', 'desc')
        .skip(this._page * PAGE_SIZE)
        .limit(PAGE_SIZE)
        .get();

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
        hasMore: data.length === PAGE_SIZE
      });

      this._page++;
    } catch (err) {
      console.error('加载历史记录失败', err);
      this.setData({ loading: false });
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
