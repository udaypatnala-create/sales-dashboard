let globalData = [];
let filteredData = [];
let charts = {};

Chart.defaults.color = "#8b949e";
Chart.defaults.font.family = "'Outfit', sans-serif";
Chart.defaults.scale.grid.color = "rgba(255, 255, 255, 0.05)";

async function init() {
    try {
        const response = await fetch('data.json');
        globalData = await response.json();
        filteredData = [...globalData];
        
        populateFilters();
        addEventListeners();
        renderDashboard();
    } catch (error) {
        console.error("Error loading data:", error);
        document.getElementById('kpi-revenue').textContent = "Error";
    }
}

function processOptions(key) {
    const rawItems = globalData.map(d => d[key]);
    const unique = [...new Set(rawItems)].filter(Boolean).filter(k => k !== 'Unknown' && k !== 'nan');
    unique.sort();
    return unique;
}

function populateFilters() {
    const ffy = document.getElementById('fy-filter');
    const freg = document.getElementById('region-filter');
    const fag = document.getElementById('agency-filter');
    const fcam = document.getElementById('campaign-filter');

    processOptions('fy').forEach(opt => ffy.add(new Option(opt, opt)));
    processOptions('region').forEach(opt => freg.add(new Option(opt, opt)));
    processOptions('agency').forEach(opt => fag.add(new Option(opt, opt)));
    
    // Some campaigns might be too long or null
    processOptions('campaign').forEach(opt => {
        const label = opt.length > 50 ? opt.substring(0, 50) + "..." : opt;
        fcam.add(new Option(label, opt));
    });
}

function addEventListeners() {
    ['fy-filter', 'region-filter', 'agency-filter', 'campaign-filter', 'time-filter', 'date-from', 'date-to'].forEach(id => {
        document.getElementById(id).addEventListener('change', (e) => {
            if (id === 'time-filter') {
                document.getElementById('custom-date-group').style.display = e.target.value === 'Custom' ? 'flex' : 'none';
            }
            applyFilters();
        });
        
        // Also fire instantly while typing on Custom dates
        if (id.startsWith('date-')) {
            document.getElementById(id).addEventListener('input', applyFilters);
        }
    });

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
            
            e.target.classList.add('active');
            const targetId = e.target.getAttribute('data-tab');
            document.getElementById(targetId).classList.add('active');
        });
    });
}

function applyFilters() {
    const fyTarget = document.getElementById('fy-filter').value;
    const regTarget = document.getElementById('region-filter').value;
    const agTarget = document.getElementById('agency-filter').value;
    const camTarget = document.getElementById('campaign-filter').value;
    const timeTarget = document.getElementById('time-filter').value;
    
    const dFrom = new Date(document.getElementById('date-from').value);
    const dTo = new Date(document.getElementById('date-to').value);
    
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    filteredData = globalData.filter(d => {
        let textMatch = (fyTarget === 'All' || d.fy === fyTarget) &&
               (regTarget === 'All' || d.region === regTarget) &&
               (agTarget === 'All' || d.agency === agTarget) &&
               (camTarget === 'All' || d.campaign === camTarget);
               
        if (!textMatch) return false;
        if (timeTarget === 'All') return true;
        
        // Hide records missing valid dates when a strict date range filter is active
        if (!d.date || d.date === 'Unknown') return false;
        
        const itemDate = new Date(d.date);
        if (isNaN(itemDate.getTime())) return false;
        
        if (timeTarget === 'This Month') {
            return itemDate.getMonth() === currentMonth && itemDate.getFullYear() === currentYear;
        } else if (timeTarget === 'Last Month') {
            let lm = currentMonth - 1;
            let ly = currentYear;
            if (lm < 0) { lm = 11; ly--; }
            return itemDate.getMonth() === lm && itemDate.getFullYear() === ly;
        } else if (timeTarget === 'Custom') {
            if (!isNaN(dFrom.getTime()) && itemDate < dFrom) return false;
            // Shift to end of day for precise inclusive filtering
            if (!isNaN(dTo.getTime())) {
                const toEnd = new Date(dTo.getTime());
                toEnd.setHours(23, 59, 59, 999);
                if (itemDate > toEnd) return false;
            }
        }
        return true;
    });

    renderDashboard();
}

function renderDashboard() {
    const totalRev = filteredData.reduce((sum, d) => sum + (d.amount || 0), 0);
    const totalCamp = new Set(filteredData.map(d => d.campaign)).size;
    
    document.getElementById('kpi-revenue').textContent = `₹${(totalRev / 10000000).toLocaleString('en-IN', { maximumFractionDigits: 2 })} Cr`;
    document.getElementById('kpi-campaigns').textContent = totalCamp.toLocaleString('en-IN');
    document.getElementById('kpi-records').textContent = filteredData.length.toLocaleString('en-IN');

    updateTrendChart();
    updateAgencyChart();
    updateRegionChart();
    renderTables();
}

