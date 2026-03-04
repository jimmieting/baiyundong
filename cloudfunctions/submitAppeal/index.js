/**
 * 云函数：提交申诉
 * 仅荣誉态用户可发起
 * 更新 t_workout 的 appeal_status 为 PENDING
 */
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  const { workoutId, reason } = event;
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  if (!workoutId || !reason) {
    return { success: false, error: '缺少必要参数' };
  }

  if (reason.length < 20) {
    return { success: false, error: '申诉说明不少于20字' };
  }

  try {
    // 验证用户身份
    const { data: users } = await db.collection('t_user')
      .where({ _openid: openid })
      .limit(1)
      .get();

    if (users.length === 0 || users[0].identity !== 'HONOR') {
      return { success: false, error: '仅荣誉态用户可发起申诉' };
    }

    // 验证记录
    const { data: record } = await db.collection('t_workout')
      .doc(workoutId)
      .get();

    if (record._openid !== openid) {
      return { success: false, error: '无权操作' };
    }

    if (record.status !== 'SUSPECT') {
      return { success: false, error: '仅异常记录可申诉' };
    }

    if (record.appeal_status === 'PENDING') {
      return { success: false, error: '已有申诉在审核中' };
    }

    // 检查硬性拒绝区间
    const durationSec = record.duration_sec || 0;
    if (durationSec < 600) {
      return { success: false, error: '此记录违背物理常识，不提供申诉入口' };
    }

    // 更新申诉状态
    await db.collection('t_workout').doc(workoutId).update({
      data: {
        appeal_status: 'PENDING'
      }
    });

    // 写入反馈表
    await db.collection('t_feedback').add({
      data: {
        _openid: openid,
        type: 'APPEAL',
        workout_id: workoutId,
        content: reason,
        evidence_images: [],
        status: 'PENDING',
        created_at: db.serverDate()
      }
    });

    return { success: true };
  } catch (err) {
    console.error('提交申诉失败', err);
    return { success: false, error: err.message };
  }
};
