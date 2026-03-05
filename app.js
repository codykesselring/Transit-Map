// Initialize map
let map;
let routeLayers = [];
let stopLayers = [];
let vehicleLayers = [];

function initMap(lat, lng, zoom) {
    if (map) map.remove();
    map = L.map('map').setView([lat, lng], zoom);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);
}

// GTFS URLs
const gtfsUrls = {
    spokane: 'https://www.spokanetransit.com/gtfs/google_transit.zip',
    seattle: 'https://metro.kingcounty.gov/GTFS/google_transit.zip'
};

const realtimeUrls = {
    spokane: null, // No public realtime for Spokane
    seattle: 'https://api.kingcounty.gov/mmcRealtime/vehiclePositions.kmz'
};

// Function to load GTFS
async function loadGTFS(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch GTFS');
        const zip = await JSZip.loadAsync(await response.arrayBuffer());

        // Clear previous layers
        routeLayers.forEach(layer => map.removeLayer(layer));
        stopLayers.forEach(layer => map.removeLayer(layer));
        routeLayers = [];
        stopLayers = [];

        // Parse routes
        const routesText = await zip.file('routes.txt').async('text');
        const routes = Papa.parse(routesText, {header: true}).data;

        // Parse stops
        const stopsText = await zip.file('stops.txt').async('text');
        const stops = Papa.parse(stopsText, {header: true}).data;

        // Parse trips
        const tripsText = await zip.file('trips.txt').async('text');
        const trips = Papa.parse(tripsText, {header: true}).data;

        // Parse shapes for routes
        const shapesText = await zip.file('shapes.txt').async('text');
        const shapes = Papa.parse(shapesText, {header: true}).data;

        // Group shapes by shape_id
        const shapeGroups = {};
        shapes.forEach(shape => {
            if (!shapeGroups[shape.shape_id]) shapeGroups[shape.shape_id] = [];
            shapeGroups[shape.shape_id].push([parseFloat(shape.shape_pt_lat), parseFloat(shape.shape_pt_lon)]);
        });

        // Display routes
        routes.forEach(route => {
            const routeTrips = trips.filter(trip => trip.route_id === route.route_id);
            const shapeId = routeTrips[0]?.shape_id;
            if (shapeId && shapeGroups[shapeId]) {
                const polyline = L.polyline(shapeGroups[shapeId], {
                    color: '#' + (route.route_color || '3388ff'),
                    weight: 3
                });
                polyline.addTo(map);
                routeLayers.push(polyline);
            }
        });

        // Display stops
        stops.forEach(stop => {
            const marker = L.circleMarker([parseFloat(stop.stop_lat), parseFloat(stop.stop_lon)], {
                radius: 3,
                color: 'red',
                fillColor: 'red',
                fillOpacity: 0.8
            });
            marker.bindPopup(stop.stop_name);
            marker.addTo(map);
            stopLayers.push(marker);
        });

        console.log('GTFS loaded successfully');
    } catch (error) {
        console.error('Error loading GTFS:', error);
        alert('Failed to load transit data');
    }
}

// Function to load realtime vehicles
async function loadRealtime(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch realtime');
        const zip = await JSZip.loadAsync(await response.arrayBuffer());

        // KMZ contains doc.kml
        const kmlText = await zip.file('doc.kml').async('text');

        // Parse KML
        const parser = new DOMParser();
        const kml = parser.parseFromString(kmlText, 'text/xml');

        // Clear previous vehicles
        vehicleLayers.forEach(layer => map.removeLayer(layer));
        vehicleLayers = [];

        // Get placemarks
        const placemarks = kml.querySelectorAll('Placemark');
        placemarks.forEach(placemark => {
            const point = placemark.querySelector('Point coordinates');
            if (point) {
                const coords = point.textContent.trim().split(',');
                const lng = parseFloat(coords[0]);
                const lat = parseFloat(coords[1]);
                const marker = L.marker([lat, lng], {
                    icon: L.icon({
                        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png',
                        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                        iconSize: [25, 41],
                        iconAnchor: [12, 41],
                        popupAnchor: [1, -34],
                        shadowSize: [41, 41]
                    })
                });
                marker.bindPopup(placemark.querySelector('name').textContent);
                marker.addTo(map);
                vehicleLayers.push(marker);
            }
        });

        console.log('Realtime data loaded');
    } catch (error) {
        console.error('Error loading realtime:', error);
    }
}

// Event listeners
document.getElementById('loadBtn').addEventListener('click', async () => {
    const city = document.getElementById('citySelect').value;
    let lat, lng, zoom;
    if (city === 'spokane') {
        lat = 47.6587;
        lng = -117.4260;
        zoom = 12;
    } else if (city === 'seattle') {
        lat = 47.6062;
        lng = -122.3321;
        zoom = 11;
    }
    initMap(lat, lng, zoom);

    // Load static data
    await loadGTFS(gtfsUrls[city]);

    // Load realtime if available
    if (realtimeUrls[city]) {
        await loadRealtime(realtimeUrls[city]);
        // Update every 30 seconds
        setInterval(() => loadRealtime(realtimeUrls[city]), 30000);
    }
});

// Initialize with Spokane
initMap(47.6587, -117.4260, 12);
loadGTFS(gtfsUrls.spokane);