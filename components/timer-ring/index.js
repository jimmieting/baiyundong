/**
 * 双轨计时圆环组件
 * 外环：分钟进度 | 内环：秒钟进度
 * 使用 Canvas 2D 绘制
 */
Component({
  properties: {
    // 已用时（秒）
    elapsed: {
      type: Number,
      value: 0,
      observer: '_draw'
    },
    // 组件尺寸
    size: {
      type: Number,
      value: 280 // rpx 转换后在 JS 中按 px 处理
    }
  },

  data: {
    canvasWidth: 140,
    canvasHeight: 140
  },

  lifetimes: {
    attached() {
      // 计算实际像素尺寸（使用新版 API）
      const windowInfo = wx.getWindowInfo();
      const ratio = windowInfo.windowWidth / 750;
      const sizePx = Math.round(this.properties.size * ratio);
      this.setData({
        canvasWidth: sizePx,
        canvasHeight: sizePx
      });
      this.dpr = windowInfo.pixelRatio;
      this.sizePx = sizePx;

      // 初始化 Canvas
      this._initCanvas();
    }
  },

  methods: {
    _initCanvas() {
      const query = this.createSelectorQuery();
      query.select('#timerCanvas')
        .fields({ node: true, size: true })
        .exec((res) => {
          if (!res[0] || !res[0].node) return;

          const canvas = res[0].node;
          const ctx = canvas.getContext('2d');

          // 设置高清
          canvas.width = this.sizePx * this.dpr;
          canvas.height = this.sizePx * this.dpr;
          ctx.scale(this.dpr, this.dpr);

          this.canvas = canvas;
          this.ctx = ctx;
          this._draw();
        });
    },

    _draw() {
      if (!this.ctx) return;

      const ctx = this.ctx;
      const size = this.sizePx;
      const cx = size / 2;
      const cy = size / 2;
      const elapsed = this.properties.elapsed;

      // 清空画布
      ctx.clearRect(0, 0, size, size);

      // 外环参数（分钟进度，60分钟一圈）
      const outerRadius = cx - 10;
      const outerWidth = 6;
      const minuteProgress = (elapsed % 3600) / 3600;

      // 内环参数（秒钟进度，60秒一圈）
      const innerRadius = cx - 22;
      const innerWidth = 4;
      const secondProgress = (elapsed % 60) / 60;

      // 起始角度（12点方向）
      const startAngle = -Math.PI / 2;

      // 绘制外环底色
      ctx.beginPath();
      ctx.arc(cx, cy, outerRadius, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(242, 242, 242, 0.2)';
      ctx.lineWidth = outerWidth;
      ctx.lineCap = 'butt';
      ctx.stroke();

      // 绘制外环进度
      if (minuteProgress > 0) {
        ctx.beginPath();
        ctx.arc(cx, cy, outerRadius, startAngle, startAngle + Math.PI * 2 * minuteProgress);
        ctx.strokeStyle = '#D34941';
        ctx.lineWidth = outerWidth;
        ctx.lineCap = 'butt';
        ctx.stroke();
      }

      // 绘制内环底色
      ctx.beginPath();
      ctx.arc(cx, cy, innerRadius, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(242, 242, 242, 0.1)';
      ctx.lineWidth = innerWidth;
      ctx.lineCap = 'butt';
      ctx.stroke();

      // 绘制内环进度
      if (secondProgress > 0) {
        ctx.beginPath();
        ctx.arc(cx, cy, innerRadius, startAngle, startAngle + Math.PI * 2 * secondProgress);
        ctx.strokeStyle = 'rgba(211, 73, 65, 0.6)';
        ctx.lineWidth = innerWidth;
        ctx.lineCap = 'butt';
        ctx.stroke();
      }
    }
  }
});
