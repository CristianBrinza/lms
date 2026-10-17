# The LMS updater: the Docker CLI with Compose, git, and the update loop. It drives the host's
# Docker through the mounted socket and the repo mounted at its own path (see docker-compose.yml).
FROM docker:29.9.0-cli@sha256:1a4c7cb63513f349bdad01fcc6e0f3f2f67d37b9da86f14dc0d4a0942eecda00
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
