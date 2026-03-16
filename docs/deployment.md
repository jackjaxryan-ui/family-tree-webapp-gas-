# Deployment Guide

This guide explains how to deploy the Family Tree Web App using Google Apps Script and Google Sheets.

The application runs as a **Google Apps Script Web App**, with Google Sheets acting as the database.

---

# 1. Prepare Google Sheets Database

Create a new Google Spreadsheet.

Recommended name:

FamilyTreeDatabase

Inside the spreadsheet create a sheet named:

Persons

Add the following columns in the first row.

| Column | Description |
|------|------|
| PersonID | Unique ID (P0001, P0002, etc.) |
| FullName | Full name |
| DisplayName | Name with birth year |
| Gender | L (male) or P (female) |
| BirthYear | Year of birth |
| IsDeceased | TRUE or FALSE |
| DeathYear | Year of death |
| IsMarried | TRUE or FALSE |
| FatherID | PersonID reference |
| MotherID | PersonID reference |
| SpouseID | PersonID reference |
| CreatedAt | Timestamp when record created |
| UpdatedAt | Timestamp when record updated |
| CreatedBy | User email |
| UpdatedBy | User email |
| Notes | Optional notes |

---

# 2. Optional: Meta Sheet

You can create an additional sheet named:

Meta

In cell B1 you may place the family database name.

Example:

| A | B |
|---|---|
| DatabaseName | Keluarga Ahmad |

The application will use this value as the page title.

If this sheet does not exist, the system will default to the name **Keluarga**.

---

# 3. Create Apps Script Project

Open the Google Spreadsheet.

Then go to:

Extensions → Apps Script

Create the following files:

Code.gs  
index.html  
appsscript.json

Copy the source code from the repository into these files.

---

# 4. Set Spreadsheet ID

In `Code.gs`, locate the variable:

SPREADSHEET_ID

Replace the placeholder value with your spreadsheet ID.

You can find the spreadsheet ID in the Google Sheets URL.

Example:

https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit

---

# 5. Deploy the Web App

Inside the Apps Script editor:

Click:

Deploy → New deployment

Select:

Web App

Recommended settings:

Execute as: Me  
Who has access: Anyone

Click **Deploy**.

Google will generate a **Web App URL**.

Example:

https://script.google.com/macros/s/XXXXX/exec

---

# 6. Access the Application

Open the Web App URL in a browser.

The form will load and allow users to input family data.

All data will be saved directly into the Google Sheets database.

---

# 7. Updating the Application

If you update the code later:

1. Edit the files in Apps Script
2. Click **Deploy**
3. Select **Manage deployments**
4. Create a **New Version**

The Web App URL will remain the same.

---

# 8. Resetting the Database (Optional)

The backend contains a function:

resetFamilyData()

This function clears all records in the Persons sheet.

It is protected by an email whitelist to prevent unauthorized resets.

---

# 9. Security Notes

Recommended practices:

- Keep spreadsheet edit access restricted
- Use Google account login if needed
- Backup the spreadsheet periodically

Since the system runs on Google infrastructure, no external server is required.

---

# Summary

Deployment only requires:

1. A Google Spreadsheet
2. Google Apps Script project
3. Web App deployment

No server, database server, or hosting infrastructure is needed.