function renderTables() {
    const tableIndia = document.querySelector('#table-india tbody');
    const tableExport = document.querySelector('#table-export tbody');
    const tablePg = document.querySelector('#table-pg tbody');
    
    let indHtml = [];
    let expHtml = [];
    let pgHtml = [];
    
    let indTotal = 0;
    let expTotal = 0;
    let pgTotal = 0;
    
    // Performance guard
    const maxRows = 1000;
    
    filteredData.forEach(d => {
        const row = `<tr>
            <td>${d.fy || '-'}</td>
            <td>${d.date || '-'}</td>
            <td>${d.agency || '-'}</td>
            <td>${d.campaign || '-'}</td>
            <td>₹${(d.amount || 0).toLocaleString('en-IN', {maximumFractionDigits: 2})}</td>
        </tr>`;
        
        if (d.region === "India") {
            indTotal += (d.amount || 0);
            if (indHtml.length < maxRows) indHtml.push(row);
        } else if (d.region === "Export") {
            expTotal += (d.amount || 0);
            if (expHtml.length < maxRows) expHtml.push(row);
        } else if (d.region === "PG Sales") {
            pgTotal += (d.amount || 0);
            if (pgHtml.length < maxRows) pgHtml.push(row);
        }
    });

    tableIndia.innerHTML = indHtml.join('');
    tableExport.innerHTML = expHtml.join('');
    tablePg.innerHTML = pgHtml.join('');

    // Update the sub-total headers and footers
    const fInd = `₹${(indTotal / 10000000).toLocaleString('en-IN', {maximumFractionDigits: 2})} Cr`;
    const fExp = `₹${(expTotal / 10000000).toLocaleString('en-IN', {maximumFractionDigits: 2})} Cr`;
    const fPg = `₹${(pgTotal / 10000000).toLocaleString('en-IN', {maximumFractionDigits: 2})} Cr`;

    document.getElementById('india-total-inr').textContent = `Total: ${fInd}`;
    document.getElementById('export-total-inr').textContent = `Total: ${fExp}`;
    document.getElementById('pg-total-inr').textContent = `Total: ${fPg}`;

    document.getElementById('india-table-footer-total').textContent = fInd;
    document.getElementById('export-table-footer-total').textContent = fExp;
    document.getElementById('pg-table-footer-total').textContent = fPg;
}

function createChart(ctxId, type, data, options) {
    const ctx = document.getElementById(ctxId).getContext('2d');
    if (charts[ctxId]) {
        charts[ctxId].destroy();
    }
    charts[ctxId] = new Chart(ctx, { type, data, options });
}

function updateTrendChart() {
    const grouped = {};
    filteredData.forEach(d => {
        const f = d.fy && d.fy !== "Unknown" ? d.fy : "Other";
        grouped[f] = (grouped[f] || 0) + d.amount;
    });

    const sortedFys = Object.keys(grouped).sort();
    // Converting to Crores for readability on Y-axis
    const dataVals = sortedFys.map(f => grouped[f] / 10000000);

    const data = {
        labels: sortedFys,
        datasets: [{
            label: 'Revenue (₹ Cr)',
            data: dataVals,
            borderColor: '#58a6ff',
            backgroundColor: 'rgba(88, 166, 255, 0.2)',
            borderWidth: 3,
            fill: true,
            tension: 0.4,
            pointBackgroundColor: '#fff',
            pointRadius: 5,
            pointHoverRadius: 8
        }]
    };
    
    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: {
                callbacks: {
                    label: function(context) {
                        return '₹' + context.parsed.y.toLocaleString('en-IN', {maximumFractionDigits: 2}) + ' Cr';
                    }
                }
            }
        }
    };

    createChart('trendChart', 'line', data, options);
}

function updateAgencyChart() {
    const grouped = {};
    filteredData.forEach(d => {
        if (!d.agency || d.agency === "Unknown") return;
        grouped[d.agency] = (grouped[d.agency] || 0) + d.amount;
    });

    const sorted = Object.entries(grouped)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
        
    const data = {
        labels: sorted.map(s => s[0].length > 15 ? s[0].slice(0, 15) + '...' : s[0]),
        datasets: [{
            label: 'Revenue',
            data: sorted.map(s => s[1] / 10000000), // Converted to Cr
            backgroundColor: 'rgba(132, 60, 250, 0.8)',
            borderRadius: 6
        }]
    };

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: {
                callbacks: {
                    label: function(context) {
                        return '₹' + context.parsed.y.toLocaleString('en-IN', {maximumFractionDigits: 2}) + ' Cr';
                    }
                }
            }
        },
        scales: {
            x: {
                ticks: {
                    autoSkip: false,
                    maxRotation: 45,
                    minRotation: 45
                }
            }
        }
    };

    createChart('agencyChart', 'bar', data, options);
}

function updateRegionChart() {
    const grouped = {};
    filteredData.forEach(d => {
        const r = d.region || "Unknown";
        grouped[r] = (grouped[r] || 0) + d.amount;
    });

    const data = {
        labels: Object.keys(grouped),
        datasets: [{
            data: Object.values(grouped).map(v => v / 10000000),
            backgroundColor: [
                '#353ae6',
                '#843cfa',
                '#fa3cc3'
            ],
            borderWidth: 0,
            hoverOffset: 12
        }]
    };

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'right',
                labels: { color: '#e6edf3', padding: 20 }
            },
            tooltip: {
                callbacks: {
                    label: function(context) {
                        return '₹' + context.parsed.toLocaleString('en-IN', {maximumFractionDigits: 2}) + ' Cr';
                    }
                }
            }
        },
        cutout: '75%'
    };

    createChart('regionChart', 'doughnut', data, options);
}

init();
