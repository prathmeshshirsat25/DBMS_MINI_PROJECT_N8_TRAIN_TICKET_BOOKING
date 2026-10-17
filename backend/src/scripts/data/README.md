# Railway data import

Loads ~2,000 real express/mail/superfast trains, ~2,900 stations and ~44,000 stops
(DataMeet Indian Railways data, CC0: https://github.com/datameet/railways) so that
searches between main stations return trains.

Run from the `backend` folder (where `.env` lives):

    node src/scripts/importRailwayData.js            # dry run - changes nothing, prints the plan
    node src/scripts/importRailwayData.js --apply    # do the import (one transaction, all-or-nothing)

Options: `--days=90` (days of schedules), `--replace-routes=thin|never` (default thin).

Notes
- Safe to run twice: no duplicates are created. Nothing is ever deleted except the
  *routes* of existing trains that have fewer stops than the dataset (e.g. 2-stop demo
  trains); this is skipped automatically if another table references routes.
- Existing stations/trains are never renamed. The dataset code CSTM is mapped to CSMT.
- Timetable is a ~2017 snapshot (newer trains such as Vande Bharat are not included).
  Every train is scheduled DAILY for the next 90 days (demo assumption).
- Per-stop distances are estimated from station coordinates, scaled to each train's
  published total distance. Fares are computed by the backend as before.
- Seats are created on demand by the existing seat controller; nothing to seed.
- `data/build_dataset.py` rebuilds `railways-main.json.gz` from the three DataMeet JSON files.
