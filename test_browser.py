from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
import time

options = Options()
options.add_argument('--headless')
driver = webdriver.Chrome(options=options)

try:
    driver.get("http://localhost:8000/dashboard_live.html")
    time.sleep(2)  # Wait for load and data
    
    # Click the first generate button
    buttons = driver.find_elements(By.CLASS_NAME, "generate-btn")
    if buttons:
        buttons[0].click()
        time.sleep(2)  # Wait for generation to finish or hang
    else:
        print("No generate button found.")
    
    for entry in driver.get_log('browser'):
        print(entry)
        
finally:
    driver.quit()
