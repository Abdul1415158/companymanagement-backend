const express = require('express');
const {
    login,
    register,
    acceptInvitation,
    verifyInvitation,
    logout
} = require('../controllers/authController');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

router.post('/login', login);
router.post('/register', register);
router.post('/accept-invitation', acceptInvitation);
router.get('/verify-invitation', verifyInvitation);
router.post('/logout', authMiddleware, logout);

module.exports = router;
