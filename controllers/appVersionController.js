const appVersionService = require('../services/appVersionService');

const getAppVersion = async (req, res, next) => {
  try {
    console.log('getAppVersion is called');
    const language = req.language || 'en';
    const data = await appVersionService.getAppVersionConfig(language);

    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAppVersion,
};
