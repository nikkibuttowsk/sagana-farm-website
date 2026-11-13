# Public Farm Listing Design

## Intent

Show active farms from Supabase in Popular, Wet Season, and Dry Season sections,
and let visitors open a farm detail page.

## Goals

- Keep the listing at `/farm` and preserve its search behavior.
- Display each farm's image, name, location, province, and season.
- Link each farm to `/farms/[id]` and make that route resolve for active farms.
- Include farms in Popular when `is_trending` is true or `category` is
  “popular”; classify wet/dry season by a case-insensitive match in `season` or
  `category`. A farm may appear in multiple sections.

## Non-goals and constraints

- Do not modify reservation tables, API routes, or email logic.
- Do not add a database migration. The implementation assumes the existing
  Supabase `farms.season` column is available as specified.
- Keep the existing public Supabase client and safe farm-image URL helper.

## Approaches

- Rebuild the listing independently: rejected because it would duplicate
  existing farm-query and image handling.
- Add detail links only: rejected because `/farms/[id]` does not currently
  exist.
- Enhance `/farm` and add a minimal active-farm detail route: selected because
  it reuses existing data and makes every requested link functional.

## Implementation calls

- Extend the active-farm query to select `season` and add a lookup for one
  active farm by ID.
- Use the existing image URL helper and placeholder for list and detail pages.
- Keep the existing search form and use it to filter farms before categorizing.
