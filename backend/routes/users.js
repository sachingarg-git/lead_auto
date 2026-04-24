const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { adminOnly } = require('../middleware/rbac');
const { listUsers, createUser, updateUser, toggleUserActive, listRoles } = require('../controllers/userController');

router.use(authenticate);

router.get('/',               adminOnly, listUsers);
router.post('/',              adminOnly, createUser);
router.patch('/:id',          adminOnly, updateUser);
router.patch('/:id/toggle',   adminOnly, toggleUserActive);
router.get('/roles',          listRoles);

module.exports = router;
