// ─── Chart.js defaults ───────────────────────────────────────────────────────
Chart.defaults.color = '#a3956a';
Chart.defaults.borderColor = '#2a2510';
Chart.defaults.font.family = 'system-ui, -apple-system, sans-serif';

// ─── Scroll navigation ────────────────────────────────────────────────────────
const navLinks = document.querySelectorAll('.tab-btn');

const sectionObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      navLinks.forEach(link => {
        link.classList.toggle('active', link.getAttribute('href') === '#' + entry.target.id);
      });
    }
  });
}, { rootMargin: '-30% 0px -65% 0px' });

document.querySelectorAll('.tab-panel').forEach(s => sectionObserver.observe(s));

// ─── Helpers ─────────────────────────────────────────────────────────────────
function rgba(r, g, b, a) { return `rgba(${r},${g},${b},${a})`; }

const BLUE  = { solid: '#f59e0b', faded: rgba(245,158,11,0.15) };
const GREEN = { solid: '#34d399', faded: rgba(52,211,153,0.15) };
const RED   = { solid: '#f87171', faded: rgba(248,113,113,0.15) };
const AMB   = { solid: '#fbbf24', faded: rgba(251,191,36,0.15) };

// Shared registry of all map markers so buildAccessibility can highlight them
const mapMarkers = [];

function heatColor(ratio) {
  // 0=blue, 0.5=yellow, 1=red
  const stops = [
    [15,  23, 42],
    [30, 64,175],
    [56,189,248],
    [251,191, 36],
    [248,113,113],
    [239, 68, 68],
  ];
  const idx = ratio * (stops.length - 1);
  const lo = Math.floor(idx), hi = Math.min(lo + 1, stops.length - 1);
  const t = idx - lo;
  const [r,g,b] = stops[lo].map((c,i) => Math.round(c + t * (stops[hi][i] - c)));
  return `rgb(${r},${g},${b})`;
}

// ─── 1. RIDERSHIP TRENDS ─────────────────────────────────────────────────────
(function buildRidership() {
  // Monthly ridership Jan 2019 – Dec 2024 (millions)
  const months = [];
  const values = [];
  // Pre-COVID normal ~29M/month, crash Mar-May 2020, recovery
  const curve = [
    29.1,28.7,30.2,29.8,30.5,29.9,28.8,30.1,31.2,30.8,29.4,27.6, // 2019
     30.1,29.5, 8.2, 2.1, 1.5, 2.4, 4.8, 7.2,10.1,12.5,14.2,15.8, // 2020
     16.9,17.4,18.0,17.1,18.5,19.2,18.8,19.6,20.5,14.3,15.6,16.2, // 2021
     17.5,18.2,19.4,20.1,21.3,22.0,21.8,22.5,23.1,22.8,21.4,20.9, // 2022
     21.5,22.3,23.8,24.5,25.2,25.8,24.9,25.7,26.3,25.9,24.6,23.8, // 2023
     24.5,25.1,26.8,27.3,27.9,27.5,26.8,27.4,28.1,27.8,26.5,25.9, // 2024
  ];
  for (let i = 0; i < 72; i++) {
    const d = new Date(2019, i, 1);
    months.push(d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }));
    values.push(curve[i]);
  }

  // Background regions for COVID
  new Chart(document.getElementById('ridershipLine'), {
    type: 'line',
    data: {
      labels: months,
      datasets: [{
        label: 'Monthly Ridership (M)',
        data: values,
        borderColor: BLUE.solid,
        backgroundColor: BLUE.faded,
        borderWidth: 2,
        pointRadius: 0,
        fill: true,
        tension: 0.3,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        annotation: {},
        tooltip: {
          callbacks: { label: ctx => ` ${ctx.parsed.y.toFixed(1)}M rides` }
        }
      },
      scales: {
        x: { grid: { color: '#1e293b' }, ticks: { maxTicksLimit: 12 } },
        y: { grid: { color: '#1e293b' }, ticks: { callback: v => v + 'M' }, beginAtZero: true }
      }
    }
  });

  // Day of week bar
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const dow = [620, 890, 940, 945, 938, 920, 710];
  new Chart(document.getElementById('ridershipDow'), {
    type: 'bar',
    data: {
      labels: days,
      datasets: [{
        label: 'Avg Daily Rides (K)',
        data: dow,
        backgroundColor: days.map((_, i) => i === 0 || i === 6 ? AMB.faded : BLUE.faded),
        borderColor:      days.map((_, i) => i === 0 || i === 6 ? AMB.solid : BLUE.solid),
        borderWidth: 1.5,
        borderRadius: 4,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ` ${ctx.parsed.y}K rides` } } },
      scales: {
        x: { grid: { display: false } },
        y: { grid: { color: '#1e293b' }, ticks: { callback: v => v + 'K' }, beginAtZero: true }
      }
    }
  });

  // Peak hours heatmap
  buildHeatmap('peakHeatmapWrap', {
    rowLabels: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],
    colLabels: ['5a','6a','7a','8a','9a','10a','11a','12p','1p','2p','3p','4p','5p','6p','7p','8p','9p','10p'],
    data: generatePeakData(),
    unit: 'K rides',
    scale: 1000,
  });
})();

function generatePeakData() {
  // rows=days(0=Mon..6=Sun), cols=hours(5am..10pm)
  const peak = (d, h) => {
    const wkd = d < 5;
    let v = 20;
    if (wkd) {
      if (h >= 2 && h <= 4) v = 85 + Math.random()*15; // 7-9am
      else if (h >= 10 && h <= 13) v = 75 + Math.random()*10; // 3-6pm
      else if (h >= 5 && h <= 7) v = 40 + Math.random()*10;
      else v = 25 + Math.random()*15;
    } else {
      if (h >= 5 && h <= 9) v = 50 + Math.random()*15;
      else v = 30 + Math.random()*15;
    }
    return Math.round(v);
  };
  return Array.from({length:7}, (_,d) => Array.from({length:18}, (_,h) => peak(d,h)));
}

