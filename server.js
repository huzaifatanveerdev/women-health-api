const path = require('path');
const express = require('express');
const dotenv = require('dotenv');
const connectDB = require('./config/database');
const errorHandler = require('./middleware/errorHandler');
const { languageMiddleware } = require('./middleware/languageMiddleware');
const { getLocalizedMessageFromRequest } = require('./utils/localization');

// Load environment variables
dotenv.config();

// Initialize express app
const app = express();
app.disable('x-powered-by');

// Connect to MongoDB and start server (cron runs after DB is ready)
connectDB()
  .then(() => {
    const { runExpireSubscriptions } = require('./jobs/expireSubscriptions');
    runExpireSubscriptions(); // run once on startup
  })
  .catch((err) => {
    console.error('Failed to start:', err);
    process.exit(1);
  });

// Middleware
app.use(express.json());

app.use(express.urlencoded({ extended: true }));

// Language middleware - must be applied before routes
app.use(languageMiddleware);

// Public landing route - intentionally minimal so the API surface is not exposed.
app.get('/', (req, res) => {
  res.type('text/plain').send('Welcome to women-help-api');
});

// Routes
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/subscription', require('./routes/subscriptionRoutes'));
app.use('/api/impact', require('./routes/impactRoutes'));
app.use('/api/webhooks', require('./routes/webhookRoutes'));
app.use('/api/symptoms', require('./routes/symptomsRoutes'));
app.use('/api/menstrual-flow', require('./routes/menstrualFlowInsightsRoutes'));
app.use('/api/app', require('./routes/appVersionRoutes'));

// Static pages (privacy policy, support, etc.)
app.get('/support', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'support.html'));
});
app.get('/privacy', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'privacy.html'));
});
app.use(express.static(path.join(__dirname, 'public')));

// Centralized error handling middleware
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: getLocalizedMessageFromRequest('error.route.not.found', req)
  });
});

// Start server
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
  console.log(`API Base URL: http://localhost:${PORT}/api`);
}); 