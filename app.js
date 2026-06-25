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
        
        // Load custom items from local storage
        const localItems = JSON.parse(localStorage.getItem('customBillingItems') || '[]');
        globalData = [...globalData, ...localItems];
        
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
    const freg = document.getElementById('region-filter');
    const fclient = document.getElementById('client-filter');
    const fops = document.getElementById('ops-filter');
    const fsales = document.getElementById('sales-filter');

    // Clear existing options except "All"
    freg.innerHTML = '<option value="All">All Regions</option>';
    fclient.innerHTML = '<option value="All">All Clients</option>';
    fops.innerHTML = '<option value="All">All Ops</option>';
    fsales.innerHTML = '<option value="All">All Sales</option>';

    processOptions('region').forEach(opt => freg.add(new Option(opt, opt)));
    processOptions('client_name').forEach(opt => {
        const label = opt.length > 50 ? opt.substring(0, 50) + "..." : opt;
        fclient.add(new Option(label, opt));
    });
    processOptions('ops_name').forEach(opt => fops.add(new Option(opt, opt)));
    processOptions('sales_contact').forEach(opt => fsales.add(new Option(opt, opt)));
}

function addEventListeners() {
    ['region-filter', 'client-filter', 'ops-filter', 'sales-filter', 'time-filter', 'date-from', 'date-to', 'search-filter'].forEach(id => {
        const el = document.getElementById(id);
        if(!el) return;
        el.addEventListener('change', (e) => {
            if (id === 'time-filter') {
                document.getElementById('custom-date-group').style.display = e.target.value === 'Custom' ? 'flex' : 'none';
            }
            applyFilters();
        });
        
        if (id.startsWith('date-') || id === 'search-filter') {
            el.addEventListener('input', applyFilters);
        }
    });

    document.querySelectorAll('.tab-btn').forEach(btn => {
        if(btn.id === 'btn-add-item' || btn.id === 'btn-cancel' || btn.type === 'submit') return;
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.tabs-nav .tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
            
            e.target.classList.add('active');
            const targetId = e.target.getAttribute('data-tab');
            if(targetId) {
                document.getElementById(targetId).classList.add('active');
            }
        });
    });

    // Modal Events
    document.getElementById('btn-add-item').addEventListener('click', () => {
        document.getElementById('add-modal').classList.add('active');
    });

    document.getElementById('btn-cancel').addEventListener('click', () => {
        document.getElementById('add-modal').classList.remove('active');
    });

    document.getElementById('add-form').addEventListener('submit', handleAddFormSubmit);
}

function handleAddFormSubmit(e) {
    e.preventDefault();
    const region = document.getElementById('new-region').value;
    const client = document.getElementById('new-client').value;
    const campaign = document.getElementById('new-campaign').value;
    const ops = document.getElementById('new-ops').value;
    const sales = document.getElementById('new-sales').value;
    const status = document.getElementById('new-status').value;
    const billType = document.getElementById('new-billing-type').value;
    const rawRo = parseFloat(document.getElementById('new-ro').value) || 0;
    const currency = document.getElementById('new-currency').value;
    const exchange = parseFloat(document.getElementById('new-exchange').value) || 1;
    const startDt = document.getElementById('new-start').value;
    const endDt = document.getElementById('new-end').value;

    const roInr = rawRo * exchange;

    let newItems = [];
    
    if (billType === 'Monthly' && startDt && endDt) {
        const sDate = new Date(startDt);
        const eDate = new Date(endDt);
        
        let months = (eDate.getFullYear() - sDate.getFullYear()) * 12;
        months -= sDate.getMonth();
        months += eDate.getMonth();
        months = months <= 0 ? 1 : months + 1; // inclusive of start and end month

        const monthlyRo = roInr / months;

        for (let i = 0; i < months; i++) {
            let splitDate = new Date(sDate.getFullYear(), sDate.getMonth() + i, 1);
            let dateStr = splitDate.toISOString().split('T')[0];
            
            newItems.push({
                region, date: dateStr, client_name: client, campaign, ops_name: ops,
                status, ro_amount: roInr, amount: monthlyRo, start_dt: startDt, end_dt: endDt,
                sales_contact: sales, platform: "", currency, exchange_rate: exchange
            });
        }
    } else {
        // End of campaign or no valid dates
        newItems.push({
            region, date: endDt || startDt, client_name: client, campaign, ops_name: ops,
            status, ro_amount: roInr, amount: roInr, start_dt: startDt, end_dt: endDt,
            sales_contact: sales, platform: "", currency, exchange_rate: exchange
        });
    }

    const localItems = JSON.parse(localStorage.getItem('customBillingItems') || '[]');
    localItems.push(...newItems);
    localStorage.setItem('customBillingItems', JSON.stringify(localItems));

    globalData.push(...newItems);
    
    // reset form and close
    document.getElementById('add-form').reset();
    document.getElementById('add-modal').classList.remove('active');
    
    populateFilters();
    applyFilters();
}

