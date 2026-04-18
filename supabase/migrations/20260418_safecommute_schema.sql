ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role text DEFAULT 'parent';

CREATE TABLE IF NOT EXISTS child_journeys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_name text NOT NULL DEFAULT 'Child',
  route_id text NOT NULL DEFAULT 'route_1',
  origin_stop text NOT NULL DEFAULT 'Central Station',
  destination_stop text NOT NULL DEFAULT 'Bondi Junction',
  departure_time timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS live_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id uuid REFERENCES child_journeys(id) ON DELETE CASCADE,
  current_state text NOT NULL DEFAULT 'WAITING',
  child_lat double precision,
  child_lon double precision,
  vehicle_lat double precision,
  vehicle_lon double precision,
  eta_minutes integer,
  updated_at timestamptz DEFAULT now()
);

INSERT INTO child_journeys (child_name, route_id, origin_stop, destination_stop)
VALUES ('Alex', 'route_1', 'Central Station', 'Bondi Junction')
ON CONFLICT DO NOTHING;
