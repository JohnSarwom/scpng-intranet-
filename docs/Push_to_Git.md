git add .
git commit -m "Group movement Performance and Strategy Divisions correct labeling"
git push origin main
g3. **Fixed Profile Image Loading**:
   * **Robust Image Mapping**: Updated `OrgChart.tsx` to intelligently map images. It first tries to find a photo by the officer's email in the standard `Employee_Profiles` library. If not found, it falls back to extracting the direct filename from the `ProfileImageUrl` column and fetching it from the `Asset Images` library.
   * **Fast Loading Technique**: Integrated the "Contacts Page" technique of pre-fetching authenticated blobs using Microsoft Graph. This avoids direct URL authentication issues and implements a multi-layer fast loading strategy:
     * **IndexedDB Caching**: All fetched photos are persisted in the browser's `scpng-intranet-photos` IndexedDB store (via `PhotoCacheService`). This ensures images load instantly on subsequent page visits.
     * **Thumbnail Optimization**: The system prioritizes fetching `medium` thumbnails for the Org Chart list view to save bandwidth and speed up rendering, falling back to full resolution only if thumbnails aren't available.
     * **Concurrent Processing**: All officer photos are fetched in parallel to minimize "waterfall" network delays.

4. **UI Polished**:
   * Fixed a type error in `OrgNode`.
   * Updated `OfficerCard` to render the loaded `photoUrl` or the initials avatar as a fallback.
   * Updated `OfficerProfileModal` with a 960px width and image support.

## How to Verify
1. Go to the **Strategy** page.
2. Switch to the **Org Chart** view and click the "**Profiles**" pill at the top right toggle.
3. Observe how the profile images (like Andy Ambulu's) now load correctly with a smooth fade-in.
4. Open a profile modal; it will now prominently display the officer's photo in the left panel.
5. Notice that after the first load, refreshing the page results in instantaneous image appearance due to the persistent cache.
n