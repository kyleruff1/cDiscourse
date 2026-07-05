-- RESEED-001 GATE-CLEAR — scoped content clear (Tier-3, operator-authorized 2026-07-04).
-- Explicit per-table DELETEs in FK order (children -> parents); NO TRUNCATE CASCADE.
-- Preserve-list (never touched): auth.users, profiles, constitution_versions/rules,
-- tag/flag_definitions, semantic_referee_*, bot_user_registry, admin_block_rules,
-- admin_audit_events, classifier_drain_audit, classifier_drain_lock.
begin;
delete from public.moderation_reviews;
delete from public.concession_acceptances;
delete from public.concession_items;
delete from public.argument_machine_observation_results;
delete from public.argument_machine_observation_runs;
delete from public.argument_flags;
delete from public.argument_deletion_requests;
delete from public.argument_inactive_audit;
delete from public.argument_tags;
delete from public.audio_submissions;
delete from public.move_reactions;
delete from public.point_tags;
delete from public.topic_satisfaction_checks;
delete from public.room_notifications;
delete from public.debate_user_state;
delete from public.argument_room_links;
delete from public.arguments;
delete from public.debate_participants;
delete from public.debate_inactive_audit;
delete from public.room_visibility_changes;
delete from public.argument_room_invites;
delete from public.debates;
delete from public.circle_invites;
delete from public.circle_members;
delete from public.circles;
commit;
