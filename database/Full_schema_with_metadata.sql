--
-- PostgreSQL database dump
--

-- Dumped from database version 16.8
-- Dumped by pg_dump version 16.8

-- Started on 2025-04-24 21:39:35

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 8 (class 2615 OID 16446)
-- Name: topology; Type: SCHEMA; Schema: -; Owner: avnadmin
--

CREATE SCHEMA topology;


ALTER SCHEMA topology OWNER TO avnadmin;

--
-- TOC entry 6006 (class 0 OID 0)
-- Dependencies: 8
-- Name: SCHEMA topology; Type: COMMENT; Schema: -; Owner: avnadmin
--

COMMENT ON SCHEMA topology IS 'PostGIS Topology schema';


--
-- TOC entry 2 (class 3079 OID 16447)
-- Name: postgis; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA public;


--
-- TOC entry 6008 (class 0 OID 0)
-- Dependencies: 2
-- Name: EXTENSION postgis; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION postgis IS 'PostGIS geometry and geography spatial types and functions';


--
-- TOC entry 3 (class 3079 OID 17523)
-- Name: postgis_topology; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS postgis_topology WITH SCHEMA topology;


--
-- TOC entry 6009 (class 0 OID 0)
-- Dependencies: 3
-- Name: EXTENSION postgis_topology; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION postgis_topology IS 'PostGIS topology spatial types and functions';


--
-- TOC entry 1160 (class 1255 OID 17697)
-- Name: check_group_admin_role(); Type: FUNCTION; Schema: public; Owner: avnadmin
--

CREATE FUNCTION public.check_group_admin_role() RETURNS trigger
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


ALTER FUNCTION public.check_group_admin_role() OWNER TO avnadmin;

--
-- TOC entry 1161 (class 1255 OID 17698)
-- Name: cleanup_old_error_logs(); Type: FUNCTION; Schema: public; Owner: avnadmin
--

CREATE FUNCTION public.cleanup_old_error_logs() RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
    DELETE FROM error_logs
    WHERE timestamp < NOW() - INTERVAL '30 days';
END;
$$;


ALTER FUNCTION public.cleanup_old_error_logs() OWNER TO avnadmin;

--
-- TOC entry 1162 (class 1255 OID 17699)
-- Name: cleanup_old_error_logs(integer); Type: FUNCTION; Schema: public; Owner: avnadmin
--

CREATE FUNCTION public.cleanup_old_error_logs(retention_days integer) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
    DELETE FROM error_logs 
    WHERE timestamp < NOW() - (retention_days || ' days')::INTERVAL;
END;
$$;


ALTER FUNCTION public.cleanup_old_error_logs(retention_days integer) OWNER TO avnadmin;

--
-- TOC entry 1163 (class 1255 OID 17700)
-- Name: get_error_frequency(timestamp without time zone, timestamp without time zone); Type: FUNCTION; Schema: public; Owner: avnadmin
--

CREATE FUNCTION public.get_error_frequency(start_date timestamp without time zone, end_date timestamp without time zone) RETURNS TABLE(error_type text, frequency bigint, first_occurrence timestamp without time zone, last_occurrence timestamp without time zone)
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


ALTER FUNCTION public.get_error_frequency(start_date timestamp without time zone, end_date timestamp without time zone) OWNER TO avnadmin;

--
-- TOC entry 1164 (class 1255 OID 17701)
-- Name: schedule_error_logs_cleanup(); Type: FUNCTION; Schema: public; Owner: avnadmin
--

CREATE FUNCTION public.schedule_error_logs_cleanup() RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
    PERFORM cron.schedule('0 0 * * *', 'SELECT cleanup_old_error_logs()');
    END;
    $$;


ALTER FUNCTION public.schedule_error_logs_cleanup() OWNER TO avnadmin;

--
-- TOC entry 1165 (class 1255 OID 17702)
-- Name: update_modified_column(); Type: FUNCTION; Schema: public; Owner: avnadmin
--

CREATE FUNCTION public.update_modified_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
   NEW.updated_at = NOW(); 
   RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_modified_column() OWNER TO avnadmin;

--
-- TOC entry 1166 (class 1255 OID 17703)
-- Name: update_timestamp(); Type: FUNCTION; Schema: public; Owner: avnadmin
--

CREATE FUNCTION public.update_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_timestamp() OWNER TO avnadmin;

--
-- TOC entry 1167 (class 1255 OID 17704)
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: avnadmin
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_updated_at_column() OWNER TO avnadmin;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 229 (class 1259 OID 17705)
-- Name: chat_messages; Type: TABLE; Schema: public; Owner: avnadmin
--

