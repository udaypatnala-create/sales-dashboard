import pandas as pd
import sys
import io

# Set stdout to utf-8
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

file_path = r"C:\Users\uday.kiran\Documents\Sales Dashboard (with 5 Years Data) do not use.xlsx"
xl = pd.ExcelFile(file_path)

for sheet in ['PG Sales']:
    if sheet in xl.sheet_names:
        print(f"\n--- Sheet: {sheet} ---")
        df = pd.read_excel(xl, sheet_name=sheet, nrows=5)
        print("Columns:", list(df.columns))
        print("First row:", df.iloc[0].to_dict() if len(df) > 0 else "Empty")
