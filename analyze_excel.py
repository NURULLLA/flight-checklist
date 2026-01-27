import pandas as pd
import os

file_path = r'c:\Users\nbekt\OneDrive\Desktop\Sky_Guard\Физюляж\Лист Microsoft Excel.xlsx'

try:
    # Read the excel file
    # Trying different engines/options just in case, but default should work if openpyxl is installed
    df = pd.read_excel(file_path, engine='openpyxl')
    
    print("Columns:")
    print(df.columns.tolist())
    print("\nFirst 20 rows:")
    print(df.head(20).to_string())
    
    # Also print any other sheets if multiple
    xl = pd.ExcelFile(file_path)
    print("\nSheet names:", xl.sheet_names)
    
except Exception as e:
    print(f"Error reading excel: {e}")
