/**
 * 云函数：身份确权
 * 将用户从 ANONYMOUS 升级为 HONOR
 * 写入不可篡改的 honor_granted_at 时间戳
 */
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  const { nickname, avatarUrl } = event;
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  if (!nickname) {
    return { success: false, error: '昵称不能为空' };
  }

  try {
    // 查询用户
    const { data: users } = await db.collection('t_user')
      .where({ _openid: openid })
      .limit(1)
      .get();

    if (users.length === 0) {
      // 首次使用，创建用户并直接设为荣誉态
      await db.collection('t_user').add({
        data: {
          _openid: openid,
          identity: 'HONOR',
          nickname: nickname,
          avatar_url: avatarUrl || '',
          honor_granted_at: db.serverDate(),
          personal_pb: 0,
          total_climbs: 0,
          total_ascent: 0,
          created_at: db.serverDate(),
          updated_at: db.serverDate()
        }
      });

      return { success: true, isNewUser: true };
    }

    const user = users[0];

    // 如果已经是荣誉态，只更新昵称头像（不修改确权时间）
    if (user.identity === 'HONOR') {
      await db.collection('t_user').doc(user._id).update({
        data: {
          nickname: nickname,
          avatar_url: avatarUrl || user.avatar_url,
          updated_at: db.serverDate()
        }
      });

      return { success: true, isNewUser: false, alreadyHonor: true };
    }

    // 从匿名态升级为荣誉态
    // 冷启动原则：honor_granted_at 一旦设定不可更改
    const updateData = {
      identity: 'HONOR',
      nickname: nickname,
      avatar_url: avatarUrl || '',
      updated_at: db.serverDate()
    };

    // 只有第一次确权才写入 honor_granted_at
    if (!user.honor_granted_at) {
      updateData.honor_granted_at = db.serverDate();
    }

    await db.collection('t_user').doc(user._id).update({ data: updateData });

    return { success: true, isNewUser: false, upgraded: true };
  } catch (err) {
    console.error('身份确权失败', err);
    return { success: false, error: err.message };
  }
};
