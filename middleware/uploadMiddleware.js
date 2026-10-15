const multer = require('multer');
const path = require('path');

// Configure multer for memory storage
const storage = multer.memoryStorage();

// File filter function
const fileFilter = (req, file, cb) => {
  // Check file type
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

// Configure multer
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: fileFilter
});

// Middleware for single file upload
const uploadSingle = upload.single('profilePicture');
const uploadIcon = upload.single('icon');

// Wrapper middleware with error handling
const uploadProfilePicture = (req, res, next) => {
  uploadSingle(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: 'File size too large. Maximum size is 5MB.'
        });
      }
      return res.status(400).json({
        success: false,
        message: `Upload error: ${err.message}`
      });
    } else if (err) {
      return res.status(400).json({
        success: false,
        message: err.message
      });
    }

    // Profile picture is optional for updateUser endpoint
    // Only check if file exists when it's a dedicated profile picture upload
    if (req.route.path.includes('/profile-picture') && !req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please upload a profile picture'
      });
    }

    next();
  });
};

// Wrapper middleware for subscription plan icon upload
const uploadSubscriptionPlanIcon = (req, res, next) => {
  uploadIcon(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: 'File size too large. Maximum size is 5MB.'
        });
      }
      return res.status(400).json({
        success: false,
        message: `Upload error: ${err.message}`
      });
    } else if (err) {
      return res.status(400).json({
        success: false,
        message: err.message
      });
    }

    // Icon is required for subscription plan creation
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please upload an icon image'
      });
    }

    next();
  });
};

module.exports = {
  uploadProfilePicture,
  uploadSubscriptionPlanIcon
}; 