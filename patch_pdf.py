import re

def patch():
    with open('letterhead_b64.txt', 'r') as f:
        img_b64 = f.read().strip()
        
    with open('app.js', 'r', encoding='utf-8') as f:
        content = f.read()
        
    # Find handlePdfGenerateClick body and replace the innerHTML assignment
    
    new_html = f"""
    invoiceDiv.style.width = '8.5in';
    invoiceDiv.style.height = '11in';
    invoiceDiv.style.padding = '2in 1in 1in 1in'; // Top padding for header
    invoiceDiv.style.boxSizing = 'border-box';
    invoiceDiv.style.backgroundImage = 'url("data:image/png;base64,{img_b64}")';
    invoiceDiv.style.backgroundSize = '100% 100%';
    invoiceDiv.style.backgroundRepeat = 'no-repeat';
    invoiceDiv.style.backgroundPosition = 'center';
    
    const amtStr = 'Rs. ' + (rowData.amount || 0).toLocaleString('en-IN', {{maximumFractionDigits: 2}});
    const dateStr = new Date().toLocaleDateString();

    invoiceDiv.innerHTML = `
        <h1 style="text-align: center; margin-bottom: 30px; color: #333; font-size: 24pt;">INVOICE</h1>
        <p style="font-size: 12pt;"><strong>Date:</strong> ${{dateStr}}</p>
        <div style="margin-top: 30px; margin-bottom: 30px; font-size: 12pt;">
            <p><strong>Billed To:</strong></p>
            <p style="font-size: 1.2em; font-weight: bold;">${{rowData.client_name || "N/A"}}</p>
        </div>
        <table style="width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12pt;">
            <thead>
                <tr style="background-color: #f2f2f2;">
                    <th style="border: 1px solid #ccc; padding: 10px; text-align: left;">Description</th>
                    <th style="border: 1px solid #ccc; padding: 10px; text-align: right;">Amount</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td style="border: 1px solid #ccc; padding: 10px;">
                        <strong>Campaign:</strong> ${{rowData.campaign || "N/A"}}<br>
                        <strong>Brand:</strong> ${{rowData.brand_name || "N/A"}}
                    </td>
                    <td style="border: 1px solid #ccc; padding: 10px; text-align: right;">${{amtStr}}</td>
                </tr>
            </tbody>
        </table>
        <div style="text-align: right; margin-top: 30px; font-size: 14pt;">
            <strong>Total: ${{amtStr}}</strong>
        </div>
    `;
"""
    
    # The old code to replace
    # starts from `const amtStr = ...` up to `    `;`
    
    # Let's just use regex to replace the whole block from `const amtStr` to the end of innerHTML
    pattern = r"const amtStr = 'Rs\..*?invoiceDiv\.innerHTML = `.*?`;"
    
    content = re.sub(pattern, new_html.strip(), content, flags=re.DOTALL)
    
    # Also fix invoiceDiv styles
    content = content.replace("invoiceDiv.style.width = '800px';", "")
    content = content.replace("invoiceDiv.style.padding = '40px';", "")
    
    with open('app.js', 'w', encoding='utf-8') as f:
        f.write(content)

if __name__ == '__main__':
    patch()
