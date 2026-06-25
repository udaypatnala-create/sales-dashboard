import base64

def patch_app():
    with open('invoice_template.docx', 'rb') as f:
        b64 = base64.b64encode(f.read()).decode('utf-8')
        
    with open('app.js', 'r', encoding='utf-8') as f:
        content = f.read()
        
    # Replace the loadFile function and its usage
    old_load_file_logic = """    loadFile("invoice_template.docx", function(error, content) {
        if (error) {
            alert("Error loading invoice template");
            btn.innerHTML = originalText;
            btn.disabled = false;
            throw error;
        }
        
        try {
            var zip = new PizZip(content);"""
            
    new_logic = f"""    try {{
        // Decode base64 template
        var binary_string = window.atob("{b64}");
        var len = binary_string.length;
        var bytes = new Uint8Array(len);
        for (var i = 0; i < len; i++) {{
            bytes[i] = binary_string.charCodeAt(i);
        }}
        var zip = new PizZip(bytes.buffer);"""
        
    content = content.replace(old_load_file_logic, new_logic)
    
    # We also need to remove the trailing '});' from loadFile callback
    # The end of the function is currently:
    #         btn.innerHTML = originalText;
    #         btn.disabled = false;
    #     });
    # }
    
    end_old = """        btn.innerHTML = originalText;
        btn.disabled = false;
    });
}"""

    end_new = """        btn.innerHTML = originalText;
        btn.disabled = false;
}"""

    content = content.replace(end_old, end_new)
    
    # Add PDF script to index.html
    with open('index.html', 'r', encoding='utf-8') as f:
        html = f.read()
        
    if 'html2pdf' not in html:
        html = html.replace('<!-- DOCX Generation Libraries -->', 
                            '<!-- DOCX Generation Libraries -->\n    <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>')
        with open('index.html', 'w', encoding='utf-8') as f:
            f.write(html)
            
    with open('app.js', 'w', encoding='utf-8') as f:
        f.write(content)

if __name__ == '__main__':
    patch_app()
