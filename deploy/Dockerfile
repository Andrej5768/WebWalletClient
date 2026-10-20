# Carries the production build to the server, which copies /site out of it (see deploy/deploy.sh in the backend).
# Build context: dist/
FROM scratch
COPY . /site
# docker create needs a command; the image is never run
CMD ["none"]
