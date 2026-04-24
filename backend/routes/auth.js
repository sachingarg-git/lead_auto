const router = require('express').Router();
const { login, me } = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const rateLimit = require('express-rate-limit');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts. Try again in 15 minutes.' },
});

router.post('/login', loginLimiter, login);
router.get('/me', authenticate, me);

module.exports = router;