CREATE TABLE public.chat_messages (
    id integer NOT NULL,
    user_id integer,
    message text NOT NULL,
    response text NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.chat_messages OWNER TO avnadmin;

--
-- TOC entry 230 (class 1259 OID 17712)
-- Name: chat_messages_id_seq; Type: SEQUENCE; Schema: public; Owner: avnadmin
--

CREATE SEQUENCE public.chat_messages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.chat_messages_id_seq OWNER TO avnadmin;

--
-- TOC entry 6012 (class 0 OID 0)
-- Dependencies: 230
-- Name: chat_messages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: avnadmin
--

ALTER SEQUENCE public.chat_messages_id_seq OWNED BY public.chat_messages.id;


--
-- TOC entry 231 (class 1259 OID 17713)
-- Name: companies; Type: TABLE; Schema: public; Owner: avnadmin
--

CREATE TABLE public.companies (
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


ALTER TABLE public.companies OWNER TO avnadmin;

--
-- TOC entry 232 (class 1259 OID 17723)
-- Name: companies_id_seq; Type: SEQUENCE; Schema: public; Owner: avnadmin
--

CREATE SEQUENCE public.companies_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.companies_id_seq OWNER TO avnadmin;

--
-- TOC entry 6013 (class 0 OID 0)
-- Dependencies: 232
-- Name: companies_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: avnadmin
--

ALTER SEQUENCE public.companies_id_seq OWNED BY public.companies.id;


--
-- TOC entry 233 (class 1259 OID 17724)
-- Name: company_geofences; Type: TABLE; Schema: public; Owner: avnadmin
--

CREATE TABLE public.company_geofences (
    id integer NOT NULL,
    company_id integer,
    name character varying(100) NOT NULL,
    coordinates public.geography(Point,4326) NOT NULL,
    radius numeric(10,2),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_by integer
);


ALTER TABLE public.company_geofences OWNER TO avnadmin;

--
-- TOC entry 234 (class 1259 OID 17731)
-- Name: company_geofences_id_seq; Type: SEQUENCE; Schema: public; Owner: avnadmin
--

CREATE SEQUENCE public.company_geofences_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.company_geofences_id_seq OWNER TO avnadmin;

--
-- TOC entry 6014 (class 0 OID 0)
-- Dependencies: 234
-- Name: company_geofences_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: avnadmin
--

ALTER SEQUENCE public.company_geofences_id_seq OWNED BY public.company_geofences.id;


--
-- TOC entry 235 (class 1259 OID 17732)
-- Name: company_geofences_new_id_seq1; Type: SEQUENCE; Schema: public; Owner: avnadmin
--

CREATE SEQUENCE public.company_geofences_new_id_seq1
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.company_geofences_new_id_seq1 OWNER TO avnadmin;

--
-- TOC entry 6015 (class 0 OID 0)
-- Dependencies: 235
-- Name: company_geofences_new_id_seq1; Type: SEQUENCE OWNED BY; Schema: public; Owner: avnadmin
--

ALTER SEQUENCE public.company_geofences_new_id_seq1 OWNED BY public.company_geofences.id;


--
-- TOC entry 236 (class 1259 OID 17733)
-- Name: company_tracking_settings; Type: TABLE; Schema: public; Owner: avnadmin
--

CREATE TABLE public.company_tracking_settings (
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


ALTER TABLE public.company_tracking_settings OWNER TO avnadmin;

--
-- TOC entry 237 (class 1259 OID 17743)
-- Name: company_tracking_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: avnadmin
--

CREATE SEQUENCE public.company_tracking_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.company_tracking_settings_id_seq OWNER TO avnadmin;

--
-- TOC entry 6016 (class 0 OID 0)
-- Dependencies: 237
-- Name: company_tracking_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: avnadmin
--

ALTER SEQUENCE public.company_tracking_settings_id_seq OWNED BY public.company_tracking_settings.id;


--
-- TOC entry 238 (class 1259 OID 17744)
-- Name: device_tokens; Type: TABLE; Schema: public; Owner: avnadmin
--

CREATE TABLE public.device_tokens (
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


ALTER TABLE public.device_tokens OWNER TO avnadmin;

--
-- TOC entry 239 (class 1259 OID 17752)
-- Name: device_tokens_id_seq; Type: SEQUENCE; Schema: public; Owner: avnadmin
--

CREATE SEQUENCE public.device_tokens_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.device_tokens_id_seq OWNER TO avnadmin;

--
-- TOC entry 6017 (class 0 OID 0)
-- Dependencies: 239
-- Name: device_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: avnadmin
--

ALTER SEQUENCE public.device_tokens_id_seq OWNED BY public.device_tokens.id;


--
-- TOC entry 240 (class 1259 OID 17753)
-- Name: employee_locations; Type: TABLE; Schema: public; Owner: avnadmin
--

CREATE TABLE public.employee_locations (
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


ALTER TABLE public.employee_locations OWNER TO avnadmin;

--
-- TOC entry 241 (class 1259 OID 17760)
-- Name: employee_locations_id_seq; Type: SEQUENCE; Schema: public; Owner: avnadmin
--

CREATE SEQUENCE public.employee_locations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.employee_locations_id_seq OWNER TO avnadmin;

--
-- TOC entry 6018 (class 0 OID 0)
-- Dependencies: 241
-- Name: employee_locations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: avnadmin
--

ALTER SEQUENCE public.employee_locations_id_seq OWNED BY public.employee_locations.id;


--
-- TOC entry 242 (class 1259 OID 17761)
-- Name: employee_schedule; Type: TABLE; Schema: public; Owner: avnadmin
--

CREATE TABLE public.employee_schedule (
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


ALTER TABLE public.employee_schedule OWNER TO avnadmin;

--
-- TOC entry 243 (class 1259 OID 17769)
-- Name: employee_schedule_id_seq; Type: SEQUENCE; Schema: public; Owner: avnadmin
--

CREATE SEQUENCE public.employee_schedule_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.employee_schedule_id_seq OWNER TO avnadmin;

--
-- TOC entry 6019 (class 0 OID 0)
-- Dependencies: 243
-- Name: employee_schedule_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: avnadmin
--

ALTER SEQUENCE public.employee_schedule_id_seq OWNED BY public.employee_schedule.id;


--
-- TOC entry 244 (class 1259 OID 17770)
-- Name: employee_shifts; Type: TABLE; Schema: public; Owner: avnadmin
--

CREATE TABLE public.employee_shifts (
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


ALTER TABLE public.employee_shifts OWNER TO avnadmin;

--
-- TOC entry 245 (class 1259 OID 17782)
-- Name: employee_shifts_id_seq; Type: SEQUENCE; Schema: public; Owner: avnadmin
--

CREATE SEQUENCE public.employee_shifts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.employee_shifts_id_seq OWNER TO avnadmin;

--
-- TOC entry 6020 (class 0 OID 0)
-- Dependencies: 245
-- Name: employee_shifts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: avnadmin
--

ALTER SEQUENCE public.employee_shifts_id_seq OWNED BY public.employee_shifts.id;


--
-- TOC entry 246 (class 1259 OID 17783)
-- Name: employee_tasks; Type: TABLE; Schema: public; Owner: avnadmin
--

CREATE TABLE public.employee_tasks (
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


ALTER TABLE public.employee_tasks OWNER TO avnadmin;

--
-- TOC entry 247 (class 1259 OID 17794)
-- Name: employee_tasks_id_seq; Type: SEQUENCE; Schema: public; Owner: avnadmin
--

CREATE SEQUENCE public.employee_tasks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.employee_tasks_id_seq OWNER TO avnadmin;

--
-- TOC entry 6021 (class 0 OID 0)
-- Dependencies: 247
-- Name: employee_tasks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: avnadmin
--

ALTER SEQUENCE public.employee_tasks_id_seq OWNED BY public.employee_tasks.id;


--
-- TOC entry 248 (class 1259 OID 17795)
-- Name: error_logs; Type: TABLE; Schema: public; Owner: avnadmin
--

CREATE TABLE public.error_logs (
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


ALTER TABLE public.error_logs OWNER TO avnadmin;

--
-- TOC entry 249 (class 1259 OID 17801)
-- Name: error_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: avnadmin
--

CREATE SEQUENCE public.error_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.error_logs_id_seq OWNER TO avnadmin;

--
-- TOC entry 6022 (class 0 OID 0)
-- Dependencies: 249
-- Name: error_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: avnadmin
--

ALTER SEQUENCE public.error_logs_id_seq OWNED BY public.error_logs.id;


--
-- TOC entry 250 (class 1259 OID 17802)
-- Name: expense_documents; Type: TABLE; Schema: public; Owner: avnadmin
--

CREATE TABLE public.expense_documents (
    id integer NOT NULL,
    expense_id integer,
    file_name character varying(255) NOT NULL,
    file_type character varying(100) NOT NULL,
    file_size integer NOT NULL,
    file_data bytea NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.expense_documents OWNER TO avnadmin;

--
-- TOC entry 251 (class 1259 OID 17808)
-- Name: expense_documents_id_seq; Type: SEQUENCE; Schema: public; Owner: avnadmin
--

CREATE SEQUENCE public.expense_documents_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.expense_documents_id_seq OWNER TO avnadmin;

--
-- TOC entry 6023 (class 0 OID 0)
-- Dependencies: 251
-- Name: expense_documents_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: avnadmin
--

ALTER SEQUENCE public.expense_documents_id_seq OWNED BY public.expense_documents.id;


--
-- TOC entry 252 (class 1259 OID 17809)
-- Name: expenses; Type: TABLE; Schema: public; Owner: avnadmin
--

CREATE TABLE public.expenses (
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


ALTER TABLE public.expenses OWNER TO avnadmin;

--
-- TOC entry 253 (class 1259 OID 17817)
-- Name: expenses_id_seq; Type: SEQUENCE; Schema: public; Owner: avnadmin
--

CREATE SEQUENCE public.expenses_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.expenses_id_seq OWNER TO avnadmin;

--
-- TOC entry 6024 (class 0 OID 0)
-- Dependencies: 253
-- Name: expenses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: avnadmin
--

ALTER SEQUENCE public.expenses_id_seq OWNED BY public.expenses.id;


--
-- TOC entry 254 (class 1259 OID 17818)
-- Name: geofence_events; Type: TABLE; Schema: public; Owner: avnadmin
--

CREATE TABLE public.geofence_events (
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


ALTER TABLE public.geofence_events OWNER TO avnadmin;

--
-- TOC entry 255 (class 1259 OID 17825)
-- Name: geofence_events_id_seq; Type: SEQUENCE; Schema: public; Owner: avnadmin
--

CREATE SEQUENCE public.geofence_events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.geofence_events_id_seq OWNER TO avnadmin;

--
-- TOC entry 6025 (class 0 OID 0)
-- Dependencies: 255
-- Name: geofence_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: avnadmin
--

ALTER SEQUENCE public.geofence_events_id_seq OWNED BY public.geofence_events.id;


--
-- TOC entry 256 (class 1259 OID 17826)
-- Name: group_admin_shifts; Type: TABLE; Schema: public; Owner: avnadmin
--

CREATE TABLE public.group_admin_shifts (
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


ALTER TABLE public.group_admin_shifts OWNER TO avnadmin;

--
-- TOC entry 257 (class 1259 OID 17836)
-- Name: group_admin_shifts_id_seq; Type: SEQUENCE; Schema: public; Owner: avnadmin
--

CREATE SEQUENCE public.group_admin_shifts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.group_admin_shifts_id_seq OWNER TO avnadmin;

--
-- TOC entry 6026 (class 0 OID 0)
-- Dependencies: 257
-- Name: group_admin_shifts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: avnadmin
--

ALTER SEQUENCE public.group_admin_shifts_id_seq OWNED BY public.group_admin_shifts.id;


--
-- TOC entry 258 (class 1259 OID 17837)
-- Name: leave_balances; Type: TABLE; Schema: public; Owner: avnadmin
--

CREATE TABLE public.leave_balances (
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


ALTER TABLE public.leave_balances OWNER TO avnadmin;

--
-- TOC entry 259 (class 1259 OID 17845)
-- Name: leave_balances_id_seq; Type: SEQUENCE; Schema: public; Owner: avnadmin
--

CREATE SEQUENCE public.leave_balances_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.leave_balances_id_seq OWNER TO avnadmin;

--
-- TOC entry 6027 (class 0 OID 0)
-- Dependencies: 259
-- Name: leave_balances_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: avnadmin
--

ALTER SEQUENCE public.leave_balances_id_seq OWNED BY public.leave_balances.id;


--
-- TOC entry 260 (class 1259 OID 17846)
-- Name: leave_documents; Type: TABLE; Schema: public; Owner: avnadmin
--

CREATE TABLE public.leave_documents (
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


ALTER TABLE public.leave_documents OWNER TO avnadmin;

--
-- TOC entry 261 (class 1259 OID 17854)
-- Name: leave_documents_id_seq; Type: SEQUENCE; Schema: public; Owner: avnadmin
--

CREATE SEQUENCE public.leave_documents_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.leave_documents_id_seq OWNER TO avnadmin;

--
-- TOC entry 6028 (class 0 OID 0)
-- Dependencies: 261
-- Name: leave_documents_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: avnadmin
--

ALTER SEQUENCE public.leave_documents_id_seq OWNED BY public.leave_documents.id;


--
-- TOC entry 262 (class 1259 OID 17855)
-- Name: leave_escalations; Type: TABLE; Schema: public; Owner: avnadmin
--

CREATE TABLE public.leave_escalations (
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


ALTER TABLE public.leave_escalations OWNER TO avnadmin;

--
-- TOC entry 263 (class 1259 OID 17863)
-- Name: leave_escalations_id_seq; Type: SEQUENCE; Schema: public; Owner: avnadmin
--

CREATE SEQUENCE public.leave_escalations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.leave_escalations_id_seq OWNER TO avnadmin;

--
-- TOC entry 6029 (class 0 OID 0)
-- Dependencies: 263
-- Name: leave_escalations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: avnadmin
--

ALTER SEQUENCE public.leave_escalations_id_seq OWNED BY public.leave_escalations.id;


--
-- TOC entry 264 (class 1259 OID 17864)
-- Name: leave_policies; Type: TABLE; Schema: public; Owner: avnadmin
--

CREATE TABLE public.leave_policies (
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


ALTER TABLE public.leave_policies OWNER TO avnadmin;

--
-- TOC entry 265 (class 1259 OID 17874)
-- Name: leave_policies_id_seq; Type: SEQUENCE; Schema: public; Owner: avnadmin
--

CREATE SEQUENCE public.leave_policies_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.leave_policies_id_seq OWNER TO avnadmin;

--
-- TOC entry 6030 (class 0 OID 0)
-- Dependencies: 265
-- Name: leave_policies_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: avnadmin
--

ALTER SEQUENCE public.leave_policies_id_seq OWNED BY public.leave_policies.id;


--
-- TOC entry 266 (class 1259 OID 17875)
-- Name: leave_requests; Type: TABLE; Schema: public; Owner: avnadmin
--

CREATE TABLE public.leave_requests (
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


ALTER TABLE public.leave_requests OWNER TO avnadmin;

--
-- TOC entry 267 (class 1259 OID 17886)
-- Name: leave_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: avnadmin
--

CREATE SEQUENCE public.leave_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.leave_requests_id_seq OWNER TO avnadmin;

--
-- TOC entry 6031 (class 0 OID 0)
-- Dependencies: 267
-- Name: leave_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: avnadmin
--

ALTER SEQUENCE public.leave_requests_id_seq OWNED BY public.leave_requests.id;


--
-- TOC entry 268 (class 1259 OID 17887)
-- Name: leave_types; Type: TABLE; Schema: public; Owner: avnadmin
--

CREATE TABLE public.leave_types (
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


ALTER TABLE public.leave_types OWNER TO avnadmin;

--
-- TOC entry 269 (class 1259 OID 17897)
-- Name: leave_types_id_seq; Type: SEQUENCE; Schema: public; Owner: avnadmin
--

CREATE SEQUENCE public.leave_types_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.leave_types_id_seq OWNER TO avnadmin;

--
-- TOC entry 6032 (class 0 OID 0)
-- Dependencies: 269
-- Name: leave_types_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: avnadmin
--

ALTER SEQUENCE public.leave_types_id_seq OWNED BY public.leave_types.id;


--
-- TOC entry 270 (class 1259 OID 17898)
-- Name: management_shifts; Type: TABLE; Schema: public; Owner: avnadmin
--

CREATE TABLE public.management_shifts (
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


ALTER TABLE public.management_shifts OWNER TO avnadmin;

--
-- TOC entry 271 (class 1259 OID 17908)
-- Name: management_shifts_id_seq; Type: SEQUENCE; Schema: public; Owner: avnadmin
--

CREATE SEQUENCE public.management_shifts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.management_shifts_id_seq OWNER TO avnadmin;

--
-- TOC entry 6033 (class 0 OID 0)
-- Dependencies: 271
-- Name: management_shifts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: avnadmin
--

ALTER SEQUENCE public.management_shifts_id_seq OWNED BY public.management_shifts.id;


--
-- TOC entry 272 (class 1259 OID 17909)
-- Name: notification_templates; Type: TABLE; Schema: public; Owner: avnadmin
--

CREATE TABLE public.notification_templates (
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


ALTER TABLE public.notification_templates OWNER TO avnadmin;

--
-- TOC entry 273 (class 1259 OID 17919)
-- Name: notification_templates_id_seq; Type: SEQUENCE; Schema: public; Owner: avnadmin
--

CREATE SEQUENCE public.notification_templates_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.notification_templates_id_seq OWNER TO avnadmin;

--
-- TOC entry 6034 (class 0 OID 0)
-- Dependencies: 273
-- Name: notification_templates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: avnadmin
--

ALTER SEQUENCE public.notification_templates_id_seq OWNED BY public.notification_templates.id;


--
-- TOC entry 274 (class 1259 OID 17920)
-- Name: notifications; Type: TABLE; Schema: public; Owner: avnadmin
--

CREATE TABLE public.notifications (
    id integer NOT NULL,
    user_id integer,
    title character varying(255) NOT NULL,
    message text NOT NULL,
    type character varying(50) NOT NULL,
    read boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.notifications OWNER TO avnadmin;

--
-- TOC entry 275 (class 1259 OID 17927)
-- Name: notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: avnadmin
--

CREATE SEQUENCE public.notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.notifications_id_seq OWNER TO avnadmin;

--
-- TOC entry 6035 (class 0 OID 0)
-- Dependencies: 275
-- Name: notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: avnadmin
--

ALTER SEQUENCE public.notifications_id_seq OWNED BY public.notifications.id;


--
-- TOC entry 276 (class 1259 OID 17928)
-- Name: push_notifications; Type: TABLE; Schema: public; Owner: avnadmin
--

CREATE TABLE public.push_notifications (
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


ALTER TABLE public.push_notifications OWNER TO avnadmin;

--
-- TOC entry 277 (class 1259 OID 17938)
-- Name: push_notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: avnadmin
--

CREATE SEQUENCE public.push_notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.push_notifications_id_seq OWNER TO avnadmin;

--
-- TOC entry 6036 (class 0 OID 0)
-- Dependencies: 277
-- Name: push_notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: avnadmin
--

ALTER SEQUENCE public.push_notifications_id_seq OWNED BY public.push_notifications.id;


--
-- TOC entry 287 (class 1259 OID 18485)
-- Name: push_receipts; Type: TABLE; Schema: public; Owner: avnadmin
--

CREATE TABLE public.push_receipts (
    id integer NOT NULL,
    notification_id integer NOT NULL,
    receipt_id character varying(36) NOT NULL,
    processed boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    processed_at timestamp with time zone,
    error_details jsonb
);


ALTER TABLE public.push_receipts OWNER TO avnadmin;

--
-- TOC entry 286 (class 1259 OID 18484)
-- Name: push_receipts_id_seq; Type: SEQUENCE; Schema: public; Owner: avnadmin
--

CREATE SEQUENCE public.push_receipts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.push_receipts_id_seq OWNER TO avnadmin;

--
-- TOC entry 6037 (class 0 OID 0)
-- Dependencies: 286
-- Name: push_receipts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: avnadmin
--

ALTER SEQUENCE public.push_receipts_id_seq OWNED BY public.push_receipts.id;


--
-- TOC entry 278 (class 1259 OID 17939)
-- Name: scheduled_notifications; Type: TABLE; Schema: public; Owner: avnadmin
--

CREATE TABLE public.scheduled_notifications (
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


ALTER TABLE public.scheduled_notifications OWNER TO avnadmin;

--
-- TOC entry 279 (class 1259 OID 17949)
-- Name: scheduled_notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: avnadmin
--

CREATE SEQUENCE public.scheduled_notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.scheduled_notifications_id_seq OWNER TO avnadmin;

--
-- TOC entry 6038 (class 0 OID 0)
-- Dependencies: 279
-- Name: scheduled_notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: avnadmin
--

ALTER SEQUENCE public.scheduled_notifications_id_seq OWNED BY public.scheduled_notifications.id;


--
-- TOC entry 280 (class 1259 OID 17950)
-- Name: support_messages; Type: TABLE; Schema: public; Owner: avnadmin
--

CREATE TABLE public.support_messages (
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


ALTER TABLE public.support_messages OWNER TO avnadmin;

--
-- TOC entry 281 (class 1259 OID 17957)
-- Name: support_messages_id_seq; Type: SEQUENCE; Schema: public; Owner: avnadmin
--

CREATE SEQUENCE public.support_messages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.support_messages_id_seq OWNER TO avnadmin;

--
-- TOC entry 6040 (class 0 OID 0)
-- Dependencies: 281
-- Name: support_messages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: avnadmin
--

ALTER SEQUENCE public.support_messages_id_seq OWNED BY public.support_messages.id;


--
-- TOC entry 289 (class 1259 OID 18517)
-- Name: tracking_analytics; Type: TABLE; Schema: public; Owner: avnadmin
--

CREATE TABLE public.tracking_analytics (
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


ALTER TABLE public.tracking_analytics OWNER TO avnadmin;

--
-- TOC entry 288 (class 1259 OID 18516)
-- Name: tracking_analytics_id_seq; Type: SEQUENCE; Schema: public; Owner: avnadmin
--

CREATE SEQUENCE public.tracking_analytics_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tracking_analytics_id_seq OWNER TO avnadmin;

--
-- TOC entry 6041 (class 0 OID 0)
-- Dependencies: 288
-- Name: tracking_analytics_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: avnadmin
--

ALTER SEQUENCE public.tracking_analytics_id_seq OWNED BY public.tracking_analytics.id;


--
-- TOC entry 282 (class 1259 OID 17967)
-- Name: user_tracking_permissions; Type: TABLE; Schema: public; Owner: avnadmin
--

CREATE TABLE public.user_tracking_permissions (
    id integer NOT NULL,
    user_id integer NOT NULL,
    can_override_geofence boolean DEFAULT false NOT NULL,
    tracking_precision character varying(20) DEFAULT 'high'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    location_required_for_shift boolean DEFAULT true NOT NULL,
    CONSTRAINT chk_tracking_precision CHECK (((tracking_precision)::text = ANY (ARRAY[('low'::character varying)::text, ('medium'::character varying)::text, ('high'::character varying)::text])))
);


ALTER TABLE public.user_tracking_permissions OWNER TO avnadmin;

--
-- TOC entry 6042 (class 0 OID 0)
-- Dependencies: 282
-- Name: COLUMN user_tracking_permissions.location_required_for_shift; Type: COMMENT; Schema: public; Owner: avnadmin
--

COMMENT ON COLUMN public.user_tracking_permissions.location_required_for_shift IS 'Whether location access is required for shift tracking';


--
-- TOC entry 283 (class 1259 OID 17975)
-- Name: user_tracking_permissions_id_seq; Type: SEQUENCE; Schema: public; Owner: avnadmin
--

CREATE SEQUENCE public.user_tracking_permissions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_tracking_permissions_id_seq OWNER TO avnadmin;

--
-- TOC entry 6043 (class 0 OID 0)
-- Dependencies: 283
-- Name: user_tracking_permissions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: avnadmin
--

ALTER SEQUENCE public.user_tracking_permissions_id_seq OWNED BY public.user_tracking_permissions.id;


--
-- TOC entry 284 (class 1259 OID 17976)
-- Name: users; Type: TABLE; Schema: public; Owner: avnadmin
--

CREATE TABLE public.users (
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


ALTER TABLE public.users OWNER TO avnadmin;

--
-- TOC entry 285 (class 1259 OID 17991)
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: avnadmin
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO avnadmin;

--
-- TOC entry 6044 (class 0 OID 0)
-- Dependencies: 285
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: avnadmin
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- TOC entry 5490 (class 2604 OID 17992)
-- Name: chat_messages id; Type: DEFAULT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.chat_messages ALTER COLUMN id SET DEFAULT nextval('public.chat_messages_id_seq'::regclass);


--
-- TOC entry 5493 (class 2604 OID 17993)
-- Name: companies id; Type: DEFAULT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.companies ALTER COLUMN id SET DEFAULT nextval('public.companies_id_seq'::regclass);


--
-- TOC entry 5498 (class 2604 OID 17994)
-- Name: company_geofences id; Type: DEFAULT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.company_geofences ALTER COLUMN id SET DEFAULT nextval('public.company_geofences_id_seq'::regclass);


--
-- TOC entry 5501 (class 2604 OID 17995)
-- Name: company_tracking_settings id; Type: DEFAULT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.company_tracking_settings ALTER COLUMN id SET DEFAULT nextval('public.company_tracking_settings_id_seq'::regclass);


--
-- TOC entry 5508 (class 2604 OID 17996)
-- Name: device_tokens id; Type: DEFAULT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.device_tokens ALTER COLUMN id SET DEFAULT nextval('public.device_tokens_id_seq'::regclass);


--
-- TOC entry 5513 (class 2604 OID 17997)
-- Name: employee_locations id; Type: DEFAULT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.employee_locations ALTER COLUMN id SET DEFAULT nextval('public.employee_locations_id_seq'::regclass);


--
-- TOC entry 5519 (class 2604 OID 17998)
-- Name: employee_schedule id; Type: DEFAULT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.employee_schedule ALTER COLUMN id SET DEFAULT nextval('public.employee_schedule_id_seq'::regclass);


--
-- TOC entry 5523 (class 2604 OID 17999)
-- Name: employee_shifts id; Type: DEFAULT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.employee_shifts ALTER COLUMN id SET DEFAULT nextval('public.employee_shifts_id_seq'::regclass);


--
-- TOC entry 5532 (class 2604 OID 18000)
-- Name: employee_tasks id; Type: DEFAULT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.employee_tasks ALTER COLUMN id SET DEFAULT nextval('public.employee_tasks_id_seq'::regclass);


--
-- TOC entry 5539 (class 2604 OID 18001)
-- Name: error_logs id; Type: DEFAULT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.error_logs ALTER COLUMN id SET DEFAULT nextval('public.error_logs_id_seq'::regclass);


--
-- TOC entry 5541 (class 2604 OID 18002)
-- Name: expense_documents id; Type: DEFAULT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.expense_documents ALTER COLUMN id SET DEFAULT nextval('public.expense_documents_id_seq'::regclass);


--
-- TOC entry 5543 (class 2604 OID 18003)
-- Name: expenses id; Type: DEFAULT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.expenses ALTER COLUMN id SET DEFAULT nextval('public.expenses_id_seq'::regclass);


--
-- TOC entry 5547 (class 2604 OID 18004)
-- Name: geofence_events id; Type: DEFAULT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.geofence_events ALTER COLUMN id SET DEFAULT nextval('public.geofence_events_id_seq'::regclass);


--
-- TOC entry 5551 (class 2604 OID 18005)
-- Name: group_admin_shifts id; Type: DEFAULT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.group_admin_shifts ALTER COLUMN id SET DEFAULT nextval('public.group_admin_shifts_id_seq'::regclass);


--
-- TOC entry 5557 (class 2604 OID 18006)
-- Name: leave_balances id; Type: DEFAULT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.leave_balances ALTER COLUMN id SET DEFAULT nextval('public.leave_balances_id_seq'::regclass);


--
-- TOC entry 5563 (class 2604 OID 18007)
-- Name: leave_documents id; Type: DEFAULT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.leave_documents ALTER COLUMN id SET DEFAULT nextval('public.leave_documents_id_seq'::regclass);


--
-- TOC entry 5566 (class 2604 OID 18008)
-- Name: leave_escalations id; Type: DEFAULT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.leave_escalations ALTER COLUMN id SET DEFAULT nextval('public.leave_escalations_id_seq'::regclass);


--
-- TOC entry 5569 (class 2604 OID 18009)
-- Name: leave_policies id; Type: DEFAULT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.leave_policies ALTER COLUMN id SET DEFAULT nextval('public.leave_policies_id_seq'::regclass);


--
-- TOC entry 5577 (class 2604 OID 18010)
-- Name: leave_requests id; Type: DEFAULT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.leave_requests ALTER COLUMN id SET DEFAULT nextval('public.leave_requests_id_seq'::regclass);


--
-- TOC entry 5583 (class 2604 OID 18011)
-- Name: leave_types id; Type: DEFAULT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.leave_types ALTER COLUMN id SET DEFAULT nextval('public.leave_types_id_seq'::regclass);


--
-- TOC entry 5589 (class 2604 OID 18012)
-- Name: management_shifts id; Type: DEFAULT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.management_shifts ALTER COLUMN id SET DEFAULT nextval('public.management_shifts_id_seq'::regclass);


--
-- TOC entry 5595 (class 2604 OID 18013)
-- Name: notification_templates id; Type: DEFAULT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.notification_templates ALTER COLUMN id SET DEFAULT nextval('public.notification_templates_id_seq'::regclass);


--
-- TOC entry 5601 (class 2604 OID 18014)
-- Name: notifications id; Type: DEFAULT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.notifications ALTER COLUMN id SET DEFAULT nextval('public.notifications_id_seq'::regclass);


--
-- TOC entry 5604 (class 2604 OID 18015)
-- Name: push_notifications id; Type: DEFAULT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.push_notifications ALTER COLUMN id SET DEFAULT nextval('public.push_notifications_id_seq'::regclass);


--
-- TOC entry 5632 (class 2604 OID 18488)
-- Name: push_receipts id; Type: DEFAULT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.push_receipts ALTER COLUMN id SET DEFAULT nextval('public.push_receipts_id_seq'::regclass);


--
-- TOC entry 5609 (class 2604 OID 18016)
-- Name: scheduled_notifications id; Type: DEFAULT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.scheduled_notifications ALTER COLUMN id SET DEFAULT nextval('public.scheduled_notifications_id_seq'::regclass);


--
-- TOC entry 5614 (class 2604 OID 18017)
-- Name: support_messages id; Type: DEFAULT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.support_messages ALTER COLUMN id SET DEFAULT nextval('public.support_messages_id_seq'::regclass);


--
-- TOC entry 5635 (class 2604 OID 18520)
-- Name: tracking_analytics id; Type: DEFAULT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.tracking_analytics ALTER COLUMN id SET DEFAULT nextval('public.tracking_analytics_id_seq'::regclass);


--
-- TOC entry 5617 (class 2604 OID 18019)
-- Name: user_tracking_permissions id; Type: DEFAULT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.user_tracking_permissions ALTER COLUMN id SET DEFAULT nextval('public.user_tracking_permissions_id_seq'::regclass);


--
-- TOC entry 5623 (class 2604 OID 18020)
-- Name: users id; Type: DEFAULT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- TOC entry 5669 (class 2606 OID 18123)
-- Name: chat_messages chat_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_pkey PRIMARY KEY (id);


--
-- TOC entry 5672 (class 2606 OID 18125)
-- Name: companies companies_email_key; Type: CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_email_key UNIQUE (email);


--
-- TOC entry 5674 (class 2606 OID 18127)
-- Name: companies companies_pkey; Type: CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_pkey PRIMARY KEY (id);


--
-- TOC entry 5676 (class 2606 OID 18129)
-- Name: company_geofences company_geofences_new_pkey1; Type: CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.company_geofences
    ADD CONSTRAINT company_geofences_new_pkey1 PRIMARY KEY (id);


--
-- TOC entry 5681 (class 2606 OID 18131)
-- Name: company_tracking_settings company_tracking_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.company_tracking_settings
    ADD CONSTRAINT company_tracking_settings_pkey PRIMARY KEY (id);


--
-- TOC entry 5684 (class 2606 OID 18133)
-- Name: device_tokens device_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.device_tokens
    ADD CONSTRAINT device_tokens_pkey PRIMARY KEY (id);


--
-- TOC entry 5686 (class 2606 OID 18135)
-- Name: device_tokens device_tokens_user_id_token_key; Type: CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.device_tokens
    ADD CONSTRAINT device_tokens_user_id_token_key UNIQUE (user_id, token);


--
-- TOC entry 5690 (class 2606 OID 18137)
-- Name: employee_locations employee_locations_pkey; Type: CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.employee_locations
    ADD CONSTRAINT employee_locations_pkey PRIMARY KEY (id);


--
-- TOC entry 5696 (class 2606 OID 18139)
-- Name: employee_schedule employee_schedule_pkey; Type: CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.employee_schedule
    ADD CONSTRAINT employee_schedule_pkey PRIMARY KEY (id);


--
-- TOC entry 5698 (class 2606 OID 18141)
-- Name: employee_shifts employee_shifts_pkey; Type: CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.employee_shifts
    ADD CONSTRAINT employee_shifts_pkey PRIMARY KEY (id);


--
-- TOC entry 5703 (class 2606 OID 18143)
-- Name: employee_tasks employee_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.employee_tasks
    ADD CONSTRAINT employee_tasks_pkey PRIMARY KEY (id);


--
-- TOC entry 5705 (class 2606 OID 18145)
-- Name: error_logs error_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.error_logs
    ADD CONSTRAINT error_logs_pkey PRIMARY KEY (id);


--
-- TOC entry 5714 (class 2606 OID 18147)
-- Name: expense_documents expense_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.expense_documents
    ADD CONSTRAINT expense_documents_pkey PRIMARY KEY (id);


--
-- TOC entry 5717 (class 2606 OID 18149)
-- Name: geofence_events geofence_events_pkey; Type: CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.geofence_events
    ADD CONSTRAINT geofence_events_pkey PRIMARY KEY (id);


--
-- TOC entry 5723 (class 2606 OID 18151)
-- Name: group_admin_shifts group_admin_shifts_pkey; Type: CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.group_admin_shifts
    ADD CONSTRAINT group_admin_shifts_pkey PRIMARY KEY (id);


--
-- TOC entry 5729 (class 2606 OID 18153)
-- Name: leave_balances leave_balances_pkey; Type: CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.leave_balances
    ADD CONSTRAINT leave_balances_pkey PRIMARY KEY (id);


--
-- TOC entry 5731 (class 2606 OID 18155)
-- Name: leave_balances leave_balances_user_id_leave_type_id_year_key; Type: CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.leave_balances
    ADD CONSTRAINT leave_balances_user_id_leave_type_id_year_key UNIQUE (user_id, leave_type_id, year);


--
-- TOC entry 5733 (class 2606 OID 18157)
-- Name: leave_documents leave_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.leave_documents
    ADD CONSTRAINT leave_documents_pkey PRIMARY KEY (id);


--
-- TOC entry 5736 (class 2606 OID 18159)
-- Name: leave_escalations leave_escalations_pkey; Type: CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.leave_escalations
    ADD CONSTRAINT leave_escalations_pkey PRIMARY KEY (id);


--
-- TOC entry 5738 (class 2606 OID 18161)
-- Name: leave_policies leave_policies_leave_type_id_key; Type: CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.leave_policies
    ADD CONSTRAINT leave_policies_leave_type_id_key UNIQUE (leave_type_id);


--
-- TOC entry 5740 (class 2606 OID 18163)
-- Name: leave_policies leave_policies_pkey; Type: CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.leave_policies
    ADD CONSTRAINT leave_policies_pkey PRIMARY KEY (id);


--
-- TOC entry 5747 (class 2606 OID 18165)
-- Name: leave_requests leave_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_pkey PRIMARY KEY (id);


--
-- TOC entry 5749 (class 2606 OID 18167)
-- Name: leave_types leave_types_name_key; Type: CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.leave_types
    ADD CONSTRAINT leave_types_name_key UNIQUE (name);


--
-- TOC entry 5751 (class 2606 OID 18169)
-- Name: leave_types leave_types_pkey; Type: CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.leave_types
    ADD CONSTRAINT leave_types_pkey PRIMARY KEY (id);


--
-- TOC entry 5755 (class 2606 OID 18171)
-- Name: management_shifts management_shifts_pkey; Type: CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.management_shifts
    ADD CONSTRAINT management_shifts_pkey PRIMARY KEY (id);


--
-- TOC entry 5759 (class 2606 OID 18173)
-- Name: notification_templates notification_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.notification_templates
    ADD CONSTRAINT notification_templates_pkey PRIMARY KEY (id);


--
-- TOC entry 5761 (class 2606 OID 18175)
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- TOC entry 5769 (class 2606 OID 18177)
-- Name: push_notifications push_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.push_notifications
    ADD CONSTRAINT push_notifications_pkey PRIMARY KEY (id);


--
-- TOC entry 5797 (class 2606 OID 18494)
-- Name: push_receipts push_receipts_pkey; Type: CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.push_receipts
    ADD CONSTRAINT push_receipts_pkey PRIMARY KEY (id);


--
-- TOC entry 5774 (class 2606 OID 18179)
-- Name: scheduled_notifications scheduled_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.scheduled_notifications
    ADD CONSTRAINT scheduled_notifications_pkey PRIMARY KEY (id);


--
-- TOC entry 5776 (class 2606 OID 18181)
-- Name: support_messages support_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.support_messages
    ADD CONSTRAINT support_messages_pkey PRIMARY KEY (id);


--
-- TOC entry 5804 (class 2606 OID 18531)
-- Name: tracking_analytics tracking_analytics_pkey; Type: CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.tracking_analytics
    ADD CONSTRAINT tracking_analytics_pkey PRIMARY KEY (id);


--
-- TOC entry 5799 (class 2606 OID 18496)
-- Name: push_receipts unique_receipt_id; Type: CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.push_receipts
    ADD CONSTRAINT unique_receipt_id UNIQUE (receipt_id);


--
-- TOC entry 5779 (class 2606 OID 18185)
-- Name: user_tracking_permissions unique_user_tracking_permission; Type: CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.user_tracking_permissions
    ADD CONSTRAINT unique_user_tracking_permission UNIQUE (user_id);


--
-- TOC entry 5781 (class 2606 OID 18187)
-- Name: user_tracking_permissions user_tracking_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.user_tracking_permissions
    ADD CONSTRAINT user_tracking_permissions_pkey PRIMARY KEY (id);


--
-- TOC entry 5787 (class 2606 OID 18189)
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- TOC entry 5789 (class 2606 OID 18191)
-- Name: users users_employee_number_key; Type: CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_employee_number_key UNIQUE (employee_number);


--
-- TOC entry 5791 (class 2606 OID 18193)
-- Name: users users_phone_key; Type: CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_phone_key UNIQUE (phone);


--
-- TOC entry 5793 (class 2606 OID 18195)
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- TOC entry 5670 (class 1259 OID 18196)
-- Name: idx_chat_messages_user_id; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_chat_messages_user_id ON public.chat_messages USING btree (user_id);


--
-- TOC entry 5677 (class 1259 OID 18197)
-- Name: idx_company_geofences_active; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_company_geofences_active ON public.company_geofences USING btree (company_id) WHERE (radius > (0)::numeric);


--
-- TOC entry 5678 (class 1259 OID 18198)
-- Name: idx_company_geofences_company; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_company_geofences_company ON public.company_geofences USING btree (company_id);


--
-- TOC entry 5679 (class 1259 OID 18199)
-- Name: idx_company_geofences_coordinates; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_company_geofences_coordinates ON public.company_geofences USING gist (coordinates);


--
-- TOC entry 5682 (class 1259 OID 18200)
-- Name: idx_company_tracking_settings; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE UNIQUE INDEX idx_company_tracking_settings ON public.company_tracking_settings USING btree (company_id);


--
-- TOC entry 5687 (class 1259 OID 18201)
-- Name: idx_device_tokens_token; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_device_tokens_token ON public.device_tokens USING btree (token);


--
-- TOC entry 5688 (class 1259 OID 18202)
-- Name: idx_device_tokens_user_id; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_device_tokens_user_id ON public.device_tokens USING btree (user_id);


--
-- TOC entry 5691 (class 1259 OID 18203)
-- Name: idx_employee_locations_moving; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_employee_locations_moving ON public.employee_locations USING btree (user_id, is_moving) WHERE (is_moving = true);


--
-- TOC entry 5692 (class 1259 OID 18204)
-- Name: idx_employee_locations_outdoor; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_employee_locations_outdoor ON public.employee_locations USING btree (user_id, is_outdoor) WHERE (is_outdoor = true);


--
-- TOC entry 5693 (class 1259 OID 18205)
-- Name: idx_employee_locations_shift; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_employee_locations_shift ON public.employee_locations USING btree (shift_id, "timestamp" DESC);


--
-- TOC entry 5694 (class 1259 OID 18206)
-- Name: idx_employee_locations_user_timestamp; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_employee_locations_user_timestamp ON public.employee_locations USING btree (user_id, "timestamp" DESC);


--
-- TOC entry 5699 (class 1259 OID 18207)
-- Name: idx_employee_shifts_location; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_employee_shifts_location ON public.employee_shifts USING gist (location_history);


--
-- TOC entry 5700 (class 1259 OID 18208)
-- Name: idx_employee_shifts_start_time; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_employee_shifts_start_time ON public.employee_shifts USING btree (start_time);


--
-- TOC entry 5701 (class 1259 OID 18209)
-- Name: idx_employee_shifts_status; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_employee_shifts_status ON public.employee_shifts USING btree (status);


--
-- TOC entry 5706 (class 1259 OID 18210)
-- Name: idx_error_logs_error_type; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_error_logs_error_type ON public.error_logs USING btree (error_type);


--
-- TOC entry 5707 (class 1259 OID 18211)
-- Name: idx_error_logs_service; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_error_logs_service ON public.error_logs USING btree (service);


--
-- TOC entry 5708 (class 1259 OID 18212)
-- Name: idx_error_logs_service_timestamp; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_error_logs_service_timestamp ON public.error_logs USING btree (service, "timestamp" DESC);


--
-- TOC entry 5709 (class 1259 OID 18213)
-- Name: idx_error_logs_timestamp; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_error_logs_timestamp ON public.error_logs USING btree ("timestamp" DESC);


--
-- TOC entry 5710 (class 1259 OID 18214)
-- Name: idx_error_logs_type; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_error_logs_type ON public.error_logs USING btree (error_type);


--
-- TOC entry 5711 (class 1259 OID 18215)
-- Name: idx_error_logs_user_id; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_error_logs_user_id ON public.error_logs USING btree (user_id);


--
-- TOC entry 5712 (class 1259 OID 18216)
-- Name: idx_error_logs_user_timestamp; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_error_logs_user_timestamp ON public.error_logs USING btree (user_id, "timestamp" DESC);


--
-- TOC entry 5715 (class 1259 OID 18560)
-- Name: idx_expenses_shift_id; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_expenses_shift_id ON public.expenses USING btree (shift_id);


--
-- TOC entry 5718 (class 1259 OID 18217)
-- Name: idx_geofence_events_geofence_id; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_geofence_events_geofence_id ON public.geofence_events USING btree (geofence_id);


--
-- TOC entry 5719 (class 1259 OID 18218)
-- Name: idx_geofence_events_shift_id; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_geofence_events_shift_id ON public.geofence_events USING btree (shift_id);


--
-- TOC entry 5720 (class 1259 OID 18219)
-- Name: idx_geofence_events_timestamp; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_geofence_events_timestamp ON public.geofence_events USING btree ("timestamp");


--
-- TOC entry 5721 (class 1259 OID 18220)
-- Name: idx_geofence_events_user_id; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_geofence_events_user_id ON public.geofence_events USING btree (user_id);


--
-- TOC entry 5724 (class 1259 OID 18221)
-- Name: idx_group_admin_shifts_start_time; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_group_admin_shifts_start_time ON public.group_admin_shifts USING btree (start_time);


--
-- TOC entry 5725 (class 1259 OID 18222)
-- Name: idx_group_admin_shifts_status; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_group_admin_shifts_status ON public.group_admin_shifts USING btree (status);


--
-- TOC entry 5726 (class 1259 OID 18223)
-- Name: idx_leave_balances_leave_type_id; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_leave_balances_leave_type_id ON public.leave_balances USING btree (leave_type_id);


--
-- TOC entry 5727 (class 1259 OID 18224)
-- Name: idx_leave_balances_user_id; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_leave_balances_user_id ON public.leave_balances USING btree (user_id);


--
-- TOC entry 5734 (class 1259 OID 18225)
-- Name: idx_leave_escalations_request_id; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_leave_escalations_request_id ON public.leave_escalations USING btree (request_id);


--
-- TOC entry 5741 (class 1259 OID 18226)
-- Name: idx_leave_requests_dates; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_leave_requests_dates ON public.leave_requests USING btree (start_date, end_date);


--
-- TOC entry 5742 (class 1259 OID 18227)
-- Name: idx_leave_requests_group_admin; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_leave_requests_group_admin ON public.leave_requests USING btree (group_admin_id);


--
-- TOC entry 5743 (class 1259 OID 18228)
-- Name: idx_leave_requests_leave_type_id; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_leave_requests_leave_type_id ON public.leave_requests USING btree (leave_type_id);


--
-- TOC entry 5744 (class 1259 OID 18229)
-- Name: idx_leave_requests_status; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_leave_requests_status ON public.leave_requests USING btree (status);


--
-- TOC entry 5745 (class 1259 OID 18230)
-- Name: idx_leave_requests_user_id; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_leave_requests_user_id ON public.leave_requests USING btree (user_id);


--
-- TOC entry 5752 (class 1259 OID 18231)
-- Name: idx_management_shifts_start_time; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_management_shifts_start_time ON public.management_shifts USING btree (start_time);


--
-- TOC entry 5753 (class 1259 OID 18232)
-- Name: idx_management_shifts_status; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_management_shifts_status ON public.management_shifts USING btree (status);


--
-- TOC entry 5756 (class 1259 OID 18233)
-- Name: idx_notification_templates_role; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_notification_templates_role ON public.notification_templates USING btree (role);


--
-- TOC entry 5757 (class 1259 OID 18234)
-- Name: idx_notification_templates_type; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_notification_templates_type ON public.notification_templates USING btree (type);


--
-- TOC entry 5762 (class 1259 OID 18235)
-- Name: idx_push_notifications_batch; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_push_notifications_batch ON public.push_notifications USING btree (batch_id);


--
-- TOC entry 5763 (class 1259 OID 18236)
-- Name: idx_push_notifications_created_at; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_push_notifications_created_at ON public.push_notifications USING btree (created_at);


--
-- TOC entry 5764 (class 1259 OID 18237)
-- Name: idx_push_notifications_expiration; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_push_notifications_expiration ON public.push_notifications USING btree (expires_at);


--
-- TOC entry 5765 (class 1259 OID 18238)
-- Name: idx_push_notifications_sent; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_push_notifications_sent ON public.push_notifications USING btree (sent);


--
-- TOC entry 5766 (class 1259 OID 18239)
-- Name: idx_push_notifications_type; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_push_notifications_type ON public.push_notifications USING btree (type);


--
-- TOC entry 5767 (class 1259 OID 18240)
-- Name: idx_push_notifications_user_id; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_push_notifications_user_id ON public.push_notifications USING btree (user_id);


--
-- TOC entry 5794 (class 1259 OID 18502)
-- Name: idx_push_receipts_notification_id; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_push_receipts_notification_id ON public.push_receipts USING btree (notification_id);


--
-- TOC entry 5795 (class 1259 OID 18503)
-- Name: idx_push_receipts_processed; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_push_receipts_processed ON public.push_receipts USING btree (processed);


--
-- TOC entry 5770 (class 1259 OID 18241)
-- Name: idx_scheduled_notifications_scheduled_for; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_scheduled_notifications_scheduled_for ON public.scheduled_notifications USING btree (scheduled_for);


--
-- TOC entry 5771 (class 1259 OID 18242)
-- Name: idx_scheduled_notifications_status; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_scheduled_notifications_status ON public.scheduled_notifications USING btree (status);


--
-- TOC entry 5772 (class 1259 OID 18243)
-- Name: idx_scheduled_notifications_target_group_admin; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_scheduled_notifications_target_group_admin ON public.scheduled_notifications USING btree (target_group_admin_id);


--
-- TOC entry 5800 (class 1259 OID 18538)
-- Name: idx_tracking_analytics_date; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_tracking_analytics_date ON public.tracking_analytics USING btree (date);


--
-- TOC entry 5801 (class 1259 OID 18539)
-- Name: idx_tracking_analytics_user; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_tracking_analytics_user ON public.tracking_analytics USING btree (user_id);


--
-- TOC entry 5802 (class 1259 OID 18537)
-- Name: idx_tracking_analytics_user_date; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE UNIQUE INDEX idx_tracking_analytics_user_date ON public.tracking_analytics USING btree (user_id, date);


--
-- TOC entry 5777 (class 1259 OID 18246)
-- Name: idx_user_tracking_permissions; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_user_tracking_permissions ON public.user_tracking_permissions USING btree (user_id, tracking_precision);


--
-- TOC entry 5782 (class 1259 OID 18247)
-- Name: idx_users_company_status; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_users_company_status ON public.users USING btree (company_id, status);


--
-- TOC entry 5783 (class 1259 OID 18248)
-- Name: idx_users_group_admin_id; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_users_group_admin_id ON public.users USING btree (group_admin_id);


--
-- TOC entry 5784 (class 1259 OID 18249)
-- Name: idx_users_management_id; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_users_management_id ON public.users USING btree (management_id);


--
-- TOC entry 5785 (class 1259 OID 18250)
-- Name: idx_users_token_version; Type: INDEX; Schema: public; Owner: avnadmin
--

CREATE INDEX idx_users_token_version ON public.users USING btree (token_version);


--
-- TOC entry 5846 (class 2620 OID 18251)
-- Name: chat_messages update_chat_messages_updated_at; Type: TRIGGER; Schema: public; Owner: avnadmin
--

CREATE TRIGGER update_chat_messages_updated_at BEFORE UPDATE ON public.chat_messages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 5847 (class 2620 OID 18252)
-- Name: company_geofences update_company_geofences_updated_at; Type: TRIGGER; Schema: public; Owner: avnadmin
--

CREATE TRIGGER update_company_geofences_updated_at BEFORE UPDATE ON public.company_geofences FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();


--
-- TOC entry 5850 (class 2620 OID 18253)
-- Name: geofence_events update_geofence_events_updated_at; Type: TRIGGER; Schema: public; Owner: avnadmin
--

CREATE TRIGGER update_geofence_events_updated_at BEFORE UPDATE ON public.geofence_events FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 5848 (class 2620 OID 18254)
-- Name: company_geofences update_geofences_timestamp; Type: TRIGGER; Schema: public; Owner: avnadmin
--

CREATE TRIGGER update_geofences_timestamp BEFORE UPDATE ON public.company_geofences FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();


--
-- TOC entry 5851 (class 2620 OID 18255)
-- Name: user_tracking_permissions update_permissions_timestamp; Type: TRIGGER; Schema: public; Owner: avnadmin
--

CREATE TRIGGER update_permissions_timestamp BEFORE UPDATE ON public.user_tracking_permissions FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();


--
-- TOC entry 5849 (class 2620 OID 18256)
-- Name: company_tracking_settings update_settings_timestamp; Type: TRIGGER; Schema: public; Owner: avnadmin
--

CREATE TRIGGER update_settings_timestamp BEFORE UPDATE ON public.company_tracking_settings FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();


--
-- TOC entry 5852 (class 2620 OID 18257)
-- Name: users update_users_updated_at; Type: TRIGGER; Schema: public; Owner: avnadmin
--

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 5805 (class 2606 OID 18258)
-- Name: chat_messages chat_messages_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 5806 (class 2606 OID 18263)
-- Name: company_geofences company_geofences_new_company_id_fkey1; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.company_geofences
    ADD CONSTRAINT company_geofences_new_company_id_fkey1 FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- TOC entry 5807 (class 2606 OID 18268)
-- Name: company_geofences company_geofences_new_created_by_fkey1; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.company_geofences
    ADD CONSTRAINT company_geofences_new_created_by_fkey1 FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 5808 (class 2606 OID 18273)
-- Name: company_tracking_settings company_tracking_settings_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.company_tracking_settings
    ADD CONSTRAINT company_tracking_settings_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- TOC entry 5809 (class 2606 OID 18278)
-- Name: device_tokens device_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.device_tokens
    ADD CONSTRAINT device_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 5810 (class 2606 OID 18283)
-- Name: employee_locations employee_locations_shift_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.employee_locations
    ADD CONSTRAINT employee_locations_shift_id_fkey FOREIGN KEY (shift_id) REFERENCES public.employee_shifts(id) ON DELETE CASCADE;


--
-- TOC entry 5811 (class 2606 OID 18288)
-- Name: employee_locations employee_locations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.employee_locations
    ADD CONSTRAINT employee_locations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 5812 (class 2606 OID 18293)
-- Name: employee_schedule employee_schedule_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.employee_schedule
    ADD CONSTRAINT employee_schedule_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 5813 (class 2606 OID 18298)
-- Name: employee_shifts employee_shifts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.employee_shifts
    ADD CONSTRAINT employee_shifts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 5814 (class 2606 OID 18303)
-- Name: employee_tasks employee_tasks_assigned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.employee_tasks
    ADD CONSTRAINT employee_tasks_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 5815 (class 2606 OID 18308)
-- Name: employee_tasks employee_tasks_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.employee_tasks
    ADD CONSTRAINT employee_tasks_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 5816 (class 2606 OID 18313)
-- Name: error_logs error_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.error_logs
    ADD CONSTRAINT error_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 5817 (class 2606 OID 18318)
-- Name: expenses expenses_group_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_group_admin_id_fkey FOREIGN KEY (group_admin_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 5818 (class 2606 OID 18323)
-- Name: expenses expenses_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 5819 (class 2606 OID 18555)
-- Name: expenses fk_expenses_shift; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT fk_expenses_shift FOREIGN KEY (shift_id) REFERENCES public.employee_shifts(id) ON DELETE SET NULL;


--
-- TOC entry 5820 (class 2606 OID 18328)
-- Name: geofence_events geofence_events_shift_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.geofence_events
    ADD CONSTRAINT geofence_events_shift_id_fkey FOREIGN KEY (shift_id) REFERENCES public.employee_shifts(id);


--
-- TOC entry 5821 (class 2606 OID 18333)
-- Name: geofence_events geofence_events_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.geofence_events
    ADD CONSTRAINT geofence_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- TOC entry 5822 (class 2606 OID 18338)
-- Name: group_admin_shifts group_admin_shifts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.group_admin_shifts
    ADD CONSTRAINT group_admin_shifts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 5823 (class 2606 OID 18343)
-- Name: leave_balances leave_balances_leave_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.leave_balances
    ADD CONSTRAINT leave_balances_leave_type_id_fkey FOREIGN KEY (leave_type_id) REFERENCES public.leave_types(id);


--
-- TOC entry 5824 (class 2606 OID 18348)
-- Name: leave_balances leave_balances_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.leave_balances
    ADD CONSTRAINT leave_balances_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- TOC entry 5825 (class 2606 OID 18353)
-- Name: leave_documents leave_documents_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.leave_documents
    ADD CONSTRAINT leave_documents_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.leave_requests(id) ON DELETE CASCADE;


--
-- TOC entry 5826 (class 2606 OID 18358)
-- Name: leave_policies leave_policies_leave_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.leave_policies
    ADD CONSTRAINT leave_policies_leave_type_id_fkey FOREIGN KEY (leave_type_id) REFERENCES public.leave_types(id);


--
-- TOC entry 5827 (class 2606 OID 18363)
-- Name: leave_requests leave_requests_approver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_approver_id_fkey FOREIGN KEY (approver_id) REFERENCES public.users(id);


--
-- TOC entry 5828 (class 2606 OID 18368)
-- Name: leave_requests leave_requests_group_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_group_admin_id_fkey FOREIGN KEY (group_admin_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 5829 (class 2606 OID 18373)
-- Name: leave_requests leave_requests_leave_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_leave_type_id_fkey FOREIGN KEY (leave_type_id) REFERENCES public.leave_types(id);


--
-- TOC entry 5830 (class 2606 OID 18378)
-- Name: leave_requests leave_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- TOC entry 5831 (class 2606 OID 18383)
-- Name: management_shifts management_shifts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.management_shifts
    ADD CONSTRAINT management_shifts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 5832 (class 2606 OID 18388)
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- TOC entry 5833 (class 2606 OID 18393)
-- Name: notifications notifications_user_id_fkey1; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey1 FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 5834 (class 2606 OID 18398)
-- Name: push_notifications push_notifications_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.push_notifications
    ADD CONSTRAINT push_notifications_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.notification_templates(id);


--
-- TOC entry 5835 (class 2606 OID 18403)
-- Name: push_notifications push_notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.push_notifications
    ADD CONSTRAINT push_notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 5844 (class 2606 OID 18497)
-- Name: push_receipts push_receipts_notification_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.push_receipts
    ADD CONSTRAINT push_receipts_notification_id_fkey FOREIGN KEY (notification_id) REFERENCES public.push_notifications(id) ON DELETE CASCADE;


--
-- TOC entry 5836 (class 2606 OID 18408)
-- Name: scheduled_notifications scheduled_notifications_target_group_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.scheduled_notifications
    ADD CONSTRAINT scheduled_notifications_target_group_admin_id_fkey FOREIGN KEY (target_group_admin_id) REFERENCES public.users(id);


--
-- TOC entry 5837 (class 2606 OID 18413)
-- Name: scheduled_notifications scheduled_notifications_target_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.scheduled_notifications
    ADD CONSTRAINT scheduled_notifications_target_user_id_fkey FOREIGN KEY (target_user_id) REFERENCES public.users(id);


--
-- TOC entry 5838 (class 2606 OID 18418)
-- Name: scheduled_notifications scheduled_notifications_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.scheduled_notifications
    ADD CONSTRAINT scheduled_notifications_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.notification_templates(id);


--
-- TOC entry 5839 (class 2606 OID 18423)
-- Name: support_messages support_messages_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.support_messages
    ADD CONSTRAINT support_messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 5845 (class 2606 OID 18532)
-- Name: tracking_analytics tracking_analytics_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.tracking_analytics
    ADD CONSTRAINT tracking_analytics_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 5840 (class 2606 OID 18433)
-- Name: user_tracking_permissions user_tracking_permissions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.user_tracking_permissions
    ADD CONSTRAINT user_tracking_permissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 5841 (class 2606 OID 18438)
-- Name: users users_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);


--
-- TOC entry 5842 (class 2606 OID 18443)
-- Name: users users_group_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_group_admin_id_fkey FOREIGN KEY (group_admin_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 5843 (class 2606 OID 18448)
-- Name: users users_management_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avnadmin
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_management_id_fkey FOREIGN KEY (management_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 6007 (class 0 OID 0)
-- Dependencies: 8
-- Name: SCHEMA topology; Type: ACL; Schema: -; Owner: avnadmin
--

REVOKE ALL ON SCHEMA topology FROM avnadmin;
GRANT CREATE ON SCHEMA topology TO avnadmin;
GRANT USAGE ON SCHEMA topology TO avnadmin WITH GRANT OPTION;


--
-- TOC entry 6010 (class 0 OID 0)
-- Dependencies: 225
-- Name: TABLE layer; Type: ACL; Schema: topology; Owner: postgres
--

GRANT ALL ON TABLE topology.layer TO avnadmin WITH GRANT OPTION;


--
-- TOC entry 6011 (class 0 OID 0)
-- Dependencies: 224
-- Name: TABLE topology; Type: ACL; Schema: topology; Owner: postgres
--

GRANT ALL ON TABLE topology.topology TO avnadmin WITH GRANT OPTION;


--
-- TOC entry 6039 (class 0 OID 0)
-- Dependencies: 219
-- Name: TABLE spatial_ref_sys; Type: ACL; Schema: public; Owner: postgres
--

GRANT INSERT,DELETE,UPDATE ON TABLE public.spatial_ref_sys TO avnadmin WITH GRANT OPTION;


--
-- TOC entry 6045 (class 0 OID 0)
-- Dependencies: 223
-- Name: SEQUENCE topology_id_seq; Type: ACL; Schema: topology; Owner: postgres
--

GRANT USAGE ON SEQUENCE topology.topology_id_seq TO avnadmin WITH GRANT OPTION;


-- Completed on 2025-04-24 21:39:38

--
-- PostgreSQL database dump complete
--

