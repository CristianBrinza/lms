# The LMS updater: the Docker CLI with Compose, git, and the update loop. It drives the host's
# Docker through the mounted socket and the repo mounted at its own path (see docker-compose.yml).
FROM docker:28.5.2-cli@sha256:625d9431a9f54c5a2bc90f24f0e1c3d55b1349fd857dd85035f98c2c9acbdd4d
RUN apk add --no-cache bash git curl jq tzdata coreutils \
  && git config --system --add safe.directory '*'
COPY update.sh /usr/local/bin/lms-update
RUN chmod +x /usr/local/bin/lms-update
ENTRYPOINT ["lms-update"]
