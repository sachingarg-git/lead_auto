const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const {
  getLeads, getLead, createLead, updateLeadStatus, updateLead, assignLead,
  getStats, getFollowUps, addFollowUp, getActivity,
  sendEmail, sendWhatsApp,
  deleteLead,
} = require('../controllers/leadController');

router.use(authenticate);

router.get('/',               authorize('leads:read'),   getLeads);
router.get('/stats',          authorize('leads:read'),   getStats);
router.get('/:id',            authorize('leads:read'),   getLead);
router.post('/',              authorize('leads:write'),  createLead);
router.patch('/:id',          authorize('leads:write'),  updateLead);
router.patch('/:id/status',   authorize('leads:status'), updateLeadStatus);
router.patch('/:id/assign',   authorize('leads:write'),  assignLead);
router.delete('/:id',         authorize('leads:write'),  deleteLead);

// FollowUp + activity log
router.get('/:id/followups',  authorize('leads:read'),   getFollowUps);
router.post('/:id/followups', authorize('leads:status'), addFollowUp);
router.get('/:id/activity',   authorize('leads:read'),   getActivity);

// Manual send
router.post('/:id/send-email',     authorize('leads:write'), sendEmail);
router.post('/:id/send-whatsapp',  authorize('leads:write'), sendWhatsApp);

module.exports = router;
