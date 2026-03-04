/**
 * 身份系统管理模块
 * ANONYMOUS / HONOR 双轨身份
 * 冷启动原则：确权后历史不可追溯入榜
 */

/**
 * 获取用户身份信息
 * @param {string} openid
 * @returns {Promise<object|null>} 用户记录
 */
async function getUserIdentity(openid) {
  const db = wx.cloud.database();
  const { data } = await db.collection('t_user')
    .where({ _openid: openid })
    .limit(1)
    .get();

  return data.length > 0 ? data[0] : null;
}

/**
 * 确保用户记录存在（首次使用自动创建）
 * @param {string} openid
 * @returns {Promise<object>} 用户记录
 */
async function ensureUser(openid) {
  let user = await getUserIdentity(openid);
  if (!user) {
    const db = wx.cloud.database();
    await db.collection('t_user').add({
      data: {
        _openid: openid,
        identity: 'ANONYMOUS',
        nickname: '',
        avatar_url: '',
        honor_granted_at: null,
        personal_pb: 0,
        total_climbs: 0,
        total_ascent: 0,
        created_at: db.serverDate()
      }
    });
    user = await getUserIdentity(openid);
  }
  return user;
}

/**
 * 判断用户是否为荣誉态
 * @param {object} user 用户记录
 * @returns {boolean}
 */
function isHonor(user) {
  return user && user.identity === 'HONOR';
}

/**
 * 判断某条记录是否具备入榜资格
 * 冷启动原则：记录时间必须晚于确权时间
 * @param {object} user 用户记录
 * @param {Date|string} recordStartTime 记录的开始时间
 * @returns {boolean}
 */
function canEnterLeaderboard(user, recordStartTime) {
  if (!isHonor(user)) return false;
  if (!user.honor_granted_at) return false;

  const recordTime = new Date(recordStartTime).getTime();
  const cutoffTime = new Date(user.honor_granted_at).getTime();

  return recordTime > cutoffTime;
}

/**
 * 升级为荣誉态（客户端调用）
 * 实际确权通过 syncUserIdentity 云函数执行
 * @param {string} nickname 微信昵称
 * @param {string} avatarUrl 头像地址
 * @returns {Promise<object>} 云函数返回结果
 */
async function upgradeToHonor(nickname, avatarUrl) {
  return wx.cloud.callFunction({
    name: 'syncUserIdentity',
    data: { nickname, avatarUrl }
  }).then(res => res.result);
}

module.exports = {
  getUserIdentity,
  ensureUser,
  isHonor,
  canEnterLeaderboard,
  upgradeToHonor
};
