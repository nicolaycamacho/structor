# Default generated repository name uses Structor

Structor defaults generated harness repositories to `<project-slug>-structor`
instead of `<project-slug>-harness`, `<project-slug>-structor-harness`, or the
older `<project-slug>-engineering-harness` pattern. Harness remains the category,
while Structor is the productized implementation of that category; using the
product name in the default folder helps users associate Structor with the
improved local harness concept without reintroducing the earlier
legacy `engineering-harness` naming ambiguity.
