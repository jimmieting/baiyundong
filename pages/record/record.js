/**
 * 记录详情页
 * 展示单次攀登完整数据 + 海拔折线 + Canvas 2D 分享海报
 * Phase 6: 5s超时保底
 */
const app = getApp();
const timeUtil = require('../../utils/time');
const network = require('../../utils/network');

const CLOUD_TIMEOUT = 5000;

Page({
  data: {
    record: null,
    loading: true,

    durationText: '--:--',
    dateText: '',
    startTimeText: '',
    endTimeText: '',
    badge: '',
    isPB: false,
    altitudeDelta: '--',
    paceText: '--',
    statusText: '',
    isSuspect: false,

    // 海拔折线图数据
    samples: [],
    startAlt: 0,
    endAlt: 0,

    // 海报
    posterReady: false
  },

  _recordId: null,

  onLoad(options) {
    this._recordId = options.id;
    if (this._recordId) {
      this._loadRecord();
    }
  },

  /**
   * 从云端加载记录
   */
  async _loadRecord() {
    this.setData({ loading: true });

    try {
      const db = wx.cloud.database();
      const { data: record } = await network.withTimeout(
        db.collection('t_workout')
          .doc(this._recordId)
          .get(),
        CLOUD_TIMEOUT,
        '记录详情查询'
      );

      // 计算展示数据
      const durationSec = record.duration_sec || 0;
      const altDelta = (record.end_alt || 0) - (record.start_alt || 0);
      const pace = timeUtil.calcVerticalPace(Math.abs(altDelta), durationSec);
      const badge = _getBadge(durationSec);

      // 是否为 PB
      let isPB = false;
      const userInfo = app.globalData.userInfo;
      if (userInfo && userInfo.personal_pb && durationSec > 0) {
        isPB = durationSec <= userInfo.personal_pb;
      }

      const statusMap = {
        'COMPLETED': '已完成',
        'SUSPECT': '数据异常',
        'RUNNING': '进行中',
        'ARRIVED': '校验中'
      };

      this.setData({
        record,
        loading: false,
        durationText: timeUtil.formatDuration(durationSec),
        dateText: timeUtil.formatDateShort(record.start_time),
        startTimeText: timeUtil.formatDateTime(record.start_time),
        endTimeText: record.end_time ? timeUtil.formatDateTime(record.end_time) : '--',
        badge,
        isPB,
        altitudeDelta: Math.round(altDelta),
        paceText: pace,
        statusText: statusMap[record.status] || record.status,
        isSuspect: record.status === 'SUSPECT',
        samples: record.altitude_samples || [],
        startAlt: record.start_alt || 0,
        endAlt: record.end_alt || 0
      });
    } catch (err) {
      console.error('加载记录失败', err);
      this.setData({ loading: false });
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  /**
   * 生成分享海报（Canvas 2D）
   */
  async generatePoster() {
    wx.showLoading({ title: '生成中...' });

    try {
      const query = this.createSelectorQuery();
      query.select('#posterCanvas')
        .fields({ node: true, size: true })
        .exec(async (res) => {
          if (!res[0] || !res[0].node) {
            wx.hideLoading();
            wx.showToast({ title: '生成失败', icon: 'none' });
            return;
          }

          const canvas = res[0].node;
          const ctx = canvas.getContext('2d');
          const dpr = wx.getSystemInfoSync().pixelRatio;
          const w = 375;
          const h = 500;

          canvas.width = w * dpr;
          canvas.height = h * dpr;
          ctx.scale(dpr, dpr);

          // 绘制黛青渐变背景
          const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
          bgGrad.addColorStop(0, '#001A24');
          bgGrad.addColorStop(1, '#003344');
          ctx.fillStyle = bgGrad;
          ctx.fillRect(0, 0, w, h);

          // 标题
          ctx.fillStyle = '#F2F2F2';
          ctx.font = 'bold 20px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('白云洞登山局 · 荣誉证书', w / 2, 60);

          // 分割线
          ctx.strokeStyle = '#D34941';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(w / 2 - 30, 80);
          ctx.lineTo(w / 2 + 30, 80);
          ctx.stroke();

          // 成绩
          ctx.fillStyle = '#F2F2F2';
          ctx.font = 'bold 56px sans-serif';
          ctx.fillText(this.data.durationText, w / 2, 160);

          // 称号
          if (this.data.badge) {
            ctx.font = '18px sans-serif';
            ctx.fillStyle = '#D34941';
            ctx.fillText(this.data.badge, w / 2, 195);
          }

          // PB 标记
          if (this.data.isPB) {
            ctx.font = 'bold 14px sans-serif';
            ctx.fillStyle = '#E67E22';
            ctx.fillText('🏆 个人最佳纪录', w / 2, 225);
          }

          // 数据行
          ctx.font = '14px sans-serif';
          ctx.fillStyle = '#8899A6';
          ctx.textAlign = 'center';
          ctx.fillText(`日期：${this.data.dateText}`, w / 2, 280);
          ctx.fillText(`海拔爬升：${this.data.altitudeDelta} 米`, w / 2, 310);
          ctx.fillText(`垂直配速：${this.data.paceText} 米/时`, w / 2, 340);

          // 底部标语
          ctx.fillStyle = 'rgba(136, 153, 166, 0.6)';
          ctx.font = '12px sans-serif';
          ctx.fillText('向上的秩序 · Order Upwards', w / 2, h - 30);

          // 保存到相册
          wx.canvasToTempFilePath({
            canvas,
            success: (res) => {
              wx.saveImageToPhotosAlbum({
                filePath: res.tempFilePath,
                success: () => {
                  wx.hideLoading();
                  wx.showToast({ title: '已保存到相册', icon: 'success' });
                },
                fail: () => {
                  wx.hideLoading();
                  wx.showToast({ title: '保存失败，请授权相册权限', icon: 'none' });
                }
              });
            },
            fail: () => {
              wx.hideLoading();
              wx.showToast({ title: '生成失败', icon: 'none' });
            }
          });
        });
    } catch (err) {
      wx.hideLoading();
      console.error('海报生成失败', err);
    }
  },

  goHome() {
    wx.switchTab({ url: '/pages/climb/climb' });
  }
});

function _getBadge(durationSec) {
  if (!durationSec) return '';
  const min = durationSec / 60;
  if (min <= 20) return '⚡ 闪电';
  if (min <= 30) return '🔥 疾风';
  if (min <= 45) return '🌟 矫健';
  if (min <= 60) return '🏃 稳健';
  return '🏅 坚毅';
}
