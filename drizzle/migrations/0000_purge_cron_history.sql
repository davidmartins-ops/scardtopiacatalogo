TRUNCATE cron.job_run_details;
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'purge-cron-history';
SELECT cron.schedule('purge-cron-history', '17 3 * * *', $$DELETE FROM cron.job_run_details WHERE end_time < now() - interval '2 days'$$);