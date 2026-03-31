import json
import base64

def build():
    with open('index.html', 'r', encoding='utf-8') as f:
        html = f.read()

    with open('style.css', 'r', encoding='utf-8') as f:
        css = f.read()

    with open('app.js', 'r', encoding='utf-8') as f:
        js = f.read()

    with open('data.json', 'r', encoding='utf-8') as f:
        data_str = f.read()

    # We inject the data.json directly into the JS as a global variable.
    # We replace the fetch call in app.js
    
    js = js.replace(
        "const response = await fetch('data.json');\n        globalData = await response.json();",
        f"globalData = {data_str};"
    )

    # We inject the CSS into a <style> tag, removing the <link>
    html = html.replace('<link rel="stylesheet" href="style.css">', f'<style>{css}</style>')

    # We inject the JS into a <script> tag, removing the <script src="app.js">
    html = html.replace('<script src="app.js"></script>', f'<script>{js}</script>')

    with open('dashboard_live.html', 'w', encoding='utf-8') as f:
        f.write(html)

    print("Successfully built fully standalone dashboard_live.html")

if __name__ == "__main__":
    build()
