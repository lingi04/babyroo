# Brighten selected Explore badges

The user requested an orange closer to Babyroo's accent for selected category
badges and asked to apply the same treatment within the expanded filter panel.

- Use the existing `primaryStrong` orange for selected borders and category
  icons. Use `#C0430D` for selected labels, which gives 5.19:1 contrast on white.
- Apply this palette to the category row, selected children, and active filter
  chips. Keep the same fill, dimensions, and selection behavior.
- Check the side-by-side composite, then run TypeScript, lint, and focused
  Explore tests. Verify the colors in the native app when a device is available.
