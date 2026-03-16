# Family Tree Web App (Google Apps Script)

A simple web application to collect and manage **family tree data** using **Google Apps Script** and **Google Sheets** as the backend database.

The app allows users to input parents, spouse, and children, while automatically maintaining family relationships in a structured dataset.

---

## Features

- Add **parents, self, spouse, and children**
- Use **existing members** or create **new records**
- Automatic **relationship linking**
- **Duplicate detection** to reduce accidental duplicates
- Dashboard statistics:
  - total family members
  - number of generations
  - last update timestamp
- **Live update without page reload**
- Mobile-friendly interface

---

## Architecture

Browser (HTML / JavaScript)  
↓  
Google Apps Script (backend)  
↓  
Google Sheets (database)

Google Sheets stores all family members and relationship references.

---

## Deployment

1. Create a Google Spreadsheet with a sheet named **Persons**
2. Open **Extensions → Apps Script**
3. Add the following files:
   - Code.gs
   - index.html
   - appsscript.json
4. Set the correct **SPREADSHEET_ID** in `Code.gs`
5. Deploy as **Web App**

Deployment menu:

Deploy → New deployment → Web App

Recommended settings:

Execute as: Me  
Who has access: Anyone

---

## Usage

1. Select or create **Father**
2. Select or create **Mother**
3. Enter **Self**
4. Add **Spouse** (optional)
5. Add **Children**
6. Click **Save**

The system automatically links family relationships and updates statistics.

---

## License

MIT License
