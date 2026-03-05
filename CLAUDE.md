# 白云洞登山局 - 微信小程序

## 项目信息
- **类型**: 微信小程序（使用微信云开发）
- **AppID**: wx1ae91ef50ebab7bc
- **云环境**: cloud1-5gbteglza5336c9b
- **项目负责人**: Jimmie Ting（非专业开发者）
- **GitHub**: https://github.com/jimmieting/baiyundong

## 开发约定
- **所有代码注释、commit message、沟通语言统一使用简体中文**
- 代码风格由 Claude 自主决定，保持一致即可
- 每次重要改动都要通过 git 提交，方便回溯
- 代码要写得清晰易懂，方便将来维护

## 技术栈
- 微信小程序原生框架（WXML + WXSS + JS）
- 微信云开发（云函数 + 云数据库 + 云存储）
- 不使用第三方 UI 框架
- Canvas 2D API（计时圆环 + 海拔折线图 + 分享海报）

## 项目架构（V2.0）

### 页面
| 页面 | 路径 | 说明 |
|------|------|------|
| 启动页 | pages/splash | 2秒品牌展示 + 随机文案 |
| 攀登页 | pages/climb | 核心C位，状态机 + 地理围栏 + 计时 |
| 巅峰页 | pages/summit | 排行榜（今日/本月/历史） |
| 共建页 | pages/cobuild | 文化卡片 + 共建者名录 + 反馈 |
| 历史页 | pages/history | 个人历史记录列表（分页） |
| 详情页 | pages/record | 单次记录详情 + 海拔图 + 荣誉海报 |

### 云函数
| 函数名 | 说明 |
|--------|------|
| getOpenId | 获取用户 OpenID |
| validateRecord | 服务端三重校验（时间+海拔+地理环） |
| syncUserIdentity | 身份确权（匿名→荣誉升级） |
| getLeaderboard | 排行榜查询（绕过客户端20条限制） |
| submitAppeal | 异常记录申诉 |
| seedData | 种子数据导入（文化卡片 + 共建者） |

### 工具模块
| 模块 | 说明 |
|------|------|
| utils/geo.js | Haversine距离 + 地理围栏判定 + 采样频率 |
| utils/time.js | 时间格式化 + 垂直配速 |
| utils/storage.js | 本地缓存 + 状态机快照 + 检查点 |
| utils/network.js | 网络监听 + 5s超时 + 待同步队列 + 自动重试 |
| utils/validator.js | 三重校验逻辑（客户端版本） |
| utils/identity.js | 身份系统（冷启动原则） |
| utils/weather.js | 和风天气API封装（需填写API_KEY） |

### 组件
| 组件 | 说明 |
|------|------|
| components/geofence-bar | 地理围栏状态条（远/近/已进入） |
| components/timer-ring | Canvas 2D双轨计时圆环 |
| components/altitude-chart | Canvas 2D海拔折线图 |
| custom-tab-bar | 自定义底部导航（C位大圆悬浮） |

### 核心常量（锁死项）
- 起点：埠兴村登山口 (26.070797, 119.372559)
- 终点：白云洞主洞平台 (26.075214, 119.389145)
- 围栏半径：50米
- 最短记录：15分钟 / 最长：600分钟
- 预期海拔增量：280米 ± 50米

### 云数据库表
| 表名 | 说明 |
|------|------|
| t_workout | 攀登记录 |
| t_user | 用户信息（身份、统计） |
| t_culture | 文化卡片内容 |
| t_feedback | 反馈/申诉记录 |
| t_cobuilder | 共建者名录 |

## 项目历史
- V1.0 由 OpenClaw（MiniMax-M2.5）开发，已备份在 git 首次提交中
- V2.0 由 Claude 基于需求文档完全重写，7阶段增量开发

## 上线前待办
- [ ] 在微信云控制台创建数据库表（t_workout, t_user, t_culture, t_feedback, t_cobuilder）
- [ ] 部署所有6个云函数
- [ ] 运行 seedData 云函数导入初始数据
- [ ] 在 utils/weather.js 中填写和风天气 API_KEY
- [ ] 确认 app.js 中 TEST_MODE = false

## 注意事项
- 项目负责人不看代码，所有技术决策由 Claude 自主判断
- 遇到需求不明确的地方，主动询问而不是自行假设
- 保持小步提交，每完成一个功能模块就提交一次
