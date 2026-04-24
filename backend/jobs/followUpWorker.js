/**
 * Follow-up worker is now merged into reminderWorker.js.
 * This file is kept for import compatibility.
 */
function startFollowUpWorker() {
  // No-op: handled by reminderWorker's unified cron poller
}

module.exports = { startFollowUpWorker };
