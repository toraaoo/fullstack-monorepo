CREATE TABLE "example_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "example_categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "example_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" uuid NOT NULL,
	"reference" text NOT NULL,
	"title" text NOT NULL,
	"owner_email" text NOT NULL,
	"secret" text,
	"token" text,
	"metadata" jsonb,
	"published_at" timestamp with time zone,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "example_items_reference_unique" UNIQUE("reference")
);
--> statement-breakpoint
ALTER TABLE "example_items" ADD CONSTRAINT "example_items_category_id_example_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."example_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "example_items_category_id_idx" ON "example_items" USING btree ("category_id");