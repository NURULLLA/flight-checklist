import sys
import os

file_path = r'c:\Users\nbekt\OneDrive\Desktop\Sky_Guard\Физюляж\LOADMASTER CHECKLIST.pdf'

try:
    import pypdf
    reader = pypdf.PdfReader(file_path)
    print("Using pypdf")
except ImportError:
    try:
        import PyPDF2 as pypdf
        reader = pypdf.PdfReader(file_path)
        print("Using PyPDF2")
    except ImportError:
        print("No suitable PDF library found (pypdf or PyPDF2).")
        sys.exit(1)

try:
    if len(reader.pages) > 0:
        text = reader.pages[0].extract_text()
        print("--- PAGE 1 TEXT ---")
        print(text)
        print("-------------------")
    else:
        print("PDF is empty")
except Exception as e:
    print(f"Error extracting text: {e}")
