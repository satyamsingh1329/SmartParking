const express = require('express');
const router = express.Router();
const { getFavorites, toggleFavorite } = require('../controllers/favoriteController');
const { protect } = require('../middleware/auth');

router.use(protect);
router.get('/', getFavorites);
router.post('/', toggleFavorite);

module.exports = router;
