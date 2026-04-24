const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const {
  getLeads, getLead, createLead, updateLeadStatus, updateLead, getStats,
  getFollowUps, addFollowUp, deleteLead,
} = require('../controllers/leadController');

router.use(authenticate);

router.get('/',                  authorize('leads:read'),   getLeads);
router.get('/stats',             authorize('leads:read'),   getStats);
router.get('/:id',               authorize('leads:read'),   getLead);
router.post('/',                 authorize('leads:write'),  createLead);
router.patch('/:id',             authorize('leads:write'),  updateLead);
router.patch('/:id/status',      authorize('leads:status'), updateLeadStatus);
router.delete('/:id',            authorize('leads:write'),  deleteLead);

// FollowUp history
router.get('/:id/followups',     authorize('leads:read'),   getFollowUps);
router.post('/:id/followups',    authorize('leads:status'), addFollowUp);

module.exports = router;
