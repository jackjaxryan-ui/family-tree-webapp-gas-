# Code.gs — Latest Version
This README covers the **latest `Code.gs`** only.

## added: family - child relationship and support for multiple spouses
This project evolves from a simple data-entry form into a more robust genealogy data engine with:
- Family-based relationship system  
- Multiple spouses support  
- Family grouping (Families & FamilyChildren)  
- Improved data integrity  
- Foundation for Family Tree View  

---

## Key Features

### 1. Person Management
- Add new individuals  
- Select existing individuals  
- Store:
  - Full Name  
  - Gender  
  - Birth Year / Death Year  
  - Notes  

### 2. Parent Relationships
- Assign Father & Mother  
- Auto-validation for gender consistency  
- Prevent overwriting existing parents  

### 3. Spouse & Marriage System (V2)
- Support multiple spouses  
- Each relationship stored as a Family  
- Track:
  - Start Year  
  - End Year  
  - Active / Inactive status  
  - Notes  

### 4. Children Management
- Add multiple children  
- Automatically linked to parents via Family  
- Child order supported  

### 5. Duplicate Detection
- Smart name comparison  
- Birth year similarity scoring  
- Warning before inserting duplicate data  

### 6. Dashboard Stats
- Total people count  
- Last update timestamp  
- Generation depth calculation  

### 7. Migration & Backfill Tools
- Convert legacy SpouseID into Families  
- Rebuild parent-child relationships  
- Audit missing relationships  

---

## Data Structure

### Required Sheets

#### Persons
Main table storing individuals

Columns:
- PersonID  
- FullName  
- DisplayName  
- Gender  
- BirthYear  
- DeathYear  
- FatherID  
- MotherID  
- SpouseID (legacy)  
- CreatedAt  
- UpdatedAt  
- Notes  

#### Families
Represents relationships (marriage or parent pair)

Columns:
- FamilyID  
- Person1ID  
- Person2ID  
- RelationType  
- StartYear  
- EndYear  
- IsActive  
- Notes  
- CreatedAt  
- UpdatedAt  

#### FamilyChildren
Links children to a family

Columns:
- LinkID  
- FamilyID  
- ChildID  
- ChildOrder  
- Notes  
- CreatedAt  
- UpdatedAt  

---

## Version Evolution

### Version 1.0
- Single spouse model  
- Relationships stored directly in Persons  
- Limited scalability  

### Version 2.0 (Current)
- Introduces Families table  
- Supports multiple spouses  
- Enables complex genealogy  
- Cleaner normalization  

---

## Family Tree View (Concept)

The current data structure is designed to support a Family Tree View, where:

- Each Family represents a couple node  
- Children branch from families  
- Individuals can belong to multiple families  

This enables:
- Visualization of remarriages  
- Multi-generation trees  
- Accurate lineage tracking  

---

## Core Concepts

### 1. Family as Central Entity
Relationships are grouped into Families instead of directly linking people.

Children belong to a Family, not just to individual parents.

### 2. Canonical Pair Key
Each couple is uniquely identified using a sorted combination of Person IDs.

This prevents duplicate family entries.

### 3. Context-Based Processing
Two main contexts are used:
- Person Context (Persons sheet)  
- Relationship Context (Families and FamilyChildren)  

This improves performance, consistency, and batch operations.

---

## Main Functions

### Entry Point
- doGet → Load UI  

### Core Actions
- submitFamily → Legacy submit (v1 compatible)  
- submitFamilyV2 → New family-based system  

### Data Access
- getPeopleIndex → Used by UI  
- getPersonFamiliesSummary → Display spouse history  

### Relationship Helpers
- ensureFamilyFromPair  
- addChildToFamily  
- findFamilyByCouple  

### Maintenance
- backfillFamiliesFromPersons  
- auditBackfillFamiliesFromPersons  
- rebuildFamilyChildrenFromPersons  

---

## Validation Rules

- Birth year must be numeric  
- Death year must not be earlier than birth year  
- Gender must match role (Father = Male, Mother = Female)  
- Existing parents cannot be overwritten  
- Duplicate entries are detected and require confirmation  

---

## Concurrency Handling

Uses LockService to ensure:
- No duplicate ID generation  
- Safe concurrent submissions  

---

## UI Features

- Search existing people (autocomplete)  
- Toggle between existing and new person  
- Dynamic child forms  
- Duplicate warning system  
- V2 spouse management panel  
- Mobile-friendly layout  

---

## Setup Instructions

1. Create a Google Spreadsheet  
2. Add sheets:
   - Persons  
   - (optional) Meta  

3. Set your Spreadsheet ID in the script:

SPREADSHEET_ID = 'YOUR_ID_HERE'

4. Deploy as Web App:
   - Execute as: Me  
   - Access: Anyone (or restricted)  

---

## Future Improvements

- Full Family Tree Visualization (graph view)  
- Drag and drop relationship editor  
- Export to GEDCOM  
- Advanced search and filtering  
- Timeline view  

---

## License

Internal / Private Use (customizable)
