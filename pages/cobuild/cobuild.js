/**
 * 共建页
 * 文化卡片 + 共建者名录 + 支持/反馈半屏模态框
 * Phase 6: 5s超时 + 本地兜底
 */
const app = getApp();
const network = require('../../utils/network');

const CLOUD_TIMEOUT = 5000;

Page({
  data: {
    cultureCards: [],
    builders: [],
    buildersLoading: true,

    showModal: false,

    // 反馈表单
    showFeedback: false,
    feedbackContent: '',
    feedbackSubmitting: false,

    statusBarHeight: 0
  },

  onLoad() {
    const systemInfo = app.globalData.systemInfo;
    if (systemInfo) {
      this.setData({ statusBarHeight: systemInfo.statusBarHeight || 44 });
    }

    this._loadCultureCards();
    this._loadBuilders();
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2 });
    }
  },

  // ========== 数据加载 ==========

  async _loadCultureCards() {
    try {
      const db = wx.cloud.database();
      const { data } = await network.withTimeout(
        db.collection('t_culture')
          .where({ type: 'CARD', is_active: true })
          .orderBy('priority', 'desc')
          .limit(10)
          .get(),
        CLOUD_TIMEOUT,
        '文化卡片查询'
      );

      if (data.length > 0) {
        this.setData({ cultureCards: data });
      } else {
        // 使用本地兜底数据
        this.setData({
          cultureCards: [
            { content: '朱熹曾于鼓山白云洞题"天路"二字，意指通往精神高处的道路。' },
            { content: '白云洞海拔约400米，从埠兴村登山口出发，垂直爬升约280米。' }
          ]
        });
      }
    } catch (err) {
      console.error('加载文化卡片失败', err);
    }
  },

  async _loadBuilders() {
    try {
      const db = wx.cloud.database();
      const { data } = await network.withTimeout(
        db.collection('t_cobuilder')
          .where({ is_visible: true })
          .orderBy('honor_level', 'desc')
          .limit(100)
          .get(),
        CLOUD_TIMEOUT,
        '共建者名录查询'
      );

      this.setData({ builders: data, buildersLoading: false });
    } catch (err) {
      console.error('加载共建者名录失败', err);
      this.setData({ buildersLoading: false });
    }
  },

  // ========== 模态框 ==========

  openModal() {
    this.setData({ showModal: true, showFeedback: false });
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setDimmed(true);
    }
  },

  closeModal() {
    this.setData({ showModal: false, showFeedback: false });
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setDimmed(false);
    }
  },

  // ========== 反馈 ==========

  openFeedback() {
    this.setData({ showFeedback: true });
  },

  onFeedbackInput(e) {
    this.setData({ feedbackContent: e.detail.value });
  },

  async submitFeedback() {
    const content = this.data.feedbackContent.trim();
    if (!content) {
      wx.showToast({ title: '请输入反馈内容', icon: 'none' });
      return;
    }

    this.setData({ feedbackSubmitting: true });

    try {
      const openid = await app.getOpenId();
      const db = wx.cloud.database();

      await network.withTimeout(
        db.collection('t_feedback').add({
          data: {
            _openid: openid,
            type: 'BUG',
            content: content,
            workout_id: '',
            evidence_images: [],
            status: 'PENDING',
            created_at: db.serverDate()
          }
        }),
        CLOUD_TIMEOUT,
        '提交反馈'
      );

      this.setData({
        feedbackContent: '',
        feedbackSubmitting: false,
        showFeedback: false
      });

      wx.showToast({ title: '反馈已提交，谢谢！', icon: 'success' });

      setTimeout(() => this.closeModal(), 1000);
    } catch (err) {
      console.error('提交反馈失败', err);
      this.setData({ feedbackSubmitting: false });
      wx.showToast({ title: '提交失败，请重试', icon: 'none' });
    }
  },

  // ========== 精神共鸣 ==========

  voteSpirit() {
    wx.showToast({ title: '感谢你的共鸣 ✨', icon: 'none' });
  },

  // ========== 捐助（待实现） ==========

  openDonation() {
    wx.showToast({ title: '捐助功能即将上线', icon: 'none' });
  }
});
