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
        
        // Assign IDs to base data
        globalData.forEach((d, i) => {
            if(!d._id) {
                const str = `${d.region}-${d.client_name}-${d.campaign}-${d.amount}-${i}`;
                d._id = 'base-' + btoa(unescape(encodeURIComponent(str))).substring(0, 20);
            }
        });

        // Apply edits from local storage
        const edits = JSON.parse(localStorage.getItem('editedBillingItems') || '{}');
        globalData = globalData.map(d => edits[d._id] ? { ...d, ...edits[d._id] } : d);
        
        // Load custom items from local storage
        const localItems = JSON.parse(localStorage.getItem('customBillingItems') || '[]');
        localItems.forEach((d, i) => {
            if(!d._id) d._id = 'custom-' + Date.now() + '-' + i;
            if(edits[d._id]) Object.assign(d, edits[d._id]);
        });
        
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

    document.querySelectorAll('.sidebar-link').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.sidebar-link').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
            
            // Add active class to clicked button
            let targetBtn = e.target.closest('.sidebar-link');
            if (targetBtn) {
                targetBtn.classList.add('active');
                const targetId = targetBtn.getAttribute('data-tab');
                if(targetId) {
                    document.getElementById(targetId).classList.add('active');
                }
            }
        });
    });

    const toggleSidebarBtn = document.getElementById('toggle-sidebar');
    if(toggleSidebarBtn) {
        toggleSidebarBtn.addEventListener('click', () => {
            const sidebar = document.getElementById('sidebar');
            if(sidebar) {
                sidebar.classList.toggle('collapsed');
            }
        });
    }

    // Modal Events
    document.getElementById('btn-add-item').addEventListener('click', () => {
        document.getElementById('add-form').reset();
        document.getElementById('edit-id').value = "";
        document.getElementById('new-billing-type').closest('.filter-group').style.display = 'block';
        document.getElementById('add-modal').classList.add('active');
    });

    document.getElementById('btn-cancel').addEventListener('click', () => {
        document.getElementById('add-modal').classList.remove('active');
    });

    document.getElementById('add-form').addEventListener('submit', handleAddFormSubmit);
}

function loadFile(url, callback) {
    PizZipUtils.getBinaryContent(url, callback);
}

function handleGenerateClick(e) {
    const btn = e.target;
    const id = btn.getAttribute('data-id');
    const rowData = globalData.find(item => item._id === id);
    if (!rowData) return;

    // Show generating state
    const originalText = btn.innerHTML;
    btn.innerHTML = '⏳...';
    btn.disabled = true;

    try {
        if (typeof docxTemplateBase64 === 'undefined') {
            alert("Assets are still loading or cached. Please refresh the page in 5 seconds and try again.");
            btn.innerHTML = originalText;
            btn.disabled = false;
            return;
        }
        
        var binary_string = window.atob(docxTemplateBase64);
        var zip = new PizZip(binary_string);
        var doc = new window.docxtemplater(zip, {
            paragraphLoop: true,
            linebreaks: true,
        });

        // Format amount
        const amtStr = 'Rs. ' + (rowData.amount || 0).toLocaleString('en-IN', {maximumFractionDigits: 2});
        const d = new Date();
        const dateStr = d.toLocaleDateString();

        doc.render({
            client_name: rowData.client_name || "N/A",
            brand_name: rowData.brand_name || "N/A",
            campaign_name: rowData.campaign || "N/A",
            amount: amtStr,
            date: dateStr
        });

        var out = doc.getZip().generate({
            type: "blob",
            mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        });
        saveAs(out, "Invoice_" + (rowData.client_name || "Client").replace(/[^a-z0-9]/gi, '_') + ".docx");
    } catch (error) {
        console.error(error);
        alert("Error generating DOCX");
    }
    
    btn.innerHTML = originalText;
    btn.disabled = false;
}

