-- DEATH LEGION DATABASE SCHEMA
-- RUN THIS IN SUPABASE SQL EDITOR

-- 1. Historical Signal Records (Every SMS captured)
CREATE TABLE IF NOT EXISTS dl_sms_history (
    id BIGSERIAL PRIMARY KEY,
    msg_id TEXT UNIQUE, -- Prevents duplicate captures across all nodes
    phone_number TEXT,
    content TEXT,
    otp_code TEXT,
    service TEXT,
    received_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Phone Node Inventory (Tracking all available numbers)
CREATE TABLE IF NOT EXISTS dl_phone_nodes (
    id BIGSERIAL PRIMARY KEY,
    phone_number TEXT UNIQUE,
    provider_type TEXT,
    last_active TIMESTAMPTZ DEFAULT NOW(),
    tags TEXT[] DEFAULT '{}',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. System Analytics (Optional performance tracking)
CREATE TABLE IF NOT EXISTS dl_sync_logs (
    id BIGSERIAL PRIMARY KEY,
    level TEXT, -- INFO, ERROR, WARN
    message TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Number Sets (Categorized lists of numbers)
CREATE TABLE IF NOT EXISTS dl_number_sets (
    id BIGSERIAL PRIMARY KEY,
    set_name TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    service_tag TEXT DEFAULT 'General',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(set_name, phone_number)
);

-- 5. OTP Requests (Signals for the bridge to watch for)
CREATE TABLE IF NOT EXISTS dl_otp_requests (
    id BIGSERIAL PRIMARY KEY,
    phone_number TEXT,
    service_name TEXT,
    status TEXT DEFAULT 'pending', -- pending, received, expired
    otp_code TEXT,
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. User Profiles (Persistent cloud settings & session memory)
CREATE TABLE IF NOT EXISTS dl_user_profiles (
    id BIGSERIAL PRIMARY KEY,
    nickname TEXT UNIQUE NOT NULL,
    settings JSONB DEFAULT '{}',
    usage_limit JSONB DEFAULT '{"date":"","list":[]}',
    timer_state JSONB DEFAULT '{"num":null, "end":null}',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Analytics View: Track message volume per Number Set
CREATE OR REPLACE VIEW dl_set_analytics AS
SELECT 
    ns.set_name,
    ns.service_tag,
    COUNT(h.id) as total_messages,
    MAX(h.received_at) as last_intercept
FROM dl_number_sets ns
LEFT JOIN dl_sms_history h ON ns.phone_number = h.phone_number
GROUP BY ns.set_name, ns.service_tag;

-- Enable Real-time (Safe Idempotent Activation)
DO $$ 
BEGIN
    -- SMS History
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'dl_sms_history') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE dl_sms_history;
    END IF;

    -- Phone Nodes
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'dl_phone_nodes') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE dl_phone_nodes;
    END IF;

    -- Number Sets
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'dl_number_sets') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE dl_number_sets;
    END IF;

    -- OTP Requests
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'dl_otp_requests') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE dl_otp_requests;
    END IF;

    -- User Profiles
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'dl_user_profiles') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE dl_user_profiles;
    END IF;
END $$;
