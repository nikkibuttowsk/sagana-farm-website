# Farm Detail Page Design

## Intent

Expand `/farms/[id]` into a useful visitor page with farm media and structured
visit information, while letting visitors start a reservation or enter a local
chat message.

## Goals

- Keep the farm data query in the existing server-rendered App Router page.
- Show a direct-media walkthrough video from `video_url` when present and a
  photo gallery from `images`.
- Use a two-column desktop layout: visuals on the left and a sticky details
  sidebar on the right. Let the sidebar flow normally on narrow screens.
- Show `location`, `province`, `season`, `bearing_season`, `crops`, `hours`,
  `entrance_fee`, `activities`, and `description`.
- Link to the existing reservation flow with the current farm ID.
- Add a client-only `FarmChatBox` with a local message list and input; do not
  send messages or call a backend.

## Non-goals and constraints

- Do not add a database migration or modify reservation tables, API routes, or
  email logic.
- Assume the listed columns already exist in Supabase; the checked-in
  migrations do not define every requested detail column.
- Support direct media URLs for the walkthrough video (MP4/WebM), not provider
  embeds.
- Reuse existing farm query, image URL validation, styles, and reservation URL
  conventions where practical.

## Approaches

- Make the entire page client-rendered: rejected because the current page
  already loads farm data server-side and only the chat needs local state.
- Keep the detail page server-rendered and isolate chat in a client component:
  selected because it follows the existing App Router pattern and limits
  client-side code.

## Implementation calls

- Use native video controls without autoplay; render photos in a responsive
  gallery.
- Keep the requested sidebar content sticky on desktop with a bounded internal
  scroll area, and non-sticky on mobile.
- On submit, append the visitor's message to local component state and clear
  the input. Show no fabricated assistant reply.
- Show a clear notice that chat messages are local and are not sent.
