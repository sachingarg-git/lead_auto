const router = require('express').Router();
const { login, verifyPin, me, changePassword, changePinSelf, removePinSelf } = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const rateLimit = require('express-rate-limit');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts. Try again in 15 minutes.' },
});

// Rate limit PIN attempts separately (tighter)
const pinLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 8,
  message: { error: 'Too many PIN attempts. Try again in 10 minutes.' },
});

router.post('/login',      loginLimiter, login);
router.post('/verify-pin', pinLimiter,   verifyPin);
router.get('/me',          authenticate, me);

// ── Self-service account management (authenticated user only) ─
router.patch('/change-password', authenticate, changePassword);
router.patch('/change-pin',      authenticate, changePinSelf);
router.delete('/remove-pin',     authenticate, removePinSelf);

module.exports = router;
