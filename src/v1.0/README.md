# Family Tree Web App v1.0

A simple Google Apps Script web app for collecting family tree data and storing it in Google Sheets.

This initial version is designed as a practical family data intake form. Users can select existing people, add new people, link parents, add a spouse, and add children in one submission.

## Overview

The project uses:

* Google Apps Script for backend logic
* Google Sheets as the database
* HTML, CSS, and JavaScript for the frontend

The main goal of this version is to make family data collection easier and more structured before the data is processed further into a larger genealogy workflow.

## Main Features

* Select existing Father and Mother
* Add new Father and Mother
* Select existing Self or add new Self
* Optional Spouse entry
* Optional multiple Children entries
* Duplicate candidate warning before saving
* Automatic parent-child linking
* Automatic spouse linking for father and mother when both are present
* Dashboard summary with:

  * total people
  * total generations
  * last update timestamp
* Basic mobile-friendly layout

## Project Files

* `Code.gs` — backend logic, validation, Google Sheets access, and ID generation
* `index.html` — frontend form UI and client-side interactions

## Spreadsheet Requirements

The app requires a Google Spreadsheet with at least these sheets:

* `Persons`
* `Meta` (optional but recommended)

### Persons Sheet Columns

Expected header row:

`PersonID, FullName, DisplayName, Gender, BirthYear, IsDeceased, DeathYear, IsMarried, FatherID, MotherID, SpouseID, CreatedAt, UpdatedAt, CreatedBy, UpdatedBy, Notes`

### Meta Sheet

Used for the database display name.

* Cell `B1` = family or database name

If the `Meta` sheet does not exist, the app uses a default name.

## How It Works

### Backend

`Code.gs` handles:

* app entry with `doGet()`
* dashboard statistics
* people index for search lists
* form submission process
* validation rules
* duplicate detection
* sheet read and write operations
* automatic `PersonID` generation

### Frontend

`index.html` handles:

* form rendering
* switch between existing and new modes
* datalist-based search inputs
* dynamic child input blocks
* duplicate warning display
* form submission and reset
* dashboard refresh after successful save

## Person ID Format

Each person is stored with an auto-generated ID such as:

* `P0001`
* `P0002`
* `P0003`

The counter is stored in Script Properties.

## Version 1.0 Scope

This is the first public/basic version of the app.

Included in v1.0:

* one main `Persons` table
* basic family relationship linking
* single spouse model using `SpouseID`
* duplicate warning only, without automatic merge
* lightweight web form for data intake

Not included yet in v1.0:

* advanced multi-marriage support
* GEDCOM export
* duplicate merge tools
* edit and delete management UI
* built-in family tree visualization

## Setup

1. Create a Google Spreadsheet.
2. Add the required `Persons` sheet with the correct header row.
3. Optionally add a `Meta` sheet and set cell `B1`.
4. Open Google Apps Script.
5. Add `Code.gs` and `index.html`.
6. Set your spreadsheet ID in `Code.gs`.
7. Deploy the project as a Web App.

Example configuration line in `Code.gs`:

`const SPREADSHEET_ID = 'paste-spreadsheetID-here';`

## Reset Helper

The script includes a helper function called `resetFamilyData()`.

This function:

* clears person records from the `Persons` sheet
* resets the internal person counter
* is restricted to allowed email addresses defined in the script

## Intended Use

This app is intended as a simple intake layer for collecting family data.

It is not meant to replace a full genealogy platform. Instead, it helps organize data input in a structured way before the data is moved into a more advanced family tree system.

## License

Personal project or custom internal use.

Update this section as needed for your repository.
