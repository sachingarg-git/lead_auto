const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { adminOnly } = require('../middleware/rbac');
const { query } = require('../config/database');
const {
  listUsers, createUser, updateUser, toggleUserActive, listRoles,
  resetPassword, generatePin, removePin,
} = require('../controllers/userController');

router.use(authenticate);

// ── Lightweight member list for assign-dropdowns (all authenticated users) ──
// Returns only id + name + role_name — no sensitive fields
router.get('/members', async (req, res) => {
  try {
    const result = await query(
      `SELECT u.id, u.name, r.name AS role_name
       FROM "Users" u JOIN "Roles" r ON u.role_id = r.id
       WHERE u.is_active = true ORDER BY u.name`
    );
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch members' });
  }
});

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
