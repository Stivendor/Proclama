# Fix Quick Search for Numbered Bible Books Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve the Quick Search feature to correctly autocomplete Bible books starting with numbers (e.g., "1 P" -> "1 Pedro") and handle the transition to the chapter field without errors.

**Architecture:** 
1. Enhance the book suggestion logic to be space-insensitive.
2. Refine the input handling in the Quick Search modal to prevent premature locking for numbered books.
3. Update the auto-lock effect to correctly handle numbered books and focus management.

**Tech Stack:** React, TypeScript, Lucide Icons.

---

### Task 1: Enhance `getBookSuggestion` logic

**Files:**
- Modify: `src/services/bible.ts`

- [ ] **Step 1: Update `getBookSuggestion` to ignore spaces**

Modify `src/services/bible.ts`:
```typescript
export function getBookSuggestion(query: string): { id: string; name: string; nameEn: string } | null {
  if (!query.trim()) return null
  
  const removeAccents = (str: string) => {
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  }
  
  // Normalizar búsqueda: sin acentos, sin espacios, minúsculas
  const queryClean = removeAccents(query.toLowerCase()).replace(/\s/g, '')
  
  // Buscar libros que comiencen con la query (ignorando tildes y espacios)
  const matches = BIBLE_BOOKS.filter(b => {
    const nameClean = removeAccents(b.name.toLowerCase()).replace(/\s/g, '')
    const nameEnClean = removeAccents(b.nameEn.toLowerCase()).replace(/\s/g, '')
    return nameClean.startsWith(queryClean) || nameEnClean.startsWith(queryClean)
  })
  
  if (matches.length === 1) {
    return { id: matches[0].id, name: matches[0].name, nameEn: matches[0].nameEn }
  }
  
  // Word matches logic update
  const wordMatches = BIBLE_BOOKS.filter(b => {
    const partsEs = removeAccents(b.name.toLowerCase()).split(' ')
    const partsEn = removeAccents(b.nameEn.toLowerCase()).split(' ')
    return partsEs.some(part => removeAccents(part.toLowerCase()).startsWith(queryClean)) || 
           partsEn.some(part => removeAccents(part.toLowerCase()).startsWith(queryClean))
  })
  
  if (wordMatches.length === 1 && matches.length > 1) {
    return { id: wordMatches[0].id, name: wordMatches[0].name, nameEn: wordMatches[0].nameEn }
  }
  
  return null
}
```

- [ ] **Step 2: Commit changes**

```bash
git add src/services/bible.ts
git commit -m "refactor: make getBookSuggestion space-insensitive for better numbered book matching"
```

---

### Task 2: Refine `handleBookChange` in `BibleView`

**Files:**
- Modify: `src/pages/BibleView.tsx`

- [ ] **Step 1: Prevent premature auto-lock for numbered books**

In `src/pages/BibleView.tsx`, update `handleBookChange`:
```typescript
  const handleBookChange = (value: string) => {
    if (isBookLocked) return
    
    // Check if user is typing a number - auto-lock the book
    if (/\d/.test(value) && parsedBook) {
      // PREVENCIÓN: No bloquear si el valor sigue siendo un prefijo válido del libro sugerido
      // Esto evita que el "1" en "1 Pedro" dispare el bloqueo del capítulo prematuramente.
      const removeAccents = (str: string) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      const nameClean = removeAccents(parsedBook.name.toLowerCase()).replace(/\s/g, '')
      const valClean = removeAccents(value.toLowerCase()).replace(/\s/g, '')
      
      if (nameClean.startsWith(valClean)) {
        setQuickSearchBook(value)
        return
      }

      setQuickSearchBook(parsedBook.name)
      setIsBookLocked(true)
      
      // Extraer capítulo inteligentemente (excluyendo el prefijo del libro si es necesario)
      const chapterPart = value.substring(parsedBook.name.length).trim() || value.match(/\d+$/)?.[0] || ''
      setQuickSearchChapter(chapterPart)
      quickSearchChapterRef.current?.focus()
      return
    }
    
    setQuickSearchBook(value)
  }
```

- [ ] **Step 2: Commit changes**

```bash
git add src/pages/BibleView.tsx
git commit -m "fix: prevent premature auto-locking in quick search for books starting with numbers"
```

---

### Task 3: Update auto-lock `useEffect` and focus logic

**Files:**
- Modify: `src/pages/BibleView.tsx`

- [ ] **Step 1: Implement "Option B" behavior in `useEffect`**

In `src/pages/BibleView.tsx`, update the `useEffect` for autocomplete (around line 134):
```typescript
  // Autocomplete book as user types - Automatic lock when unique
  useEffect(() => {
    if (!quickSearchBook.trim() || isBookLocked) return
    
    const suggestion = getBookSuggestion(quickSearchBook.trim())
    if (suggestion) {
      const displayName = selectedLanguage === 'Inglés' ? (suggestion as any).name || suggestion.name : suggestion.name
      setParsedBook({ name: displayName, id: suggestion.id })
      
      // AUTO-LOCK: Si ya es una coincidencia única y han escrito al menos 2 caracteres
      const query = quickSearchBook.trim().toLowerCase()
      if (query.length >= 2) {
        // OPCIÓN B: Bloquear el libro y saltar al capítulo VACÍO si se detectó por letras después del número
        setQuickSearchBook(displayName)
        setIsBookLocked(true)
        setQuickSearchChapter('') // Asegurar que el capítulo esté vacío para libros numerados
        setTimeout(() => quickSearchChapterRef.current?.focus(), 10)
      }
    } else {
      setParsedBook(null)
    }
  }, [quickSearchBook, isBookLocked, selectedLanguage])
```

- [ ] **Step 2: Commit changes**

```bash
git add src/pages/BibleView.tsx
git commit -m "feat: implement option B behavior for quick search autocompletion"
```
