# The LMS updater: the Docker CLI with Compose, git, and the update loop. It drives the host's
# Docker through the mounted socket and the repo mounted at its own path (see docker-compose.yml).
FROM docker:28.5.2-cli@sha256:625d9431a9f54c5a2bc90f24f0e1c3d55b1349fd857dd85035f98c2c9acbdd4d
# openssh-keygen: git checks the commits' SSH signatures with it (update.sh, signed deploys).
RUN apk add --no-cache bash git curl jq tzdata coreutils openssh-keygen \
  && git config --system --add safe.directory '*'
# It runs as the checkout's owner (docker-compose.yml), who needs a name here: ssh-keygen, which
# checks the signatures, refuses to run for a user id without one.
ARG LMS_UID=1000
ARG LMS_GID=1000
RUN getent passwd "$LMS_UID" >/dev/null || echo "lms:x:$LMS_UID:$LMS_GID:LMS updater:/tmp:/sbin/nologin" >>/etc/passwd
COPY update.sh /usr/local/bin/lms-update
RUN chmod +x /usr/local/bin/lms-update
ENTRYPOINT ["lms-update"]
