# Meeting Minutes — Template Structure

> **Created:** 2026-03-29
> **Template File:** `public/files/SCPNG_Meeting_Minutes_DYNAMIC.docx`
> **Engine:** docxtemplater (single-brace `{tag}` delimiter)

---

## Delimiter Convention

| Type | Syntax | Example |
|---|---|---|
| Flat value | `{TAG_NAME}` | `{MEETING_NUMBER}` |
| Loop open | `{#arrayName}` | `{#attendance}` |
| Loop close | `{/arrayName}` | `{/attendance}` |
| Current item (primitive array) | `{.}` | `{#points}{.}{/points}` |

> **Critical:** docxtemplater uses **single braces** by default. Double braces `{{TAG}}` cause a `"Duplicate open tag"` parse error. All flat fields in the template must use single braces.

---

## Section A — Meeting Particulars (Flat Fields)

| Placeholder | Description | Required |
|---|---|---|
| `{MEETING_NUMBER}` | Meeting reference e.g. `SC-003/2025` | Yes |
| `{MEETING_NAME}` | Full descriptive meeting name | Yes |
| `{MEETING_DATE}` | Date of meeting | Yes |
| `{START_TIME}` | Meeting start time | Yes |
| `{END_TIME}` | Meeting end time | Yes |
| `{FACILITATOR_NAME}` | Name and title of facilitator | Yes |
| `{VENUE}` | Meeting location | Yes |
| `{MINUTES_BY}` | Name and title of minute recorder | Yes |
| `{MEETING_OBJECTIVE}` | Purpose of the meeting | Yes |
| `{MEETING_ORDER}` | Opening notes / agenda order | No |

---

## Section B — Attendance (Loop)

**Template row pattern** (single data row in Word table):

```
| {#attendance}{name}   |   {position}{/attendance} |
```

- `{#attendance}` opens in the **left cell**
- `{/attendance}` closes in the **right cell**
- Both open and close tags are in the **same table row**
- Produces exactly as many rows as attendees entered — no blank rows

| Key | Description |
|---|---|
| `name` | Attendee full name |
| `position` | Attendee job title / position |

---

## Section C — Key Discussion Points (Nested Loop)

**Template pattern (3-paragraph loop):**

```text
{#discussion}{index}. {title}   ← Heading paragraph (Left Margin)
  {#points}                     ← Loop Open (No bullet, No spaces)
  • {.}                         ← Bullet Content (Indented)
  {/points}                     ← Loop Close (No bullet, No spaces)
{/discussion}                   ← Outer Loop Close (No bullet)
```

> [!IMPORTANT]
> The `{#points}`, `{/points}`, and `{/discussion}` tags MUST be on their own paragraphs and be **flush against the left margin** (no spaces or tabs) to be correctly removed by the `paragraphLoop: true` engine.

- Outer loop `{#discussion}` / `{/discussion}` iterates topics
- `{index}` is the 1-based topic number
- `{title}` is the topic heading
- Inner loop `{#points}{.}{/points}` iterates bullet points for each topic
- `{.}` refers to the current string item in the `points` array

| Key | Type | Description |
|---|---|---|
| `index` | number | Auto-incremented topic number |
| `title` | string | Topic heading |
| `points` | string[] | Bullet point lines |

---

## Section D — Action Items Summary (Loop)

**Template row pattern:**

```
| {#actionItems}{area}  |  {action}{/actionItems} |
```

- `{#actionItems}{area}` — open tag and field in **same cell, same line**
- `{action}{/actionItems}` — field and close tag in **right cell**

| Key | Description |
|---|---|
| `area` | Action category / responsible area |
| `action` | Action description (owner appended inline if set) |

---

## Section E — Closing Remarks (Loop)

**Template pattern (3-paragraph loop):**

```text
{#closingRemarks}
• {remark}
{/closingRemarks}
```

- Each remark is rendered on a separate bullet paragraph.

| Key | Description |
|---|---|
| `remark` | Single closing remark text |

---

## Section F — Sign Off (Flat Fields)

| Placeholder | Description |
|---|---|
| `{CHAIRPERSON_NAME}` | Auto-extracted from `FACILITATOR_NAME` (before the `–` separator) |
| `{MINUTE_RECORDER_NAME}` | Auto-extracted from `MINUTES_BY` (before the `–` separator) |

---

## Template File History

| File | Status | Notes |
|---|---|---|
| `SCPNG_Meeting_Minutes_TEMPLATE.docx` | Deprecated (backup) | Fixed numbered slots (ATTENDEE_1..5, DISCUSSION_TOPIC_1..7). Replaced because unused slots left blank rows. |
| `SCPNG_Meeting_Minutes_DYNAMIC.docx` | **Active** | Dynamic loop-based template. Produces clean output regardless of how many items are entered. |
