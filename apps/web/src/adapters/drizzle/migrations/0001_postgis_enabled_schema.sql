CREATE TYPE "public"."alert_frequency" AS ENUM('none', 'daily', 'instant');--> statement-breakpoint
CREATE TYPE "public"."channel" AS ENUM('sale', 'rent');--> statement-breakpoint
CREATE TYPE "public"."council_tax_band" AS ENUM('A', 'B', 'C', 'D', 'E', 'F', 'G', 'H');--> statement-breakpoint
CREATE TYPE "public"."enquiry_status" AS ENUM('new', 'contacted', 'closed');--> statement-breakpoint
CREATE TYPE "public"."epc_rating" AS ENUM('A', 'B', 'C', 'D', 'E', 'F', 'G');--> statement-breakpoint
CREATE TYPE "public"."furnished" AS ENUM('furnished', 'part_furnished', 'unfurnished');--> statement-breakpoint
CREATE TYPE "public"."image_kind" AS ENUM('photo', 'floorplan', 'epc');--> statement-breakpoint
CREATE TYPE "public"."outbox_op" AS ENUM('upsert', 'delete');--> statement-breakpoint
CREATE TYPE "public"."payment_purpose" AS ENUM('subscription', 'featured_listing');--> statement-breakpoint
CREATE TYPE "public"."price_qualifier" AS ENUM('fixed', 'guide_price', 'offers_over', 'offers_in_region', 'poa');--> statement-breakpoint
CREATE TYPE "public"."property_status" AS ENUM('draft', 'pending_review', 'rejected', 'published', 'under_offer', 'completed', 'hidden', 'archived');--> statement-breakpoint
CREATE TYPE "public"."property_type" AS ENUM('detached', 'semi_detached', 'terraced', 'flat', 'bungalow', 'maisonette', 'land', 'other');--> statement-breakpoint
CREATE TYPE "public"."tenure" AS ENUM('freehold', 'leasehold', 'share_of_freehold', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('user', 'owner', 'agent', 'admin');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('active', 'suspended', 'banned');--> statement-breakpoint
CREATE TABLE "agencies" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"logo_path" text,
	"phone" text NOT NULL,
	"email" text NOT NULL,
	"website" text NOT NULL,
	"address" text NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY NOT NULL,
	"actor_id" uuid NOT NULL,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"reason" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "enquiries" (
	"id" uuid PRIMARY KEY NOT NULL,
	"property_id" uuid NOT NULL,
	"sender_id" uuid,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"message" text NOT NULL,
	"viewing_requested" boolean DEFAULT false NOT NULL,
	"status" "enquiry_status" DEFAULT 'new' NOT NULL,
	"delivered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"anon_id" text NOT NULL,
	"user_id" uuid,
	"properties" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outbox" (
	"id" uuid PRIMARY KEY NOT NULL,
	"property_id" uuid NOT NULL,
	"op" "outbox_op" NOT NULL,
	"enqueued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"agency_id" uuid,
	"purpose" "payment_purpose" NOT NULL,
	"stripe_customer_id" text NOT NULL,
	"stripe_ref" text NOT NULL,
	"amount" integer NOT NULL,
	"currency" text NOT NULL,
	"status" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- drizzle-kit auto-generated this table with the "location" column typed
-- as the quoted identifier "geography(Point,4326)" — that's wrong: quoting
-- the whole thing makes Postgres look for a type literally named
-- `geography(Point,4326)`, which doesn't exist, instead of the built-in
-- `geography` type with a `(Point,4326)` typmod. Hand-corrected to the
-- unquoted form (same fix rationale as 0000: drizzle-kit doesn't fully
-- understand PostGIS-specific DDL). Never verified against a real
-- Postgres+PostGIS instance until CI's integration job got one (PRD §8.8) —
-- this was a latent bug the whole time.
CREATE TABLE "properties" (
	"id" uuid PRIMARY KEY NOT NULL,
	"lister_id" uuid NOT NULL,
	"agency_id" uuid,
	"channel" "channel" NOT NULL,
	"status" "property_status" DEFAULT 'draft' NOT NULL,
	"property_type" "property_type" NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"description" text NOT NULL,
	"features" text[] DEFAULT '{}'::text[] NOT NULL,
	"bedrooms" smallint NOT NULL,
	"bathrooms" smallint NOT NULL,
	"price" integer NOT NULL,
	"price_qualifier" "price_qualifier" NOT NULL,
	"tenure" "tenure",
	"deposit" integer,
	"furnished" "furnished",
	"available_from" date,
	"epc_rating" "epc_rating",
	"council_tax_band" "council_tax_band",
	"new_home" boolean DEFAULT false NOT NULL,
	"address_line1" text NOT NULL,
	"display_address" text NOT NULL,
	"town" text NOT NULL,
	"outcode" text NOT NULL,
	"postcode" text NOT NULL,
	"location" geography(Point,4326) NOT NULL,
	"location_approximate" boolean DEFAULT false NOT NULL,
	"published_at" timestamp with time zone,
	"status_changed_at" timestamp with time zone,
	"rejection_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "property_images" (
	"id" uuid PRIMARY KEY NOT NULL,
	"property_id" uuid NOT NULL,
	"kind" "image_kind" NOT NULL,
	"storage_path" text NOT NULL,
	"position" smallint DEFAULT 0 NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"blurhash" text NOT NULL,
	"alt_text" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_properties" (
	"user_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "saved_properties_user_id_property_id_pk" PRIMARY KEY("user_id","property_id")
);
--> statement-breakpoint
CREATE TABLE "saved_searches" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"criteria" jsonb NOT NULL,
	"alert_frequency" "alert_frequency" DEFAULT 'none' NOT NULL,
	"last_alerted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"firebase_uid" text NOT NULL,
	"email" "citext" NOT NULL,
	"display_name" text NOT NULL,
	"phone" text,
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"agency_id" uuid,
	"status" "user_status" DEFAULT 'active' NOT NULL,
	"last_seen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outbox" ADD CONSTRAINT "outbox_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_agency_id_agencies_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_lister_id_users_id_fk" FOREIGN KEY ("lister_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_agency_id_agencies_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_images" ADD CONSTRAINT "property_images_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_properties" ADD CONSTRAINT "saved_properties_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_properties" ADD CONSTRAINT "saved_properties_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_searches" ADD CONSTRAINT "saved_searches_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_agency_id_agencies_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "agencies_slug_idx" ON "agencies" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "enquiries_property_id_idx" ON "enquiries" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "outbox_unprocessed_idx" ON "outbox" USING btree ("processed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "properties_slug_idx" ON "properties" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "properties_location_gist_idx" ON "properties" USING gist ("location");--> statement-breakpoint
CREATE INDEX "properties_status_channel_price_idx" ON "properties" USING btree ("status","channel","price");--> statement-breakpoint
CREATE INDEX "properties_agency_status_idx" ON "properties" USING btree ("agency_id","status");--> statement-breakpoint
CREATE INDEX "properties_lister_status_idx" ON "properties" USING btree ("lister_id","status");--> statement-breakpoint
CREATE INDEX "properties_town_status_idx" ON "properties" USING btree ("town","status");--> statement-breakpoint
CREATE INDEX "property_images_property_id_idx" ON "property_images" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "saved_searches_user_id_idx" ON "saved_searches" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_firebase_uid_idx" ON "users" USING btree ("firebase_uid");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");