const router = require('express').Router();

router.use('/health', require('./health.routes'));
router.use('/auth', require('./auth.routes'));                    // Phase 2
router.use('/departments', require('./department.routes'));       // Phase 3
router.use('/doctors', require('./doctor.routes'));               // Phase 3 (+ slots in Phase 4)
router.use('/searches', require('./search.routes'));              // Phase 3
router.use('/appointments', require('./appointment.routes'));     // Phase 4
router.use('/availability', require('./availability.routes'));    // Phase 4
router.use('/payments', require('./payment.routes'));             // Phase 4 (demo)

router.use('/patients', require('./patient.routes'));             // Phase 5
router.use('/reports', require('./report.routes'));               // Phase 5
router.use('/prescriptions', require('./prescription.routes'));   // Phase 5
router.use('/notifications', require('./notification.routes'));   // Phase 5
router.use('/doctor', require('./doctorPortal.routes'));          // Phase 6
router.use('/admin', require('./admin.routes'));                  // Phase 7

router.use('/', require('./public.routes'));                     // Phase 8: contact, emergency, articles, finder, meta
router.use('/packages', require('./package.routes'));             // Phase 8
router.use('/insurance', require('./insurance.routes'));          // Phase 8
router.use('/feedback', require('./feedback.routes'));            // Phase 8
router.use('/teleconsultations', require('./teleconsultation.routes')); // Phase 8 (simulated)

module.exports = router;
