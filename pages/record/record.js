/**
 * 记录详情页
 * 展示单次攀登完整数据 + 海拔折线 + Canvas 2D 分享海报
 * 支持保存到相册 + 分享给好友
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
    badgeClean: '', // 不含emoji的称号
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
    posterReady: false,
    posterTempPath: '' // 生成后的临时路径
  },

  _recordId: null,

  onLoad(options) {
    this._recordId = options.id;
    if (this._recordId) {
      this._loadRecord();
    }
  },

  /**
   * 转发给好友（微信分享）
   */
  onShareAppMessage() {
    return {
      title: `白云洞 ${this.data.durationText} ${this.data.badge || '完成挑战'}`,
      path: `/pages/record/record?id=${this._recordId}`,
      imageUrl: this.data.posterTempPath || ''
    };
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
      const badgeClean = _getBadgeClean(durationSec);

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
        badgeClean,
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
   * 保存到相册
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
          const windowInfo = wx.getWindowInfo();
          const dpr = windowInfo.pixelRatio;
          const w = 375;
          const h = 560;

          canvas.width = w * dpr;
          canvas.height = h * dpr;
          ctx.scale(dpr, dpr);

          this._drawPoster(ctx, w, h);

          // 导出为临时文件
          wx.canvasToTempFilePath({
            canvas,
            success: (tmpRes) => {
              // 缓存路径用于分享
              this.setData({ posterTempPath: tmpRes.tempFilePath, posterReady: true });

              // 保存到相册
              wx.saveImageToPhotosAlbum({
                filePath: tmpRes.tempFilePath,
                success: () => {
                  wx.hideLoading();
                  wx.showToast({ title: '已保存到相册', icon: 'success' });
                },
                fail: (saveErr) => {
                  wx.hideLoading();
                  // 用户拒绝权限时给予引导
                  if (saveErr.errMsg && saveErr.errMsg.includes('deny')) {
                    wx.showModal({
                      title: '需要相册权限',
                      content: '请在设置中开启相册写入权限后重试',
                      confirmText: '去设置',
                      success: (modalRes) => {
                        if (modalRes.confirm) {
                          wx.openSetting({});
                        }
                      }
                    });
                  } else {
                    wx.showToast({ title: '保存失败', icon: 'none' });
                  }
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

  /**
   * 分享给好友（触发微信转发）
   */
  shareFriend() {
    // 先确保海报已生成，再触发转发
    if (!this.data.posterTempPath) {
      // 先静默生成海报图，再提示分享
      this._generatePosterSilent(() => {
        wx.showToast({ title: '请点击右上角 ··· 分享', icon: 'none', duration: 2500 });
      });
    } else {
      wx.showToast({ title: '请点击右上角 ··· 分享', icon: 'none', duration: 2500 });
    }
  },

  /**
   * 静默生成海报（不保存到相册）
   */
  _generatePosterSilent(callback) {
    const query = this.createSelectorQuery();
    query.select('#posterCanvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        if (!res[0] || !res[0].node) return;

        const canvas = res[0].node;
        const ctx = canvas.getContext('2d');
        const windowInfo = wx.getWindowInfo();
        const dpr = windowInfo.pixelRatio;
        const w = 375;
        const h = 560;

        canvas.width = w * dpr;
        canvas.height = h * dpr;
        ctx.scale(dpr, dpr);

        this._drawPoster(ctx, w, h);

        wx.canvasToTempFilePath({
          canvas,
          success: (tmpRes) => {
            this.setData({ posterTempPath: tmpRes.tempFilePath, posterReady: true });
            if (callback) callback();
          }
        });
      });
  },

  /**
   * 绘制海报内容
   * 黛青渐变背景 + 山形剪影 + 成绩数据 + 品牌标语
   */
  _drawPoster(ctx, w, h) {
    // ===== 背景：黛青渐变 =====
    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, '#001520');
    bgGrad.addColorStop(0.6, '#003344');
    bgGrad.addColorStop(1, '#002233');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // ===== 山形剪影（底部装饰）=====
    const mountainY = h - 140; // 山形起始高度
    ctx.fillStyle = 'rgba(0, 26, 36, 0.6)';
    ctx.beginPath();
    // 远山（浅色）
    ctx.moveTo(0, h);
    ctx.lineTo(0, mountainY + 40);
    ctx.lineTo(50, mountainY + 10);
    ctx.lineTo(100, mountainY + 35);
    ctx.lineTo(140, mountainY - 15);
    ctx.lineTo(180, mountainY + 20);
    ctx.lineTo(220, mountainY - 30);
    ctx.lineTo(260, mountainY + 5);
    ctx.lineTo(310, mountainY - 20);
    ctx.lineTo(340, mountainY + 15);
    ctx.lineTo(375, mountainY + 30);
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();

    // 近山（深色）
    ctx.fillStyle = 'rgba(0, 15, 22, 0.7)';
    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.lineTo(0, mountainY + 70);
    ctx.lineTo(60, mountainY + 45);
    ctx.lineTo(120, mountainY + 60);
    ctx.lineTo(170, mountainY + 30);
    ctx.lineTo(230, mountainY + 55);
    ctx.lineTo(280, mountainY + 35);
    ctx.lineTo(330, mountainY + 50);
    ctx.lineTo(375, mountainY + 65);
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();

    // ===== 顶部品牌 =====
    ctx.fillStyle = 'rgba(242, 242, 242, 0.5)';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('白云洞登山局', w / 2, 36);

    // 标题
    ctx.fillStyle = '#F2F2F2';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText('攀登证书', w / 2, 70);

    // 装饰线
    ctx.strokeStyle = '#D34941';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(w / 2 - 24, 84);
    ctx.lineTo(w / 2 + 24, 84);
    ctx.stroke();

    // ===== 核心成绩 =====
    ctx.fillStyle = '#F2F2F2';
    ctx.font = 'bold 60px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(this.data.durationText, w / 2, 160);

    // 称号（不用 emoji，Canvas 对 emoji 兼容性不好）
    if (this.data.badgeClean) {
      ctx.font = 'bold 18px sans-serif';
      ctx.fillStyle = '#D34941';
      ctx.fillText(this.data.badgeClean, w / 2, 192);
    }

    // PB 标记
    let dataStartY = 230;
    if (this.data.isPB) {
      ctx.font = 'bold 14px sans-serif';
      ctx.fillStyle = '#E67E22';
      ctx.fillText('Personal Best · 个人最佳', w / 2, 220);
      dataStartY = 250;
    }

    // ===== 数据区域（居中卡片感） =====
    const cardX = 60;
    const cardW = w - 120;
    const cardY = dataStartY;
    const cardH = 130;

    // 半透明卡片背景
    ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.beginPath();
    _roundRect(ctx, cardX, cardY, cardW, cardH, 10);
    ctx.fill();

    // 卡片边框
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    _roundRect(ctx, cardX, cardY, cardW, cardH, 10);
    ctx.stroke();

    // 数据行
    ctx.textAlign = 'left';
    ctx.font = '13px sans-serif';
    const labelX = cardX + 20;
    const valueX = cardX + cardW - 20;

    const rows = [
      { label: '日期', value: this.data.dateText },
      { label: '海拔爬升', value: this.data.altitudeDelta + ' 米' },
      { label: '垂直配速', value: this.data.paceText + ' 米/时' }
    ];

    rows.forEach((row, i) => {
      const y = cardY + 35 + i * 35;
      ctx.fillStyle = '#8899A6';
      ctx.textAlign = 'left';
      ctx.fillText(row.label, labelX, y);
      ctx.fillStyle = '#F2F2F2';
      ctx.textAlign = 'right';
      ctx.fillText(row.value, valueX, y);
    });

    // ===== 底部标语 =====
    ctx.textAlign = 'center';
    ctx.fillStyle = '#D34941';
    ctx.font = '11px sans-serif';
    ctx.fillText('向上的秩序 · Order Upwards', w / 2, h - 80);

    ctx.fillStyle = 'rgba(136, 153, 166, 0.4)';
    ctx.font = '10px sans-serif';
    ctx.fillText('白云洞 · 鼓山 · 福州', w / 2, h - 60);

    // 底部提示
    ctx.fillStyle = 'rgba(136, 153, 166, 0.3)';
    ctx.font = '9px sans-serif';
    ctx.fillText('长按识别小程序码 一起来攀登', w / 2, h - 20);
  },

  goHome() {
    wx.switchTab({ url: '/pages/climb/climb' });
  }
});

/**
 * Canvas 绘制圆角矩形
 */
function _roundRect(ctx, x, y, w, h, r) {
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
}

function _getBadge(durationSec) {
  if (!durationSec) return '';
  const min = durationSec / 60;
  if (min <= 20) return '闪电';
  if (min <= 30) return '疾风';
  if (min <= 45) return '矫健';
  if (min <= 60) return '稳健';
  return '坚毅';
}

/**
 * 不含 emoji 的称号（用于 Canvas 绘制）
 */
function _getBadgeClean(durationSec) {
  if (!durationSec) return '';
  const min = durationSec / 60;
  if (min <= 20) return '闪电级';
  if (min <= 30) return '疾风级';
  if (min <= 45) return '矫健级';
  if (min <= 60) return '稳健级';
  return '坚毅级';
}
