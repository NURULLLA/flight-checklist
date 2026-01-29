import os

html_path = 'checklist.html'
base64_path = 'logo_base64.txt'

# Read base64 content
with open(base64_path, 'r') as f:
    base64_data = f.read().strip()

# Read HTML content
with open(html_path, 'r', encoding='utf-8') as f:
    html_content = f.read()

# Prepare data URL
data_url = f"data:image/png;base64,{base64_data}"

# Replace the image source
new_html_content = html_content.replace('src="img/logo.png"', f'src="{data_url}"')

# Write back to HTML
with open(html_path, 'w', encoding='utf-8') as f:
    f.write(new_html_content)

print("Successfully embedded logo into checklist.html")
