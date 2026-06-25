import pandas as pd
import json
import math
import numpy as np

def safe_str(val):
    if pd.isna(val) or val is None:
        return ""
    return str(val).strip()

def safe_float(val):
    if pd.isna(val) or val is None:
        return 0.0
    try:
        # handle strings with commas or currency symbols if any
        if isinstance(val, str):
            val = val.replace(',', '').replace('₹', '').replace('$', '').strip()
        return float(val)
    except:
        return 0.0

def process_excel():
    file_path = r"C:\Users\uday.kiran\Downloads\Invoice-Billing-(Jan'26-Dec'26) (2).xlsx"
    xl = pd.ExcelFile(file_path)
    
    all_data = []

    # Helper function to append
    def add_record(region, month_year, client, campaign, ops, status, ro_amount, billing_amt, start_dt, end_dt, sales, platform=""):
        date_str = ""
        if pd.notna(month_year) and isinstance(month_year, pd.Timestamp):
            date_str = month_year.strftime('%Y-%m-%d')
        elif str(month_year).strip() != "":
            date_str = str(month_year).strip()

        start_str = ""
        if pd.notna(start_dt) and isinstance(start_dt, pd.Timestamp):
            start_str = start_dt.strftime('%Y-%m-%d')
        end_str = ""
        if pd.notna(end_dt) and isinstance(end_dt, pd.Timestamp):
            end_str = end_dt.strftime('%Y-%m-%d')
            
        all_data.append({
            "region": region,
            "date": date_str,
            "client_name": safe_str(client),
            "campaign": safe_str(campaign),
            "ops_name": safe_str(ops),
            "status": safe_str(status),
            "ro_amount": safe_float(ro_amount),
            "amount": safe_float(billing_amt) or safe_float(ro_amount), # Use billing if available, else RO
            "start_dt": start_str,
            "end_dt": end_str,
            "sales_contact": safe_str(sales),
            "platform": safe_str(platform),
            "currency": "INR", # default to INR from excel
            "exchange_rate": 1.0
        })

    if 'India Campaigns' in xl.sheet_names:
        df = pd.read_excel(xl, sheet_name='India Campaigns')
        for _, row in df.iterrows():
            if pd.isna(row.get('Month & Year')): continue
            add_record('India', row.get('Month & Year'), row.get('Client Name'), row.get('Indian Campaign Name'), row.get('Ops Name'), row.get('Status'), row.get('RO Amount'), row.get('Billing Amt'), row.get('Start Dt'), row.get('End Date'), row.get('Sales Contact'), row.get('Platform'))

    if 'Foreign Campaigns' in xl.sheet_names:
        df = pd.read_excel(xl, sheet_name='Foreign Campaigns')
        for _, row in df.iterrows():
            if pd.isna(row.get('Month & Year')): continue
            # If INR RO AMOUNT exists, use it, else RO Amount
            ro = row.get('INR RO AMOUNT')
            if pd.isna(ro) or ro == 0: ro = row.get('RO Amount')
            add_record('Foreign', row.get('Month & Year'), row.get('Client Name'), row.get('Campaign Name'), row.get('Ops Name'), row.get('Status'), ro, row.get('Billing Amt'), row.get('Start Dt'), row.get('End Date'), row.get('Sales Contact'), row.get('Platform'))

    if 'Streaming Ads ' in xl.sheet_names:
        df = pd.read_excel(xl, sheet_name='Streaming Ads ')
        for _, row in df.iterrows():
            if pd.isna(row.get('Month & Year')): continue
            ro = row.get('INR RO AMOUNT')
            if pd.isna(ro) or ro == 0: ro = row.get('RO Amount')
            add_record('Streaming', row.get('Month & Year'), row.get('Client Name'), row.get('Campaign Name'), row.get('Ops Name'), row.get('Status'), ro, row.get('Billing Amt'), row.get('Start Dt'), row.get('End Date'), row.get('Sales Contact'), row.get('Platform'))

    if 'Google & Networks' in xl.sheet_names:
        df = pd.read_excel(xl, sheet_name='Google & Networks', header=1)
        for _, row in df.iterrows():
            if pd.isna(row.get('Month & Year')): continue
            # Google sheet might just have Network Name and revenue. Assuming generic column names if missing
            # E.g., it might have 'Revenue' or 'Billing Amt'
            # For now, let's try to find a revenue column. We'll use the 3rd or 4th column if unnamed
            cols = df.columns
            # Let's assume 'Network Name' is campaign/client
            client = row.get('Network Name', '')
            add_record('Google & Networks', row.get('Month & Year'), client, client, '', 'Delivering', 0, 0, '', '', '', '')

    if 'PG Sales- FC-INR-USD-Report' in xl.sheet_names:
        df = pd.read_excel(xl, sheet_name='PG Sales- FC-INR-USD-Report')
        for _, row in df.iterrows():
            if pd.isna(row.get('Month and year')): continue
            add_record('PG Sales', row.get('Month and year'), row.get('Programmatic buyer'), row.get('Order'), '', 'Delivering', row.get('Revenue(INR)'), row.get('Revenue(INR)'), '', '', row.get('Sales'), '')

    if 'PG Deals' in xl.sheet_names:
        df = pd.read_excel(xl, sheet_name='PG Deals', header=1)
        for _, row in df.iterrows():
            if pd.isna(row.get('Month & Year')): continue
            client = row.get('Client Name', '') if 'Client Name' in df.columns else ''
            add_record('PG Deals', row.get('Month & Year'), client, client, '', 'Delivering', 0, 0, '', '', row.get('Sales Contact', ''), '')

    # Write to local file
    output_path = r"C:\Users\uday.kiran\.gemini\antigravity\scratch\sales_dashboard\data.json"
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(all_data, f, ensure_ascii=False, indent=2)

    print(f"Data extraction complete. Exported {len(all_data)} records to data.json")

if __name__ == "__main__":
    process_excel()
