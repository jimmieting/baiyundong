/**
 * 云函数：种子数据导入
 * 支持 seedCulture / seedCobuilder / seedAll
 * 带去重逻辑
 */
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

// 文案种子数据
const CULTURE_DATA = [
  { type: 'SPLASH', content: '朱熹曾于此见"天路"，你今日所行亦然。', priority: 10, is_active: true },
  { type: 'SPLASH', content: '每一步向上，都是与自己的博弈。', priority: 10, is_active: true },
  { type: 'SPLASH', content: '秩序不在山顶等你，秩序在你脚下生长。', priority: 10, is_active: true },
  { type: 'SPLASH', content: '凌晨的白云洞，只属于向上的人。', priority: 8, is_active: true },
  { type: 'SPLASH', content: '没有捷径，只有节奏。', priority: 10, is_active: true },
  { type: 'SPLASH', content: '山不言语，但记录一切。', priority: 8, is_active: true },
  { type: 'SPLASH', content: '向上的秩序，从第一步开始。', priority: 10, is_active: true },
  { type: 'SPLASH', content: '天路漫漫，心志为灯。', priority: 8, is_active: true },
  { type: 'CARD', content: '朱熹曾于鼓山白云洞题"天路"二字，意指通往精神高处的道路。', priority: 10, is_active: true },
  { type: 'CARD', content: '白云洞海拔约400米，从埠兴村登山口出发，垂直爬升约280米。', priority: 10, is_active: true },
  { type: 'HISTORY', content: '白云洞位于福州鼓山半山腰，海拔约400米。南宋理学家朱熹曾在此讲学，题写"天路"二字。', priority: 10, is_active: true },
  { type: 'HISTORY', content: '从埠兴村登山口到白云洞主洞平台，直线距离约1.8公里，垂直爬升约280米，是福州最经典的登山快线之一。', priority: 10, is_active: true }
];

const COBUILDER_DATA = [
  { nickname: 'Jimmie', contribution_type: 'EARLY_ADOPTER', honor_level: 10, is_visible: true, note: '项目发起人' }
];

exports.main = async (event) => {
  const { action = 'seedAll' } = event;
  const results = {};

  try {
    if (action === 'seedCulture' || action === 'seedAll') {
      results.culture = await _seedCollection('t_culture', CULTURE_DATA, 'content');
    }

    if (action === 'seedCobuilder' || action === 'seedAll') {
      results.cobuilder = await _seedCollection('t_cobuilder', COBUILDER_DATA, 'nickname');
    }

    return { success: true, results };
  } catch (err) {
    console.error('种子数据导入失败', err);
    return { success: false, error: err.message };
  }
};

/**
 * 导入单个集合（带去重）
 */
async function _seedCollection(collectionName, data, uniqueField) {
  let inserted = 0;
  let skipped = 0;

  for (const item of data) {
    // 检查是否已存在
    const { data: existing } = await db.collection(collectionName)
      .where({ [uniqueField]: item[uniqueField] })
      .limit(1)
      .get();

    if (existing.length === 0) {
      await db.collection(collectionName).add({
        data: { ...item, created_at: db.serverDate() }
      });
      inserted++;
    } else {
      skipped++;
    }
  }

  return { inserted, skipped, total: data.length };
}
