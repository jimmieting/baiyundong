// 云函数：获取OpenID
exports.main = async (event, context) => {
  const wxContext = wx.getWXContext();
  
  return {
    openid: wxContext.OPENID,
    appid: wxContext.APPID,
    unionid: wxContext.UNIONID
  };
};