function applyFilters() {
    const regTarget = document.getElementById('region-filter').value;
    const clientTarget = document.getElementById('client-filter').value;
    const opsTarget = document.getElementById('ops-filter').value;
    const salesTarget = document.getElementById('sales-filter').value;
    const timeTarget = document.getElementById('time-filter').value;
    const searchTarget = document.getElementById('search-filter').value.toLowerCase().trim();
    
    const dFrom = new Date(document.getElementById('date-from').value);
    const dTo = new Date(document.getElementById('date-to').value);
    
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    filteredData = globalData.filter(d => {
        let textMatch = (regTarget === 'All' || d.region === regTarget) &&
               (clientTarget === 'All' || d.client_name === clientTarget) &&
               (opsTarget === 'All' || d.ops_name === opsTarget) &&
               (salesTarget === 'All' || d.sales_contact === salesTarget);
               
        if (!textMatch) return false;
        
        if (searchTarget !== "") {
            const cl = d.client_name ? d.client_name.toLowerCase() : "";
            const cam = d.campaign ? d.campaign.toLowerCase() : "";
            const op = d.ops_name ? d.ops_name.toLowerCase() : "";
            const sa = d.sales_contact ? d.sales_contact.toLowerCase() : "";
            if (!cl.includes(searchTarget) && !cam.includes(searchTarget) && !op.includes(searchTarget) && !sa.includes(searchTarget)) {
                return false;
            }
        }

        if (timeTarget === 'All') return true;
        
        if (!d.date || d.date === 'Unknown' || d.date === '') return false;
        
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

function getStatusBadge(statusStr) {
    if(!statusStr) return '-';
    let s = statusStr.toLowerCase();
    if(s.includes('yet to start')) return `<span class="badge badge-grey">${statusStr}</span>`;
    if(s.includes('delivering')) return `<span class="badge badge-green">${statusStr}</span>`;
    if(s.includes('stop') || s.includes('complet') || s.includes('paus')) return `<span class="badge badge-red">${statusStr}</span>`;
    if(s.includes('invoice')) return `<span class="badge badge-blue">${statusStr}</span>`;
    return `<span class="badge badge-grey">${statusStr}</span>`;
}

function renderDashboard() {
    const totalRev = filteredData.reduce((sum, d) => sum + (d.amount || 0), 0);
    const totalCamp = new Set(filteredData.map(d => d.campaign)).size;
    
    document.getElementById('kpi-revenue').textContent = `₹${(totalRev / 100000).toLocaleString('en-IN', { maximumFractionDigits: 2 })} L`;
    document.getElementById('kpi-campaigns').textContent = totalCamp.toLocaleString('en-IN');
    document.getElementById('kpi-records').textContent = filteredData.length.toLocaleString('en-IN');

    updateTrendChart();
    updateClientChart();
    updateRegionChart();
    renderSummaryTable();
    renderTables();
}

function renderSummaryTable() {
    const tableBody = document.querySelector('#table-summary tbody');
    if (!tableBody) return;
    let summaryData = {};
    let grandTotal = 0;
    
    filteredData.forEach(d => {
        const r = d.region || "Unknown";
        if (!summaryData[r]) {
            summaryData[r] = { records: 0, campaigns: new Set(), revenue: 0 };
        }
        summaryData[r].records += 1;
        if(d.campaign) summaryData[r].campaigns.add(d.campaign);
        summaryData[r].revenue += (d.amount || 0);
        grandTotal += (d.amount || 0);
    });

    let html = [];
    for (const [region, data] of Object.entries(summaryData)) {
        html.push(`<tr>
            <td>${region}</td>
            <td>${data.records.toLocaleString('en-IN')}</td>
            <td>${data.campaigns.size.toLocaleString('en-IN')}</td>
            <td>₹${(data.revenue / 100000).toLocaleString('en-IN', {maximumFractionDigits: 2})} L</td>
        </tr>`);
    }

    tableBody.innerHTML = html.join('');
    document.getElementById('summary-table-footer-total').textContent = `₹${(grandTotal / 100000).toLocaleString('en-IN', {maximumFractionDigits: 2})} L`;
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
    
    const maxRows = 1000;
    
    filteredData.forEach(d => {
        // Date | Client Name | Campaign | Ops | Sales | Status | Revenue (₹)
        const row = `<tr>
            <td>${d.date || '-'}</td>
            <td>${d.client_name || '-'}</td>
            <td>${d.campaign || '-'}</td>
            <td>${d.ops_name || '-'}</td>
            <td>${d.sales_contact || '-'}</td>
            <td>${getStatusBadge(d.status)}</td>
            <td>₹${(d.amount || 0).toLocaleString('en-IN', {maximumFractionDigits: 2})}</td>
        </tr>`;
        
        if (d.region === "India") {
            indTotal += (d.amount || 0);
            if (indHtml.length < maxRows) indHtml.push(row);
        } else if (d.region === "Foreign") {
            expTotal += (d.amount || 0);
            if (expHtml.length < maxRows) expHtml.push(row);
        } else if (d.region.includes("PG")) {
            pgTotal += (d.amount || 0);
            if (pgHtml.length < maxRows) pgHtml.push(row);
        }
    });

    if(tableIndia) tableIndia.innerHTML = indHtml.join('');
    if(tableExport) tableExport.innerHTML = expHtml.join('');
    if(tablePg) tablePg.innerHTML = pgHtml.join('');

    const fInd = `₹${(indTotal / 100000).toLocaleString('en-IN', {maximumFractionDigits: 2})} L`;
    const fExp = `₹${(expTotal / 100000).toLocaleString('en-IN', {maximumFractionDigits: 2})} L`;
    const fPg = `₹${(pgTotal / 100000).toLocaleString('en-IN', {maximumFractionDigits: 2})} L`;

    if(document.getElementById('india-total-inr')) document.getElementById('india-total-inr').textContent = `Total: ${fInd}`;
    if(document.getElementById('export-total-inr')) document.getElementById('export-total-inr').textContent = `Total: ${fExp}`;
    if(document.getElementById('pg-total-inr')) document.getElementById('pg-total-inr').textContent = `Total: ${fPg}`;

    if(document.getElementById('india-table-footer-total')) document.getElementById('india-table-footer-total').textContent = fInd;
    if(document.getElementById('export-table-footer-total')) document.getElementById('export-table-footer-total').textContent = fExp;
    if(document.getElementById('pg-table-footer-total')) document.getElementById('pg-table-footer-total').textContent = fPg;
}

function createChart(ctxId, type, data, options) {
    const el = document.getElementById(ctxId);
    if(!el) return;
    const ctx = el.getContext('2d');
    if (charts[ctxId]) {
        charts[ctxId].destroy();
    }
    charts[ctxId] = new Chart(ctx, { type, data, options });
}

function updateTrendChart() {
    const grouped = {};
    filteredData.forEach(d => {
        if(!d.date || d.date === 'Unknown' || d.date === '') return;
        const dObj = new Date(d.date);
        if(isNaN(dObj.getTime())) return;
        const key = `${dObj.getFullYear()}-${String(dObj.getMonth()+1).padStart(2, '0')}`;
        grouped[key] = (grouped[key] || 0) + d.amount;
    });

    const sorted = Object.keys(grouped).sort();
    const dataVals = sorted.map(k => grouped[k] / 100000); // Lakhs

    const data = {
        labels: sorted,
        datasets: [{
            label: 'Revenue (₹ Lakhs)',
            data: dataVals,
            borderColor: '#58a6ff',
            backgroundColor: 'rgba(88, 166, 255, 0.2)',
            borderWidth: 3,
            fill: true,
            tension: 0.4,
            pointBackgroundColor: '#fff',
            pointRadius: 5
        }]
    };
    
    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false }
        }
    };
    createChart('trendChart', 'line', data, options);
}

function updateClientChart() {
    const grouped = {};
    filteredData.forEach(d => {
        if (!d.client_name || d.client_name === "Unknown") return;
        grouped[d.client_name] = (grouped[d.client_name] || 0) + d.amount;
    });

    const sorted = Object.entries(grouped)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
        
    const data = {
        labels: sorted.map(s => s[0].length > 15 ? s[0].slice(0, 15) + '...' : s[0]),
        datasets: [{
            label: 'Revenue',
            data: sorted.map(s => s[1] / 100000), // Lakhs
            backgroundColor: 'rgba(132, 60, 250, 0.8)',
            borderRadius: 6
        }]
    };

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false }
        }
    };
    createChart('agencyChart', 'bar', data, options); // using existing canvas ID
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
            data: Object.values(grouped).map(v => v / 100000),
            backgroundColor: ['#353ae6', '#843cfa', '#fa3cc3', '#2ea043', '#58a6ff', '#f85149'],
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
            }
        },
        cutout: '75%'
    };
    createChart('regionChart', 'doughnut', data, options);
}

init();
