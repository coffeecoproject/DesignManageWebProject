# Sourced by the period-close drill scripts. Each drill runs against its own throwaway napbox Postgres,
# never this worktree's development database; the environment and its data are deleted afterwards.

TEMP_DB_ENV="period-close-drill-$$"
TEMP_DB_STARTED=0

temp_db_up() {
  TEMP_DB_STARTED=1
  napbox up --temp "$TEMP_DB_ENV" >/dev/null
}

temp_db_down() {
  if [[ "$TEMP_DB_STARTED" == "1" ]]; then
    napbox down --temp "$TEMP_DB_ENV" >/dev/null
  fi
}

# Runs psql inside the throwaway Postgres; stdin is forwarded, there is no interactive terminal.
temp_db_psql() {
  napbox exec postgres --temp "$TEMP_DB_ENV" -- psql -U startupmanage_app -d startupmanage_local "$@"
}
