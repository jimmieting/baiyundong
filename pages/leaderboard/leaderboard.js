// 白云洞登山局 - 排行榜页面 V1.0

const db = wx.cloud.database();
const _ = db.command;

Page({
  data: {
    currentTab: 'today',
    list: [],
    loading: true
  },

  onLoad() {
    this.loadLeaderboard();
  },

  onShow() {
    // 每次显示时刷新
    this.loadLeaderboard();
  },

  // 切换tab
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ currentTab: tab });
    this.loadLeaderboard();
  },

  // 加载排行榜数据
  async loadLeaderboard() {
    this.setData({ loading: true });

    try {
      const { currentTab } = this.data;
      let query = {};

      // 时间过滤
      const now = new Date();
      let startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      let startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      if (currentTab === 'today') {
        query = {
          start_time: _.gte(startOfDay)
        };
      } else if (currentTab === 'month') {
        query = {
          start_time: _.gte(startOfMonth)
        };
      }
      // all: 无时间过滤

      // 查询有效记录 - 测试模式也显示COMPLETED记录
      query.status = 'COMPLETED';
      query.appeal_status = _.in(['NONE', 'APPROVED']);

      // 检查是否有数据
      const countResult = await db.collection('t_workout').where({
        status: 'COMPLETED'
      }).count();

      const result = await db.collection('t_workout')
        .where({
          status: 'COMPLETED'
        })
        .orderBy('duration_sec', 'asc')
        .limit(50)
        .get();

      // 处理数据
      const processedList = await this.processLeaderboardData(result.data);
      
      this.setData({
        list: processedList,
        loading: false
      });

    } catch (err) {
      console.error('加载排行榜失败', err);
      this.setData({ loading: false });
    }
  },

  // 处理排行榜数据
  async processLeaderboardData(records) {
    // 获取所有相关用户的昵称和头像
    const openids = [...new Set(records.map(r => r._openid))];
    const users = await this.getUsersInfo(openids);

    return records.map(record => {
      const user = users.find(u => u._openid === record._openid);
      const durationSec = record.duration_sec;
      
      // 格式化时长
      const mins = Math.floor(durationSec / 60);
      const secs = durationSec % 60;
      const formattedDuration = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

      // 格式化日期
      const date = record.start_time ? new Date(record.start_time) : null;
      const formattedDate = date ? `${date.getMonth() + 1}-${date.getDate()}` : '--';

      // 计算配速（分钟/公里）
      // 需要计算实际距离，这里用简化估算
      const distance = 2.79; // 约2.79公里
      const paceVal = (durationSec / 60 / distance).toFixed(1);
      const pace = `${paceVal} min/km`;

      return {
        ...record,
        nickname: user ? user.nickname : '匿名攀登者',
        avatar_url: user ? user.avatar_url : null,
        formattedDuration,
        formattedDate,
        pace
      };
    });
  },

  // 批量获取用户信息
  async getUsersInfo(openids) {
    if (!openids || openids.length === 0) return [];

    try {
      // 由于云数据库限制，需要逐个查询或使用云函数
      const promises = openids.map(openid => 
        db.collection('t_user').where({ _openid: openid }).get()
      );
      
      const results = await Promise.all(promises);
      return results.map(r => r.data[0]).filter(Boolean);
    } catch (err) {
      console.error('获取用户信息失败', err);
      return [];
    }
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.loadLeaderboard().then(() => {
      wx.stopPullDownRefresh();
    });
  }
});
