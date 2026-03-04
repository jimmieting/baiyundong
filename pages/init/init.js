// 白云洞登山局 - 数据初始化页面

const db = wx.cloud.database();

Page({
  data: {
    loading: false,
    result: ''
  },

  async initData() {
    this.setData({ loading: true, result: '' });

    try {
      let msg = '';

      // 1. 导入文化数据
      const cultures = [
        { type: 'SPLASH', content: "朱熹曾于此见'天路'，你今日所行亦然。", priority: 10, note: '核心品牌语' },
        { type: 'SPLASH', content: "向上的秩序，是与自己博弈。", priority: 8, note: '长期主义逻辑' },
        { type: 'SPLASH', content: "汗水无欺，数据确权。", priority: 5, note: '技术公理' },
        { type: 'SPLASH', content: "每一级石阶，都是通往巅峰的秩序。", priority: 5, note: '视觉锚点' },
        { type: 'SPLASH', content: "白云洞不仅是一座山，更是一次秩序的重建。", priority: 5, note: '战略视角' },
        { type: 'HISTORY', content: "白云洞位于福州鼓山系，是福州最具挑战性的登山路线之一。海拔约700米，累计爬升280m。自古为文人墨客修行之地。", priority: 10, note: '地理概况' },
        { type: 'HISTORY', content: "南宋大儒朱熹曾游历于此，留下'天路'之说。其石阶陡峭，如同通往云端的阶梯，故名天路。", priority: 10, note: '朱熹天路' }
      ];

      for (const c of cultures) {
        await db.collection('t_culture').add({ data: c });
      }
      msg += '✅ 文化数据(7条)导入成功\n';

      // 2. 导入共建者数据
      const cobuilders = [
        { nickname: 'Jimmie Ting', contribution_type: 'EARLY_ADOPTER', honor_level: 10, is_visible: true, note: '发起人/首席架构师' },
        { nickname: 'OpenClaw AI', contribution_type: 'TECH_SUPPORT', honor_level: 5, is_visible: true, note: '技术共建者' },
        { nickname: '佚名', contribution_type: 'DONATION', honor_level: 1, is_visible: true, note: '早期支持者' }
      ];

      for (const c of cobuilders) {
        await db.collection('t_cobuilder').add({ data: c });
      }
      msg += '✅ 共建者(3人)导入成功\n';

      // 3. 导入里程碑文案
      const milestones = [
        { type: 'MILESTONE', content: '首次登顶', priority: 5 },
        { type: 'MILESTONE', content: 'pb刷新', priority: 5 }
      ];

      for (const m of milestones) {
        await db.collection('t_culture').add({ data: m });
      }
      msg += '✅ 里程碑数据(2条)导入成功';

      this.setData({ result: msg });

    } catch (err) {
      console.error('初始化失败', err);
      this.setData({ result: '❌ 初始化失败: ' + err.message });
    }

    this.setData({ loading: false });
  },

  goBack() {
    wx.navigateBack();
  }
});
