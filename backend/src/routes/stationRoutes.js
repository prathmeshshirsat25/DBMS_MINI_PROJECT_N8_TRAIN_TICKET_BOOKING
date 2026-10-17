// routes/stationRoutes.js
// Express router for /stations endpoints

const express = require('express');
const router = express.Router();
const { getAllStations, getStationById } = require('../controllers/stationController.js');

// GET /stations?q=query
router.get('/', getAllStations);

// GET /stations/:id
router.get('/:id', getStationById);

module.exports = router;
