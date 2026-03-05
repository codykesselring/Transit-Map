# US Transit Live Map

A web application to visualize public transit routes and live vehicle locations on an interactive map.

## Features

- Display transit routes and stops for selected cities
- Show live vehicle positions where available
- Zoom and pan to explore cities

## Supported Cities

- Spokane, WA (static routes only)
- Seattle, WA (static routes + live vehicles)

## How to Run

1. Clone or download the project files
2. Open a terminal in the project directory
3. Start a local server:
   ```bash
   python -m http.server 8000
   ```
   Or use any other local server
4. Open http://localhost:8000 in your browser

## Adding More Cities

To add more cities:

1. Find the GTFS static feed URL (google_transit.zip)
2. If realtime is available, find the vehicle positions URL (preferably GTFS-RT .pb or KMZ)
3. Add to gtfsUrls and realtimeUrls in app.js
4. Add coordinates and zoom level in the loadBtn event

## Data Sources

- Spokane Transit: https://www.spokanetransit.com/gtfs/
- King County Metro: https://metro.kingcounty.gov/GTFS/

## Technologies Used

- Leaflet.js for mapping
- JSZip for handling ZIP files
- PapaParse for CSV parsing
- DOMParser for KML parsing

## Future Enhancements

- Add more US cities
- Support GTFS-RT protobuf format
- Add trip planning features
- Real-time alerts and service updates