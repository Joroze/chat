const R = require('ramda');

function getGeneralUserInfo(user) {
  if (!user) return undefined;

  return R.omit(['ipAddress'], user);
}

module.exports = {
  getGeneralUserInfo,
};
