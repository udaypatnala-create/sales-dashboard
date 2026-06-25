import pandas as pd
import json

file_path = r"C:\Users\uday.kiran\Downloads\Invoice-Billing-(Jan'26-Dec'26) (2).xlsx"
try:
    xls = pd.ExcelFile(file_path)
    print("Sheet Names:", xls.sheet_names)
    for sheet in xls.sheet_names:
        print(f"--- Sheet: {sheet} ---")
        df = pd.read_excel(xls, sheet_name=sheet, nrows=5)
        print("Columns:", df.columns.tolist())
        print(df.head())
except Exception as e:
    print(f"Error reading excel: {e}")
