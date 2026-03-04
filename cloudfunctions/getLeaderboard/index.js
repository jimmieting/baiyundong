/**
 * 云函数：排行榜聚合查询
 * 仅荣誉态 + 有效记录 + 确权时间后的记录可入榜
 * 支持：today / month / all 三种模式
 */
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;
const $ = db.command.aggregate;

exports.main = async (event) => {
  const { mode = 'today', limit = 50 } = event;

  try {
    // 计算时间范围
    const now = new Date();
    let timeFilter = {};

    if (mode === 'today') {
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      timeFilter = { start_time: _.gte(todayStart) };
    } else if (mode === 'month') {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      timeFilter = { start_time: _.gte(monthStart) };
    }
    // mode === 'all' 不加时间过滤

    // 查询有效的、非匿名的记录
    const matchCondition = {
      status: 'COMPLETED',
      is_valid: true,
      is_anonymous: false,
      ...timeFilter
    };

    const { data: records } = await db.collection('t_workout')
      .where(matchCondition)
      .orderBy('duration_sec', 'asc')
      .limit(limit)
      .get();

    if (records.length === 0) {
      return { success: true, list: [] };
    }

    // 收集所有相关的 openid
    const openids = [...new Set(records.map(r => r._openid))];

    // 批量查询用户信息
    const { data: users } = await db.collection('t_user')
      .where({ _openid: _.in(openids) })
      .get();

    // 构建 openid -> user 映射
    const userMap = {};
    users.forEach(u => {
      userMap[u._openid] = u;
    });

    // 过滤：只保留确权时间之后的记录（冷启动原则）
    const validRecords = records.filter(record => {
      const user = userMap[record._openid];
      if (!user || user.identity !== 'HONOR' || !user.honor_granted_at) {
        return false;
      }
      const recordTime = new Date(record.start_time).getTime();
      const cutoffTime = new Date(user.honor_granted_at).getTime();
      return recordTime > cutoffTime;
    });

    // 组装返回数据
    const list = validRecords.map(record => {
      const user = userMap[record._openid] || {};
      return {
        _id: record._id,
        openid: record._openid,
        nickname: user.nickname || '匿名',
        avatar_url: user.avatar_url || '',
        duration_sec: record.duration_sec,
        start_time: record.start_time
      };
    });

    return { success: true, list };
  } catch (err) {
    console.error('排行榜查询失败', err);
    return { success: false, error: err.message, list: [] };
  }
};
