const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { adminOnly } = require('../middleware/rbac');
const {
  listUsers, createUser, updateUser, toggleUserActive, listRoles,
  resetPassword, generatePin, removePin,
} = require('../controllers/userController');

router.use(authenticate);

router.get('/',                  adminOnly, listUsers);
router.post('/',                 adminOnly, createUser);
router.patch('/:id',             adminOnly, updateUser);
router.patch('/:id/toggle',      adminOnly, toggleUserActive);
router.get('/roles',             listRoles);

// 2FA & password management (admin only)
router.post('/:id/reset-password', adminOnly, resetPassword);
router.post('/:id/generate-pin',   adminOnly, generatePin);
router.delete('/:id/pin',          adminOnly, removePin);

module.exports = router;
