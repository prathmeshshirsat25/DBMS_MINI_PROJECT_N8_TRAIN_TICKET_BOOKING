// controllers/stationController.js
// Handles station search and retrieval for the Railway Booking System

const { query } = require('../config/db.js');

/**
 * GET /stations?q=query
 * Search stations by station_code, station_name, or city (case-insensitive).
 * Returns up to 20 results if q is provided, otherwise first 50 stations.
 */
const getAllStations = async (req, res) => {
  try {
    const { q } = req.query;

    let result;
    if (q && q.trim()) {
      const searchTerm = `%${q.trim()}%`;
      result = await query(
        `SELECT station_id, station_code, station_name, city, state
         FROM stations
         WHERE station_code ILIKE $1
            OR station_name ILIKE $1
            OR city ILIKE $1
         ORDER BY station_name
         LIMIT 20`,
        [searchTerm]
      );
    } else {
      result = await query(
        `SELECT station_id, station_code, station_name, city, state
         FROM stations
         ORDER BY station_name
         LIMIT 50`
      );
    }

    return res.status(200).json({
      success: true,
      count: result.rows.length,
      data: result.rows,
    });
  } catch (err) {
    console.error('[stationController.getAllStations]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch stations',
      error: err.message,
    });
  }
};

/**
 * GET /stations/:id
 * Returns a single station by its primary key.
 */
const getStationById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT station_id, station_code, station_name, city, state
       FROM stations
       WHERE station_id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Station with id ${id} not found`,
      });
    }

    return res.status(200).json({
      success: true,
      data: result.rows[0],
    });
  } catch (err) {
    console.error('[stationController.getStationById]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch station',
      error: err.message,
    });
  }
};

module.exports = { getAllStations, getStationById };
