CREATE SCHEMA IF NOT EXISTS topology;

COMMENT ON SCHEMA topology IS 'PostGIS Topology schema';

CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA public;

COMMENT ON EXTENSION postgis IS 'PostGIS geometry and geography spatial types and functions';

CREATE EXTENSION IF NOT EXISTS postgis_topology WITH SCHEMA topology;

COMMENT ON EXTENSION postgis_topology IS 'PostGIS topology spatial types and functions';

CREATE FUNCTION IF NOT EXISTS public.check_group_admin_role() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
      BEGIN
          IF NOT EXISTS (
              SELECT 1 FROM users 
              WHERE id = NEW.group_admin_id 
              AND role = 'group-admin'
          ) THEN
              RAISE EXCEPTION 'User % is not a group admin', NEW.group_admin_id;
          END IF;
          RETURN NEW;
      END;
      $$;

CREATE FUNCTION IF NOT EXISTS public.cleanup_old_error_logs() RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
    DELETE FROM error_logs
    WHERE timestamp < NOW() - INTERVAL '30 days';
END;
$$;

CREATE FUNCTION IF NOT EXISTS public.cleanup_old_error_logs(retention_days integer) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
    DELETE FROM error_logs 
    WHERE timestamp < NOW() - (retention_days || ' days')::INTERVAL;
END;
$$;

CREATE FUNCTION IF NOT EXISTS public.get_error_frequency(start_date timestamp without time zone, end_date timestamp without time zone) RETURNS TABLE(error_type text, frequency bigint, first_occurrence timestamp without time zone, last_occurrence timestamp without time zone)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        e.error_type,
        COUNT(*) as frequency,
        MIN(e.timestamp) as first_occurrence,
        MAX(e.timestamp) as last_occurrence
    FROM error_logs e
    WHERE e.timestamp BETWEEN start_date AND end_date
    GROUP BY e.error_type
    ORDER BY frequency DESC;
END;
$$;

CREATE FUNCTION IF NOT EXISTS public.schedule_error_logs_cleanup() RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
    PERFORM cron.schedule('0 0 * * *', 'SELECT cleanup_old_error_logs()');
    END;
    $$;

CREATE FUNCTION IF NOT EXISTS public.update_modified_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
   NEW.updated_at = NOW(); 
   RETURN NEW;
END;
$$;

CREATE FUNCTION IF NOT EXISTS public.update_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;

