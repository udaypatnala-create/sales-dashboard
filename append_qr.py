b64 = open('qrcode_base64.txt').read().strip()
with open('invoice_assets.js', 'a') as f:
    f.write(f'\nconst qrCodeBase64 = "{b64}";\n')
