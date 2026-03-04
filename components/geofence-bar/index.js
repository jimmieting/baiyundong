/**
 * 地理状态条组件
 * 三态显示：远距(灰) / 边缘(白+呼吸灯) / 围栏内(红)
 */
Component({
  properties: {
    // 地理状态 'far' | 'near' | 'inside'
    status: {
      type: String,
      value: 'far'
    },
    // 显示文案
    text: {
      type: String,
      value: '定位中...'
    }
  }
});