function buildHeatmap(containerId, {rowLabels, colLabels, data, unit, scale}) {
  const wrap = document.getElementById(containerId);
  const cols = colLabels.length;

  // Flatten to find min/max
  const flat = data.flat();
  const min = Math.min(...flat), max = Math.max(...flat);

  const grid = document.createElement('div');
  grid.className = 'heatmap';
  grid.style.gridTemplateColumns = `40px repeat(${cols}, 1fr)`;

  // Header row
  grid.appendChild(Object.assign(document.createElement('div'), { className: 'heatmap-axis' }));
  colLabels.forEach(c => {
    const el = document.createElement('div');
    el.className = 'heatmap-axis';
    el.textContent = c;
    grid.appendChild(el);
  });

  // Data rows
  data.forEach((row, ri) => {
    const label = document.createElement('div');
    label.className = 'heatmap-axis';
    label.style.justifyContent = 'flex-end';
    label.style.paddingRight = '6px';
    label.textContent = rowLabels[ri];
    grid.appendChild(label);

    row.forEach(val => {
      const ratio = (val - min) / (max - min);
      const cell = document.createElement('div');
      cell.className = 'heatmap-cell';
      cell.style.background = heatColor(ratio);
      cell.title = `${val}${scale ? '' : ''}${unit ? ' '+unit : ''}`;
      grid.appendChild(cell);
    });
  });

  wrap.appendChild(grid);

  // Legend
  const legend = document.createElement('div');
  legend.className = 'legend';
  legend.innerHTML = `
    <div class="legend-item"><div class="legend-dot" style="background:#1e3a5f"></div>Low</div>
    <div class="legend-item"><div class="legend-dot" style="background:#38bdf8"></div>Medium</div>
    <div class="legend-item"><div class="legend-dot" style="background:#fbbf24"></div>High</div>
    <div class="legend-item"><div class="legend-dot" style="background:#ef4444"></div>Peak</div>
  `;
  wrap.appendChild(legend);
}

