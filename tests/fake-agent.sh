#!/bin/sh
# A stand-in agent for testing Index: sets its title, reports each status in
# turn (2 s apart), then waits. Herdr counts "done" only after "working".
# usage: tests/fake-agent.sh <state[,state...]> [title]
#   e.g. tests/fake-agent.sh working,done "Finished the refactor"
printf '\033]0;%s\007' "${2:-}"
first=1
for s in $(printf '%s' "$1" | tr ',' ' '); do
  [ "$first" = 1 ] || sleep 2
  first=0
  printf '\033]7501;state=%s\007' "$s"
done
exec cat
