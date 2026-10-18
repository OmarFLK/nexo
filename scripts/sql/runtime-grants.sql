-- Run as the migration owner, AFTER creating nexo_runtime with a strong password
-- using SQL/Neon. Do not make it a member of neon_superuser or the owner role.
GRANT CONNECT ON DATABASE neondb TO nexo_runtime;
GRANT USAGE ON SCHEMA public TO nexo_runtime;
GRANT SELECT ON nexo_schema_migrations,nexo_workspace,nexo_commands,nexo_audit,nexo_users,nexo_sessions,nexo_login_limits TO nexo_runtime;
GRANT UPDATE ON nexo_workspace TO nexo_runtime;
GRANT INSERT ON nexo_commands,nexo_audit TO nexo_runtime;
GRANT INSERT,UPDATE,DELETE ON nexo_sessions,nexo_login_limits TO nexo_runtime;
-- No CREATE, TRUNCATE, role administration, user management or audit deletion grants.
