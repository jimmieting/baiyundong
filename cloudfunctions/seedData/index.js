// 云函数：批量导入初始数据
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

exports.main = async (event, context) => {
  const { action } = event;
  
  try {
    if (action === 'seedCulture') {
      // 导入文化数据
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
      
      return { success: true, message: '文化数据导入成功', count: cultures.length };
    }
    
    if (action === 'seedCobuilder') {
      // 导入共建者数据
      const cobuilders = [
        { nickname: 'Jimmie Ting', contribution_type: 'EARLY_ADOPTER', honor_level: 10, is_visible: true, note: '发起人/首席架构师' },
        { nickname: 'OpenClaw AI', contribution_type: 'TECH_SUPPORT', honor_level: 5, is_visible: true, note: '技术共建者' },
        { nickname: '佚名', contribution_type: 'DONATION', honor_level: 1, is_visible: true, note: '早期支持者' }
      ];
      
      for (const c of cobuilders) {
        await db.collection('t_cobuilder').add({ data: c });
      }
      
      return { success: true, message: '共建者数据导入成功', count: cobuilders.length };
    }
    
    return { success: false, message: '未知操作' };
    
  } catch (err) {
    return { success: false, error: err.message };
  }
};
