# Where to Manage Tags and English Words

## 📋 Tags Management

Tags are stored in the database. You can manage them either via migrations/SQL, or via the new text file which auto-syncs into the DB.

### Option 0: `tags.txt` (Recommended for this project)
**File:** `backend/app/tags.txt`

- One tag per line (supports Chinese names)
- Blank lines are ignored
- Lines starting with `#` are comments
- **Restart the backend** after editing (the file is cached)

On the next call to `GET /api/tags` (or when creating a link), the backend will:
- Insert missing tags (active)
- Reactivate tags that exist but are inactive
- Deactivate tags not present in `tags.txt` (no rows are deleted)

### Option 1: Database Migration (Initial Setup)
**File:** `backend/migrations/versions/20260126_0001_init.py`

Look for the section around **line 55-67**:
```python
# Seed a few default tags (safe to re-run? This migration runs once).
op.execute(
    sa.text(
        """
        INSERT INTO tags (name, is_active)
        VALUES
          ('General', true),
          ('Marketing', true),
          ('Engineering', true),
          ('Support', true)
        """
    )
)
```

**To add/modify tags:** Edit the VALUES list and run:
```bash
cd backend
alembic upgrade head
```

### Option 2: Direct Database (After Migration)
Connect to your Postgres database and run SQL:
```sql
-- Add a new tag
INSERT INTO tags (name, is_active) VALUES ('Sales', true);

-- Deactivate a tag (won't show in dropdown)
UPDATE tags SET is_active = false WHERE name = 'OldTag';

-- Reactivate a tag
UPDATE tags SET is_active = true WHERE name = 'OldTag';
```

### Option 3: Create a New Migration (Recommended for Production)
```bash
cd backend
alembic revision -m "add_new_tags"
```

Then edit the new migration file to add/update tags.

---

## 📚 Blocked Words List

The blocked words list (English words, acronyms, and swear words) is now in a separate text file:

**File:** `backend/app/blocked_words.txt`

This file contains:
- Common English words ≤4 characters
- Common 3-4 letter acronyms (VIP, USA, API, URL, etc.)
- Swear words ≤4 characters (fuck, shit, damn, etc.)

### To Add Words:
1. Open `backend/app/blocked_words.txt`
2. Add your word on a new line (one word per line, lowercase)
3. Save the file
4. Restart the backend server (the file is cached, so restart is required)

### To Remove Words:
1. Open `backend/app/blocked_words.txt`
2. Find and delete the line containing the word
3. Save the file
4. Restart the backend server

### Example:
```
a
i
am
an
test
code
link
vip
usa
fuck
shit
```

**Note:** 
- The check is case-insensitive, so "TEST", "test", and "Test" are all blocked
- Only words ≤4 characters are loaded (longer words in the file are ignored)
- The file is loaded once at startup and cached for performance

---

## 🔄 After Making Changes

1. **For Tags:** Restart backend (if editing `tags.txt`) or run migrations / SQL
2. **For English Words:** Restart the backend server
3. **For UI Changes:** Frontend hot-reloads automatically in dev mode
