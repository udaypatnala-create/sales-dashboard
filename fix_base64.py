import zipfile
import base64
import re

def fix():
    # Read the correct image directly
    with zipfile.ZipFile('template.docx') as z:
        img_b64 = base64.b64encode(z.read('word/media/image1.png')).decode('utf-8')
        
    with open('app.js', 'r', encoding='utf-8') as f:
        content = f.read()
        
    # Replace the corrupted background image URL with the correct one
    # The corrupted one starts with: url("data:image/png;base64,ÿþ
    # We can just use a regex to replace the entire backgroundImage line
    
    # regex: invoiceDiv.style.backgroundImage = 'url("data:image/png;base64,.*?")';
    content = re.sub(r'invoiceDiv\.style\.backgroundImage = \'url\("data:image/png;base64,.*?"\)\';', 
                     f'invoiceDiv.style.backgroundImage = \'url("data:image/png;base64,{img_b64}")\';', 
                     content, flags=re.DOTALL)
                     
    # To fix the 'left: -9999px' issue with html2pdf (if it causes empty pages)
    # We shouldn't hide it with left/top. Better to hide it with z-index or opacity or visibility,
    # or just let html2pdf render it before removing.
    # Actually, html2pdf can render elements with `position: fixed; top: 100vh;` or similar.
    # Let's replace:
    content = content.replace("invoiceDiv.style.left = '-9999px';", "invoiceDiv.style.left = '0';")
    content = content.replace("invoiceDiv.style.top = '-9999px';", "invoiceDiv.style.top = '100vh';")
    
    with open('app.js', 'w', encoding='utf-8') as f:
        f.write(content)

if __name__ == '__main__':
    fix()
