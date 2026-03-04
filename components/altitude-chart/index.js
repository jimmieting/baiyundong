/**
 * 海拔折线图组件
 * 使用 Canvas 2D 绘制
 * X轴：时间 | Y轴：海拔
 */
Component({
  properties: {
    // 采样数据 [{ alt, timestamp }, ...]
    samples: {
      type: Array,
      value: [],
      observer: '_draw'
    },
    // 起点海拔
    startAlt: {
      type: Number,
      value: 0
    },
    // 终点海拔
    endAlt: {
      type: Number,
      value: 0
    }
  },

  data: {
    canvasWidth: 300,
    canvasHeight: 150,
    hasData: false
  },

  lifetimes: {
    attached() {
      const systemInfo = wx.getSystemInfoSync();
      const ratio = systemInfo.windowWidth / 750;
      const width = Math.round(686 * ratio); // 686rpx 宽（留 32rpx*2 边距）
      const height = Math.round(300 * ratio);

      this.setData({ canvasWidth: width, canvasHeight: height });
      this.dpr = systemInfo.pixelRatio;
      this.widthPx = width;
      this.heightPx = height;

      // 延迟初始化 Canvas
      setTimeout(() => this._initCanvas(), 100);
    }
  },

  methods: {
    _initCanvas() {
      const query = this.createSelectorQuery();
      query.select('#altChart')
        .fields({ node: true, size: true })
        .exec((res) => {
          if (!res[0] || !res[0].node) return;

          const canvas = res[0].node;
          const ctx = canvas.getContext('2d');

          canvas.width = this.widthPx * this.dpr;
          canvas.height = this.heightPx * this.dpr;
          ctx.scale(this.dpr, this.dpr);

          this.canvas = canvas;
          this.ctx = ctx;
          this._draw();
        });
    },

    _draw() {
      if (!this.ctx) return;

      const ctx = this.ctx;
      const w = this.widthPx;
      const h = this.heightPx;
      const samples = this.properties.samples;
      const padding = { top: 20, right: 15, bottom: 30, left: 45 };

      // 清空
      ctx.clearRect(0, 0, w, h);

      // 如果没有采样数据，用起终点画简单线
      const points = [];
      if (samples && samples.length >= 2) {
        samples.forEach(s => {
          if (s.alt !== undefined && s.alt !== null) {
            points.push({ alt: s.alt, ts: s.timestamp });
          }
        });
        this.setData({ hasData: true });
      }

      if (points.length < 2) {
        // 无足够数据，画占位
        this._drawEmpty(ctx, w, h);
        return;
      }

      // 计算范围
      const alts = points.map(p => p.alt);
      let minAlt = Math.min(...alts);
      let maxAlt = Math.max(...alts);
      if (maxAlt - minAlt < 10) { maxAlt = minAlt + 100; }

      const minTs = points[0].ts;
      const maxTs = points[points.length - 1].ts;
      const tsDuration = maxTs - minTs || 1;

      const chartW = w - padding.left - padding.right;
      const chartH = h - padding.top - padding.bottom;

      // 绘制网格线
      ctx.strokeStyle = 'rgba(136, 153, 166, 0.2)';
      ctx.lineWidth = 0.5;
      for (let i = 0; i <= 4; i++) {
        const y = padding.top + (chartH / 4) * i;
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(w - padding.right, y);
        ctx.stroke();
      }

      // 绘制 Y 轴标签（海拔）
      ctx.fillStyle = '#8899A6';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'right';
      for (let i = 0; i <= 4; i++) {
        const alt = Math.round(maxAlt - ((maxAlt - minAlt) / 4) * i);
        const y = padding.top + (chartH / 4) * i;
        ctx.fillText(`${alt}m`, padding.left - 5, y + 3);
      }

      // 绘制折线
      ctx.beginPath();
      ctx.strokeStyle = '#D34941';
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';

      points.forEach((p, i) => {
        const x = padding.left + ((p.ts - minTs) / tsDuration) * chartW;
        const y = padding.top + ((maxAlt - p.alt) / (maxAlt - minAlt)) * chartH;

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      // 绘制渐变填充
      const gradient = ctx.createLinearGradient(0, padding.top, 0, h - padding.bottom);
      gradient.addColorStop(0, 'rgba(211, 73, 65, 0.3)');
      gradient.addColorStop(1, 'rgba(211, 73, 65, 0)');

      ctx.beginPath();
      points.forEach((p, i) => {
        const x = padding.left + ((p.ts - minTs) / tsDuration) * chartW;
        const y = padding.top + ((maxAlt - p.alt) / (maxAlt - minAlt)) * chartH;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      // 闭合到底部
      const lastX = padding.left + chartW;
      ctx.lineTo(lastX, h - padding.bottom);
      ctx.lineTo(padding.left, h - padding.bottom);
      ctx.closePath();
      ctx.fillStyle = gradient;
      ctx.fill();

      // 标注起终点
      ctx.fillStyle = '#F2F2F2';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('起点', padding.left, h - 8);
      ctx.fillText('终点', w - padding.right, h - 8);
    },

    _drawEmpty(ctx, w, h) {
      ctx.fillStyle = '#8899A6';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('海拔数据不足', w / 2, h / 2);
      this.setData({ hasData: false });
    }
  }
});
