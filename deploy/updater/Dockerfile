# The LMS updater: the Docker CLI with Compose, git, and the update loop. It drives the host's
# Docker through the mounted socket and the repo mounted at its own path (see docker-compose.yml).
FROM docker:28-cli
RUN apk add --no-cache bash git curl jq tzdata coreutils \
  && git config --system --add safe.directory '*'
COPY update.sh /usr/local/bin/lms-update
RUN chmod +x /usr/local/bin/lms-update
ENTRYPOINT ["lms-update"]
