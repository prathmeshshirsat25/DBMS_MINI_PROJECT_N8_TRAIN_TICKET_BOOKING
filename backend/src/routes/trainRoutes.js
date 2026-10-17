// routes/trainRoutes.js
// Express router for /trains endpoints.
//
// IMPORTANT: Static routes (/search, /available-dates) are registered BEFORE
// the parameterised route (/:id) to prevent Express from treating "search" or
// "available-dates" as a train ID.

const express = require('express');
const router = express.Router();

const {
  searchTrains,
  getTrains,
  getTrainById,
  getTrainRoutes,
  getTrainSchedule,
  getAvailableDates,
} = require('../controllers/trainController.js');

// ---- Static / named routes first -----------------------------------------

// GET /trains/search?from=&to=&date=&class=
router.get('/search', searchTrains);

// GET /trains/available-dates?from=&to=&class=&month=YYYY-MM
router.get('/available-dates', getAvailableDates);

// GET /trains?q=&page=&limit=
router.get('/', getTrains);

// ---- Parameterised routes after ------------------------------------------

// GET /trains/:id
router.get('/:id', getTrainById);

// GET /trains/:id/routes
router.get('/:id/routes', getTrainRoutes);

// GET /trains/:id/schedule?date=YYYY-MM-DD
router.get('/:id/schedule', getTrainSchedule);

module.exports = router;