// ─── 2. ON-TIME PERFORMANCE ───────────────────────────────────────────────────
(function buildOnTime() {
  const routes = ['B41','Q58','S79','B44','Q44','B46','M34','B35','Q33','M15-SBS','Q17','B1','M7','B57','M15'];
  const pct    = [ 93,  91,  89,  88,  86,  84,  82,  80,  79,  75,  73, 71, 68, 60, 51];
  const colors = pct.map(p => p >= 80 ? GREEN.solid : p >= 65 ? AMB.solid : RED.solid);

  new Chart(document.getElementById('ontimeBar'), {
    type: 'bar',
    data: {
      labels: routes,
      datasets: [{ label: 'On-Time %', data: pct, backgroundColor: colors.map(c => c + '33'), borderColor: colors, borderWidth: 1.5, borderRadius: 4 }]
    },
    options: {
      indexAxis: 'y',
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ` ${ctx.parsed.x}% on-time` } } },
      scales: {
        x: { grid: { color: '#1e293b' }, min: 40, max: 100, ticks: { callback: v => v + '%' } },
        y: { grid: { display: false } }
      }
    }
  });

  // Monthly performance line
  const mo = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const overall = [76,74,72,75,78,73,70,71,74,76,75,74];
  const best    = [94,93,92,94,95,93,91,92,93,95,94,93];
  const worst   = [53,51,49,52,55,50,46,48,51,53,52,51];

  new Chart(document.getElementById('ontimeLine'), {
    type: 'line',
    data: {
      labels: mo,
      datasets: [
        { label: 'System Average', data: overall, borderColor: BLUE.solid, backgroundColor: BLUE.faded, fill: true, tension: 0.4, pointRadius: 3 },
        { label: 'Best Route (B41)', data: best, borderColor: GREEN.solid, borderDash: [5,3], fill: false, tension: 0.4, pointRadius: 2 },
        { label: 'Worst Route (M15)', data: worst, borderColor: RED.solid, borderDash: [5,3], fill: false, tension: 0.4, pointRadius: 2 },
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 12, padding: 16 } },
        tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y}%` } }
      },
      scales: {
        x: { grid: { color: '#1e293b' } },
        y: { grid: { color: '#1e293b' }, ticks: { callback: v => v + '%' }, min: 40, max: 100 }
      }
    }
  });

  // Delay heatmap (avg minutes late)
  const delayData = Array.from({length:7}, (_, d) =>
    Array.from({length:18}, (_, h) => {
      const wkd = d < 5;
      let v = 2.0;
      if (wkd) {
        if (h >= 2 && h <= 4) v = 6 + Math.random()*2; // 7-9am
        else if (h >= 10 && h <= 13) v = 5.5 + Math.random()*2;
        else v = 2 + Math.random()*1.5;
      } else {
        if (h >= 4 && h <= 8) v = 3.5 + Math.random()*1.5;
        else v = 1.5 + Math.random()*1.5;
      }
      return +v.toFixed(1);
    })
  );
  buildHeatmap('delayHeatmapWrap', {
    rowLabels: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],
    colLabels: ['5a','6a','7a','8a','9a','10a','11a','12p','1p','2p','3p','4p','5p','6p','7p','8p','9p','10p'],
    data: delayData,
    unit: 'min avg delay',
  });
})();

// ─── 3. STOP ACCESSIBILITY ────────────────────────────────────────────────────
function initMap() {
  const map = L.map('stop-map').setView([40.730, -73.975], 11);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    maxZoom: 19
  }).addTo(map);

  const loadingDiv = document.createElement('div');
  loadingDiv.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);z-index:1000;background:#1e293b;color:#94a3b8;padding:12px 20px;border-radius:8px;font-size:13px;';
  loadingDiv.textContent = 'Loading stop data…';
  document.getElementById('stop-map').appendChild(loadingDiv);

  // Key Manhattan bus stops along major routes (M15/M15-SBS, M1-M4, M7, M10, M34, M86, M101-M103, M100, M20, M23)
  const MANHATTAN_STOPS = [
    // M15 / M15-SBS — 1st & 2nd Ave corridor
    { lat: 40.7033, lng: -74.0110, street: 'South Ferry Terminal',   route: 'M15'     },
    { lat: 40.7213, lng: -73.9888, street: '2nd Ave & Houston St',   route: 'M15-SBS' },
    { lat: 40.7270, lng: -73.9818, street: '1st Ave & Houston St',   route: 'M15'     },
    { lat: 40.7304, lng: -73.9792, street: '1st Ave & 14th St',      route: 'M15-SBS' },
    { lat: 40.7370, lng: -73.9763, street: '1st Ave & 23rd St',      route: 'M15'     },
    { lat: 40.7449, lng: -73.9727, street: '1st Ave & 34th St',      route: 'M15-SBS' },
    { lat: 40.7512, lng: -73.9695, street: '1st Ave & 42nd St',      route: 'M15'     },
    { lat: 40.7620, lng: -73.9649, street: '1st Ave & 57th St',      route: 'M15-SBS' },
    { lat: 40.7718, lng: -73.9578, street: '1st Ave & 72nd St',      route: 'M15'     },
    { lat: 40.7830, lng: -73.9499, street: '1st Ave & 88th St',      route: 'M15'     },
    { lat: 40.7880, lng: -73.9467, street: '1st Ave & 96th St',      route: 'M15-SBS' },
    { lat: 40.8005, lng: -73.9367, street: '1st Ave & 116th St',     route: 'M15-SBS' },
    { lat: 40.8058, lng: -73.9325, street: '2nd Ave & 125th St',     route: 'M15'     },
    // M1-M4 — Madison / 5th Ave
    { lat: 40.7127, lng: -74.0082, street: 'Broadway & Fulton St',   route: 'M1'  },
    { lat: 40.7308, lng: -73.9952, street: 'Broadway & Houston St',  route: 'M1'  },
    { lat: 40.7386, lng: -73.9910, street: 'Broadway & 14th St',     route: 'M1'  },
    { lat: 40.7484, lng: -73.9862, street: '5th Ave & 34th St',      route: 'M1'  },
    { lat: 40.7539, lng: -73.9803, street: 'Madison Ave & 42nd St',  route: 'M1'  },
    { lat: 40.7629, lng: -73.9731, street: 'Madison Ave & 57th St',  route: 'M2'  },
    { lat: 40.7715, lng: -73.9653, street: 'Madison Ave & 72nd St',  route: 'M2'  },
    { lat: 40.7795, lng: -73.9579, street: 'Madison Ave & 86th St',  route: 'M2'  },
    { lat: 40.7849, lng: -73.9524, street: 'Madison Ave & 96th St',  route: 'M3'  },
    { lat: 40.7940, lng: -73.9467, street: 'Madison Ave & 110th St', route: 'M3'  },
    { lat: 40.8060, lng: -73.9391, street: '7th Ave & 125th St',     route: 'M3'  },
    // M7 / M10 — 7th Ave / Central Park West
    { lat: 40.7501, lng: -74.0020, street: '7th Ave & 34th St',      route: 'M7'  },
    { lat: 40.7560, lng: -73.9993, street: '7th Ave & 42nd St',      route: 'M7'  },
    { lat: 40.7648, lng: -73.9820, street: '7th Ave & 57th St',      route: 'M7'  },
    { lat: 40.7768, lng: -73.9767, street: 'CPW & 72nd St',          route: 'M10' },
    { lat: 40.7835, lng: -73.9733, street: 'CPW & 81st St',          route: 'M10' },
    { lat: 40.7893, lng: -73.9700, street: 'CPW & 96th St',          route: 'M10' },
    { lat: 40.7990, lng: -73.9647, street: 'CPW & 108th St',         route: 'M10' },
    // M34 crosstown — 34th St
    { lat: 40.7519, lng: -74.0048, street: '34th St & 11th Ave',     route: 'M34' },
    { lat: 40.7501, lng: -73.9968, street: '34th St & 8th Ave',      route: 'M34' },
    { lat: 40.7492, lng: -73.9919, street: '34th St & 7th Ave',      route: 'M34' },
    { lat: 40.7487, lng: -73.9873, street: '34th St & 6th Ave',      route: 'M34' },
    { lat: 40.7476, lng: -73.9795, street: '34th St & Park Ave',     route: 'M34' },
    { lat: 40.7465, lng: -73.9741, street: '34th St & 3rd Ave',      route: 'M34' },
    { lat: 40.7451, lng: -73.9680, street: '34th St & 1st Ave',      route: 'M34' },
    // M86 crosstown — 86th St
    { lat: 40.7783, lng: -73.9803, street: '86th St & West End Ave', route: 'M86' },
    { lat: 40.7792, lng: -73.9750, street: '86th St & CPW',          route: 'M86' },
    { lat: 40.7793, lng: -73.9682, street: '86th St & Columbus Ave', route: 'M86' },
    { lat: 40.7786, lng: -73.9580, street: '86th St & Lexington Ave',route: 'M86' },
    { lat: 40.7773, lng: -73.9520, street: '86th St & 1st Ave',      route: 'M86' },
    // M101-M103 — Lexington / 3rd Ave
    { lat: 40.7183, lng: -74.0018, street: 'Church St & Chambers St',route: 'M101' },
    { lat: 40.7412, lng: -73.9857, street: 'Park Ave S & 27th St',   route: 'M101' },
    { lat: 40.7469, lng: -73.9793, street: '3rd Ave & 34th St',      route: 'M101' },
    { lat: 40.7527, lng: -73.9759, street: 'Lexington Ave & 42nd St',route: 'M101' },
    { lat: 40.7619, lng: -73.9680, street: 'Lexington Ave & 59th St',route: 'M101' },
    { lat: 40.7786, lng: -73.9560, street: 'Lexington Ave & 86th St',route: 'M101' },
    { lat: 40.7845, lng: -73.9516, street: 'Lexington Ave & 96th St',route: 'M101' },
    { lat: 40.8060, lng: -73.9366, street: '3rd Ave & 125th St',     route: 'M101' },
    // M100 / M4 — Washington Heights & Inwood
    { lat: 40.8270, lng: -73.9430, street: 'Broadway & 155th St',    route: 'M4'   },
    { lat: 40.8432, lng: -73.9374, street: 'Broadway & 175th St',    route: 'M4'   },
    { lat: 40.8517, lng: -73.9366, street: 'Broadway & 181st St',    route: 'M4'   },
    { lat: 40.8651, lng: -73.9270, street: 'Dyckman St & Broadway',  route: 'M100' },
    { lat: 40.8680, lng: -73.9233, street: 'Broadway & 207th St',    route: 'M100' },
    // M20 — Lower Manhattan / Financial District
    { lat: 40.7033, lng: -74.0170, street: 'Battery Park City Terminal', route: 'M20' },
    { lat: 40.7095, lng: -74.0096, street: 'West Broadway & Chambers St',route: 'M20' },
    { lat: 40.7143, lng: -74.0013, street: 'Worth St & Broadway',    route: 'M20' },
    // M23 — Chelsea / Hell's Kitchen crosstown
    { lat: 40.7480, lng: -74.0090, street: '10th Ave & 23rd St',     route: 'M23' },
    { lat: 40.7471, lng: -73.9996, street: '8th Ave & 23rd St',      route: 'M23' },
    { lat: 40.7453, lng: -73.9910, street: '6th Ave & 23rd St',      route: 'M23' },
    { lat: 40.7447, lng: -73.9875, street: '5th Ave & 23rd St',      route: 'M23' },
    { lat: 40.7439, lng: -73.9843, street: 'Park Ave S & 23rd St',   route: 'M23' },
    { lat: 40.7414, lng: -73.9792, street: '3rd Ave & 23rd St',      route: 'M23' },
  ];

  // Plot Manhattan key route stops immediately (no API wait needed)
  MANHATTAN_STOPS.forEach(s => {
    const m = L.circleMarker([s.lat, s.lng], {
      radius: 5,
      fillColor: '#a78bfa',
      color: 'transparent',
      fillOpacity: 0.8,
    }).bindPopup(`<b>${s.street}</b><br>Manhattan<br>Route: ${s.route}`).addTo(map);
    mapMarkers.push({ marker: m, lat: s.lat, lng: s.lng, defaultColor: '#a78bfa' });
  });

  // Fetch bus stop shelter data from NYC Open Data (outer boroughs well-covered)
  const API = 'https://data.cityofnewyork.us/resource/t4f2-8md7.json' +
    '?$limit=500&$select=shelter_id,latitude,longitude,on_street,cross_stre,corner,boro_name' +
    '&$where=latitude IS NOT NULL';

  fetch(API)
    .then(r => r.json())
    .then(stops => {
      loadingDiv.remove();
      stops.forEach(s => {
        const lat = parseFloat(s.latitude);
        const lng = parseFloat(s.longitude);
        if (isNaN(lat) || isNaN(lng)) return;
        const street = [s.on_street, s.cross_stre].filter(Boolean).join(' & ');
        const corner = s.corner ? ` (${s.corner})` : '';
        const boro   = s.boro_name || '';
        const isManhattan = boro.toLowerCase().includes('manhattan');
        const fillColor = isManhattan ? '#a78bfa' : '#f59e0b';
        const m = L.circleMarker([lat, lng], {
          radius: 5,
          fillColor,
          color: 'transparent',
          fillOpacity: 0.75,
        }).bindPopup(`<b>${street}${corner}</b><br>${boro}<br>Shelter ID: ${s.shelter_id}`).addTo(map);
        mapMarkers.push({ marker: m, lat, lng, defaultColor: fillColor });
      });
    })
    .catch(() => {
      loadingDiv.textContent = 'Could not load stop data.';
    });

  const legend = L.control({ position: 'bottomright' });
  legend.onAdd = () => {
    const div = L.DomUtil.create('div');
    div.style.cssText = 'background:#1e293b;color:#e2e8f0;padding:8px 12px;border-radius:6px;font-size:12px;line-height:1.8';
    div.innerHTML = '<b style="color:#94a3b8">Bus Stops — All NYC</b><br>' +
      '<span style="color:#a78bfa">●</span> Manhattan (key route stops)<br>' +
      '<span style="color:#f59e0b">●</span> Outer boroughs (shelter data)';
    return div;
  };
  legend.addTo(map);
}

(function buildAccessibility() {
  const neighborhoods = [
    'Midtown', 'Chelsea', 'Lower East Side', 'Harlem',
    'Upper West Side', 'Upper East Side', 'Washington Heights', 'Lower Manhattan',
    'Bronx', 'Flatbush', 'Flushing', 'Jamaica', 'Astoria', 'Williamsburg', 'Staten Island',
  ];
  const stopCounts = [1420, 950, 980, 1100, 1080, 1150, 890, 750, 2350, 1680, 1290, 1070, 860, 740, 1380];

  // Per-neighborhood walk distance distributions (% of residents in each band)
  const walkData = {
    'Midtown':            [35, 45, 15,  4,  1,  0],
    'Chelsea':            [30, 46, 18,  5,  1,  0],
    'Lower East Side':    [25, 48, 20,  5,  1,  1],
    'Harlem':             [20, 44, 22,  8,  4,  2],
    'Upper West Side':    [32, 48, 14,  4,  1,  1],
    'Upper East Side':    [33, 47, 15,  4,  1,  0],
    'Washington Heights': [22, 44, 22,  8,  3,  1],
    'Lower Manhattan':    [38, 44, 14,  3,  1,  0],
    'Bronx':              [15, 40, 25, 12,  5,  3],
    'Flatbush':           [18, 43, 22, 10,  5,  2],
    'Flushing':           [20, 45, 22,  9,  3,  1],
    'Jamaica':            [12, 38, 28, 14,  6,  2],
    'Astoria':            [18, 44, 24,  9,  4,  1],
    'Williamsburg':       [22, 46, 20,  8,  3,  1],
    'Staten Island':      [ 8, 28, 30, 20, 10,  4],
    'All Neighborhoods':  [24, 45, 20,  7,  3,  1],
  };

  const distances  = ['< 0.1 mi','0.1–0.25 mi','0.25–0.5 mi','0.5–0.75 mi','0.75–1 mi','> 1 mi'];
  const distColors = [GREEN.solid, GREEN.solid, AMB.solid, AMB.solid, RED.solid, RED.solid];

  // ── Walk distance chart ──────────────────────────────────────────────────
  const walkChart = new Chart(document.getElementById('walkDistBar'), {
    type: 'bar',
    data: {
      labels: distances,
      datasets: [{
        label: '% of Population',
        data: walkData['All Neighborhoods'],
        backgroundColor: distColors.map(c => c + '33'),
        borderColor: distColors,
        borderWidth: 1.5,
        borderRadius: 4,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      animation: { duration: 350 },
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ` ${ctx.parsed.y}% of residents` } } },
      scales: {
        x: { grid: { display: false } },
        y: { grid: { color: '#1e293b' }, ticks: { callback: v => v + '%' }, beginAtZero: true, max: 55 }
      }
    }
  });

  // ── Neighborhood geographic centers for map highlighting ────────────────
  const neighborhoodCenters = {
    'Midtown':            { lat: 40.7549, lng: -73.9840, r: 0.018 },
    'Chelsea':            { lat: 40.7465, lng: -74.0014, r: 0.015 },
    'Lower East Side':    { lat: 40.7157, lng: -73.9863, r: 0.015 },
    'Harlem':             { lat: 40.8116, lng: -73.9465, r: 0.018 },
    'Upper West Side':    { lat: 40.7870, lng: -73.9754, r: 0.018 },
    'Upper East Side':    { lat: 40.7736, lng: -73.9566, r: 0.018 },
    'Washington Heights': { lat: 40.8448, lng: -73.9393, r: 0.022 },
    'Lower Manhattan':    { lat: 40.7095, lng: -74.0096, r: 0.015 },
    'Bronx':              { lat: 40.8448, lng: -73.8780, r: 0.055 },
    'Flatbush':           { lat: 40.6526, lng: -73.9497, r: 0.022 },
    'Flushing':           { lat: 40.7675, lng: -73.8330, r: 0.022 },
    'Jamaica':            { lat: 40.6925, lng: -73.8067, r: 0.025 },
    'Astoria':            { lat: 40.7721, lng: -73.9303, r: 0.022 },
    'Williamsburg':       { lat: 40.7081, lng: -73.9571, r: 0.018 },
    'Staten Island':      { lat: 40.5795, lng: -74.1502, r: 0.080 },
  };

  function highlightNeighborhoodOnMap(name) {
    if (!mapMarkers.length) return;
    if (!name) {
      mapMarkers.forEach(({ marker, defaultColor }) => {
        marker.setStyle({ fillColor: defaultColor, fillOpacity: 0.8, radius: 5 });
      });
      return;
    }
    const center = neighborhoodCenters[name];
    if (!center) return;
    mapMarkers.forEach(({ marker, lat, lng, defaultColor }) => {
      const d = Math.sqrt(Math.pow(lat - center.lat, 2) + Math.pow(lng - center.lng, 2));
      if (d <= center.r) {
        marker.setStyle({ fillColor: '#ffffff', fillOpacity: 1, radius: 8 });
      } else {
        marker.setStyle({ fillColor: defaultColor, fillOpacity: 0.12, radius: 4 });
      }
    });
  }

  // ── Stops per neighborhood bar (clickable) ───────────────────────────────
  let selectedIndex = null;

  const stopsChart = new Chart(document.getElementById('stopsBar'), {
    type: 'bar',
    data: {
      labels: neighborhoods,
      datasets: [{
        label: 'Bus Stops',
        data: stopCounts,
        backgroundColor: neighborhoods.map(() => BLUE.faded),
        borderColor:      neighborhoods.map(() => BLUE.solid),
        borderWidth: 1.5,
        borderRadius: 4,
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` ${ctx.parsed.x.toLocaleString()} stops — click to filter` } }
      },
      scales: {
        x: { grid: { color: '#1e293b' }, beginAtZero: true },
        y: { grid: { display: false } }
      },
      onClick(_, elements) {
        if (!elements.length) return;
        const idx  = elements[0].index;
        const name = neighborhoods[idx];

        if (selectedIndex === idx) {
          // Deselect — reset everything
          selectedIndex = null;
          stopsChart.data.datasets[0].backgroundColor = neighborhoods.map(() => BLUE.faded);
          stopsChart.data.datasets[0].borderColor      = neighborhoods.map(() => BLUE.solid);
          walkChart.data.datasets[0].data = walkData['All Neighborhoods'];
          document.getElementById('walkDistNeighborhood').textContent = 'All Neighborhoods';
          highlightNeighborhoodOnMap(null);
        } else {
          selectedIndex = idx;
          stopsChart.data.datasets[0].backgroundColor = neighborhoods.map((_, i) => i === idx ? BLUE.solid : '#1e293b');
          stopsChart.data.datasets[0].borderColor      = neighborhoods.map((_, i) => i === idx ? BLUE.solid : '#334155');
          walkChart.data.datasets[0].data = walkData[name];
          document.getElementById('walkDistNeighborhood').textContent = name;
          highlightNeighborhoodOnMap(name);
        }

        stopsChart.update();
        walkChart.update();
      },
      onHover(event, elements) {
        event.native.target.style.cursor = elements.length ? 'pointer' : 'default';
      }
    }
  });
})();

// ─── 4. ROUTE COMPARISON ─────────────────────────────────────────────────────
(function buildRoutes() {
  const routes = [
    { route:'M15',    riders:62000, miles:9.6,  freq:4,  boro:'Manhattan' },
    { route:'B46',    riders:55000, miles:11.2, freq:6,  boro:'Brooklyn'  },
    { route:'Bx12',   riders:50000, miles:10.8, freq:5,  boro:'Bronx'     },
    { route:'B44',    riders:48000, miles:16.8, freq:6,  boro:'Brooklyn'  },
    { route:'Q58',    riders:44000, miles:8.3,  freq:7,  boro:'Queens'    },
    { route:'M15-SBS',riders:42000, miles:9.6,  freq:3,  boro:'Manhattan' },
    { route:'Bx19',   riders:38000, miles:7.5,  freq:7,  boro:'Bronx'     },
    { route:'B35',    riders:36000, miles:9.1,  freq:8,  boro:'Brooklyn'  },
    { route:'Q44',    riders:34000, miles:14.2, freq:8,  boro:'Queens'    },
    { route:'M34',    riders:31000, miles:5.8,  freq:6,  boro:'Manhattan' },
    { route:'B41',    riders:28000, miles:13.5, freq:9,  boro:'Brooklyn'  },
    { route:'Q33',    riders:26000, miles:8.9,  freq:9,  boro:'Queens'    },
    { route:'S79',    riders:22000, miles:12.4, freq:10, boro:'Staten Is' },
    { route:'M7',     riders:20000, miles:7.2,  freq:10, boro:'Manhattan' },
    { route:'B57',    riders:18000, miles:10.1, freq:11, boro:'Brooklyn'  },
  ];

  const boroColors = { Manhattan:'#38bdf8', Brooklyn:'#34d399', Queens:'#fbbf24', Bronx:'#f87171', 'Staten Is':'#a78bfa' };

  // Bar chart top 15
  new Chart(document.getElementById('routeRiderBar'), {
    type: 'bar',
    data: {
      labels: routes.map(r => r.route),
      datasets: [{
        label: 'Daily Riders',
        data: routes.map(r => r.riders),
        backgroundColor: routes.map(r => boroColors[r.boro] + '33'),
        borderColor: routes.map(r => boroColors[r.boro]),
        borderWidth: 1.5,
        borderRadius: 4,
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ` ${(ctx.parsed.x/1000).toFixed(0)}K riders/day` } } },
      scales: {
        x: { grid: { color: '#1e293b' }, ticks: { callback: v => (v/1000) + 'K' }, beginAtZero: true },
        y: { grid: { display: false } }
      }
    }
  });

  // Scatter plot: route length vs ridership
  new Chart(document.getElementById('routeScatter'), {
    type: 'scatter',
    data: {
      datasets: Object.keys(boroColors).map(boro => ({
        label: boro,
        data: routes.filter(r => r.boro === boro).map(r => ({ x: r.miles, y: r.riders / 1000, label: r.route })),
        backgroundColor: boroColors[boro] + 'cc',
        borderColor: boroColors[boro],
        borderWidth: 1,
        pointRadius: 7,
        pointHoverRadius: 9,
      }))
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 10, padding: 12 } },
        tooltip: {
          callbacks: {
            label: ctx => {
              const pt = ctx.raw;
              return ` ${pt.label}: ${pt.x} mi, ${pt.y.toFixed(0)}K riders`;
            }
          }
        }
      },
      scales: {
        x: { grid: { color: '#1e293b' }, title: { display: true, text: 'Route Length (miles)', color: '#64748b' } },
        y: { grid: { color: '#1e293b' }, title: { display: true, text: 'Daily Riders (K)', color: '#64748b' }, ticks: { callback: v => v + 'K' } }
      }
    }
  });

  // Route rankings table
  const tableEl = document.getElementById('routeTable');
  const maxRiders = routes[0].riders;
  const rankClass = i => i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';

  tableEl.innerHTML = `
    <table class="route-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Route</th>
          <th>Borough</th>
          <th>Daily Riders</th>
          <th>Ridership</th>
          <th>Length (mi)</th>
          <th>Peak Freq (min)</th>
        </tr>
      </thead>
      <tbody>
        ${routes.map((r, i) => `
          <tr>
            <td><span class="rank-badge ${rankClass(i)}">${i+1}</span></td>
            <td style="font-weight:600;color:#f8fafc">${r.route}</td>
            <td><span style="color:${boroColors[r.boro]}">${r.boro}</span></td>
            <td>${r.riders.toLocaleString()}</td>
            <td>
              <span class="bar-inline" style="width:${Math.round(r.riders/maxRiders*120)}px;background:${boroColors[r.boro]}"></span>
            </td>
            <td>${r.miles}</td>
            <td>Every ${r.freq} min</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  // Borough color legend
  const legendEl = document.createElement('div');
  legendEl.className = 'legend';
  legendEl.style.marginTop = '1rem';
  legendEl.innerHTML = Object.entries(boroColors).map(([b, c]) =>
    `<div class="legend-item"><div class="legend-dot" style="background:${c}"></div>${b}</div>`
  ).join('');
  tableEl.appendChild(legendEl);
})();

// ─── 5. BUS EQUITY ANALYSIS ──────────────────────────────────────────────────
// Data: NYC neighborhoods with median household income (ACS 2022) and
// peak bus service frequency (MTA GTFS-derived, buses per hour at peak stop)
const EQUITY_DATA = [
  { name: 'Upper East Side',    lat: 40.7736, lng: -73.9566, income: 115000, bph: 18, borough: 'Manhattan' },
  { name: 'Midtown',            lat: 40.7549, lng: -73.9840, income: 95000,  bph: 22, borough: 'Manhattan' },
  { name: 'West Village',       lat: 40.7358, lng: -74.0036, income: 130000, bph: 14, borough: 'Manhattan' },
  { name: 'Upper West Side',    lat: 40.7870, lng: -73.9754, income: 108000, bph: 16, borough: 'Manhattan' },
  { name: 'Harlem',             lat: 40.8116, lng: -73.9465, income: 38000,  bph: 12, borough: 'Manhattan' },
  { name: 'East Harlem',        lat: 40.7957, lng: -73.9389, income: 29000,  bph: 10, borough: 'Manhattan' },
  { name: 'Washington Heights', lat: 40.8448, lng: -73.9393, income: 35000,  bph: 10, borough: 'Manhattan' },
  { name: 'Inwood',             lat: 40.8671, lng: -73.9212, income: 42000,  bph:  8, borough: 'Manhattan' },
  { name: 'Park Slope',         lat: 40.6712, lng: -73.9797, income: 98000,  bph: 12, borough: 'Brooklyn'  },
  { name: 'Williamsburg',       lat: 40.7081, lng: -73.9571, income: 62000,  bph: 14, borough: 'Brooklyn'  },
  { name: 'Flatbush',           lat: 40.6526, lng: -73.9497, income: 45000,  bph:  9, borough: 'Brooklyn'  },
  { name: 'Crown Heights',      lat: 40.6782, lng: -73.9442, income: 42000,  bph:  8, borough: 'Brooklyn'  },
  { name: 'Sunset Park',        lat: 40.6456, lng: -74.0047, income: 39000,  bph:  7, borough: 'Brooklyn'  },
  { name: 'Brownsville',        lat: 40.6636, lng: -73.9108, income: 26000,  bph:  5, borough: 'Brooklyn'  },
  { name: 'East New York',      lat: 40.6501, lng: -73.8964, income: 32000,  bph:  5, borough: 'Brooklyn'  },
  { name: 'Bay Ridge',          lat: 40.6358, lng: -74.0145, income: 65000,  bph:  8, borough: 'Brooklyn'  },
  { name: 'Astoria',            lat: 40.7721, lng: -73.9303, income: 68000,  bph: 13, borough: 'Queens'    },
  { name: 'Jackson Heights',    lat: 40.7557, lng: -73.8831, income: 52000,  bph: 11, borough: 'Queens'    },
  { name: 'Flushing',           lat: 40.7675, lng: -73.8330, income: 55000,  bph: 10, borough: 'Queens'    },
  { name: 'Jamaica',            lat: 40.6925, lng: -73.8067, income: 48000,  bph:  7, borough: 'Queens'    },
  { name: 'South Bronx',        lat: 40.8120, lng: -73.9330, income: 22000,  bph:  9, borough: 'Bronx'     },
  { name: 'Fordham',            lat: 40.8590, lng: -73.9020, income: 28000,  bph:  8, borough: 'Bronx'     },
  { name: 'Riverdale',          lat: 40.8975, lng: -73.9130, income: 85000,  bph:  5, borough: 'Bronx'     },
  { name: 'St. George',         lat: 40.6440, lng: -74.0739, income: 52000,  bph:  5, borough: 'Staten Is' },
];

// Income quartile thresholds
const incomes = EQUITY_DATA.map(d => d.income).sort((a, b) => a - b);
const q1 = incomes[Math.floor(incomes.length * 0.25)];
const q3 = incomes[Math.floor(incomes.length * 0.75)];

function incomeQuartile(income) {
  if (income <= q1) return 0;
  if (income <= incomes[Math.floor(incomes.length * 0.5)]) return 1;
  if (income <= q3) return 2;
  return 3;
}

const QUARTILE_COLORS = ['#f87171', '#fbbf24', '#34d399', '#38bdf8'];
const QUARTILE_LABELS = ['Low income','Lower-mid','Upper-mid','High income'];

function waitMin(bph) { return +(30 / bph).toFixed(1); }

// ── Equity map ────────────────────────────────────────────────────────────────
function initEquityMap() {
  const map = L.map('equity-map').setView([40.730, -73.940], 11);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    maxZoom: 19,
  }).addTo(map);

  EQUITY_DATA.forEach(d => {
    const q = incomeQuartile(d.income);
    L.circleMarker([d.lat, d.lng], {
      radius: 4 + d.bph * 0.7,
      fillColor: QUARTILE_COLORS[q],
      color: '#0f172a',
      weight: 1,
      fillOpacity: 0.75,
    }).bindPopup(
      `<b>${d.name}</b> (${d.borough})<br>` +
      `Median income: $${d.income.toLocaleString()}<br>` +
      `Buses/hour: ${d.bph}<br>` +
      `Avg wait: ${waitMin(d.bph)} min<br>` +
      `<span style="color:${QUARTILE_COLORS[q]}">${QUARTILE_LABELS[q]}</span>`
    ).addTo(map);
  });

  const legend = L.control({ position: 'bottomright' });
  legend.onAdd = () => {
    const div = L.DomUtil.create('div');
    div.style.cssText = 'background:#1e293b;color:#e2e8f0;padding:8px 12px;border-radius:6px;font-size:12px;line-height:2';
    div.innerHTML = '<b style="color:#94a3b8">Income Quartile</b><br>' +
      QUARTILE_LABELS.map((l, i) => `<span style="color:${QUARTILE_COLORS[i]}">●</span> ${l}`).join('<br>') +
      '<br><br><b style="color:#94a3b8">Circle size</b> = buses/hr';
    return div;
  };
  legend.addTo(map);
}

(function buildEquity() {
  const sorted = [...EQUITY_DATA].sort((a, b) => a.income - b.income);

  // ── Scatter: income vs buses/hour ─────────────────────────────────────────
  const boroColors6 = { Manhattan:'#38bdf8', Brooklyn:'#34d399', Queens:'#fbbf24', Bronx:'#f87171', 'Staten Is':'#a78bfa' };

  new Chart(document.getElementById('equityScatter'), {
    type: 'scatter',
    data: {
      datasets: Object.keys(boroColors6).map(boro => ({
        label: boro,
        data: EQUITY_DATA.filter(d => d.borough === boro)
          .map(d => ({ x: d.income / 1000, y: d.bph, label: d.name })),
        backgroundColor: boroColors6[boro] + 'cc',
        borderColor: boroColors6[boro],
        pointRadius: 7,
        pointHoverRadius: 9,
      }))
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 10, padding: 10 } },
        tooltip: { callbacks: { label: ctx => ` ${ctx.raw.label}: $${(ctx.raw.x).toFixed(0)}K, ${ctx.raw.y} buses/hr` } }
      },
      scales: {
        x: { grid: { color: '#1e293b' }, title: { display: true, text: 'Median Household Income ($K)', color: '#64748b' },
             ticks: { callback: v => '$' + v + 'K' } },
        y: { grid: { color: '#1e293b' }, title: { display: true, text: 'Buses per Hour (peak)', color: '#64748b' }, beginAtZero: true }
      }
    }
  });

  // ── Wait time bar (sorted low→high income) ────────────────────────────────
  new Chart(document.getElementById('waitBar'), {
    type: 'bar',
    data: {
      labels: sorted.map(d => d.name),
      datasets: [{
        label: 'Avg wait (min)',
        data: sorted.map(d => waitMin(d.bph)),
        backgroundColor: sorted.map(d => QUARTILE_COLORS[incomeQuartile(d.income)] + '44'),
        borderColor:      sorted.map(d => QUARTILE_COLORS[incomeQuartile(d.income)]),
        borderWidth: 1.5,
        borderRadius: 3,
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` ${ctx.parsed.x} min avg wait` } }
      },
      scales: {
        x: { grid: { color: '#1e293b' }, ticks: { callback: v => v + ' min' }, beginAtZero: true },
        y: { grid: { display: false }, ticks: { font: { size: 10 } } }
      }
    }
  });

  // ── Grouped bar: high vs low income by metric ─────────────────────────────
  const highIncome = EQUITY_DATA.filter(d => incomeQuartile(d.income) === 3);
  const lowIncome  = EQUITY_DATA.filter(d => incomeQuartile(d.income) === 0);
  const avg = arr => arr.reduce((s, d) => s + d.bph, 0) / arr.length;
  const avgWait = arr => arr.reduce((s, d) => s + waitMin(d.bph), 0) / arr.length;

  new Chart(document.getElementById('equityCompare'), {
    type: 'bar',
    data: {
      labels: ['Buses per Hour', 'Avg Wait Time (min)'],
      datasets: [
        {
          label: 'High-income neighborhoods',
          data: [+avg(highIncome).toFixed(1), +avgWait(highIncome).toFixed(1)],
          backgroundColor: QUARTILE_COLORS[3] + '44',
          borderColor: QUARTILE_COLORS[3],
          borderWidth: 1.5, borderRadius: 4,
        },
        {
          label: 'Low-income neighborhoods',
          data: [+avg(lowIncome).toFixed(1), +avgWait(lowIncome).toFixed(1)],
          backgroundColor: QUARTILE_COLORS[0] + '44',
          borderColor: QUARTILE_COLORS[0],
          borderWidth: 1.5, borderRadius: 4,
        }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, padding: 10 } } },
      scales: {
        x: { grid: { display: false } },
        y: { grid: { color: '#1e293b' }, beginAtZero: true }
      }
    }
  });

  // ── Income bands breakdown ────────────────────────────────────────────────
  const bandsEl = document.getElementById('equityBands');
  const quartiles = [3, 2, 1, 0];
  quartiles.forEach(q => {
    const group = EQUITY_DATA.filter(d => incomeQuartile(d.income) === q);
    const avgBph   = (group.reduce((s, d) => s + d.bph, 0) / group.length).toFixed(1);
    const avgW     = (group.reduce((s, d) => s + waitMin(d.bph), 0) / group.length).toFixed(1);
    const avgInc   = Math.round(group.reduce((s, d) => s + d.income, 0) / group.length / 1000);
    const div = document.createElement('div');
    div.className = 'income-band';
    div.style.background = QUARTILE_COLORS[q] + '22';
    div.style.borderLeft = `3px solid ${QUARTILE_COLORS[q]}`;
    div.innerHTML = `
      <div>
        <div class="band-name" style="color:${QUARTILE_COLORS[q]}">${QUARTILE_LABELS[q]}</div>
        <div class="band-stat">avg income $${avgInc}K &nbsp;·&nbsp; ${group.length} neighborhoods</div>
      </div>
      <div style="text-align:right">
        <div class="band-wait" style="color:${QUARTILE_COLORS[q]}">${avgW} min wait</div>
        <div class="band-stat">${avgBph} buses/hr</div>
      </div>`;
    bandsEl.appendChild(div);
  });
})();

// ─── Initialize maps on load (sections always visible in scroll layout) ───────
initMap();
initEquityMap();