function handlePdfGenerateClick(e) {
    const btn = e.target;
    const id = btn.getAttribute('data-id');
    const rowData = globalData.find(item => item._id === id);
    if (!rowData) return;

    const originalText = btn.innerHTML;
    btn.innerHTML = '⏳...';
    btn.disabled = true;

    const isExport = rowData.region !== 'India';
    const invoiceTitle = isExport ? 'EXPORT INVOICE' : 'TAX INVOICE';
    
    // Formatting values
    const currencySym = rowData.currency === 'USD' ? '$' : (rowData.currency === 'INR' ? '₹' : (rowData.currency || ''));
    const amtStr = (rowData.amount || 0).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
    
    let dStr = rowData.inv_date;
    if (dStr) {
        const d = new Date(dStr);
        if (!isNaN(d)) dStr = d.toLocaleDateString('en-GB', {day: '2-digit', month: 'short', year: '2-digit'}).replace(/ /g, '-');
    } else {
        dStr = new Date().toLocaleDateString('en-GB', {day: '2-digit', month: 'short', year: '2-digit'}).replace(/ /g, '-');
    }
    
    // Get month year for description
    let monthYear = "the period";
    if (rowData.start_dt) {
        const sd = new Date(rowData.start_dt);
        if (!isNaN(sd)) monthYear = sd.toLocaleDateString('en-US', {month: 'long', year: 'numeric'});
    }

    const htmlContent = `
        <div style="width: 8.27in; height: 11.69in; padding: 1.5in 0.5in 1.5in 0.5in; box-sizing: border-box; font-family: Arial, sans-serif; font-size: 10pt; color: #000; position: relative; background-color: #fff;">
            
            <img src="data:image/png;base64,\${letterheadBase64}" style="position: absolute; top: 0.4in; right: 0.5in; height: 35px; width: auto;">

            <div style="background-color: #000080; color: white; text-align: center; font-weight: bold; padding: 4px; border: 1px solid #000; font-size: 11pt;">\${invoiceTitle}</div>
            
            <table style="width: 100%; border-collapse: collapse; border: 1px solid #000; border-top: none;">
                <tr>
                    <td style="width: 60%; vertical-align: top; padding: 6px; border-right: 1px solid #000; line-height: 1.4;">
                        <strong>To</strong><br>
                        <strong>\${rowData.client_name || "Client Name"}</strong><br>
                        <br><br><br>
                        GSTIN No :<br>
                        State &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;: &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Code :
                    </td>
                    <td style="width: 40%; vertical-align: top; padding: 0;">
                        <table style="width: 100%; border-collapse: collapse; height: 100%;">
                            <tr>
                                <td style="padding: 6px; border-bottom: 1px solid #000; border-right: 1px solid #000; width: 40%;">Invoice No</td>
                                <td style="padding: 6px; border-bottom: 1px solid #000;">\${rowData.inv_number || "Draft"}</td>
                            </tr>
                            <tr>
                                <td style="padding: 6px; border-bottom: 1px solid #000; border-right: 1px solid #000;">Date</td>
                                <td style="padding: 6px; border-bottom: 1px solid #000;">\${dStr}</td>
                            </tr>
                            <tr>
                                <td style="padding: 6px; border-right: 1px solid #000;">Terms</td>
                                <td style="padding: 6px;"></td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>

            <table style="width: 100%; border-collapse: collapse; border: 1px solid #000; border-top: none; margin-top: -1px;">
                <tr style="color: blue; font-weight: bold; background-color: #e6e6ff;">
                    <th style="border: 1px solid #000; padding: 6px; width: 5%; text-align: left; color: blue;">#</th>
                    <th style="border: 1px solid #000; padding: 6px; width: 75%; text-align: center; color: blue;">Description</th>
                    <th style="border: 1px solid #000; padding: 6px; width: 20%; text-align: right; color: blue;">Amount</th>
                </tr>
                <tr>
                    <td style="border-right: 1px solid #000; padding: 6px; vertical-align: top; height: 180px;">1</td>
                    <td style="border-right: 1px solid #000; padding: 6px; vertical-align: top; line-height: 1.5;">
                        Online Advertisement Fee- \${isExport ? 'Export' : 'Domestic'}<br>
                        &nbsp;&nbsp;\${rowData.brand_name || rowData.campaign || ""} campaign on Cricbuzz during \${monthYear}<br><br>
                        &nbsp;&nbsp;<strong>RO No : \${rowData.ro_number || ""}</strong>
                    </td>
                    <td style="padding: 6px; vertical-align: top; text-align: right;">
                        \${currencySym}\${amtStr}
                    </td>
                </tr>
                <tr style="border-top: 1px solid #000;">
                    <td colspan="2" style="border-right: 1px solid #000; padding: 6px; text-align: right; font-weight: bold;">Total</td>
                    <td style="padding: 6px; text-align: right; font-weight: bold;">\${currencySym}\${amtStr}</td>
                </tr>
            </table>

            <div style="border: 1px solid #000; border-top: none; padding: 6px; margin-bottom: 20px;">
                IRN : 17e253676f9c60157a72e8e2d0a59b104f994703ace4777f2c9b12dbb4bf91ef
            </div>

            <div style="display: flex; margin-top: 10px; font-size: 10pt; line-height: 1.4;">
                <div style="flex: 1;">
                    <strong style="text-decoration: underline;">Payment Instructions :</strong><br><br>
                    <table style="border: none; padding: 0; width: 100%; font-size: 10pt;">
                        <tr><td style="width: 140px; padding: 1px;">Payable to</td><td style="padding: 1px;">: Cricbuzz Global Enterprises Limited</td></tr>
                        <tr><td style="padding: 1px;">GSTIN</td><td style="padding: 1px;">: 27AALCC6425H1ZI</td></tr>
                        <tr><td style="padding: 1px;">Place</td><td style="padding: 1px;">: Mumbai</td></tr>
                        <tr><td style="padding: 1px;">HSN Code</td><td style="padding: 1px;">: 998365</td></tr>
                        <tr><td style="padding: 1px;">HSN Description</td><td style="padding: 1px;">: Sale of Internet Advertising Space</td></tr>
                        <tr><td style="padding: 1px;">Reverse Charge</td><td style="padding: 1px;">: Not applicable</td></tr>
                    </table>
                </div>
                <div style="width: 150px; text-align: right;">
                    <img src="data:image/png;base64,\${qrCodeBase64}" style="width: 120px; height: 120px; border: 1px solid #ccc; display: inline-block;">
                </div>
            </div>

            <div style="margin-top: 20px; font-size: 10pt; line-height: 1.4;">
                <strong style="text-decoration: underline;">NEFT/RTGS Details :</strong><br><br>
                <table style="border: none; padding: 0; width: 100%; font-size: 10pt;">
                    <tr><td style="width: 140px; padding: 1px;">Account Number</td><td style="padding: 1px;">: 50200090046749</td></tr>
                    <tr><td style="padding: 1px;">Bank Name</td><td style="padding: 1px;">: HDFC Bank Ltd</td></tr>
                    <tr><td style="padding: 1px;">Bank Address</td><td style="padding: 1px;">: Vipul Plaza Suncity Golf Course Road Sector 54 Gurgaon Haryana 122002</td></tr>
                    <tr><td style="padding: 1px;">IFSC Code</td><td style="padding: 1px;">: HDFC0009273</td></tr>
                    <tr><td style="padding: 1px;">SWIFT Code</td><td style="padding: 1px;">: HDFCINBB</td></tr>
                </table>
            </div>

            <div style="margin-top: 20px; font-size: 10pt; line-height: 1.4;">
                <strong style="text-decoration: underline;">Mailing Address :</strong><br><br>
                Business Arcade, 11th Floor, Plot No. 584, Sayani Road, Opposite Parel Bus Depot, Lower Parel, Mumbai – 400 013,<br>
                GSTIN/UIN: 27AALCC6425H1ZI, State Name : Maharashtra, Code : 27<br>
                Phone :
            </div>

            <div style="position: absolute; bottom: 0.4in; left: 0.5in; right: 0.5in; text-align: center; font-size: 8pt; color: #888; line-height: 1.3;">
                <strong style="color: #666; font-size: 9pt;">Cricbuzz Global Enterprises Limited</strong><br>
                Regd. Office: Express Building, 9-10, Bahadurshah Zafar Marg, I.P. Estate, New Delhi, Central Delhi - 110002, INDIA<br>
                Corp. Office: 11th Floor, Plot No 584, Business Arcade, Sayani Road Opposite Parel Bus Depot, Lower Parel, Mumbai City, Maharashtra - 400013 |<br>
                CIN: U63999DL2024PLC426666; PAN: AALCC6425H; GSTIN: 27AALCC6425H1ZI<br>
                Telephone: +91 8082529699, +91 80951 16575; Fax: +91 (0)80 2679 0623<br>
                Email: admin@cricbuzz.com; Website: www.cricbuzz.com
            </div>
        </div>
    `;

    var opt = {
        margin:       0,
        filename:     'Invoice_' + (rowData.client_name || 'Client').replace(/[^a-z0-9]/gi, '_') + '.pdf',
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2 },
        jsPDF:        { unit: 'in', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(htmlContent).save().then(() => {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }).catch(err => {
        console.error(err);
        alert('Error generating PDF: ' + (err.message || String(err)));
        btn.innerHTML = originalText;
        btn.disabled = false;
    });
}

function handleEditClick(e) {
    const btn = e.target;
    const id = btn.getAttribute('data-id');
    const item = globalData.find(d => d._id === id);
    if(!item) return;

    document.getElementById('edit-id').value = id;
    
    // Populate form
    document.getElementById('new-region').value = item.region || 'India';
    document.getElementById('new-client').value = item.client_name || '';
    document.getElementById('new-campaign').value = item.campaign || '';
    document.getElementById('new-ops').value = item.ops_name || '';
    document.getElementById('new-sales').value = item.sales_contact || '';
    document.getElementById('new-status').value = item.status || 'Yet to start';
    
    // Hide billing type for edits
    document.getElementById('new-billing-type').closest('.filter-group').style.display = 'none';
    
    document.getElementById('new-ro').value = item.ro_amount || 0;
    document.getElementById('new-currency').value = item.currency || 'INR';
    document.getElementById('new-exchange').value = item.exchange_rate || 1;
    document.getElementById('new-start').value = item.start_dt || '';
    document.getElementById('new-end').value = item.end_dt || '';
    
    // New fields
    if(document.getElementById('new-ro-date')) document.getElementById('new-ro-date').value = item.ro_date || '';
    if(document.getElementById('new-ro-number')) document.getElementById('new-ro-number').value = item.ro_number || '';
    if(document.getElementById('new-series')) document.getElementById('new-series').value = item.series || '';
    if(document.getElementById('new-order-id')) document.getElementById('new-order-id').value = item.order_id || '';
    if(document.getElementById('new-inv-date')) document.getElementById('new-inv-date').value = item.inv_date || '';
    if(document.getElementById('new-inv-number')) document.getElementById('new-inv-number').value = item.inv_number || '';
    if(document.getElementById('new-comment')) document.getElementById('new-comment').value = item.comment || '';
    if(document.getElementById('new-platform')) document.getElementById('new-platform').value = item.platform || '';
    if(document.getElementById('new-country')) document.getElementById('new-country').value = item.country || '';

    document.getElementById('add-modal').classList.add('active');
}

function handleAddFormSubmit(e) {
    e.preventDefault();
    const editId = document.getElementById('edit-id').value;
    
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

    const roDate = document.getElementById('new-ro-date') ? document.getElementById('new-ro-date').value : '';
    const roNum = document.getElementById('new-ro-number') ? document.getElementById('new-ro-number').value : '';
    const series = document.getElementById('new-series') ? document.getElementById('new-series').value : '';
    const orderId = document.getElementById('new-order-id') ? document.getElementById('new-order-id').value : '';
    const invDate = document.getElementById('new-inv-date') ? document.getElementById('new-inv-date').value : '';
    const invNum = document.getElementById('new-inv-number') ? document.getElementById('new-inv-number').value : '';
    const comment = document.getElementById('new-comment') ? document.getElementById('new-comment').value : '';
    const platform = document.getElementById('new-platform') ? document.getElementById('new-platform').value : '';
    const country = document.getElementById('new-country') ? document.getElementById('new-country').value : '';

    const roInr = rawRo * exchange;

    if (editId) {
        // Edit Mode
        const item = globalData.find(d => d._id === editId);
        if(item) {
            item.region = region;
            item.client_name = client;
            item.campaign = campaign;
            item.ops_name = ops;
            item.sales_contact = sales;
            item.status = status;
            item.ro_amount = roInr;
            // Since we're editing a single row, let's allow them to update the amount (but amount isn't editable here, wait... billing amount = roInr in this form)
            // Let's assume editing updates the amount to roInr. But wait, if it was split, the amount is monthlyRo.
            // Actually, let's keep item.amount unchanged UNLESS they edit ro_amount and it's not a split?
            // To be safe, if we are editing, let's just let amount = roInr because we don't have an "amount" field in the form.
            // The safest is: if they are editing a split item, modifying RO modifies the amount. Let's just set amount = roInr.
            item.amount = roInr; 
            item.currency = currency;
            item.exchange_rate = exchange;
            item.start_dt = startDt;
            item.end_dt = endDt;
            
            item.ro_date = roDate;
            item.ro_number = roNum;
            item.series = series;
            item.order_id = orderId;
            item.inv_date = invDate;
            item.inv_number = invNum;
            item.comment = comment;
            item.platform = platform;
            item.country = country;
            
            // Save to local storage
            let edits = JSON.parse(localStorage.getItem('editedBillingItems') || '{}');
            edits[editId] = { ...item };
            localStorage.setItem('editedBillingItems', JSON.stringify(edits));
        }
    } else {
        // Create Mode
        let newItems = [];
        if (billType === 'Monthly' && startDt && endDt) {
            const sDate = new Date(startDt);
            const eDate = new Date(endDt);
            
            let months = (eDate.getFullYear() - sDate.getFullYear()) * 12;
            months -= sDate.getMonth();
            months += eDate.getMonth();
            months = months <= 0 ? 1 : months + 1;

            const monthlyRo = roInr / months;

            for (let i = 0; i < months; i++) {
                let splitDate = new Date(sDate.getFullYear(), sDate.getMonth() + i, 1);
                let dateStr = splitDate.toISOString().split('T')[0];
                
                newItems.push({
                    _id: 'custom-' + Date.now() + '-' + i,
                    region, date: dateStr, client_name: client, campaign, ops_name: ops,
                    status, ro_amount: roInr, amount: monthlyRo, start_dt: startDt, end_dt: endDt,
                    sales_contact: sales, platform, currency, exchange_rate: exchange,
                    ro_date: roDate, ro_number: roNum, series, order_id: orderId, inv_date: invDate, inv_number: invNum, comment, country
                });
            }
        } else {
            newItems.push({
                _id: 'custom-' + Date.now(),
                region, date: endDt || startDt, client_name: client, campaign, ops_name: ops,
                status, ro_amount: roInr, amount: roInr, start_dt: startDt, end_dt: endDt,
                sales_contact: sales, platform, currency, exchange_rate: exchange,
                ro_date: roDate, ro_number: roNum, series, order_id: orderId, inv_date: invDate, inv_number: invNum, comment, country
            });
        }

        const localItems = JSON.parse(localStorage.getItem('customBillingItems') || '[]');
        localItems.push(...newItems);
        localStorage.setItem('customBillingItems', JSON.stringify(localItems));
        globalData.push(...newItems);
    }
    
    document.getElementById('add-form').reset();
    document.getElementById('add-modal').classList.remove('active');
    
    populateFilters();
    applyFilters();
    renderDashboard();
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
        // Date | Client Name | Campaign | Ops | Sales | Status | RO Date | RO# | Series | Order ID | Inv Date | Inv# | Comment | Platform | Country | RO Amt | Revenue (₹)
        const row = `<tr>
            <td>${d.date || '-'}</td>
            <td>${d.client_name || '-'}</td>
            <td>${d.campaign || '-'}</td>
            <td>${d.ops_name || '-'}</td>
            <td>${d.sales_contact || '-'}</td>
            <td>${getStatusBadge(d.status)}</td>
            <td>${d.ro_date || '-'}</td>
            <td>${d.ro_number || '-'}</td>
            <td>${d.series || '-'}</td>
            <td>${d.order_id || '-'}</td>
            <td>${d.inv_date || '-'}</td>
            <td>${d.inv_number || '-'}</td>
            <td>${d.comment || '-'}</td>
            <td>${d.platform || '-'}</td>
            <td>${d.country || '-'}</td>
            <td>₹${(d.ro_amount || 0).toLocaleString('en-IN', {maximumFractionDigits: 2})}</td>
            <td>₹${(d.amount || 0).toLocaleString('en-IN', {maximumFractionDigits: 2})}</td>
            <td>
                <div style="display: flex; gap: 0.5rem;">
                    <button class="edit-btn" data-id="${d._id}" style="padding: 4px 8px; font-size: 0.9em; background: rgba(88, 166, 255, 0.2); border: none; border-radius: 4px; color: #58a6ff; cursor: pointer;">✎ Edit</button>
                    <button class="generate-btn" data-id="${d._id}" style="padding: 4px 8px; font-size: 0.9em; background: rgba(46, 160, 67, 0.2); border: none; border-radius: 4px; color: #3fb950; cursor: pointer;">📄 DOCX</button>
                    <button class="generate-pdf-btn" data-id="${d._id}" style="padding: 4px 8px; font-size: 0.9em; background: rgba(216, 59, 1, 0.2); border: none; border-radius: 4px; color: #d83b01; cursor: pointer;">📄 PDF</button>
                </div>
            </td>
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

    // Attach edit and generate listeners
    document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', handleEditClick);
    });
    document.querySelectorAll('.generate-btn').forEach(btn => {
        btn.addEventListener('click', handleGenerateClick);
    });
    document.querySelectorAll('.generate-pdf-btn').forEach(btn => {
        btn.addEventListener('click', handlePdfGenerateClick);
    });

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
                labels: { 
                    color: document.body.classList.contains('light-mode') ? '#24292f' : '#e6edf3', 
                    padding: 20 
                }
            }
        },
        cutout: '75%'
    };
    createChart('regionChart', 'doughnut', data, options);
}

// Theme Toggle Logic
const themeBtn = document.getElementById('toggle-theme');
const themeIcon = document.getElementById('theme-icon');
const themeText = document.getElementById('theme-text');

function applyTheme(isLight) {
    if (isLight) {
        document.body.classList.add('light-mode');
        if (themeIcon) themeIcon.textContent = '🌙';
        if (themeText) themeText.textContent = 'Dark Mode';
        Chart.defaults.color = '#57606a';
        Chart.defaults.borderColor = 'rgba(0,0,0,0.05)';
    } else {
        document.body.classList.remove('light-mode');
        if (themeIcon) themeIcon.textContent = '☀️';
        if (themeText) themeText.textContent = 'Light Mode';
        Chart.defaults.color = '#8b949e';
        Chart.defaults.borderColor = 'rgba(255,255,255,0.05)';
    }
    if (typeof renderDashboard === 'function' && globalData && globalData.length > 0) {
        renderDashboard();
    }
}

if (themeBtn) {
    themeBtn.addEventListener('click', () => {
        const isLight = !document.body.classList.contains('light-mode');
        localStorage.setItem('theme', isLight ? 'light' : 'dark');
        applyTheme(isLight);
    });
}

// Init theme on load
const savedTheme = localStorage.getItem('theme');
if (savedTheme === 'light') {
    applyTheme(true);
} else {
    applyTheme(false); // Default dark
}

init();
