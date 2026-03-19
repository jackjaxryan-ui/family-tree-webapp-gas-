# 📐 Architecture Overview

This project is a Google Apps Script–based web application for managing family tree data using Google Sheets as a lightweight relational database.

---

## 🧩 Data Model

The system uses three core sheets:

### 1. Persons
- Master record of individuals  
- Contains identity and direct relations:
  - `PersonID`
  - `FullName`, `Gender`, `BirthYear`
  - `FatherID`, `MotherID`, `SpouseID`

👉 Source of truth for all individuals

---

### 2. Families
- Represents relationship pairs:
  - Marriage
  - ParentPair
- Key fields:
  - `FamilyID`
  - `Person1ID`, `Person2ID`
  - `RelationType`

👉 Defines relationship structure

---

### 3. FamilyChildren
- Maps children to a family
- Key fields:
  - `FamilyID`
  - `ChildID`
  - `ChildOrder`

👉 Connects individuals to family units

---

## 🔄 Core Flow

### 1. Data Input

submitFamily() / submitFamilyV2()

- Creates or updates `Persons`
- Creates or links `Families`
- Assigns children via `FamilyChildren`
- Includes safeguards:
  - Prevent double-submit (recent request guard)
  - Prevent strict duplicate creation

---

### 2. Duplicate Detection

findDuplicateCandidates()

- Scans `Persons`
- Groups potential duplicates:
  - **STRICT** (high confidence)
  - **LOOSE** (review needed)
- Outputs to `DuplicateReview` sheet
- Preserves manual inputs:
  - `Decision`
  - `ManualNote`

---

### 3. Controlled Merge

mergeDuplicatePersonsSafe()

- Reads `DuplicateReview`
- Processes only rows with:
  - `Decision = MERGE`
- Merges duplicate persons into a selected keeper
- Performs full remapping:
  - Persons → Father/Mother/Spouse
  - Families → Person1/Person2
  - FamilyChildren → ChildID/FamilyID
- Removes resulting duplicates
- Reorders child positions
- Logs actions to `MergeLog`

---

## 🛡️ Data Integrity Principles

- **Persons = Source of Truth**
- **Families = Relationship Layer**
- **FamilyChildren = Linkage Layer**

Additional safeguards:
- Backup before destructive operations
- Manual review required before merge
- No automatic merge without explicit approval
- Cross-sheet consistency maintained during merge

---

## ⚙️ Duplicate Handling Strategy

1. Detect duplicates (non-destructive)
2. Review manually in `DuplicateReview`
3. Approve via `Decision = MERGE`
4. Execute safe merge with full relational update

---

## 🚀 Design Goals

- Maintain data integrity across related sheets  
- Prevent duplicate creation at input level  
- Enable safe cleanup of existing data  
- Keep implementation simple (Sheets-based) but structured  

---

**Status: Production-ready duplicate management with relational consistency**