CREATE FUNCTION IF NOT EXISTS public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.chat_messages (
    id integer NOT NULL,
    user_id integer,
    message text NOT NULL,
    response text NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE SEQUENCE IF NOT EXISTS public.chat_messages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.chat_messages_id_seq OWNED BY public.chat_messages.id;

CREATE TABLE IF NOT EXISTS public.companies (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    email character varying(100) NOT NULL,
    phone character varying(20),
    address text,
    status character varying(20) DEFAULT 'active'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    user_limit integer DEFAULT 100 NOT NULL,
    pending_users integer DEFAULT 0 NOT NULL,
    logo bytea,
    CONSTRAINT companies_status_check CHECK (((status)::text = ANY (ARRAY[('active'::character varying)::text, ('disabled'::character varying)::text])))
);

CREATE SEQUENCE IF NOT EXISTS public.companies_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.companies_id_seq OWNED BY public.companies.id;

CREATE TABLE IF NOT EXISTS public.company_geofences (
    id integer NOT NULL,
    company_id integer,
    name character varying(100) NOT NULL,
    coordinates public.geography(Point,4326) NOT NULL,
    radius numeric(10,2),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_by integer
);

CREATE SEQUENCE IF NOT EXISTS public.company_geofences_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.company_geofences_id_seq OWNED BY public.company_geofences.id;

CREATE SEQUENCE IF NOT EXISTS public.company_geofences_new_id_seq1
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.company_geofences_new_id_seq1 OWNED BY public.company_geofences.id;

CREATE TABLE IF NOT EXISTS public.company_tracking_settings (
    id integer NOT NULL,
    company_id integer,
    update_interval_seconds integer DEFAULT 30,
    battery_saving_enabled boolean DEFAULT true,
    indoor_tracking_enabled boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    default_tracking_precision character varying(10) DEFAULT 'medium'::character varying NOT NULL,
    CONSTRAINT company_tracking_settings_default_tracking_precision_check CHECK (((default_tracking_precision)::text = ANY (ARRAY[('low'::character varying)::text, ('medium'::character varying)::text, ('high'::character varying)::text])))
);

CREATE SEQUENCE IF NOT EXISTS public.company_tracking_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.company_tracking_settings_id_seq OWNED BY public.company_tracking_settings.id;

CREATE TABLE IF NOT EXISTS public.device_tokens (
    id integer NOT NULL,
    user_id integer NOT NULL,
    token character varying(255) NOT NULL,
    device_type character varying(20) NOT NULL,
    device_name character varying(100),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    last_used_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    is_active boolean DEFAULT true,
    CONSTRAINT device_tokens_device_type_check CHECK (((device_type)::text = ANY (ARRAY[('ios'::character varying)::text, ('android'::character varying)::text, ('web'::character varying)::text])))
);

CREATE SEQUENCE IF NOT EXISTS public.device_tokens_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.device_tokens_id_seq OWNED BY public.device_tokens.id;

CREATE TABLE IF NOT EXISTS public.employee_locations (
    id integer NOT NULL,
    user_id integer,
    "timestamp" timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    latitude numeric(10,8) NOT NULL,
    longitude numeric(11,8) NOT NULL,
    accuracy numeric(10,2),
    is_moving boolean DEFAULT false,
    battery_level integer,
    shift_id integer,
    is_outdoor boolean DEFAULT false,
    geofence_status character varying(20),
    movement_type character varying(20),
    location_accuracy integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    is_tracking_active boolean DEFAULT false
);

CREATE SEQUENCE IF NOT EXISTS public.employee_locations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.employee_locations_id_seq OWNED BY public.employee_locations.id;

CREATE TABLE IF NOT EXISTS public.employee_schedule (
    id integer NOT NULL,
    user_id integer,
    title character varying(255) NOT NULL,
    description text,
    date date NOT NULL,
    "time" time without time zone NOT NULL,
    location character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    status character varying(20) DEFAULT 'pending'::character varying
);

CREATE SEQUENCE IF NOT EXISTS public.employee_schedule_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.employee_schedule_id_seq OWNED BY public.employee_schedule.id;

CREATE TABLE IF NOT EXISTS public.employee_shifts (
    id integer NOT NULL,
    user_id integer,
    start_time timestamp without time zone NOT NULL,
    end_time timestamp without time zone,
    duration interval,
    status character varying(20) DEFAULT 'active'::character varying,
    total_kilometers numeric DEFAULT 0,
    total_expenses numeric DEFAULT 0,
    location_start point,
    location_end point,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    location_history public.geography(LineString,4326),
    total_distance_km numeric(10,2) DEFAULT 0,
    travel_time_minutes integer DEFAULT 0,
    last_location_update timestamp without time zone,
    is_tracking_active boolean DEFAULT false
);

CREATE SEQUENCE IF NOT EXISTS public.employee_shifts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.employee_shifts_id_seq OWNED BY public.employee_shifts.id;

CREATE TABLE IF NOT EXISTS public.employee_tasks (
    id integer NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    assigned_to integer,
    assigned_by integer,
    priority character varying(20) DEFAULT 'medium'::character varying NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    due_date timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    last_status_update timestamp without time zone,
    status_history jsonb DEFAULT '[]'::jsonb,
    is_reassigned boolean DEFAULT false
);

CREATE SEQUENCE IF NOT EXISTS public.employee_tasks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.employee_tasks_id_seq OWNED BY public.employee_tasks.id;

CREATE TABLE IF NOT EXISTS public.error_logs (
    id integer NOT NULL,
    "timestamp" timestamp with time zone NOT NULL,
    service character varying(100) NOT NULL,
    error_type character varying(100) NOT NULL,
    message text NOT NULL,
    user_id integer,
    metadata jsonb,
    stack_trace text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE SEQUENCE IF NOT EXISTS public.error_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.error_logs_id_seq OWNED BY public.error_logs.id;

CREATE TABLE IF NOT EXISTS public.expense_documents (
    id integer NOT NULL,
    expense_id integer,
    file_name character varying(255) NOT NULL,
    file_type character varying(100) NOT NULL,
    file_size integer NOT NULL,
    file_data bytea NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE SEQUENCE IF NOT EXISTS public.expense_documents_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.expense_documents_id_seq OWNED BY public.expense_documents.id;

CREATE TABLE IF NOT EXISTS public.expenses (
    id integer,
    user_id integer,
    employee_name character varying(100),
    employee_number character varying(50),
    department character varying(100),
    designation character varying(100),
    location character varying(100),
    date timestamp without time zone,
    vehicle_type character varying(50),
    vehicle_number character varying(50),
    total_kilometers numeric,
    start_time timestamp without time zone,
    end_time timestamp without time zone,
    route_taken text,
    lodging_expenses numeric,
    daily_allowance numeric,
    diesel numeric,
    toll_charges numeric,
    other_expenses numeric,
    advance_taken numeric,
    total_amount numeric,
    amount_payable numeric,
    status character varying(20) DEFAULT 'pending'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    company_id integer,
    comments text,
    group_admin_id integer,
    rejection_reason text,
    category character varying(50),
    shift_id integer
);

CREATE SEQUENCE IF NOT EXISTS public.expenses_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.expenses_id_seq OWNED BY public.expenses.id;

CREATE TABLE IF NOT EXISTS public.geofence_events (
    id integer NOT NULL,
    user_id integer NOT NULL,
    geofence_id integer NOT NULL,
    shift_id integer NOT NULL,
    event_type character varying(10) NOT NULL,
    "timestamp" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT geofence_events_event_type_check CHECK (((event_type)::text = ANY (ARRAY[('entry'::character varying)::text, ('exit'::character varying)::text])))
);

CREATE SEQUENCE IF NOT EXISTS public.geofence_events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.geofence_events_id_seq OWNED BY public.geofence_events.id;

CREATE TABLE IF NOT EXISTS public.group_admin_shifts (
    id integer NOT NULL,
    user_id integer,
    start_time timestamp without time zone NOT NULL,
    end_time timestamp without time zone,
    duration interval,
    status character varying(20) DEFAULT 'active'::character varying,
    total_kilometers numeric DEFAULT 0,
    total_expenses numeric DEFAULT 0,
    location_start point,
    location_end point,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE SEQUENCE IF NOT EXISTS public.group_admin_shifts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.group_admin_shifts_id_seq OWNED BY public.group_admin_shifts.id;

CREATE TABLE IF NOT EXISTS public.leave_balances (
    id integer NOT NULL,
    user_id integer,
    leave_type_id integer,
    total_days integer NOT NULL,
    used_days integer DEFAULT 0,
    pending_days integer DEFAULT 0,
    year integer NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    carry_forward_days integer DEFAULT 0
);

CREATE SEQUENCE IF NOT EXISTS public.leave_balances_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.leave_balances_id_seq OWNED BY public.leave_balances.id;

CREATE TABLE IF NOT EXISTS public.leave_documents (
    id integer NOT NULL,
    request_id integer,
    file_name character varying(255) NOT NULL,
    file_type character varying(100) NOT NULL,
    file_data text NOT NULL,
    upload_method character varying(20),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT leave_documents_upload_method_check CHECK (((upload_method)::text = ANY (ARRAY[('camera'::character varying)::text, ('file'::character varying)::text])))
);

CREATE SEQUENCE IF NOT EXISTS public.leave_documents_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.leave_documents_id_seq OWNED BY public.leave_documents.id;

CREATE TABLE IF NOT EXISTS public.leave_escalations (
    id integer NOT NULL,
    request_id integer NOT NULL,
    escalated_by integer NOT NULL,
    escalated_to integer NOT NULL,
    reason text NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying,
    resolution_notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    resolved_at timestamp without time zone,
    CONSTRAINT leave_escalations_status_check CHECK (((status)::text = ANY (ARRAY[('pending'::character varying)::text, ('resolved'::character varying)::text])))
);

CREATE SEQUENCE IF NOT EXISTS public.leave_escalations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.leave_escalations_id_seq OWNED BY public.leave_escalations.id;

CREATE TABLE IF NOT EXISTS public.leave_policies (
    id integer NOT NULL,
    leave_type_id integer,
    default_days integer NOT NULL,
    carry_forward_days integer DEFAULT 0,
    min_service_days integer DEFAULT 0,
    requires_approval boolean DEFAULT true,
    notice_period_days integer DEFAULT 0,
    max_consecutive_days integer,
    gender_specific character varying(10),
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE SEQUENCE IF NOT EXISTS public.leave_policies_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.leave_policies_id_seq OWNED BY public.leave_policies.id;

CREATE TABLE IF NOT EXISTS public.leave_requests (
    id integer NOT NULL,
    user_id integer,
    leave_type_id integer,
    start_date date NOT NULL,
    end_date date NOT NULL,
    reason text NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying,
    rejection_reason text,
    contact_number character varying(20) NOT NULL,
    requires_documentation boolean DEFAULT false,
    approver_id integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    days_requested integer NOT NULL,
    has_documentation boolean DEFAULT false,
    group_admin_id integer,
    CONSTRAINT leave_requests_status_check CHECK (((status)::text = ANY (ARRAY[('pending'::character varying)::text, ('approved'::character varying)::text, ('rejected'::character varying)::text, ('escalated'::character varying)::text, ('cancelled'::character varying)::text])))
);

CREATE SEQUENCE IF NOT EXISTS public.leave_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.leave_requests_id_seq OWNED BY public.leave_requests.id;

CREATE TABLE IF NOT EXISTS public.leave_types (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    requires_documentation boolean DEFAULT false,
    max_days integer,
    is_paid boolean DEFAULT true,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE SEQUENCE IF NOT EXISTS public.leave_types_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.leave_types_id_seq OWNED BY public.leave_types.id;

CREATE TABLE IF NOT EXISTS public.management_shifts (
    id integer NOT NULL,
    user_id integer,
    start_time timestamp without time zone NOT NULL,
    end_time timestamp without time zone,
    duration interval,
    status character varying(20) DEFAULT 'active'::character varying,
    total_kilometers numeric DEFAULT 0,
    total_expenses numeric DEFAULT 0,
    location_start point,
    location_end point,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE SEQUENCE IF NOT EXISTS public.management_shifts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.management_shifts_id_seq OWNED BY public.management_shifts.id;

CREATE TABLE IF NOT EXISTS public.notification_templates (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    type character varying(50) NOT NULL,
    role character varying(50) NOT NULL,
    priority character varying(20) DEFAULT 'default'::character varying NOT NULL,
    data jsonb DEFAULT '{}'::jsonb,
    variables text[] DEFAULT '{}'::text[],
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE SEQUENCE IF NOT EXISTS public.notification_templates_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.notification_templates_id_seq OWNED BY public.notification_templates.id;

CREATE TABLE IF NOT EXISTS public.notifications (
    id integer NOT NULL,
    user_id integer,
    title character varying(255) NOT NULL,
    message text NOT NULL,
    type character varying(50) NOT NULL,
    read boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE SEQUENCE IF NOT EXISTS public.notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.notifications_id_seq OWNED BY public.notifications.id;

CREATE TABLE IF NOT EXISTS public.push_notifications (
    id integer NOT NULL,
    user_id integer NOT NULL,
    title character varying(255) NOT NULL,
    message text NOT NULL,
    data jsonb DEFAULT '{}'::jsonb,
    type character varying(50) NOT NULL,
    sent boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    sent_at timestamp with time zone,
    action_url character varying(255),
    priority character varying(20) DEFAULT 'default'::character varying,
    category character varying(50),
    expires_at timestamp with time zone,
    batch_id character varying(255),
    template_id integer,
    CONSTRAINT push_notifications_priority_check CHECK (((priority)::text = ANY (ARRAY[('high'::character varying)::text, ('default'::character varying)::text, ('low'::character varying)::text])))
);

CREATE SEQUENCE IF NOT EXISTS public.push_notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.push_notifications_id_seq OWNED BY public.push_notifications.id;

CREATE TABLE IF NOT EXISTS public.push_receipts (
    id integer NOT NULL,
    notification_id integer NOT NULL,
    receipt_id character varying(36) NOT NULL,
    processed boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    processed_at timestamp with time zone,
    error_details jsonb
);

CREATE SEQUENCE IF NOT EXISTS public.push_receipts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.push_receipts_id_seq OWNED BY public.push_receipts.id;

CREATE TABLE IF NOT EXISTS public.scheduled_notifications (
    id integer NOT NULL,
    template_id integer,
    variables jsonb DEFAULT '{}'::jsonb,
    target_role character varying(50),
    target_user_id integer,
    target_group_admin_id integer,
    scheduled_for timestamp with time zone NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    sent_at timestamp with time zone,
    error text,
    CONSTRAINT chk_target_specification CHECK ((((target_role IS NOT NULL) AND (target_user_id IS NULL) AND (target_group_admin_id IS NULL)) OR ((target_role IS NULL) AND (target_user_id IS NOT NULL) AND (target_group_admin_id IS NULL)) OR ((target_role IS NULL) AND (target_user_id IS NULL) AND (target_group_admin_id IS NOT NULL))))
);

CREATE SEQUENCE IF NOT EXISTS public.scheduled_notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.scheduled_notifications_id_seq OWNED BY public.scheduled_notifications.id;

CREATE TABLE IF NOT EXISTS public.support_messages (
    id integer NOT NULL,
    user_id integer,
    subject character varying(255) NOT NULL,
    message text NOT NULL,
    user_email character varying(100) NOT NULL,
    user_name character varying(100) NOT NULL,
    user_role character varying(20) NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    resolved_at timestamp without time zone
);

CREATE SEQUENCE IF NOT EXISTS public.support_messages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.support_messages_id_seq OWNED BY public.support_messages.id;

CREATE TABLE IF NOT EXISTS public.tracking_analytics (
    id integer NOT NULL,
    user_id integer NOT NULL,
    date date NOT NULL,
    total_distance numeric(10,2) DEFAULT 0,
    total_distance_km numeric(10,2) DEFAULT 0,
    total_travel_time_minutes integer DEFAULT 0,
    outdoor_time integer DEFAULT 0,
    indoor_time integer DEFAULT 0,
    indoor_time_minutes integer DEFAULT 0,
    outdoor_time_minutes integer DEFAULT 0,
    last_update timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE SEQUENCE IF NOT EXISTS public.tracking_analytics_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.tracking_analytics_id_seq OWNED BY public.tracking_analytics.id;

CREATE TABLE IF NOT EXISTS public.user_tracking_permissions (
    id integer NOT NULL,
    user_id integer NOT NULL,
    can_override_geofence boolean DEFAULT false NOT NULL,
    tracking_precision character varying(20) DEFAULT 'high'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    location_required_for_shift boolean DEFAULT true NOT NULL,
    CONSTRAINT chk_tracking_precision CHECK (((tracking_precision)::text = ANY (ARRAY[('low'::character varying)::text, ('medium'::character varying)::text, ('high'::character varying)::text])))
);

COMMENT ON COLUMN public.user_tracking_permissions.location_required_for_shift IS 'Whether location access is required for shift tracking';

CREATE SEQUENCE IF NOT EXISTS public.user_tracking_permissions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.user_tracking_permissions_id_seq OWNED BY public.user_tracking_permissions.id;

CREATE TABLE IF NOT EXISTS public.users (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    email character varying(100) NOT NULL,
    phone character varying(20),
    password character varying(100) NOT NULL,
    role character varying(20) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    reset_token character varying(255),
    reset_token_expires timestamp without time zone,
    status character varying(20) DEFAULT 'active'::character varying,
    last_login timestamp without time zone,
    failed_login_attempts integer DEFAULT 0,
    password_reset_required boolean DEFAULT false,
    company_id integer,
    can_submit_expenses_anytime boolean DEFAULT false,
    shift_status character varying(20) DEFAULT 'inactive'::character varying,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    employee_number character varying(50),
    department character varying(100),
    designation character varying(100),
    group_admin_id integer,
    profile_image bytea,
    token_version integer DEFAULT 0,
    gender character varying(10),
    management_id integer,
    CONSTRAINT users_gender_check CHECK (((gender)::text = ANY (ARRAY[('male'::character varying)::text, ('female'::character varying)::text, ('other'::character varying)::text]))),
    CONSTRAINT users_role_check CHECK (((role)::text = ANY (ARRAY[('employee'::character varying)::text, ('group-admin'::character varying)::text, ('management'::character varying)::text, ('super-admin'::character varying)::text])))
);

CREATE SEQUENCE IF NOT EXISTS public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;

ALTER TABLE ONLY public.chat_messages ALTER COLUMN id SET DEFAULT nextval('public.chat_messages_id_seq'::regclass);

ALTER TABLE ONLY public.companies ALTER COLUMN id SET DEFAULT nextval('public.companies_id_seq'::regclass);

ALTER TABLE ONLY public.company_geofences ALTER COLUMN id SET DEFAULT nextval('public.company_geofences_id_seq'::regclass);

ALTER TABLE ONLY public.company_tracking_settings ALTER COLUMN id SET DEFAULT nextval('public.company_tracking_settings_id_seq'::regclass);

ALTER TABLE ONLY public.device_tokens ALTER COLUMN id SET DEFAULT nextval('public.device_tokens_id_seq'::regclass);

ALTER TABLE ONLY public.employee_locations ALTER COLUMN id SET DEFAULT nextval('public.employee_locations_id_seq'::regclass);

ALTER TABLE ONLY public.employee_schedule ALTER COLUMN id SET DEFAULT nextval('public.employee_schedule_id_seq'::regclass);

ALTER TABLE ONLY public.employee_shifts ALTER COLUMN id SET DEFAULT nextval('public.employee_shifts_id_seq'::regclass);

ALTER TABLE ONLY public.employee_tasks ALTER COLUMN id SET DEFAULT nextval('public.employee_tasks_id_seq'::regclass);

ALTER TABLE ONLY public.error_logs ALTER COLUMN id SET DEFAULT nextval('public.error_logs_id_seq'::regclass);

ALTER TABLE ONLY public.expense_documents ALTER COLUMN id SET DEFAULT nextval('public.expense_documents_id_seq'::regclass);

ALTER TABLE ONLY public.expenses ALTER COLUMN id SET DEFAULT nextval('public.expenses_id_seq'::regclass);

ALTER TABLE ONLY public.geofence_events ALTER COLUMN id SET DEFAULT nextval('public.geofence_events_id_seq'::regclass);

ALTER TABLE ONLY public.group_admin_shifts ALTER COLUMN id SET DEFAULT nextval('public.group_admin_shifts_id_seq'::regclass);

ALTER TABLE ONLY public.leave_balances ALTER COLUMN id SET DEFAULT nextval('public.leave_balances_id_seq'::regclass);

ALTER TABLE ONLY public.leave_documents ALTER COLUMN id SET DEFAULT nextval('public.leave_documents_id_seq'::regclass);

ALTER TABLE ONLY public.leave_escalations ALTER COLUMN id SET DEFAULT nextval('public.leave_escalations_id_seq'::regclass);

ALTER TABLE ONLY public.leave_policies ALTER COLUMN id SET DEFAULT nextval('public.leave_policies_id_seq'::regclass);

ALTER TABLE ONLY public.leave_requests ALTER COLUMN id SET DEFAULT nextval('public.leave_requests_id_seq'::regclass);

ALTER TABLE ONLY public.leave_types ALTER COLUMN id SET DEFAULT nextval('public.leave_types_id_seq'::regclass);

ALTER TABLE ONLY public.management_shifts ALTER COLUMN id SET DEFAULT nextval('public.management_shifts_id_seq'::regclass);

ALTER TABLE ONLY public.notification_templates ALTER COLUMN id SET DEFAULT nextval('public.notification_templates_id_seq'::regclass);

ALTER TABLE ONLY public.notifications ALTER COLUMN id SET DEFAULT nextval('public.notifications_id_seq'::regclass);

ALTER TABLE ONLY public.push_notifications ALTER COLUMN id SET DEFAULT nextval('public.push_notifications_id_seq'::regclass);

ALTER TABLE ONLY public.push_receipts ALTER COLUMN id SET DEFAULT nextval('public.push_receipts_id_seq'::regclass);

ALTER TABLE ONLY public.scheduled_notifications ALTER COLUMN id SET DEFAULT nextval('public.scheduled_notifications_id_seq'::regclass);

ALTER TABLE ONLY public.support_messages ALTER COLUMN id SET DEFAULT nextval('public.support_messages_id_seq'::regclass);

ALTER TABLE ONLY public.tracking_analytics ALTER COLUMN id SET DEFAULT nextval('public.tracking_analytics_id_seq'::regclass);

ALTER TABLE ONLY public.user_tracking_permissions ALTER COLUMN id SET DEFAULT nextval('public.user_tracking_permissions_id_seq'::regclass);

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_email_key UNIQUE (email);

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.company_geofences
    ADD CONSTRAINT company_geofences_new_pkey1 PRIMARY KEY (id);

ALTER TABLE ONLY public.company_tracking_settings
    ADD CONSTRAINT company_tracking_settings_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.device_tokens
    ADD CONSTRAINT device_tokens_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.device_tokens
    ADD CONSTRAINT device_tokens_user_id_token_key UNIQUE (user_id, token);

ALTER TABLE ONLY public.employee_locations
    ADD CONSTRAINT employee_locations_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.employee_schedule
    ADD CONSTRAINT employee_schedule_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.employee_shifts
    ADD CONSTRAINT employee_shifts_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.employee_tasks
    ADD CONSTRAINT employee_tasks_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.error_logs
    ADD CONSTRAINT error_logs_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.expense_documents
    ADD CONSTRAINT expense_documents_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.geofence_events
    ADD CONSTRAINT geofence_events_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.group_admin_shifts
    ADD CONSTRAINT group_admin_shifts_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.leave_balances
    ADD CONSTRAINT leave_balances_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.leave_balances
    ADD CONSTRAINT leave_balances_user_id_leave_type_id_year_key UNIQUE (user_id, leave_type_id, year);

ALTER TABLE ONLY public.leave_documents
    ADD CONSTRAINT leave_documents_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.leave_escalations
    ADD CONSTRAINT leave_escalations_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.leave_policies
    ADD CONSTRAINT leave_policies_leave_type_id_key UNIQUE (leave_type_id);

ALTER TABLE ONLY public.leave_policies
    ADD CONSTRAINT leave_policies_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.leave_types
    ADD CONSTRAINT leave_types_name_key UNIQUE (name);

ALTER TABLE ONLY public.leave_types
    ADD CONSTRAINT leave_types_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.management_shifts
    ADD CONSTRAINT management_shifts_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.notification_templates
    ADD CONSTRAINT notification_templates_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.push_notifications
    ADD CONSTRAINT push_notifications_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.push_receipts
    ADD CONSTRAINT push_receipts_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.scheduled_notifications
    ADD CONSTRAINT scheduled_notifications_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.support_messages
    ADD CONSTRAINT support_messages_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.tracking_analytics
    ADD CONSTRAINT tracking_analytics_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.push_receipts
    ADD CONSTRAINT unique_receipt_id UNIQUE (receipt_id);

ALTER TABLE ONLY public.user_tracking_permissions
    ADD CONSTRAINT unique_user_tracking_permission UNIQUE (user_id);

ALTER TABLE ONLY public.user_tracking_permissions
    ADD CONSTRAINT user_tracking_permissions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_employee_number_key UNIQUE (employee_number);

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_phone_key UNIQUE (phone);

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);

CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON public.chat_messages USING btree (user_id);

CREATE INDEX IF NOT EXISTS idx_company_geofences_active ON public.company_geofences USING btree (company_id) WHERE (radius > (0)::numeric);

CREATE INDEX IF NOT EXISTS idx_company_geofences_company ON public.company_geofences USING btree (company_id);

CREATE INDEX IF NOT EXISTS idx_company_geofences_coordinates ON public.company_geofences USING gist (coordinates);

CREATE UNIQUE INDEX idx_company_tracking_settings ON public.company_tracking_settings USING btree (company_id);

CREATE INDEX IF NOT EXISTS idx_device_tokens_token ON public.device_tokens USING btree (token);

CREATE INDEX IF NOT EXISTS idx_device_tokens_user_id ON public.device_tokens USING btree (user_id);

CREATE INDEX IF NOT EXISTS idx_employee_locations_moving ON public.employee_locations USING btree (user_id, is_moving) WHERE (is_moving = true);

CREATE INDEX IF NOT EXISTS idx_employee_locations_outdoor ON public.employee_locations USING btree (user_id, is_outdoor) WHERE (is_outdoor = true);

CREATE INDEX IF NOT EXISTS idx_employee_locations_shift ON public.employee_locations USING btree (shift_id, "timestamp" DESC);

CREATE INDEX IF NOT EXISTS idx_employee_locations_user_timestamp ON public.employee_locations USING btree (user_id, "timestamp" DESC);

CREATE INDEX IF NOT EXISTS idx_employee_shifts_location ON public.employee_shifts USING gist (location_history);

CREATE INDEX IF NOT EXISTS idx_employee_shifts_start_time ON public.employee_shifts USING btree (start_time);

CREATE INDEX IF NOT EXISTS idx_employee_shifts_status ON public.employee_shifts USING btree (status);

CREATE INDEX IF NOT EXISTS idx_error_logs_error_type ON public.error_logs USING btree (error_type);

CREATE INDEX IF NOT EXISTS idx_error_logs_service ON public.error_logs USING btree (service);

CREATE INDEX IF NOT EXISTS idx_error_logs_service_timestamp ON public.error_logs USING btree (service, "timestamp" DESC);

CREATE INDEX IF NOT EXISTS idx_error_logs_timestamp ON public.error_logs USING btree ("timestamp" DESC);

CREATE INDEX IF NOT EXISTS idx_error_logs_type ON public.error_logs USING btree (error_type);

CREATE INDEX IF NOT EXISTS idx_error_logs_user_id ON public.error_logs USING btree (user_id);

CREATE INDEX IF NOT EXISTS idx_error_logs_user_timestamp ON public.error_logs USING btree (user_id, "timestamp" DESC);

CREATE INDEX IF NOT EXISTS idx_expenses_shift_id ON public.expenses USING btree (shift_id);

CREATE INDEX IF NOT EXISTS idx_geofence_events_geofence_id ON public.geofence_events USING btree (geofence_id);

CREATE INDEX IF NOT EXISTS idx_geofence_events_shift_id ON public.geofence_events USING btree (shift_id);

CREATE INDEX IF NOT EXISTS idx_geofence_events_timestamp ON public.geofence_events USING btree ("timestamp");

CREATE INDEX IF NOT EXISTS idx_geofence_events_user_id ON public.geofence_events USING btree (user_id);

CREATE INDEX IF NOT EXISTS idx_group_admin_shifts_start_time ON public.group_admin_shifts USING btree (start_time);

CREATE INDEX IF NOT EXISTS idx_group_admin_shifts_status ON public.group_admin_shifts USING btree (status);

CREATE INDEX IF NOT EXISTS idx_leave_balances_leave_type_id ON public.leave_balances USING btree (leave_type_id);

CREATE INDEX IF NOT EXISTS idx_leave_balances_user_id ON public.leave_balances USING btree (user_id);

CREATE INDEX IF NOT EXISTS idx_leave_escalations_request_id ON public.leave_escalations USING btree (request_id);

CREATE INDEX IF NOT EXISTS idx_leave_requests_dates ON public.leave_requests USING btree (start_date, end_date);

CREATE INDEX IF NOT EXISTS idx_leave_requests_group_admin ON public.leave_requests USING btree (group_admin_id);

CREATE INDEX IF NOT EXISTS idx_leave_requests_leave_type_id ON public.leave_requests USING btree (leave_type_id);

CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON public.leave_requests USING btree (status);

CREATE INDEX IF NOT EXISTS idx_leave_requests_user_id ON public.leave_requests USING btree (user_id);

CREATE INDEX IF NOT EXISTS idx_management_shifts_start_time ON public.management_shifts USING btree (start_time);

CREATE INDEX IF NOT EXISTS idx_management_shifts_status ON public.management_shifts USING btree (status);

CREATE INDEX IF NOT EXISTS idx_notification_templates_role ON public.notification_templates USING btree (role);

CREATE INDEX IF NOT EXISTS idx_notification_templates_type ON public.notification_templates USING btree (type);

CREATE INDEX IF NOT EXISTS idx_push_notifications_batch ON public.push_notifications USING btree (batch_id);

CREATE INDEX IF NOT EXISTS idx_push_notifications_created_at ON public.push_notifications USING btree (created_at);

CREATE INDEX IF NOT EXISTS idx_push_notifications_expiration ON public.push_notifications USING btree (expires_at);

CREATE INDEX IF NOT EXISTS idx_push_notifications_sent ON public.push_notifications USING btree (sent);

CREATE INDEX IF NOT EXISTS idx_push_notifications_type ON public.push_notifications USING btree (type);

CREATE INDEX IF NOT EXISTS idx_push_notifications_user_id ON public.push_notifications USING btree (user_id);

CREATE INDEX IF NOT EXISTS idx_push_receipts_notification_id ON public.push_receipts USING btree (notification_id);

CREATE INDEX IF NOT EXISTS idx_push_receipts_processed ON public.push_receipts USING btree (processed);

CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_scheduled_for ON public.scheduled_notifications USING btree (scheduled_for);

CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_status ON public.scheduled_notifications USING btree (status);

CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_target_group_admin ON public.scheduled_notifications USING btree (target_group_admin_id);

CREATE INDEX IF NOT EXISTS idx_tracking_analytics_date ON public.tracking_analytics USING btree (date);

CREATE INDEX IF NOT EXISTS idx_tracking_analytics_user ON public.tracking_analytics USING btree (user_id);

CREATE UNIQUE INDEX idx_tracking_analytics_user_date ON public.tracking_analytics USING btree (user_id, date);

CREATE INDEX IF NOT EXISTS idx_user_tracking_permissions ON public.user_tracking_permissions USING btree (user_id, tracking_precision);

CREATE INDEX IF NOT EXISTS idx_users_company_status ON public.users USING btree (company_id, status);

CREATE INDEX IF NOT EXISTS idx_users_group_admin_id ON public.users USING btree (group_admin_id);

CREATE INDEX IF NOT EXISTS idx_users_management_id ON public.users USING btree (management_id);

CREATE INDEX IF NOT EXISTS idx_users_token_version ON public.users USING btree (token_version);

CREATE TRIGGER IF NOT EXISTS update_chat_messages_updated_at BEFORE UPDATE ON public.chat_messages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER IF NOT EXISTS update_company_geofences_updated_at BEFORE UPDATE ON public.company_geofences FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();

CREATE TRIGGER IF NOT EXISTS update_geofence_events_updated_at BEFORE UPDATE ON public.geofence_events FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER IF NOT EXISTS update_geofences_timestamp BEFORE UPDATE ON public.company_geofences FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

CREATE TRIGGER IF NOT EXISTS update_permissions_timestamp BEFORE UPDATE ON public.user_tracking_permissions FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

CREATE TRIGGER IF NOT EXISTS update_settings_timestamp BEFORE UPDATE ON public.company_tracking_settings FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

CREATE TRIGGER IF NOT EXISTS update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.company_geofences
    ADD CONSTRAINT company_geofences_new_company_id_fkey1 FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.company_geofences
    ADD CONSTRAINT company_geofences_new_created_by_fkey1 FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.company_tracking_settings
    ADD CONSTRAINT company_tracking_settings_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.device_tokens
    ADD CONSTRAINT device_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.employee_locations
    ADD CONSTRAINT employee_locations_shift_id_fkey FOREIGN KEY (shift_id) REFERENCES public.employee_shifts(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.employee_locations
    ADD CONSTRAINT employee_locations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.employee_schedule
    ADD CONSTRAINT employee_schedule_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.employee_shifts
    ADD CONSTRAINT employee_shifts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.employee_tasks
    ADD CONSTRAINT employee_tasks_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.employee_tasks
    ADD CONSTRAINT employee_tasks_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.error_logs
    ADD CONSTRAINT error_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_group_admin_id_fkey FOREIGN KEY (group_admin_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT fk_expenses_shift FOREIGN KEY (shift_id) REFERENCES public.employee_shifts(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.geofence_events
    ADD CONSTRAINT geofence_events_shift_id_fkey FOREIGN KEY (shift_id) REFERENCES public.employee_shifts(id);

ALTER TABLE ONLY public.geofence_events
    ADD CONSTRAINT geofence_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);

ALTER TABLE ONLY public.group_admin_shifts
    ADD CONSTRAINT group_admin_shifts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.leave_balances
    ADD CONSTRAINT leave_balances_leave_type_id_fkey FOREIGN KEY (leave_type_id) REFERENCES public.leave_types(id);

ALTER TABLE ONLY public.leave_balances
    ADD CONSTRAINT leave_balances_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);

ALTER TABLE ONLY public.leave_documents
    ADD CONSTRAINT leave_documents_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.leave_requests(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.leave_policies
    ADD CONSTRAINT leave_policies_leave_type_id_fkey FOREIGN KEY (leave_type_id) REFERENCES public.leave_types(id);

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_approver_id_fkey FOREIGN KEY (approver_id) REFERENCES public.users(id);

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_group_admin_id_fkey FOREIGN KEY (group_admin_id) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_leave_type_id_fkey FOREIGN KEY (leave_type_id) REFERENCES public.leave_types(id);

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);

ALTER TABLE ONLY public.management_shifts
    ADD CONSTRAINT management_shifts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey1 FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.push_notifications
    ADD CONSTRAINT push_notifications_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.notification_templates(id);

ALTER TABLE ONLY public.push_notifications
    ADD CONSTRAINT push_notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.push_receipts
    ADD CONSTRAINT push_receipts_notification_id_fkey FOREIGN KEY (notification_id) REFERENCES public.push_notifications(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.scheduled_notifications
    ADD CONSTRAINT scheduled_notifications_target_group_admin_id_fkey FOREIGN KEY (target_group_admin_id) REFERENCES public.users(id);

ALTER TABLE ONLY public.scheduled_notifications
    ADD CONSTRAINT scheduled_notifications_target_user_id_fkey FOREIGN KEY (target_user_id) REFERENCES public.users(id);

ALTER TABLE ONLY public.scheduled_notifications
    ADD CONSTRAINT scheduled_notifications_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.notification_templates(id);

ALTER TABLE ONLY public.support_messages
    ADD CONSTRAINT support_messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.tracking_analytics
    ADD CONSTRAINT tracking_analytics_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.user_tracking_permissions
    ADD CONSTRAINT user_tracking_permissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_group_admin_id_fkey FOREIGN KEY (group_admin_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_management_id_fkey FOREIGN KEY (management_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.leave_types ADD COLUMN company_id INTEGER REFERENCES companies(id);

UPDATE ONLY public.leave_types SET company_id = NULL;

ALTER TABLE ONLY public.leave_types ADD CONSTRAINT leave_types_name_company_id_unique UNIQUE (name, company_id);