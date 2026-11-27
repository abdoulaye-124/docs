-- =============================================================================
-- TERANGA ÉDUCATION — Migration 6 (Phase 5) : rôle « relecteur wolof »
-- Seule dans son fichier : une nouvelle valeur d'énumération doit être validée
-- avant d'être utilisée par les migrations suivantes.
-- =============================================================================
alter type app_role add value if not exists 'relecteur_wolof';
