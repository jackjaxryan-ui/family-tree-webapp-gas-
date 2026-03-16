# Database Schema

The application uses **Google Sheets as the database**.

Main sheet used by the system:

Persons

Each row represents **one person in the family tree**.

---

# Persons Table

| Column | Type | Description |
|------|------|------|
| PersonID | String | Unique identifier (P0001, P0002, etc.) |
| FullName | String | Full name |
| DisplayName | String | Name with birth year (for UI display) |
| Gender | String | L (male) or P (female) |
| BirthYear | Number | Year of birth |
| IsDeceased | Boolean | TRUE if the person is deceased |
| DeathYear | Number | Year of death |
| IsMarried | Boolean | TRUE if the person is married |
| FatherID | String | Reference to father's PersonID |
| MotherID | String | Reference to mother's PersonID |
| SpouseID | String | Reference to spouse PersonID |
| CreatedAt | Timestamp | Record creation time |
| UpdatedAt | Timestamp | Last update time |
| CreatedBy | String | Email of creator |
| UpdatedBy | String | Email of last editor |
| Notes | String | Optional notes |

---

# Relationship Model

Family relationships are stored using **PersonID references**.

Example:

PersonID | FullName
--- | ---
P0001 | Ahmad
P0002 | Fatimah
P0003 | Hasan

Relationships:

Hasan.FatherID → P0001  
Hasan.MotherID → P0002  

Marriage relationship:

Ahmad.SpouseID → P0002  
Fatimah.SpouseID → P0001  

---

# Example Row

| PersonID | FullName | Gender | BirthYear | FatherID | MotherID |
|------|------|------|------|------|------|
| P0003 | Hasan | L | 1970 | P0001 | P0002 |

This means Hasan is the child of Ahmad and Fatimah.

---

# Notes

- PersonID is generated automatically by the backend.
- Relationships are maintained by referencing PersonID.
- The system automatically links spouses and parents when data is submitted.
