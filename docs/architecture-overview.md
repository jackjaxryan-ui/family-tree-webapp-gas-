## Data Model

Persons
- Master data for individuals

Families
- Pair relationship (Marriage / ParentPair)

FamilyChildren
- Mapping child to family

## Core Flow

1. submitFamily()
   → create/update Persons
   → create/update Families
   → create/update FamilyChildren

2. findDuplicateCandidates()
   → scan Persons
   → write DuplicateReview

3. mergeDuplicatePersonsSafe()
   → read Decision
   → merge approved duplicates
   → remap all references
