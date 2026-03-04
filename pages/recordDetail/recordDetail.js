// 白云洞登山局 - 记录详情 V1.0

const db = wx.cloud.database();

Page({
  data: {
    record: null,
    loading: true,
    isPB: false,
    medal: {
      icon: '🏅',
      name: '攀登者'
    }
  },

  onLoad(options) {
    if (options.id) {
      this.loadRecord(options.id);
    }
  },

  async loadRecord(id) {
    this.setData({ loading: true });
    wx.showLoading({ title: '加载中...', mask: true });

    try {
      const result = await db.collection('t_workout').doc(id).get();
      
      wx.hideLoading();
      
      if (!result.data) {
        this.setData({ loading: false, record: null });
        return;
      }

      const record = result.data;
      const startTime = record.start_time ? new Date(record.start_time) : null;
      const endTime = record.end_time ? new Date(record.end_time) : null;
      
      // 计算duration_sec
      let durationSec = record.duration_sec;
      if (!durationSec && startTime && endTime) {
        durationSec = Math.floor((endTime - startTime) / 1000);
      }
      
      const altitudeDelta = record.end_alt && record.start_alt 
        ? Math.round(record.end_alt - record.start_alt) 
        : null;

      // 获取用户PB判断是否破纪录
      let isPB = false;
      try {
        const userRes = await db.collection('t_user').where({ 
          _openid: record._openid 
        }).limit(1).get();
        
        if (userRes.data && userRes.data[0]) {
          const pb = userRes.data[0].personal_pb;
          isPB = pb && durationSec ? durationSec < pb : false;
        }
      } catch (e) {
        console.warn('获取PB失败', e);
      }

      const medal = this.getMedal(durationSec);

      this.setData({
        record: {
          ...record,
          formattedDuration: this.formatDuration(durationSec),
          formattedStartTime: this.formatDateTime(startTime),
          formattedEndTime: this.formatDateTime(endTime),
          altitudeDelta,
          comparison: null
        },
        loading: false,
        isPB,
        medal
      });

    } catch (err) {
      console.error('加载记录失败', err);
      wx.hideLoading();
      this.setData({ loading: false, record: null });
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  formatDuration(seconds) {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  },

  formatDateTime(date) {
    if (!date) return '--';
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  },

  getMedal(durationSec) {
    if (!durationSec) return { icon: '🏅', name: '攀登者' };
    const mins = durationSec / 60;
    if (mins < 25) return { icon: '⚡', name: '闪电攀登者' };
    if (mins < 35) return { icon: '🔥', name: '烈焰行者' };
    if (mins < 45) return { icon: '🌟', name: '晨曦挑战者' };
    if (mins < 60) return { icon: '🏃', name: '稳步前进者' };
    return { icon: '🏅', name: '攀登者' };
  },

  // 生成海报
  generatePoster() {
    const { record, medal, isPB } = this.data;
    
    wx.showLoading({ title: '生成中...' });
    
    const ctx = wx.createCanvasContext('poster-canvas', this);
    
    // 黛青渐变背景
    ctx.setFillStyle('#003344');
    ctx.fillRect(0, 0, 300, 500);
    
    // 标题
    ctx.setFillStyle('#F2F2F2');
    ctx.setFontSize(20);
    ctx.setTextAlign('center');
    ctx.fillText('白云洞登山局 · 荣誉证书', 150, 40);
    
    // 成绩
    ctx.setFontSize(48);
    ctx.fillText(record.formattedDuration || '00:00', 150, 120);
    
    // 称号
    ctx.setFontSize(16);
    ctx.setFillStyle('#D34941');
    ctx.fillText(medal.name || '攀登者', 150, 160);
    
    // PB标识
    if (isPB) {
      ctx.setFillStyle('#FFD700');
      ctx.setFontSize(14);
      ctx.fillText('🎉 新纪录！', 150, 190);
    }
    
    // 日期
    ctx.setFillStyle('#8899A6');
    ctx.setFontSize(12);
    ctx.fillText(record.formattedStartTime || '', 150, 230);
    
    // 底部Slogan
    ctx.setFillStyle('rgba(242,242,242,0.5)');
    ctx.setFontSize(12);
    ctx.fillText('向上的秩序', 150, 460);
    
    ctx.draw(false, () => {
      wx.hideLoading();
      wx.canvasToTempFilePath({
        canvasId: 'poster-canvas',
        success: (res) => {
          wx.saveImageToPhotosAlbum({
            filePath: res.tempFilePath,
            success: () => {
              wx.showToast({ title: '已保存到相册', icon: 'success' });
            },
            fail: () => {
              wx.showToast({ title: '保存失败', icon: 'none' });
            }
          });
        },
        fail: () => {
          wx.showToast({ title: '生成失败', icon: 'none' });
        }
      }, this);
    });
  },

  // 返回首页
  goHome() {
    wx.switchTab({
      url: '/pages/index/index'
    });
  },

  // 返回上一页
  goBack() {
    wx.navigateBack();
  }
});
