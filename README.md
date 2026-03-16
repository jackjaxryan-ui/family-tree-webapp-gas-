# Family Tree Web App (Google Apps Script)

A lightweight web application to collect and manage family tree data using Google Apps Script and Google Sheets as the backend database.

This project allows users to input family members (parents, spouse, children) and automatically maintains relationships between them inside a Google Sheets dataset.

The application runs entirely on Google Apps Script Web App, so it does not require a dedicated server or database.

---

## Features

- Add parents, self, spouse, and children
- Use existing family members or create new entries
- Automatic relationship linking (parent, spouse, children)
- Duplicate detection to reduce accidental duplicate records
- Dynamic child input (add/remove children easily)
- Dashboard statistics:
  - Total family members
  - Number of generations
  - Last update timestamp
- Live banner update without page reload
- Mobile-friendly interface

---

## Architecture

Browser (HTML / JavaScript UI)  
↓  
Google Apps Script (Code.gs)  
↓  
Google Sheets (Persons table)

Google Sheets acts as the database where all family relationships are stored.

---

## Data Structure

Main sheet name: **Persons**

Columns used by the application:

| Column | Description |
|------|------|
| PersonID | Unique ID (P0001, P0002, etc.) |
| FullName | Full name |
| DisplayName | Name with birth year |
| Gender | L (male) or P (female) |
| BirthYear | Year of birth |
| IsDeceased | Deceased status |
| DeathYear | Year of death |
| FatherID | Parent relationship |
| MotherID | Parent relationship |
| SpouseID | Marriage relationship |
| CreatedAt | Record creation timestamp |
| UpdatedAt | Last update timestamp |
| Notes | Optional notes |

Relationships between people are stored using PersonID references.

Example:

Ahmad → PersonID P0001  
Fatimah → PersonID P0002  
Hasan → PersonID P0003  

Stored relationships:

Hasan.FatherID = P0001  
Hasan.MotherID = P0002  
Ahmad.SpouseID = P0002  
Fatimah.SpouseID = P0001  

---

## Deployment

### 1. Create Google Sheet

Create a spreadsheet and add a sheet named:

Persons

Add the columns described in the Data Structure section.

Optional:

Create another sheet named:

Meta

Cell **B1** can contain the name of the family database.

---

### 2. Create Apps Script Project

Open the spreadsheet.

Go to:

Extensions → Apps Script

Add the following files:

Code.gs  
index.html  
appsscript.json  

Paste the source code into these files.

---

### 3. Deploy Web App

Deploy the project as a Web App.

Menu:

Deploy → New deployment

Recommended settings:

Execute as: Me  
Who has access: Anyone  

After deployment you will receive a Web App URL that users can access.

---

## Usage

1. Select or create Father  
2. Select or create Mother  
3. Enter Self data  
4. Add Spouse (optional)  
5. Add Children  
6. Click **Save to Google Sheets**

After saving:

- relationships are automatically linked  
- statistics banner updates instantly  

---

## Current Capabilities

The system currently supports:

- multi-generation family trees  
- automatic parent and spouse linking  
- duplicate detection  
- live dashboard statistics  
- mobile-friendly data entry  

This makes it suitable for:

- family genealogy collection  
- family history documentation  
- small community family mapping  

---

## Future Improvements

Possible future features include:

- visual family tree graph
- person profile page
- search functionality
- GEDCOM import and export
- family branch filtering

---

## License

MIT License

You are free to use, modify, and distribute this project.

---

## Author

Built using **Google Apps Script** and **Google Sheets** as a lightweight backend platform.

Designed for simple deployment and minimal infrastructure.
