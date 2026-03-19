# Family Tree Web App v1.50 
## (with find-clean duplicate Persons function)

A simple Google Apps Script web app for collecting family tree data and storing it in Google Sheets.
This project evolves from a simple data-entry form into a more robust genealogy data engine with:

* Normalized relationship structure (Families & FamilyChildren)
* Multi-spouse support
* Duplicate detection and safe merge tools
* Tree visualization (3-level hierarchy)
* Migration utilities from legacy structure

---

## Overview

This application is designed as a **data intake and normalization layer** before exporting or integrating into a full genealogy system (e.g., GEDCOM / FamilyEcho).

It prioritizes:

* Data integrity
* Relationship consistency
* Safe concurrent operations
* Clean structure for future expansion

---

## Core Features

### 1. Person Management

* Add new individuals
* Select existing individuals
* Store key attributes:

  * Full Name
  * Gender
  * Birth / Death Year
  * Notes

---

### 2. Parent Assignment

* Assign Father and Mother
* Enforce gender validation
* Prevent parent overwrite (data protection)

---

### 3. Family-Based Relationship System (V2)

Instead of relying on SpouseID, relationships are normalized into:

* Families (couple entity)
* FamilyChildren (child linkage)

Supports:

* Multiple spouses
* Active / inactive relationships
* Marriage timeline (start/end year)
* Notes per relationship

---

### 4. Children Linking

* Add multiple children in one submission
* Automatically linked to parents via Family
* Child ordering supported

---

### 5. Duplicate Detection (Important)

Smart duplicate detection is implemented during input:

* Name similarity (exact / partial)
* Birth year proximity
* Gender validation

System behavior:

* Warns user before insert
* Requires confirmation for duplicate creation
* Prevents accidental duplicate spam

---

### 6. Duplicate Review & Cleanup Module

Advanced tools are provided for data maintenance:

#### Duplicate Review

Function:

* findDuplicateCandidates()

Output:

* Sheet: DuplicateReview

Features:

* STRICT duplicates (high confidence)
* LOOSE duplicates (needs manual review)
* Completeness scoring
* Family/child reference count

---

#### Safe Merge Engine

Function:

* mergeDuplicatePersonsSafe()

Capabilities:

* Merge duplicate Persons safely

* Preserve best-quality data

* Re-map relationships:

  * FatherID
  * MotherID
  * SpouseID
  * Families
  * FamilyChildren

* Prevent:

  * Self-referencing loops
  * Broken relationships
  * Duplicate family links

---

#### Backup Before Merge

Function:

* backupAllFamilySheets()

Creates snapshot of:

* Persons
* Families
* FamilyChildren

Recommended before any merge operation.

---

### 7. Dashboard

Displays:

* Total people count
* Total generations
* Last update timestamp

---

### 8. Family Tree View

Simple hierarchical tree:

* Parents (Family)
* Children
* Grandchildren (via child families)

Supports:

* Multi-branch spouse structure
* Active/inactive relationship display

---

### 9. Migration & Maintenance Tools

#### Backfill Families

Function:

* backfillFamiliesFromPersons()

Purpose:

* Convert legacy SpouseID → Families

---

#### Audit Missing Relationships

Function:

* auditBackfillFamiliesFromPersons()

Detects:

* Missing spouse families
* Missing parent pairs
* Missing child links

---

#### Rebuild Child Links

Function:

* rebuildFamilyChildrenFromPersons()

Reconstructs FamilyChildren from:

* FatherID
* MotherID

---

### 10. Concurrency Safety

Uses:

* LockService → prevent race conditions
* CacheService → prevent duplicate submissions

---

## Data Model

### Persons

Primary entity

Fields:

* PersonID
* FullName
* DisplayName
* Gender
* BirthYear
* DeathYear
* FatherID
* MotherID
* SpouseID (legacy)
* CreatedAt / UpdatedAt
* Notes

---

### Families

Represents relationships

Fields:

* FamilyID
* Person1ID
* Person2ID
* RelationType
* StartYear
* EndYear
* IsActive
* Notes

---

### FamilyChildren

Links children to families

Fields:

* LinkID
* FamilyID
* ChildID
* ChildOrder
* Notes

---

## Architecture

### Context-Based Processing

Two main contexts:

* Person Context (Persons)
* Relationship Context (Families + FamilyChildren)

Benefits:

* Faster lookups
* Reduced repeated reads
* Cleaner logic separation

---

### Canonical Pair Key

Couples are identified using:

sorted(Person1ID, Person2ID)

Prevents duplicate family creation.

---

## Main Functions

### Entry

* doGet → Load UI

---

### Submission

* submitFamily → Legacy mode
* submitFamilyV2 → Family-based system

---

### Data Access

* getPeopleIndex
* getFamiliesIndex
* getPersonFamiliesSummary

---

### Relationship

* ensureFamilyFromPair
* addChildToFamily
* getFamilyTreeView

---

### Duplicate Handling

* findDuplicateCandidates
* mergeDuplicatePersonsSafe
* backupAllFamilySheets

---

### Maintenance

* backfillFamiliesFromPersons
* rebuildFamilyChildrenFromPersons
* repairPersonCounter

---

## Setup

1. Create Google Spreadsheet

2. Add required sheets:

   * Persons
   * Families (auto-created if missing)
   * FamilyChildren (auto-created if missing)

3. Set Spreadsheet ID:

SPREADSHEET_ID = 'YOUR_ID_HERE'

4. Deploy as Web App:

* Execute as: Me
* Access: Anyone / restricted

---

## Version Evolution

### Version 1.0

* Single spouse model
* Direct relationships in Persons
* Basic input form

---

### Version 2.0 (Current)

* Family-based normalization
* Multi-spouse support
* Duplicate detection & merge tools
* Tree visualization
* Migration utilities

---

## Key Design Decisions

### 1. Do Not Overwrite Data

* Parents cannot be replaced once set
* Prevents silent corruption

---

### 2. Duplicate Handling is Controlled

* Detection first
* Manual confirmation
* Safe merge only

---

### 3. Separate Intake vs Processing

This app focuses on:

Data collection → normalization → export-ready structure

---

## Future Improvements

* GEDCOM export
* Graph-based tree visualization
* Relationship editor UI
* Search & filtering
* Timeline view

---

## License

Private / Internal Use (customizable)
