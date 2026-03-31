import pandas as pd
import json
import math
import numpy as np

def safe_str(val):
    if pd.isna(val) or val is None:
        return "Unknown"
    return str(val).strip()

def safe_float(val):
    if pd.isna(val) or val is None:
        return 0.0
    try:
        return float(val)
    except:
        return 0.0

def process_excel():
    file_path = r"C:\Users\uday.kiran\Documents\Sales Dashboard (with 5 Years Data) do not use.xlsx"
    xl = pd.ExcelFile(file_path)
    
    all_data = []

    # 1. India Sheet
    if 'India ' in xl.sheet_names:
        df_india = pd.read_excel(xl, sheet_name='India ')
        for index, row in df_india.iterrows():
            fy = safe_str(row.get('FY '))
            if fy == "Unknown" or fy == "nan": continue
            
            agency = safe_str(row.get('Agency'))
            campaign = safe_str(row.get('Campaign '))
            amount = safe_float(row.get('Net Amount'))
            date_val = row.get('Invoice Date')
            
            if pd.notna(date_val) and isinstance(date_val, pd.Timestamp):
                date_str = date_val.strftime('%Y-%m-%d')
            else:
                date_str = "Unknown"
                
            all_data.append({
                "region": "India",
                "fy": fy,
                "date": date_str,
                "agency": agency,
                "campaign": campaign,
                "amount": amount
            })

    # 2. Export Sheet
    if 'Export' in xl.sheet_names:
        df_export = pd.read_excel(xl, sheet_name='Export')
        for index, row in df_export.iterrows():
            fy = safe_str(row.get('FY '))
            if fy == "Unknown" or fy == "nan": continue
            
            agency = safe_str(row.get('Agency'))
            campaign = safe_str(row.get('Campaign '))
            amount = safe_float(row.get('INR'))
            date_val = row.get('Invoice Date')
            
            if pd.notna(date_val) and isinstance(date_val, pd.Timestamp):
                date_str = date_val.strftime('%Y-%m-%d')
            else:
                date_str = "Unknown"

            all_data.append({
                "region": "Export",
                "fy": fy,
                "date": date_str,
                "agency": agency,
                "campaign": campaign,
                "amount": amount
            })

    # 3. PG Sales
    if 'PG Sales' in xl.sheet_names:
        df_pg = pd.read_excel(xl, sheet_name='PG Sales')
        for index, row in df_pg.iterrows():
            fy = safe_str(row.get('FY '))
            if fy == "Unknown" or fy == "nan": continue
            
            agency = safe_str(row.get('Programmatic buyer'))
            campaign = safe_str(row.get('Order'))
            amount = safe_float(row.get('Ad server CPM and CPC revenue (₹)'))
            date_val = safe_str(row.get('Month and year')) # E.g., 'April 2022'
            
            # we will just keep month and year as the date string for PG sales
            all_data.append({
                "region": "PG Sales",
                "fy": fy,
                "date": date_val,
                "agency": agency,
                "campaign": campaign,
                "amount": amount
            })

    # Write to local file
    output_path = r"C:\Users\uday.kiran\.gemini\antigravity\scratch\sales_dashboard\data.json"
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(all_data, f, ensure_ascii=False, indent=2)

    print(f"Data extraction complete. Exported {len(all_data)} records to data.json")

if __name__ == "__main__":
    process_excel()
